/**
 * Playwright E2E tests for the Pricing page and Razorpay checkout flow.
 *
 * Covers:
 *  1. Three tier cards (Free / Silver / Gold) render with correct prices
 *  2. Clicking Subscribe on a paid card opens the RazorpayCheckout overlay
 *  3. Mock-mode full flow: create-order → verify-payment → "Subscription Activated!"
 *  4. Unauthenticated users are redirected to /login when clicking Subscribe
 *  5. Already-subscribed users see "Current Plan" badge and disabled button
 *
 * All backend calls are intercepted via page.route() so no live server is required.
 * Auth is simulated via localStorage + mocked GET /api/user endpoint.
 */

const { test, expect } = require('@playwright/test');

// ── Constants ──────────────────────────────────────────────────────────────

const FAKE_TOKEN = 'test_token_pricing_e2e_123';

const MOCK_PLANS = {
  free: [{
    id: 1, tier: 'free', name: 'Free', interval: 'lifetime', price: 0,
    features: ['Play vs computer', '5 games/day online'],
  }],
  silver: [
    { id: 2, tier: 'silver', name: 'Silver Monthly', interval: 'monthly', price: 99,
      features: ['Unlimited games', 'All tournaments'] },
    { id: 3, tier: 'silver', name: 'Silver Yearly', interval: 'yearly', price: 999,
      features: ['Unlimited games', 'All tournaments'] },
  ],
  gold: [
    { id: 4, tier: 'gold', name: 'Gold Monthly', interval: 'monthly', price: 499,
      features: ['Everything in Silver', 'Priority support'] },
    { id: 5, tier: 'gold', name: 'Gold Yearly', interval: 'yearly', price: 4999,
      features: ['Everything in Silver', 'Priority support'] },
  ],
};

const MOCK_USER_FREE   = { id: 1, name: 'Test User', email: 'test@chess99.com', subscription_tier: 'free' };
const MOCK_USER_SILVER = { id: 1, name: 'Test User', email: 'test@chess99.com', subscription_tier: 'silver' };

const MOCK_SUB_FREE   = { tier: 'free',   status: 'active', expires_at: null };
const MOCK_SUB_SILVER = { tier: 'silver', status: 'active', expires_at: '2027-02-21T00:00:00Z' };

const MOCK_ORDER_SILVER = {
  order_id: 'order_mock_silver_abc123',
  key_id:   'rzp_test_mock',
  amount:   9900,
  currency: 'INR',
  mock_mode: true,
  plan: { name: 'Silver Monthly' },
  prefill: { name: 'Test User', email: 'test@chess99.com' },
};

const MOCK_VERIFY_SUCCESS = {
  success:    true,
  message:    'Subscription activated successfully',
  tier:       'silver',
  tier_label: 'Silver',
  expires_at: '2027-02-21T00:00:00Z',
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Catch-all safety net: intercepts ANY /api/** call that isn't handled by a
 * more-specific route and returns an empty 200 instead of hitting the real
 * backend with a fake token.
 *
 * MUST be registered FIRST in each test because Playwright resolves routes
 * LIFO (last registered = highest priority), so any route registered after
 * this one will take precedence for its specific URL pattern.
 */
async function setupApiCatchAll(page) {
  await page.route('**/api/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}

/** Injects a fake auth token into localStorage before page scripts run. */
async function injectAuthToken(page) {
  await page.addInitScript((token) => {
    localStorage.setItem('auth_token', token);
  }, FAKE_TOKEN);
}

/** Mocks GET /api/user to return the given user object (or 401 if null). */
async function mockUserEndpoint(page, user) {
  if (user) {
    await page.route('**/api/user', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      })
    );
  } else {
    await page.route('**/api/user', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthenticated.' }),
      })
    );
  }
}

/** Mocks GET /api/subscriptions/plans. */
async function mockPlansEndpoint(page) {
  await page.route('**/api/subscriptions/plans', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plans: MOCK_PLANS, mock_mode: true }),
    })
  );
}

