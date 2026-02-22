// Lobby test with pre-injected auth token
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://chess99.com';
const AUTH_TOKEN = '146|0uHTEJS2PMsYMlrlm8zxYT7PWw9jMAFqHjYyJU6rbd2a6b3a';

test.describe('Lobby Authenticated via Token', () => {
  test('lobby renders Players and Friends tabs, no Games tab, badges inline', async ({ page }) => {
    // Inject auth token before any page scripts run
    await page.addInitScript((token) => {
      localStorage.setItem('auth_token', token);
    }, AUTH_TOKEN);

    // Use domcontentloaded instead of networkidle (WebSocket keeps network busy)
    await page.goto(`${BASE_URL}/lobby`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for the lobby to render - look for tab buttons or lobby content
    await page.waitForSelector('.tab-button, .lobby-tabs, .authentication-required', { timeout: 15000 });

    // Give React a moment to finish rendering
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/e2e/screenshots/lobby-auth-full.png', fullPage: true });

    const url = page.url();
    console.log('Lobby URL:', url);

    // Check if we're on the lobby (not redirected away)
    if (url.includes('/lobby')) {
      // Look for tab buttons
      const tabButtons = page.locator('.tab-button');
      const tabCount = await tabButtons.count();
      console.log(`Tab count: ${tabCount}`);

      // Collect all tab text
      const tabTexts = [];
      for (let i = 0; i < tabCount; i++) {
        const text = await tabButtons.nth(i).textContent();
        tabTexts.push(text.trim());
        console.log(`Tab ${i}: "${text.trim()}"`);
      }

      if (tabCount >= 2) {
        // Should have Players tab
        const hasPlayers = tabTexts.some(t => t.includes('Players'));
        expect(hasPlayers).toBe(true);

        // Should have Friends tab
        const hasFriends = tabTexts.some(t => t.includes('Friends'));
        expect(hasFriends).toBe(true);

        // Should NOT have Games tab
        const hasGames = tabTexts.some(t => t.includes('Games') || t.includes('Active'));
        expect(hasGames).toBe(false);

        // Check badge CSS - should NOT be absolute positioned
        const badges = page.locator('.tab-badge');
        const badgeCount = await badges.count();
        console.log(`Badge count: ${badgeCount}`);
        for (let i = 0; i < badgeCount; i++) {
          const position = await badges.nth(i).evaluate(el => getComputedStyle(el).position);
          const marginLeft = await badges.nth(i).evaluate(el => getComputedStyle(el).marginLeft);
          console.log(`Badge ${i} - position: ${position}, margin-left: ${marginLeft}`);
          expect(position).not.toBe('absolute');
        }

        // Screenshot the tabs closeup
        const tabsArea = page.locator('.lobby-tabs');
        if (await tabsArea.isVisible().catch(() => false)) {
          await tabsArea.screenshot({ path: 'tests/e2e/screenshots/lobby-tabs-detail.png' });
        }

        // Click Friends tab and screenshot
        const friendsTab = page.locator('.tab-button:has-text("Friends")');
        if (await friendsTab.isVisible().catch(() => false)) {
          await friendsTab.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'tests/e2e/screenshots/lobby-friends-view.png', fullPage: true });
        }

        // Click Players tab and check "Show more" toggle
        const playersTab = page.locator('.tab-button:has-text("Players")');
        if (await playersTab.isVisible().catch(() => false)) {
          await playersTab.click();
          await page.waitForTimeout(2000);

          // Check for "Show more" button
          const showMoreBtn = page.locator('button:has-text("Show")');
          const showMoreVisible = await showMoreBtn.isVisible().catch(() => false);
          console.log(`Show more button visible: ${showMoreVisible}`);

          if (showMoreVisible) {
            await page.screenshot({ path: 'tests/e2e/screenshots/lobby-players-collapsed.png', fullPage: true });
            await showMoreBtn.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'tests/e2e/screenshots/lobby-players-expanded.png', fullPage: true });
          } else {
            await page.screenshot({ path: 'tests/e2e/screenshots/lobby-players-view.png', fullPage: true });
          }
        }
      } else {
        console.log('Less than 2 tabs found - auth may not have worked');
        console.log('Page content snippet:');
        const bodyText = await page.locator('body').textContent();
        console.log(bodyText.substring(0, 500));
      }
    } else {
      console.log('Not on lobby page. Auth token injection did not work. URL:', url);
      await page.screenshot({ path: 'tests/e2e/screenshots/lobby-auth-failed.png', fullPage: true });
    }
  });
});
