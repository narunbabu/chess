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
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Login page defaults to a social-button view; reveal the email form.
  const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
  if (await emailLink.count() > 0) {
    await emailLink.first().click();
    await page.waitForTimeout(1000);
  }

  await page.locator('input[type="email"]').fill('ab@ameyem.com');
  await page.locator('input[type="password"], input[placeholder="Password"]').fill('Vedansh@123');
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

/**
 * From the /play landing page, drill into the computer-game setup screen and
 * select the requested mode (Casual or Rated). Does NOT click Play.
 *
 * Note: `gameMode` now defaults to `'computer'` in PlayComputer.js, so the
 * "Choose Your Game Mode" splash never renders — the GameModeSelector
 * (Rated/Casual) appears immediately on /play.
 */
async function openComputerSetup(page, mode = 'Casual') {
  await page.goto('/play');
  await page.waitForLoadState('domcontentloaded');

  // GameModeSelector (Rated/Casual) is shown directly.
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
    await page.addInitScript(() => {
      localStorage.setItem('chess99:casual_tour:v1:guest', 'completed');
      localStorage.removeItem('chess99_active_computer_game');
      localStorage.setItem('computerDepth', '3');
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      }));
    });

    await page.route('**/api/user', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        rating: 1200,
      }),
    }));
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

    // CompanionControls renders the per-move and continuous-play buttons.
    await expect(page.locator('button:has-text("Play One Move")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Play Until Stopped")')).toBeVisible();
  });

  test('rated games hide companion controls', async ({ page }) => {
    await openComputerSetup(page, 'Rated');
    await startGame(page);

    await expect(page.locator('[data-tour="tab-companion"]')).toHaveCount(0);
    await expect(page.locator('[data-tour="companion-one-move"]')).toHaveCount(0);
  });
});