/**
 * Mocks GET /api/subscriptions/current.
 * Returns `initialSub`, but switches to `activatedSub` once the flag is set.
 * Call `setActivated()` from the verify-payment mock to flip the state.
 */
async function mockCurrentSubscriptionEndpoint(page, initialSub, activatedSub = null) {
  let activated = false;
  const setActivated = () => { activated = true; };

  await page.route('**/api/subscriptions/current', route => {
    const sub = (activated && activatedSub) ? activatedSub : initialSub;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sub),
    });
  });

  return setActivated;
}

// ── Test Suite ─────────────────────────────────────────────────────────────

test.describe('Pricing Page & Checkout Flow', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 1. Three tier cards render ───────────────────────────────────────────

  test('renders Free / Silver / Gold cards with correct prices', async ({ page }) => {
    await setupApiCatchAll(page);
    await mockPlansEndpoint(page);
    await mockCurrentSubscriptionEndpoint(page, MOCK_SUB_FREE);
    // No auth needed — plans endpoint is public

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pricing-card', { timeout: 10000 });

    // Three cards total
    const cards = page.locator('.pricing-card');
    await expect(cards).toHaveCount(3);

    // Tier name labels
    const tierLabels = page.locator('.pricing-card__tier');
    await expect(tierLabels.nth(0)).toHaveText(/free/i);
    await expect(tierLabels.nth(1)).toHaveText(/silver/i);
    await expect(tierLabels.nth(2)).toHaveText(/gold/i);

    // Prices (monthly toggle is default)
    await expect(cards.nth(0).locator('.pricing-card__amount')).toHaveText('Free');
    await expect(cards.nth(1).locator('.pricing-card__amount')).toHaveText('99');
    await expect(cards.nth(2).locator('.pricing-card__amount')).toHaveText('499');

    // Silver should show "Most Popular" badge
    await expect(cards.nth(1).locator('.pricing-card__popular-badge')).toBeVisible();

    // Yearly toggle switches to annual prices
    await page.locator('.pricing-page__toggle-btn:has-text("Yearly")').click();
    await page.waitForTimeout(300);
    await expect(cards.nth(1).locator('.pricing-card__amount')).toHaveText('999');
    await expect(cards.nth(2).locator('.pricing-card__amount')).toHaveText('4999');
  });

  // ── 2. Clicking Subscribe opens checkout overlay ─────────────────────────

  test('clicking Subscribe on Silver or Gold opens the checkout overlay', async ({ page }) => {
    await setupApiCatchAll(page);
    await injectAuthToken(page);
    await mockUserEndpoint(page, MOCK_USER_FREE);
    await mockPlansEndpoint(page);
    await mockCurrentSubscriptionEndpoint(page, MOCK_SUB_FREE);

    // Stub both checkout API calls — mock mode fires them automatically
    await page.route('**/api/subscriptions/create-order', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDER_SILVER),
      })
    );
    await page.route('**/api/subscriptions/verify-payment', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VERIFY_SUCCESS),
      })
    );

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pricing-card', { timeout: 10000 });

    // ── Silver ──
    const silverCard = page.locator('.pricing-card').nth(1);
    await silverCard.locator('.pricing-card__btn--subscribe').click();
    await expect(page.locator('.razorpay-checkout-overlay')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.razorpay-checkout-modal')).toBeVisible();

    // Mock mode auto-completes: wait for overlay to self-dismiss (success state + 1.5s delay)
    await expect(page.locator('.razorpay-checkout-overlay')).not.toBeVisible({ timeout: 10000 });

    // ── Gold ──
    // After onSuccess fires, fetchCurrentSubscription() briefly sets loading=true.
    // Wait for Gold's button to re-enable before attempting the click.
    const goldCard = page.locator('.pricing-card').nth(2);
    await expect(goldCard.locator('.pricing-card__btn--subscribe')).toBeEnabled({ timeout: 5000 });
    await goldCard.locator('.pricing-card__btn--subscribe').click();
    await expect(page.locator('.razorpay-checkout-overlay')).toBeVisible({ timeout: 8000 });
  });

  // ── 3. Mock-mode full checkout flow ──────────────────────────────────────

  test('mock mode: create-order → verify-payment → Subscription Activated!', async ({ page }) => {
    await setupApiCatchAll(page);
    await injectAuthToken(page);
    await mockUserEndpoint(page, MOCK_USER_FREE);
    await mockPlansEndpoint(page);

    // Subscription starts free, upgrades to silver after verify
    const setActivated = await mockCurrentSubscriptionEndpoint(page, MOCK_SUB_FREE, MOCK_SUB_SILVER);

    await page.route('**/api/subscriptions/create-order', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDER_SILVER), // mock_mode: true → frontend skips SDK
      })
    );

    await page.route('**/api/subscriptions/verify-payment', route => {
      setActivated(); // next /current call returns silver tier
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VERIFY_SUCCESS),
      });
    });

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pricing-card', { timeout: 10000 });

    // Click Subscribe on Silver
    const silverCard = page.locator('.pricing-card').nth(1);
    await silverCard.locator('.pricing-card__btn--subscribe').click();

    // Overlay should appear
    await expect(page.locator('.razorpay-checkout-overlay')).toBeVisible({ timeout: 8000 });

    // In mock mode, the frontend bypasses the Razorpay SDK and goes straight to verify.
    // The success state should appear without any user interaction.
    await expect(page.locator('.razorpay-checkout__checkmark')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('.razorpay-checkout__step--success')).toBeVisible();
    await expect(page.locator('.razorpay-checkout__step--success'))
      .toContainText('Subscription Activated');
  });

  // ── 4. Unauthenticated → redirect to /login ───────────────────────────────

  test('unauthenticated: clicking Subscribe redirects to /login', async ({ page }) => {
    await setupApiCatchAll(page);
    // No auth_token injected → AuthContext will skip fetchUser, isAuthenticated stays false
    await mockPlansEndpoint(page);
    await mockCurrentSubscriptionEndpoint(page, MOCK_SUB_FREE);

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pricing-card', { timeout: 10000 });

    // Cards should still be visible (page renders with fallback/mock plans)
    await expect(page.locator('.pricing-card')).toHaveCount(3);

    // Subscribe buttons should be present (not replaced — redirect happens on click)
    const silverCard = page.locator('.pricing-card').nth(1);
    await expect(silverCard.locator('.pricing-card__btn--subscribe')).toBeVisible();

    // Clicking Subscribe while unauthenticated should navigate to /login
    await silverCard.locator('.pricing-card__btn--subscribe').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  // ── 5. Subscribed user sees "Current Plan" badge ──────────────────────────

  test('silver subscriber sees "Current Plan" badge and disabled button', async ({ page }) => {
    await setupApiCatchAll(page);
    await injectAuthToken(page);
    await mockUserEndpoint(page, MOCK_USER_SILVER);
    await mockPlansEndpoint(page);
    await mockCurrentSubscriptionEndpoint(page, MOCK_SUB_SILVER);

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.pricing-card', { timeout: 10000 });

    // Wait for subscription context to hydrate
    await page.waitForTimeout(1000);

    const silverCard = page.locator('.pricing-card').nth(1);

    // "Current Plan" badge should be visible on Silver
    await expect(silverCard.locator('.pricing-card__current-badge')).toBeVisible();

    // Button should show "Current Plan" and be disabled (not "Subscribe")
    await expect(silverCard.locator('.pricing-card__btn--current')).toBeVisible();
    await expect(silverCard.locator('.pricing-card__btn--current')).toBeDisabled();
    await expect(silverCard.locator('.pricing-card__btn--subscribe')).not.toBeVisible();

    // Free card should still have its "Play Now" button
    const freeCard = page.locator('.pricing-card').nth(0);
    await expect(freeCard.locator('.pricing-card__btn--free')).toBeVisible();

    // Gold card should still have a Subscribe button (upgrade path)
    const goldCard = page.locator('.pricing-card').nth(2);
    await expect(goldCard.locator('.pricing-card__btn--subscribe')).toBeVisible();
  });
});
