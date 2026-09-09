// @ts-check
const { test, expect } = require('@playwright/test');

const FRONTEND_URL = process.env.BASE_URL || 'http://localhost:3000';
const BACKEND_API = process.env.BACKEND_API_URL || 'http://localhost:8000/api';

const TEST_EMAIL = process.env.CHESS99_TEST_EMAIL || 'ab@ameyem.com';
const TEST_PASSWORD = process.env.CHESS99_TEST_PASSWORD || 'Vedansh@123';

async function loginAs(page) {
  await page.goto(FRONTEND_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Click "Use email instead" to reveal email/password form
  const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
  if (await emailLink.count() > 0) {
    await emailLink.first().click();
    await page.waitForTimeout(1000);
  }

  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"], input[placeholder="Password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {
    console.log('⚠️ No redirect to dashboard after login');
  });
  await page.waitForTimeout(3000);

  if (!page.url().includes('/dashboard')) {
    await page.goto(FRONTEND_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  }
  await page.waitForTimeout(3000);
}

/**
 * Fetch the canonical streak straight from the API using the session token,
 * so the test asserts the UI matches the single source of truth rather than
 * guessing at today's streak value.
 */
async function fetchCurrentStreak(page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (!token) throw new Error('No auth_token in localStorage after login');

  const response = await page.request.get(`${BACKEND_API}/user`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok()) {
    throw new Error(`GET /user failed: ${response.status()}`);
  }
  const user = await response.json();
  return {
    streak: user.current_streak_days ?? 0,
    longest: user.longest_streak_days ?? 0,
  };
}

/**
 * Credit a real qualifying activity so today has a streak even when the
 * account was inactive: a training drill attempt credits on ANY submission
 * (wrong is fine). Falls back to a solved tactical puzzle if the free-tier
 * daily drill cap is exhausted.
 */
async function ensureStreakToday(page) {
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const drillsResponse = await page.request.get(`${BACKEND_API}/v1/training/drills`, { headers });
  if (drillsResponse.ok()) {
    const body = await drillsResponse.json();
    const drill = (body.data?.drills || []).find((d) => !d.is_locked && d.position_fen);
    if (drill) {
      const attempt = await page.request.post(
        `${BACKEND_API}/v1/training/drills/${drill.slug}/attempt`,
        { headers, data: { solution: ['Kd2'], time_spent_seconds: 5 } }
      );
      if (attempt.ok()) {
        console.log(`✅ Credited today's streak via drill attempt (${drill.slug})`);
        return;
      }
      console.log(`⚠️ Drill attempt failed: ${attempt.status()}`);
    }
  }

  const tactical = await page.request.post(`${BACKEND_API}/v1/tactical/attempts`, {
    headers,
    data: { stage_id: 0, puzzle_id: 'e2e-streak-check', success: true },
  });
  if (!tactical.ok()) {
    throw new Error(`Could not credit a streak day: ${tactical.status()}`);
  }
  console.log('✅ Credited today\'s streak via solved tactical puzzle');
}

test.describe('Streak header (Feature B)', { timeout: 90000 }, () => {
  test.setTimeout(90000);

  test('guest header shows no streak badge anywhere', async ({ page }) => {
    await page.goto(FRONTEND_URL + '/lobby', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);

    // No 🔥 badge in the header, and definitely no "🔥 0"
    await expect(page.locator('.header-streak-badge')).toHaveCount(0);
    await expect(page.locator('.nav-user-streak')).toHaveCount(0);
    const headerText = await page.locator('.app-header').innerText().catch(() => '');
    expect(headerText).not.toContain('🔥');
    console.log('✅ Guest header renders no streak UI');
  });

  test('header shows the canonical streak from GET /user', async ({ page }) => {
    await loginAs(page);
    let { streak, longest } = await fetchCurrentStreak(page);
    console.log(`📍 API streak: current=${streak}, longest=${longest}`);

    if (streak === 0) {
      // Credit a real qualifying activity so the visible-badge path is exercised
      await ensureStreakToday(page);
      const fresh = await fetchCurrentStreak(page);
      streak = fresh.streak;
      longest = fresh.longest;
      console.log(`📍 API streak after activity: current=${streak}, longest=${longest}`);
      expect(streak).toBeGreaterThan(0);

      // Streak refetches on window focus (useDailyStreak) — refocus, then reload as fallback
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
    }

    const badge = page.locator('.header-streak-badge');

    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText(`🔥 ${streak}`);
    const title = await badge.getAttribute('title');
    expect(title).toContain(`${streak}-day activity streak`);
    expect(title).toContain(`Longest: ${longest}`);
    console.log(`✅ Header badge shows 🔥 ${streak}`);

    // Same number in the profile nav panel
    await page.locator('.user-avatar').first().click();
    await expect(page.locator('.nav-user-streak')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.nav-user-streak')).toContainText(`🔥 ${streak}`);
    console.log('✅ Nav panel shows the same streak');
    await page.keyboard.press('Escape');
  });

  test('dashboard daily challenge card shows the same streak as the header', async ({ page }) => {
    await loginAs(page);
    const { streak } = await fetchCurrentStreak(page);

    await page.goto(FRONTEND_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    if (streak > 0) {
      // The daily challenge card and the header must agree (single source)
      const cardBadge = page.locator('section:has-text("Daily"), section:has-text("Challenge")')
        .locator('span')
        .filter({ hasText: /^🔥 \d+$/ });
      await expect(cardBadge.first()).toBeVisible({ timeout: 15000 });
      const cardText = await cardBadge.first().innerText();
      expect(cardText.trim()).toBe(`🔥 ${streak}`);
      console.log(`✅ Daily challenge card shows the same 🔥 ${streak} as the header`);
    } else {
      const cardBadge = page.locator('span').filter({ hasText: /^🔥 \d+$/ });
      await expect(cardBadge.first()).toHaveCount(0);
      console.log('✅ Streak is 0 today — no 🔥 badge on the challenge card');
    }
  });
});
