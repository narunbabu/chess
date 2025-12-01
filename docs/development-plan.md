Below is a “full-circle” product-and-tech playbook you can treat as a living roadmap.  Use it to layer the new credit economy, sharing hooks, competitions, and payments on top of the React + Laravel stack you already have.

---

## 1.  North-Star UX in One Sentence

> *“A visitor can play a quick game instantly, share the highlight as a GIF/video, then realise they can rack-up credits, battle stronger AIs & live opponents, and win bigger prizes by joining tournaments.”*

Keep every decision anchored to that experience.

---

## 2.  End-to-End User Journey

| Phase           | Visitor                                                                             | Logged-in Newbie (free credits)                               | Seasoned Player                                               |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| **Discover**    | Lands on `/` → clicks **Play as Guest**                                             | Email/Social sign-up splash includes 100 free credits ↑       | Push-/email notifications (“100-credit rapid blitz tonight!”) |
| **Play**        | Plays vs Stockfish (fixed depth = 2)                                                | Chooses depth (cost scales) or “Play vs LLM Bot”              | Joins paid arena or challenges friends                        |
| **Post-game**   | • Share GIF/MP4 <br>• Prompt: “Save this game + earn 100 credits”                   | • Earn/win credits <br>• Replay, annotate, or rematch         | • Leaderboard, badges, streaks, rating graph                  |
| **Economy**     | –                                                                                   | • Wallet visible in header <br>• CTA “Top-up / Invite friend” | • Auto top-up when < X credits <br>• Subscription bundles     |
| **Social Loop** | Invite link = `?ref=ABC123` adds 25 credits to both sides once the friend registers | Share tournament bracket or puzzle of the day                 | Streams to Twitch/YouTube, referral code in overlay           |

---

## 3.  Credit Economy Design

| Action                   | **Cost (credits)** | **Reward (credits)**       | Notes                                                     |
| ------------------------ | ------------------ | -------------------------- | --------------------------------------------------------- |
| Vs Stockfish depth 1–3   | `1 + depth`        | Win = stake × 1.5          | Keeps low-stakes fun                                      |
| Vs LLM bot (O3, Sonnet…) | `model_cost × 1.2` | Win = stake × 2            | Map 1 credit ≈ ₹1; update multiplier when API prices move |
| Ranked PvP (entry)       | 5                  | Win = 10                   | Uses Elo+credits matchmaking                              |
| Daily puzzle streak      | –                  | `1 + streak/3`             | Free drip to bring them back                              |
| Refer a friend           | –                  | 25 each on first top-up    | Viral growth                                              |
| Tournament entry         | 20 – 100           | Prize pool 80 % to winners | Remaining 20 % is platform fee                            |

> **Tip:** Store every credit delta in a `wallet_transactions` table with **immutable** rows for audit & leaderboards.

---

## 4.  Engagement & Retention Loops

1. **Daily “Chess Quest”**

   * Example: *“Win a game with a knight fork”* → badge + 10 credits.
   * Push/E-mail at local 8 PM with personalised quest based on past games.

2. **Streak Meter** – Visible under avatar; resets if no game in 48 h.

3. **Skill Progress Bars** – Completion % of openings, tactics themes.

4. **Season Pass (optional)** – ₹499 gives 1 month of unlimited depth-16 games + unique board themes.

5. **Community Tournaments**

   * Auto-generated Swiss events every 3 hours (15 min rounds).
   * Shareable bracket image + live leaderboard.

---

## 5.  Share-to-Earn Flow

1. **Client** already renders GIF/WebM. When “Share” clicked:

   * Upload to S3 → get public URL.
   * Append `?r=<refCode>&g=<compressedGameId>` so clicks land on a **spectator page** with a **“Play your own”** CTA.

2. **Backend endpoint:** `/share-track` increments a soft metric; if visitor registers within 24 h ⇒ reward sender/referrer.

3. **One-tap share targets:** WhatsApp (deep-link), Telegram, X/Twitter, Facebook, Email.

---

## 6.  Payment & Subscription

