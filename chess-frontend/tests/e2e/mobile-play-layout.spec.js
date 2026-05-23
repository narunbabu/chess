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

async function installFakeStockfish(page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;

    class FakeStockfishWorker {
      constructor(url) {
        this.url = String(url);
        this.onmessage = null;
        this.onerror = null;
        this.terminated = false;
      }

      postMessage(message) {
        if (this.terminated) return;

        const send = (data, delay = 0) => {
          setTimeout(() => {
            if (!this.terminated && this.onmessage) {
              this.onmessage({ data });
            }
          }, delay);
        };

        if (message === 'isready') {
          send('readyok');
          return;
        }

        if (typeof message === 'string' && message.startsWith('go ')) {
          send('info depth 1 multipv 1 score cp 35 pv e2e4', 5);
          send('info depth 1 multipv 2 score cp 20 pv d2d4', 5);
          send('info depth 1 multipv 3 score cp 10 pv g1f3', 5);
          send('info depth 1 multipv 4 score cp 5 pv c2c4', 5);
          send('info depth 1 multipv 5 score cp 0 pv e2e3', 5);
          send('bestmove e2e4', 10);
        }
      }

      terminate() {
        this.terminated = true;
      }

      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
    }

    window.Worker = function Worker(url, options) {
      const workerUrl = String(url);
      if (workerUrl.includes('/workers/stockfish.js')) {
        return new FakeStockfishWorker(workerUrl);
      }
      return new NativeWorker(url, options);
    };
  });
}

test.describe('Mobile play layout', () => {
  test('Best shows future arrows and inline strip without opening the mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFakeStockfish(page);
    await startCasualComputerGame(page);

    const bestButton = page.locator('.gc-mobile-action-grid-portrait button:has-text("Best")');
    await bestButton.click();

    await expect(page.locator('.gc-right-panel')).toBeHidden();
    await expect(page.locator('.gc-inline-best-strip')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.gc-inline-best-strip')).toContainText('e4');
    await expect(page.locator('[data-testid="chess-board"] svg line')).toHaveCount(3, { timeout: 5000 });

    await bestButton.click();

    await expect(page.locator('.gc-inline-best-strip')).toBeHidden();
    await expect(page.locator('[data-testid="chess-board"] svg line')).toHaveCount(0);
    await expect(page.locator('.gc-mobile-action-grid-portrait label:has-text("Review")')).toBeVisible();
  });

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
    await expect(page.locator('.gc-mobile-action-grid-portrait button[aria-label="Pause"], .gc-mobile-action-grid-portrait button[aria-label="Resume"]')).toBeVisible();
    const portraitMoreButton = page.locator('.gc-mobile-action-grid-portrait button[aria-label="More play actions"]');
    await expect(portraitMoreButton).toBeVisible();
    await expect(page.locator('.gc-mobile-action-grid-portrait button:has-text("Moves")')).toBeHidden();
    await expect(page.locator('.gc-mobile-last-moves-center')).toBeVisible();

    await portraitMoreButton.click();
    const portraitMenu = page.locator('.gc-mobile-action-menu');
    await expect(portraitMenu).toBeVisible();
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
    await expect(page.locator('.gc-mobile-rail button[aria-label="Pause"], .gc-mobile-rail button[aria-label="Resume"]')).toBeVisible();
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
    await expect(railMenu.locator('button:has-text("CCT panel")')).toBeVisible();
    await expect(railMenu.locator('button:has-text("Companion")')).toBeVisible();

    await railMenu.locator('button:has-text("CCT panel")').click();
    await expect(page.locator('.gc-right-panel.mobile-open')).toBeVisible();
    await expect(page.locator('.gc-mobile-panel-heading')).toContainText('CCT');
    await expect(page.locator('.gc-right-panel.mobile-open .gc-tabs')).toBeHidden();
  });
});
