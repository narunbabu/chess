# Payment Flow — Chess99

_Last updated: 2026-02-20_

---

## 1. Plan definitions

### Tiers (backend: `App\Enums\SubscriptionTier`)

| Value | Level | Description |
|-------|-------|-------------|
| `free` | 0 | Default for all users |
| `standard` | 1 | Mid-tier paid plan |
| `premium` | 2 | Top-tier paid plan |

### Intervals

`monthly` · `yearly` · `lifetime` (free tier only)

### How plans are stored

Plans live in the `subscription_plans` table. Each row has:
- `tier` (`free` / `standard` / `premium`)
- `interval` (`lifetime` / `monthly` / `yearly`)
- `price` — amount in INR
- `razorpay_plan_id` — the Razorpay plan ID (populated via artisan command, see §4)

Plans are seeded on first migration. The Razorpay plan IDs are written by:

```bash
php artisan razorpay:create-plans
```

This reads the five `RAZORPAY_PLAN_*` env vars and writes them into the matching rows.

---

## 2. Subscription checkout flow (frontend → backend)

```
User clicks "Subscribe" on PricingPage
        │
        ▼
PricingCard.onSubscribe(planId, tier, interval)
        │
        ├─ planId is null (API unavailable, fallback UI)?
        │       └─ store { tier, interval } as pendingIntent
        │          call fetchPlans()
        │          useEffect fires when hasApiPlans → setCheckoutPlanId(matched real id)
        │
        └─ planId exists
                └─ setCheckoutPlanId(planId)
                        │
                        ▼
                <RazorpayCheckout planId={checkoutPlanId}>
                        │
                        ├─ POST /api/subscriptions/checkout { plan_id }
                        │       backend creates SubscriptionPayment (status: pending)
                        │       calls SubscriptionService::initiateCheckout()
                        │
                        ├─ mock mode (RAZORPAY_MOCK_MODE=true)?
                        │       └─ backend auto-completes payment, returns { auto_completed: true }
                        │
                        └─ production mode
                                └─ backend creates Razorpay customer (if none) + subscription
                                   returns { checkout.subscription_id, checkout.key_id }
                                   frontend opens Razorpay modal (rzp.open())
```

### Post-login resume

If the user is unauthenticated when they click Subscribe, `PricingPage` saves the intent to
`localStorage` then redirects to `/login`:

| localStorage key | Content |
|-----------------|---------|
| `pending_plan_id` | integer plan ID (when real API plan was shown) |
| `pending_plan_tier` | `standard` / `premium` (when fallback plan was shown) |
| `pending_plan_interval` | `monthly` / `yearly` |

After login, a `useEffect` on `isAuthenticated` clears these keys and resumes checkout automatically.

---

## 3. Payment verification

### Webhook (primary path — production)

`POST /api/subscriptions/webhook` — no auth required, but signature-verified:

```
X-Razorpay-Signature: <HMAC-SHA256 of raw body using RAZORPAY_WEBHOOK_SECRET>
```

Handled events:

| Razorpay event | Action |
|----------------|--------|
| `subscription.authenticated` | Logged only |
| `subscription.activated` | Mark `SubscriptionPayment` completed; grant tier on `users` |
| `subscription.charged` | Record renewal payment; extend `subscription_expires_at` |
| `subscription.cancelled` | Set `subscription_auto_renew = false` |
| `subscription.halted` | Log warning; subscription remains active until expiry |

The controller **always returns `200 { status: ok }`** regardless of processing outcome, to prevent Razorpay webhook retries from duplicating work.

Idempotency: before activating, the handler checks if a `SubscriptionPayment` with the same `razorpay_payment_id` already exists and skips processing if so.

### Frontend callback (secondary / mock path)

After the user completes the Razorpay modal, the `handler.payment.success` callback in `RazorpayCheckout.jsx` polls `GET /api/subscriptions/current` every 2 seconds (up to 10 attempts) waiting for the webhook to flip the status to `completed`. This covers the race between the modal closing and the webhook arriving.

In **mock mode**, the backend auto-completes the payment inside the checkout response, so no polling is needed.

---

## 4. Required environment variables (production)

Add these to `.env` on the VPS before going live:

```env
# Razorpay API credentials (from Razorpay dashboard → Settings → API Keys)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=<live secret key>

# Webhook secret (from Razorpay dashboard → Webhooks → your endpoint → Secret)
RAZORPAY_WEBHOOK_SECRET=<webhook secret>

# Disable mock mode
RAZORPAY_MOCK_MODE=false

# Razorpay plan IDs — create plans in Razorpay dashboard first, then paste IDs here
RAZORPAY_PLAN_STANDARD_MONTHLY=plan_XXXXXXXXX
RAZORPAY_PLAN_STANDARD_YEARLY=plan_XXXXXXXXX
RAZORPAY_PLAN_PREMIUM_MONTHLY=plan_XXXXXXXXX
RAZORPAY_PLAN_PREMIUM_YEARLY=plan_XXXXXXXXX
```

After updating `.env`, run:

```bash
php artisan razorpay:create-plans   # writes plan IDs into subscription_plans table
php artisan config:clear            # clear config cache
```

**Webhook URL to register in Razorpay dashboard:**
```
https://api.chess99.com/api/subscriptions/webhook
```
Events to subscribe: `subscription.authenticated`, `subscription.activated`,
`subscription.charged`, `subscription.cancelled`, `subscription.halted`

---

## 5. Tournament entry-fee state machine (`ChampionshipParticipant`)

Tournament registrations use a separate payment flow (one-time order, not subscription) with its own state machine enforced by `App\Exceptions\InvalidStateTransitionException`.

### State graph

```
                    ┌─────────────────────┐
                    │       pending        │◄──────────────┐
                    └──────────┬──────────┘               │
                               │                          │ retry
              ┌────────────────┴──────────────┐           │
              ▼                               ▼           │
        ┌──────────┐                    ┌──────────┐      │
        │completed │                    │  failed  │──────┘
        └─────┬────┘                    └──────────┘
              │ refund
              ▼
        ┌──────────┐
        │ refunded │  ← terminal, no further transitions
        └──────────┘
```

### Allowed transitions

| From | To | Trigger |
|------|----|---------|
| `pending` | `completed` | Razorpay `payment.captured` webhook / `markAsPaid()` |
| `pending` | `failed` | Razorpay failure / `markAsFailed()` |
| `completed` | `refunded` | Refund issued / `markAsRefunded()` |
| `failed` | `pending` | User retries payment / `transitionTo(PENDING)` |

All transitions use `SELECT FOR UPDATE` inside `DB::transaction` to prevent concurrent webhook
deliveries from producing inconsistent states.

If Razorpay order creation fails after the `pending` row is committed, the row is deleted in a
cleanup transaction so the user can re-register without hitting the unique constraint.

### Duplicate registration HTTP response

- Already registered → **409 Conflict** (`ALREADY_REGISTERED`)
- Registration not open / championship full → **422 Unprocessable Entity**
- Razorpay order creation failure → **502 Bad Gateway** (no orphan row left)