| Stack layer | Recommendation                                              | Reason                                      |
| ----------- | ----------------------------------------------------------- | ------------------------------------------- |
| Gateway     | **Razorpay** (India) + Stripe for intl.                     | UPI, cards, subscriptions, good Laravel SDK |
| Compliance  | Use Razorpay Subscriptions → auto debit (RBI e-mandate)     | No manual renewals                          |
| Webhooks    | `/payments/webhook` verifies signature, credits wallet      | Idempotent updates                          |
| Taxes       | Include GST (18 %) on invoices, download CSV from dashboard | Consult CA                                  |

---

## 7.  Technical Architecture Add-ons

### 7.1  Database (Laravel MySQL / Postgres)

* `users` – add `credits INT DEFAULT 0`, `ref_code CHAR(8)`
* `wallet_transactions` – id, user\_id, delta (+/-), reason ENUM, source\_game\_id, json\_meta, created\_at
* `games` – add `share_token`, `gif_url`, `video_url`
* `tournaments` + `tournament_entries`
* `pvp_matches` (websocket room id, fen\_stream, result, stake, etc.)

### 7.2  API / Services

| Endpoint                | Description                                  |
| ----------------------- | -------------------------------------------- |
| `POST /wallet/transfer` | Internal credit moves (win, quest, referral) |
| `POST /wallet/purchase` | Called after payment success                 |
| `POST /llm-move`        | Proxy to chosen model, charge credits        |
| `GET /tournaments/live` | List & websocket signatures                  |
| `POST /games/:id/share` | Generates media, returns signed urls         |

> **Security:** protect credit-changing routes with Laravel Sanctum tokens; also create an admin panel for manual adjustments & refunds.

### 7.3  Real-time Stack

* **Laravel Echo + Redis + Socket.IO** (or Pusher) for live PvP and tourneys.
* Store PGN moves in Redis channel, persist every N moves → MySQL.

### 7.4  LLM Opponents

* Micro-service (`python FastAPI`) that abstracts *providers* (OpenAI, Perplexity, DeepSeek).
* Input: FEN + PGN; Output: SAN move + evaluation.
* Each call returns reported “token cost” → charge user credits with 20 % margin.

---

## 8.  Competition Operations Playbook

| Timeline      | Task                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| **T-4 weeks** | Announce season theme, hire streamer, secure sponsors.                            |
| **T-1 week**  | Open registration (20 credits / player).                                          |
| **Game-day**  | Stream finals on YouTube with commentator; overlay leaderboard (your share link). |
| **Post**      | Auto e-mail highlight GIFs to all entrants → encourage social posting.            |

---

## 9.  Marketing & Analytics

* **Amplitude/Mixpanel** to track funnel: guest → first win → registration → purchase.
* **Segment** to fan-out events (e-mail, push, ads).
* **Referral dashboard**: top inviters, total new credits issued, CAC.

---

## 10.  Roll-out Milestones

| Sprint (2 w each)          | Deliverable                                                 |
| -------------------------- | ----------------------------------------------------------- |
| **1. Guest-play MVP**      | Anonymous play, share GIF, soft prompt to sign-up.          |
| **2. Auth & Wallet**       | Social login, free credits, credit deductions vs Stockfish. |
| **3. Payments**            | Razorpay integration, top-up screen, webhook.               |
| **4. PvP Alpha**           | Websocket rooms, stake handling, simple leaderboard.        |
| **5. LLM Bots**            | Proxy micro-service, pricing table per model depth.         |
| **6. Quests & Referral**   | Daily quest scheduler (Laravel Cron), ref links.            |
| **7. Season 1 Tournament** | UI, bracket logic, payouts, marketing push.                 |

---

### Immediate Next Steps (this week)

1. **Schema update** – add `credits` & `wallet_transactions`.
2. **Guest cookie** – generate temp UUID to track pre-sign-up games.
3. **Reward Pop-up** – after each guest game: “Save + 100 credits”.
4. **Credit middleware** – before hitting `/play` versus LLM or PvP, assert balance.
5. **Razorpay sandbox** – create key, wire test purchase → add 500 credits.

---

Use this as a modular guide: ship smallest usable slice first, observe metrics, and iterate.  When you’re ready for detailed schema migrations, UI mock-ups, or payment-gateway code stubs, just let me know and we’ll dive in!
