import { test, expect } from '@playwright/test';

test.setTimeout(90000);

const BOARD_SELECTOR = '.gc-board-wrapper';

async function startCasualComputerGame(page) {
  await page.addInitScript(() => {
    localStorage.setItem('chess99:casual_tour:v1:guest', 'completed');
    localStorage.removeItem('chess99_active_computer_game');
    localStorage.setItem('computerDepth', '3');
  });

  await page.goto('/play', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button.start-button:has-text("Play")', { timeout: 15000 });
  await page.locator('button.start-button:has-text("Play")').first().click();
  await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible', timeout: 15000 });
}

async function clickBoard(page, xRatio = 0.25, yRatio = 0.75) {
  const boardBox = await page.locator(BOARD_SELECTOR).boundingBox();
  expect(boardBox).not.toBeNull();
  await page.mouse.click(
    boardBox.x + boardBox.width * xRatio,
    boardBox.y + boardBox.height * yRatio
  );
}

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'fake-test-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      }));
    });
  });

  test('should load play board within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await startCasualComputerGame(page);

    const loadTime = Date.now() - startTime;

    // Performance budgets
    expect(loadTime).toBeLessThan(10000); // CRA dev-server play flow should be ready within 10 seconds

    // Log performance metrics
    console.log(`Page load time: ${loadTime}ms`);
  });

  test('should render chess board quickly', async ({ page }) => {
    await startCasualComputerGame(page);

    const startTime = Date.now();

    // Wait for chess board to render
    await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible' });

    const boardBox = await page.locator(BOARD_SELECTOR).boundingBox();
    expect(boardBox.width).toBeGreaterThan(300);
    expect(boardBox.height).toBeGreaterThan(300);

    const renderTime = Date.now() - startTime;

    // Chess board should render within 1 second
    expect(renderTime).toBeLessThan(1000);

    console.log(`Chess board render time: ${renderTime}ms`);
  });

  test('should handle piece interactions with low latency', async ({ page }) => {
    await startCasualComputerGame(page);

    // Wait for board to be ready
    await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible' });

    const interactionTimes = [];
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      await clickBoard(page, 0.18, 0.82);
      await clickBoard(page, 0.18, 0.62);

      const interactionTime = Date.now() - startTime;
      interactionTimes.push(interactionTime);

      // Small delay between interactions
      await page.waitForTimeout(100);
    }

    if (interactionTimes.length > 0) {
      const averageTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
      const maxTime = Math.max(...interactionTimes);

      // Interaction should be fast
      expect(averageTime).toBeLessThan(300); // Average under 300ms in mobile emulation
      expect(maxTime).toBeLessThan(800); // Max under 800ms

      console.log(`Average piece interaction time: ${averageTime.toFixed(2)}ms`);
      console.log(`Max piece interaction time: ${maxTime}ms`);
    }
  });

  test('should handle move validation API calls efficiently', async ({ page }) => {
    let apiCallTimes = [];
    let apiCallCount = 0;

    // Intercept API calls to measure timing
    await page.route('**/api/tutorial/lessons/*/validate-move', async (route) => {
      const startTime = Date.now();

      // Mock successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            feedback: 'Good move!',
            feedback_type: 'success',
            score_change: 10,
            goal_achieved: false
          }
        })
      });

      const responseTime = Date.now() - startTime;
      apiCallTimes.push(responseTime);
      apiCallCount++;
    });

    await startCasualComputerGame(page);

    // Wait for board to be ready
    await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible' });

    // Make several moves to trigger API calls
    for (let i = 0; i < 3; i++) {
      await clickBoard(page, 0.18, 0.82);
      await clickBoard(page, 0.18, 0.62);
      await page.waitForTimeout(200);
    }

    // Check API performance
    if (apiCallTimes.length > 0) {
      const averageApiTime = apiCallTimes.reduce((a, b) => a + b, 0) / apiCallTimes.length;
      const maxApiTime = Math.max(...apiCallTimes);

      expect(averageApiTime).toBeLessThan(100); // API should respond within 100ms (mocked)
      expect(maxApiTime).toBeLessThan(200); // Max within 200ms

      console.log(`Average API response time: ${averageApiTime.toFixed(2)}ms`);
      console.log(`Max API response time: ${maxApiTime}ms`);
      console.log(`Total API calls: ${apiCallCount}`);
    }
  });

  test('should maintain performance during continuous interactions', async ({ page }) => {
    await startCasualComputerGame(page);

    // Wait for board to be ready
    await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible' });

    const interactionTimes = [];
    const duration = 5000; // 5 seconds of continuous interaction
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const iterationStart = Date.now();

      await clickBoard(page, Math.random(), Math.random());

      const iterationTime = Date.now() - iterationStart;
      interactionTimes.push(iterationTime);

      // Small delay
      await page.waitForTimeout(50);
    }

    if (interactionTimes.length > 0) {
      const averageTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
      const maxTime = Math.max(...interactionTimes);
      const p95 = calculatePercentile(interactionTimes, 95);

      expect(averageTime).toBeLessThan(100); // Average under 100ms
      expect(maxTime).toBeLessThan(300); // Max under 300ms
      expect(p95).toBeLessThan(200); // 95th percentile under 200ms

      console.log(`Continuous interaction average: ${averageTime.toFixed(2)}ms`);
      console.log(`Continuous interaction max: ${maxTime}ms`);
      console.log(`Continuous interaction P95: ${p95.toFixed(2)}ms`);
      console.log(`Total interactions: ${interactionTimes.length}`);
    }
  });

  test('should have efficient memory usage', async ({ page }) => {
    await startCasualComputerGame(page);

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // Perform many interactions
    for (let i = 0; i < 50; i++) {
      await clickBoard(page, (i % 8 + 0.5) / 8, ((i + 2) % 8 + 0.5) / 8);
      await page.waitForTimeout(50);
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (under 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

    console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });

  test('should perform well on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const startTime = Date.now();

    await startCasualComputerGame(page);

    // Wait for chess board
    await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible' });

    const loadTime = Date.now() - startTime;

    // Mobile performance budget (slightly more lenient)
    expect(loadTime).toBeLessThan(10000); // Mobile play flow should be ready within 10 seconds

    // Test touch interactions
    const interactionStart = Date.now();
    const board = page.locator(BOARD_SELECTOR);
    try {
      await board.tap({ position: { x: 40, y: 40 } });
    } catch (error) {
      if (!String(error?.message || error).includes('does not support tap')) {
        throw error;
      }
      await board.click({ position: { x: 40, y: 40 } });
    }

    const interactionTime = Date.now() - interactionStart;
    expect(interactionTime).toBeLessThan(300); // Touch interaction under 300ms

    console.log(`Mobile load time: ${loadTime}ms`);
    console.log(`Mobile touch interaction time: ${interactionTime}ms`);
  });

  /**
   * Calculate percentile from array of values
   */
  function calculatePercentile(values, percentile) {
    values.sort((a, b) => a - b);
    const index = (percentile / 100) * (values.length - 1);

    if (Math.floor(index) === index) {
      return values[index];
    } else {
      const lower = values[Math.floor(index)];
      const upper = values[Math.ceil(index)];
      return lower + ((upper - lower) * (index - Math.floor(index)));
    }
  }
});

test.describe('Core Web Vitals', () => {
  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    await startCasualComputerGame(page);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.locator(BOARD_SELECTOR).waitFor({ state: 'visible' });

    // Get Web Vitals metrics
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics = {};

        // Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            metrics.fid = entries[0].processingStart - entries[0].startTime;
          }
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          metrics.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });

        // Resolve after a delay to allow metrics to be collected
        setTimeout(() => resolve(metrics), 3000);
      });
    });

    console.log('Core Web Vitals:', vitals);

    // Check thresholds
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(2500); // Good LCP threshold
      console.log(`LCP: ${vitals.lcp.toFixed(2)}ms`);
    }

    if (vitals.fid) {
      expect(vitals.fid).toBeLessThan(100); // Good FID threshold
      console.log(`FID: ${vitals.fid.toFixed(2)}ms`);
    }

    if (vitals.cls) {
      expect(vitals.cls).toBeLessThan(0.1); // Good CLS threshold
      console.log(`CLS: ${vitals.cls.toFixed(4)}`);
    }
  });
});
