import { test, expect } from '@playwright/test';

/** Helper: click an element that may be outside the viewport */
async function jsClick(locator) {
  await locator.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await locator.evaluate(el => el.click());
}

test.describe('Companion Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Click "use email instead" if visible (Google OAuth default)
    const useEmailButton = page.locator('button:has-text("use email"), button:has-text("Use Email"), button:has-text("email instead")').first();
    if (await useEmailButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await useEmailButton.click();
      await page.waitForTimeout(500);
    }

    // Fill credentials and submit
    await page.locator('input[type="email"], input[name="email"]').first().fill('ab@ameyem.com');
    await page.locator('input[type="password"]').first().fill('Vedansh@123');
    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect away from login (successful auth)
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');

    // Go to /play (computer setup with GameModeSelector for logged-in users)
    await page.goto('/play');
    await page.waitForLoadState('domcontentloaded');
    // Wait for GameModeSelector to be rendered (only for authenticated users)
    await page.waitForSelector('.game-mode-selector', { timeout: 10000 });
  });

  test('should show Companion button in game mode selector', async ({ page }) => {
    const companionButton = page.locator('button:has-text("Companion")').first();
    await companionButton.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await expect(companionButton).toBeVisible();
  });

  test('should show CompanionSelector when Companion mode is selected', async ({ page }) => {
    // Click the Companion mode button
    await jsClick(page.locator('button:has-text("Companion")').first());

    // The companion-selection wrapper div should appear
    const companionSelection = page.locator('.companion-selection');
    await expect(companionSelection).toBeVisible();

    // Wait for API to load companion cards
    await page.waitForSelector('.companion-selector button', { timeout: 15000 });

    const companionCards = page.locator('.companion-selector button');
    const cardCount = await companionCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should display synthetic players with correct information', async ({ page }) => {
    await jsClick(page.locator('button:has-text("Companion")').first());

    // Wait for API to load
    await page.waitForSelector('.companion-selector button', { timeout: 15000 });

    // Check player names (font-semibold text inside buttons)
    const playerNames = page.locator('.companion-selector button .font-semibold');
    const nameCount = await playerNames.count();
    expect(nameCount).toBeGreaterThan(0);

    // Check ratings (purple text)
    const ratings = page.locator('.companion-selector button .text-purple-600');
    const ratingCount = await ratings.count();
    expect(ratingCount).toBeGreaterThan(0);
  });

  test('should be able to select a companion', async ({ page }) => {
    await jsClick(page.locator('button:has-text("Companion")').first());
    await page.waitForSelector('.companion-selector button', { timeout: 15000 });

    // Click the first companion card using JS (avoids viewport issues)
    const firstCard = page.locator('.companion-selector button').first();
    await jsClick(firstCard);
    await page.waitForTimeout(300);

    // A "Selected" badge should appear
    const selectedBadge = page.locator('.companion-selector button:has-text("Selected")');
    await expect(selectedBadge).toBeVisible();
  });

  test('should start game with companion when Play is clicked', async ({ page }) => {
    await jsClick(page.locator('button:has-text("Companion")').first());
    await page.waitForSelector('.companion-selector button', { timeout: 15000 });
    await jsClick(page.locator('.companion-selector button').first());
    await page.waitForTimeout(300);

    // Click the Play button (triggers 3-second countdown)
    const playButton = page.locator('button.start-button:has-text("Play")').first();
    await jsClick(playButton);

    // Wait for countdown (3s) + game initialisation
    await page.waitForTimeout(5000);

    // Chess board should be visible
    const chessBoard = page.locator('.gc-board-wrapper').first();
    await expect(chessBoard).toBeVisible({ timeout: 10000 });
  });

  test('should show CompanionControls during game', async ({ page }) => {
    await jsClick(page.locator('button:has-text("Companion")').first());
    await page.waitForSelector('.companion-selector button', { timeout: 15000 });
    await jsClick(page.locator('.companion-selector button').first());
    await page.waitForTimeout(300);

    const playButton = page.locator('button.start-button:has-text("Play")').first();
    await jsClick(playButton);
    await page.waitForTimeout(5000);

    // CompanionControls panel should be visible in the sidebar
    const companionControls = page.locator('.companion-controls');
    await expect(companionControls).toBeVisible({ timeout: 10000 });

    // Should have "Suggest One Move" and "Play Continuously" buttons
    await expect(page.locator('button:has-text("Suggest One Move")')).toBeVisible();
    await expect(page.locator('button:has-text("Play Continuously")')).toBeVisible();
  });

  test('should deselect companion when switching to other modes', async ({ page }) => {
    await jsClick(page.locator('button:has-text("Companion")').first());
    await page.waitForSelector('.companion-selector button', { timeout: 15000 });
    await jsClick(page.locator('.companion-selector button').first());
    await page.waitForTimeout(300);

    // Verify selection
    await expect(page.locator('.companion-selector button:has-text("Selected")')).toBeVisible();

    // Switch to Casual mode
    await jsClick(page.locator('button:has-text("Casual")').first());
    await page.waitForTimeout(500);

    // CompanionSelector should no longer be shown
    await expect(page.locator('.companion-selection')).not.toBeVisible();
  });

  test('should show correct theme styling for Companion button', async ({ page }) => {
    const companionButton = page.locator('button:has-text("Companion")').first();
    await companionButton.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await expect(companionButton).toBeVisible();

    const bgColor = await companionButton.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(bgColor).toBeTruthy();
    expect(bgColor).not.toBe('transparent');
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
