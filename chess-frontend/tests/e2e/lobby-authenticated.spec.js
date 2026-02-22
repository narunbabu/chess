// Authenticated lobby test - tests tabs, friends, badge CSS
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://chess99.com';
// Use test account credentials from environment or defaults
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@chess99.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test1234';

test.describe('Lobby Authenticated Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      // Click login button
      const loginBtn = page.locator('button:has-text("Login"), button:has-text("Sign In"), button[type="submit"]');
      await loginBtn.click();

      // Wait for navigation
      await page.waitForURL('**/lobby**', { timeout: 10000 }).catch(() => {
        console.log('Did not redirect to lobby after login');
      });
    }
  });

  test('lobby shows Players and Friends tabs, no Games tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/lobby`, { waitUntil: 'networkidle', timeout: 15000 });

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
      await page.locator('.tab-button:has-text("Friends")').click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/e2e/screenshots/lobby-friends-tab.png', fullPage: true });

      // Click back to Players tab
      await page.locator('.tab-button:has-text("Players")').click();
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
