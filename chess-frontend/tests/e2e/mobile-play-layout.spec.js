import { test, expect } from '@playwright/test';

async function startCasualComputerGame(page) {
  await page.addInitScript(() => {
    localStorage.setItem('chess99:casual_tour:v1:guest', 'completed');
    localStorage.removeItem('chess99_active_computer_game');
    localStorage.setItem('computerDepth', '3');
  });

  await page.goto('/play', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button.start-button:has-text("Play")', { timeout: 15000 });
  await page.locator('button.start-button:has-text("Play")').first().click();
  await page.waitForSelector('.gc-board-wrapper', { timeout: 15000 });
  await expect(page.locator('.gc-board-wrapper')).toBeVisible();
}

test.describe('Mobile play layout', () => {
  test('portrait keeps the board dominant and moves hidden until opened', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startCasualComputerGame(page);

    const boardBox = await page.locator('.gc-board-wrapper').boundingBox();
    expect(boardBox.width).toBeGreaterThanOrEqual(382);
    expect(boardBox.height).toBeGreaterThanOrEqual(382);

    await expect(page.locator('.gc-right-panel')).toBeHidden();
    await expect(page.locator('.gc-mobile-action-grid-portrait')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait label:has-text("Review")')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Undo")')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Best")')).toBeVisible();
    const portraitMoreButton = page.locator('.gc-mobile-action-grid-portrait button[aria-label="More play actions"]');
    await expect(portraitMoreButton).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Moves")')).toBeHidden();
    await expect(page.locator('.gc-mobile-last-moves-center')).toBeVisible();

    await portraitMoreButton.click();
    const portraitMenu = page.locator('.gc-mobile-action-menu');
    await expect(portraitMenu).toBeVisible();
    await expect(portraitMenu.locator('button').filter({ hasText: /Pause|Resume/ })).toBeVisible();
    await expect(portraitMenu.locator('button:has-text("CCT panel")')).toBeVisible();
    await expect(portraitMenu.locator('button:has-text("Companion")')).toBeVisible();
    await expect(portraitMenu.locator('button:has-text("Moves")')).toBeVisible();

    await portraitMenu.locator('button:has-text("Companion")').click();
    await expect(page.locator('.gc-right-panel.mobile-open')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open')).toContainText(/Coach|Companion/);
    await expect(page.locator('.gc-right-panel.mobile-open .gc-tabs')).toBeHidden();
    await expect(page.locator('.gc-right-panel.mobile-open .companion-controls-compact')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open [data-tour="companion-one-move"]')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open [data-tour="companion-continuous"]')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open select')).toHaveValue(/.+/);

    await page.locator('.gc-mobile-panel-heading button').click();
    await portraitMoreButton.click();
    await page.locator('.gc-mobile-action-menu button:has-text("Moves")').click();
    await expect(page.locator('.gc-right-panel.mobile-open')).toBeVisible();

    const panelPosition = await page.locator('.gc-right-panel.mobile-open').evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.position;
    });
    expect(panelPosition).toBe('fixed');
  });

  test('landscape uses a side rail and leaves enough height for the board', async ({ page }) => {
    await page.setViewportSize({ width: 812, height: 375 });
    await startCasualComputerGame(page);

    await expect(page.locator('.gc-mobile-rail')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail label:has-text("Review")')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button:has-text("Undo")')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button:has-text("Best")')).toBeVisible();
    const railMoreButton = page.locator('.gc-mobile-rail button[aria-label="More play actions"]');
    await expect(railMoreButton).toBeVisible();
    await expect(page.locator('.gc-mobile-last-moves-rail')).toBeVisible();

    const boardBox = await page.locator('.gc-board-wrapper').boundingBox();
    expect(boardBox.width).toBeGreaterThanOrEqual(350);
    expect(boardBox.height).toBeGreaterThanOrEqual(350);

    const railBox = await page.locator('.gc-mobile-rail').boundingBox();
    expect(railBox.x).toBeGreaterThan(boardBox.x + boardBox.width - 1);

    await railMoreButton.click();
    const railMenu = page.locator('.gc-mobile-action-menu');
    await expect(railMenu).toBeVisible();
    await expect(railMenu.locator('button').filter({ hasText: /Pause|Resume/ })).toBeVisible();
    await expect(railMenu.locator('button:has-text("CCT panel")')).toBeVisible();
    await expect(railMenu.locator('button:has-text("Companion")')).toBeVisible();

    await railMenu.locator('button:has-text("CCT panel")').click();
    await expect(page.locator('.gc-right-panel.mobile-open')).toBeVisible();
    await expect(page.locator('.gc-mobile-panel-heading')).toContainText('CCT');
    await expect(page.locator('.gc-right-panel.mobile-open .gc-tabs')).toBeHidden();
  });
});
