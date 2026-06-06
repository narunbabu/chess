import { test, expect } from '@playwright/test';

/**
 * Landing hero smoke — verifies the redesigned hero (live HeroBoard + the two
 * CTAs) renders for a logged-out visitor without a runtime crash. Logged-out
 * landing is client-side only, so this does not require the backend.
 */
test.describe('Landing hero', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure a clean, logged-out state so we see the landing (not the lobby redirect).
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('renders kids-academy hero with both CTAs and a live board', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Title reflects the unified kids-academy positioning.
    await expect(page).toHaveTitle(/Chess99/i);

    // Both CTAs are present, in the requested order (Login and Play primary).
    await expect(page.getByRole('button', { name: 'Login and Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Play Now$/ }).first()).toBeVisible();

    // The live HeroBoard mounted: react-chessboard renders draggable piece images.
    const pieces = page.locator('[data-piece], img[alt][draggable="true"], [data-square] img');
    await expect.poll(async () => await pieces.count(), { timeout: 10000 }).toBeGreaterThan(0);

    // The interactive nudge from HeroBoard is shown.
    await expect(page.getByText(/your move/i)).toBeVisible();
  });
});
