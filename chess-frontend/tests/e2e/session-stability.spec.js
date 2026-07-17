// S16 — Web session stability
//
// Root-caused (2026-07-15, docs/specs/2026-07-14-quality-fix-program/S16-web-session-stability.md):
// repeated full-page navigation to authenticated routes intermittently
// bounced to a logged-out guard despite a valid stored token, because of
// three compounding bugs:
//   1. AuthContext.fetchUser() cleared auth_token on ANY fetch error, not
//      just a genuine 401 (network flakes/timeouts/5xx = logged out for real)
//   2. The global axios 401 interceptor hard-redirected via
//      window.location.href on any single 401 from parallel boot-time calls,
//      even on public pages
//   3. Per-page redirects (e.g. BecomeAmbassador) didn't wait for AuthContext
//      hydration before redirecting on a still-null `user`
//
// This spec verifies the fix: hard-navigating between authenticated and
// public routes repeatedly never bounces to /login and never drops the
// stored token, and a single aborted/failed GET /user survives without
// clearing the token.
const { test, expect } = require('@playwright/test');

const TEST_EMAIL = process.env.CHESS99_TEST_EMAIL || process.env.TEST_EMAIL || 'ab@ameyem.com';
const TEST_PASSWORD = process.env.CHESS99_TEST_PASSWORD || process.env.TEST_PASSWORD || 'Vedansh@123';

const NAV_SEQUENCE = ['/dashboard', '/profile', '/friends', '/privacy', '/terms', '/dashboard'];
const ITERATIONS = 10;

async function loginAs(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  // Login page defaults to a social-button view; reveal the email form if present.
  const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
  if (await emailLink.count() > 0 && await emailLink.first().isVisible().catch(() => false)) {
    await emailLink.first().click();
    await page.waitForTimeout(500);
  }

  await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
  await page.locator('input[type="password"], input[placeholder="Password"]').first().fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').first().click();

  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) {
    test.skip(true, 'Login did not produce an auth_token — backend auth is unavailable in this environment.');
  }
  return token;
}

test.describe('S16 — Session stability across hard navigation', { timeout: 5 * 60 * 1000 }, () => {
  test.setTimeout(5 * 60 * 1000);

  test('10x hard-navigation loop across authenticated + public routes never bounces to /login and keeps auth_token', async ({ page }) => {
    await loginAs(page);

    for (let i = 0; i < ITERATIONS; i++) {
      for (const path of NAV_SEQUENCE) {
        // Hard navigation (page.goto, not client-side <Link>/navigate) — this
        // is exactly the scenario that used to intermittently lose the
        // session, since every hard load re-mounts AuthContext from scratch
        // and races GET /user against every other boot-time provider call.
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(400);

        const url = page.url();
        expect(url, `iteration ${i + 1}, path ${path}: bounced to /login`).not.toContain('/login');

        const token = await page.evaluate(() => localStorage.getItem('auth_token'));
        expect(token, `iteration ${i + 1}, path ${path}: auth_token was cleared`).toBeTruthy();
      }
    }
  });

  test('public pages (/privacy, /terms) never redirect a logged-out visitor to /login', async ({ page }) => {
    // No login at all — simulate a logged-out visitor landing directly on a
    // public page. Prior to the fix, background provider calls (Subscription/
    // Entitlement/AppData/presence) firing on every mount could still 401 and
    // trigger the old hard-redirect interceptor even with no session to lose.
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      expect(page.url(), `${path}: logged-out visitor was redirected to /login`).not.toContain('/login');
    }
  });

  test('a single aborted GET /user does not clear auth_token', async ({ page }) => {
    const token = await loginAs(page);

    // Simulate one failed/aborted GET /user (network error / timeout class of
    // failure) on the NEXT hard navigation. Before the T1 fix, AuthContext's
    // fetchUser() catch block cleared auth_token on ANY error here, not just
    // a genuine 401 — this is the exact regression this test guards against.
    let aborted = false;
    await page.route('**/api/user', (route) => {
      if (!aborted) {
        aborted = true;
        return route.abort('failed');
      }
      return route.continue();
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // The token must survive the aborted request — AuthContext should keep
    // it (and retry in the background) rather than treating a network error
    // as an invalid session.
    const tokenAfterAbort = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfterAbort, 'auth_token was cleared after a non-401 GET /user failure').toBe(token);
    expect(page.url(), 'aborted GET /user bounced the visitor to /login').not.toContain('/login');
  });
});
