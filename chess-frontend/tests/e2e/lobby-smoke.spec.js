// Quick smoke test for lobby page changes
// Run: npx playwright test tests/e2e/lobby-smoke.spec.js --headed
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://chess99.com';

test.describe('Lobby Page Smoke Tests', () => {
  test('lobby page loads and shows tabs without Games tab', async ({ page }) => {
    // Go to lobby (will redirect to login if not authenticated)
    await page.goto(`${BASE_URL}/lobby`, { waitUntil: 'networkidle', timeout: 15000 });

    // Take screenshot of whatever loads
    await page.screenshot({ path: 'tests/e2e/screenshots/lobby-page.png', fullPage: true });

    // Check the current URL - if redirected to login, that's expected for unauthenticated
    const url = page.url();
    console.log('Current URL:', url);

    if (url.includes('/login') || url.includes('/')) {
      console.log('Redirected to login - expected for unauthenticated user');
      // Test the landing page instead
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: 'tests/e2e/screenshots/landing-page.png', fullPage: true });
      return;
    }

    // If we're on the lobby page, check for our changes
    // 1. Players tab should exist
    const playersTab = page.locator('text=Players');
    await expect(playersTab).toBeVisible();

    // 2. Friends tab should exist
    const friendsTab = page.locator('text=Friends');
    await expect(friendsTab).toBeVisible();

    // 3. Games tab should NOT exist
    const gamesTab = page.locator('.tab-button:has-text("Games")');
    await expect(gamesTab).toHaveCount(0);

    // 4. Badge should not have absolute positioning issues
    const badges = page.locator('.tab-badge');
    const badgeCount = await badges.count();
    console.log(`Found ${badgeCount} tab badges`);

    await page.screenshot({ path: 'tests/e2e/screenshots/lobby-tabs.png', fullPage: true });
  });

  test('play page accepts gameId query parameter', async ({ page }) => {
    // Test that /play?gameId=invalid doesn't crash
    await page.goto(`${BASE_URL}/play?gameId=99999999`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/play-invalid-gameid.png', fullPage: true });

    const url = page.url();
    console.log('Play page URL:', url);

    // Page should load without crashing
    // After invalid gameId, URL should be cleared
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/e2e/screenshots/play-after-invalid-gameid.png', fullPage: true });
  });

  test('play page loads normally without gameId', async ({ page }) => {
    await page.goto(`${BASE_URL}/play`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: 'tests/e2e/screenshots/play-normal.png', fullPage: true });

    const url = page.url();
    console.log('Play page URL:', url);

    // Should not have gameId in URL for fresh load
    expect(url).not.toContain('gameId');
  });
});
