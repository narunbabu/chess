import { test, expect } from '@playwright/test';

/**
 * Companion mode is now an in-game player-side assistant (not a top-level game mode).
 * It surfaces as a 🤝 tab in the right panel inside any active Casual game.
 * In Rated games, the same tab shows a "Not available in Rated games" notice.
 *
 * See commit 1e3ef94 — feat(companion): redesign companion mode as in-game
 * player-side assistant.
 */

async function jsClick(locator) {
  await locator.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await locator.evaluate(el => el.click());
}

async function login(page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const useEmailButton = page.locator(
    'button:has-text("use email"), button:has-text("Use Email"), button:has-text("email instead")'
  ).first();
  if (await useEmailButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await useEmailButton.click();
    await page.waitForTimeout(500);
  }

  await page.locator('input[type="email"], input[name="email"]').first().fill('ab@ameyem.com');
  await page.locator('input[type="password"]').first().fill('Vedansh@123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * From the /play landing page, drill into the computer-game setup screen and
 * select the requested mode (Casual or Rated). Does NOT click Play.
 */
async function openComputerSetup(page, mode = 'Casual') {
  await page.goto('/play');
  await page.waitForLoadState('domcontentloaded');

  // Step 1: click "Play Against Computer" on the landing.
  await jsClick(page.locator('button:has-text("Play Against Computer")').first());

  // Step 2: GameModeSelector now appears (Rated/Casual).
  await page.waitForSelector('.game-mode-selector', { timeout: 10000 });
  await jsClick(page.locator(`.game-mode-selector button:has-text("${mode}")`).first());
  await page.waitForTimeout(300);
}

/**
 * Click the Play button and wait for the board + right-panel tabs to render.
 */
async function startGame(page) {
  const playButton = page.locator('button.start-button:has-text("Play")').first();
  await jsClick(playButton);
  // Countdown is 3s; allow extra time for board init.
  await page.waitForSelector('.gc-board-wrapper', { timeout: 15000 });
  await page.waitForSelector('.gc-tabs', { timeout: 10000 });
}

test.describe('Companion Mode', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows 🤝 companion tab in the right panel during a casual game', async ({ page }) => {
    await openComputerSetup(page, 'Casual');
    await startGame(page);

    const companionTab = page.locator('.gc-tabs button', { hasText: '🤝' });
    await expect(companionTab).toBeVisible();
  });

  test('renders companion picker with "No companion" default option', async ({ page }) => {
    await openComputerSetup(page, 'Casual');
    await startGame(page);

    await jsClick(page.locator('.gc-tabs button', { hasText: '🤝' }));

    // Picker is a <select> inside the companion tab content.
    const picker = page.locator('.gc-tab-content select');
    await expect(picker).toBeVisible();
    await expect(picker.locator('option[value=""]')).toHaveText(/No companion/i);
  });

  test('selecting a companion reveals CompanionControls', async ({ page }) => {
    await openComputerSetup(page, 'Casual');
    await startGame(page);

    await jsClick(page.locator('.gc-tabs button', { hasText: '🤝' }));

    const picker = page.locator('.gc-tab-content select');
    await expect(picker).toBeVisible();

    // Wait for companion options to load (skip the empty "No companion" option).
    await page.waitForFunction(() => {
      const sel = document.querySelector('.gc-tab-content select');
      return sel && sel.options.length > 1;
    }, { timeout: 15000 });

    const firstOptionValue = await picker.locator('option').nth(1).getAttribute('value');
    await picker.selectOption(firstOptionValue);
    await page.waitForTimeout(300);

    // CompanionControls renders Suggest / Continuous buttons.
    await expect(page.locator('button:has-text("Suggest One Move")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Play Continuously")')).toBeVisible();
  });

  test('rated games show "Not available in Rated games" notice in companion tab', async ({ page }) => {
    await openComputerSetup(page, 'Rated');
    await startGame(page);

    await jsClick(page.locator('.gc-tabs button', { hasText: '🤝' }));

    await expect(
      page.locator('.gc-tab-content', { hasText: 'Not available in Rated games' })
    ).toBeVisible();
  });
});
