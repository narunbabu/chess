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
    await expect(page.locator('.gc-mobile-action-grid-portrait button[aria-label="Pause game"], .gc-mobile-action-grid-portrait button[aria-label="Resume game"]')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button[aria-label="Open chat"]')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Undo")')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("CCT")')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Comp")')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button[aria-label="More play actions"]')).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Moves")')).toBeHidden();
    await expect(page.locator('.gc-mobile-last-moves-center')).toBeVisible();

    await page.locator('.gc-mobile-action-grid-portrait button:has-text("Comp")').click();
    await expect(page.locator('.gc-right-panel.mobile-open')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open')).toContainText(/Coach|Companion/);
    await expect(page.locator('.gc-right-panel.mobile-open .gc-tabs')).toBeHidden();
    await expect(page.locator('.gc-right-panel.mobile-open .companion-controls-compact')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open [data-tour="companion-one-move"]')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open [data-tour="companion-continuous"]')).toBeVisible();
    await expect(page.locator('.gc-right-panel.mobile-open select')).toHaveValue(/.+/);

    await page.locator('.gc-mobile-panel-heading button').click();
    await page.locator('.gc-mobile-action-grid-portrait button[aria-label="More play actions"]').click();
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
    await expect(page.locator('.gc-mobile-rail button[aria-label="Pause game"], .gc-mobile-rail button[aria-label="Resume game"]')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button[aria-label="Open chat"]')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button:has-text("Undo")')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button:has-text("CCT")')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button:has-text("Comp")')).toBeVisible();
    await expect(page.locator('.gc-mobile-rail button[aria-label="More play actions"]')).toBeVisible();
    await expect(page.locator('.gc-mobile-last-moves-rail')).toBeVisible();

    const boardBox = await page.locator('.gc-board-wrapper').boundingBox();
    expect(boardBox.width).toBeGreaterThanOrEqual(350);
    expect(boardBox.height).toBeGreaterThanOrEqual(350);

    const railBox = await page.locator('.gc-mobile-rail').boundingBox();
    expect(railBox.x).toBeGreaterThan(boardBox.x + boardBox.width - 1);

    await page.locator('.gc-mobile-rail button:has-text("CCT")').click();
    await expect(page.locator('.gc-right-panel.mobile-open')).toBeVisible();
    await expect(page.locator('.gc-mobile-panel-heading')).toContainText('CCT');
    await expect(page.locator('.gc-right-panel.mobile-open .gc-tabs')).toBeHidden();
  });
});
