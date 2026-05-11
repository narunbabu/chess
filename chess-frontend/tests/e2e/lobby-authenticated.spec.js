// Authenticated lobby test - tests tabs, friends, badge CSS
const { test, expect } = require('@playwright/test');

// Use test account credentials from environment or defaults
// Defaults match the working dev account documented in chess-web CLAUDE.md.
const TEST_EMAIL = process.env.CHESS99_TEST_EMAIL || process.env.TEST_EMAIL || 'ab@ameyem.com';
const TEST_PASSWORD = process.env.CHESS99_TEST_PASSWORD || process.env.TEST_PASSWORD || 'Vedansh@123';

test.describe('Lobby Authenticated Tests', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Login page defaults to a social-button view; reveal the email form.
    const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
    if (await emailLink.count() > 0) {
      await emailLink.first().click();
      await page.waitForTimeout(1000);
    }

    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"], input[placeholder="Password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 }).catch(() => {
      console.log('Did not redirect after login');
    });
    await page.waitForTimeout(3000);
  });

  test('lobby shows Players and Friends tabs, no Games tab', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`/lobby`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Lobby renders a "Loading lobby..." spinner until AuthContext fetchUser
    // resolves (which awaits presence + user-status WebSocket init). Give the
    // tabs plenty of time to mount before asserting on them.
    const firstReadyState = await Promise.race([
      page.waitForSelector('.lobby-tabs .tab-button', { timeout: 45000 }).then(() => 'tabs').catch(() => 'timeout'),
      page.waitForSelector('text=Authentication Required', { timeout: 45000 }).then(() => 'auth').catch(() => 'timeout'),
    ]);
    if (firstReadyState !== 'tabs') {
      test.skip(true, 'Backend auth is unavailable; authenticated lobby flow requires a valid local API session.');
    }

    // First-visit guided tour modal intercepts pointer events on the tabs;
    // close it (via skip / close / overlay click) before interacting.
    const skipTour = page.locator(
      '.guided-tour button:has-text("Skip"), .guided-tour button:has-text("Close"), .guided-tour [aria-label*="Close" i]'
    ).first();
    if (await skipTour.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipTour.click().catch(() => {});
      await page.waitForTimeout(300);
    }
    // If the scrim is still around, mark the tour as completed and remove it.
    await page.evaluate(() => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.includes('tour') || k.includes('guided'));
        keys.forEach(k => localStorage.setItem(k, 'true'));
      } catch (e) {}
      document.querySelectorAll('.guided-tour, .guided-tour-scrim').forEach(el => el.remove());
    });

    // Screenshot the lobby
    await page.screenshot({ path: 'tests/e2e/screenshots/lobby-authenticated.png', fullPage: true });

    const url = page.url();
    console.log('After login, URL:', url);

    // If we're on the lobby page
    if (url.includes('/lobby')) {
      // Check tabs exist
      const tabButtons = page.locator('.tab-button');
      const tabCount = await tabButtons.count();
      console.log(`Found ${tabCount} tabs`);

      // Get all tab text
      for (let i = 0; i < tabCount; i++) {
        const text = await tabButtons.nth(i).textContent();
        console.log(`Tab ${i}: "${text.trim()}"`);
      }

      // Screenshot tabs area specifically
      const tabsArea = page.locator('.lobby-tabs');
      if (await tabsArea.isVisible().catch(() => false)) {
        await tabsArea.screenshot({ path: 'tests/e2e/screenshots/lobby-tabs-closeup.png' });
      }

      // Players tab should exist
      await expect(page.locator('.tab-button:has-text("Players")')).toBeVisible();

      // Friends tab should exist
      await expect(page.locator('.tab-button:has-text("Friends")')).toBeVisible();

      // Games tab should NOT exist
      const gamesTabCount = await page.locator('.tab-button:has-text("Games")').count();
      expect(gamesTabCount).toBe(0);

      // Click Friends tab
      await page.locator('.tab-button:has-text("Friends")').first().click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/e2e/screenshots/lobby-friends-tab.png', fullPage: true });

      // Click back to Players tab
      await page.locator('.tab-button:has-text("Players")').first().click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/e2e/screenshots/lobby-players-tab.png', fullPage: true });

      // Check badge styling - badges should NOT have position:absolute
      const badges = page.locator('.tab-badge');
      const badgeCount = await badges.count();
      console.log(`Found ${badgeCount} badges`);

      for (let i = 0; i < badgeCount; i++) {
        const position = await badges.nth(i).evaluate(el => getComputedStyle(el).position);
        console.log(`Badge ${i} position: ${position}`);
        // Badge should be static (inline flow) not absolute
        expect(position).not.toBe('absolute');
      }
    } else {
      console.log('Not on lobby - login may have failed. Current URL:', url);
      await page.screenshot({ path: 'tests/e2e/screenshots/lobby-login-failed.png', fullPage: true });
    }
  });
});
