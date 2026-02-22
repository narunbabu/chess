import { test, expect } from '@playwright/test';

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

  test('should load interactive lesson page within performance budget', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to the page
    await page.goto('/tutorial/interactive/1');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for chess board to be visible
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

    const loadTime = Date.now() - startTime;

    // Performance budgets
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

    // Log performance metrics
    console.log(`Page load time: ${loadTime}ms`);
  });

  test('should render chess board quickly', async ({ page }) => {
    await page.goto('/tutorial/interactive/1');
    await page.waitForLoadState('networkidle');

    const startTime = Date.now();

    // Wait for chess board to render
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

    // Wait for pieces to be present
    await page.locator('[data-piece], .piece').first().waitFor({ state: 'visible' });

    const renderTime = Date.now() - startTime;

    // Chess board should render within 1 second
    expect(renderTime).toBeLessThan(1000);

    console.log(`Chess board render time: ${renderTime}ms`);
  });

  test('should handle piece interactions with low latency', async ({ page }) => {
    await page.goto('/tutorial/interactive/1');
    await page.waitForLoadState('networkidle');

    // Wait for board to be ready
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

    const interactionTimes = [];
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      // Click on a piece
      const pieces = page.locator('[data-piece], .piece');
      const pieceCount = await pieces.count();

      if (pieceCount > 0) {
        await pieces.first().click();

        // Wait for visual feedback (selection highlight)
        await page.waitForSelector('.selected, [data-selected], .highlight', { state: 'visible', timeout: 1000 });

        const interactionTime = Date.now() - startTime;
        interactionTimes.push(interactionTime);
      }

      // Small delay between interactions
      await page.waitForTimeout(100);
    }

    if (interactionTimes.length > 0) {
      const averageTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;
      const maxTime = Math.max(...interactionTimes);

      // Interaction should be fast
      expect(averageTime).toBeLessThan(200); // Average under 200ms
      expect(maxTime).toBeLessThan(500); // Max under 500ms

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

    await page.goto('/tutorial/interactive/1');
    await page.waitForLoadState('networkidle');

    // Wait for board to be ready
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

    // Make several moves to trigger API calls
    const squares = page.locator('.square, [data-square], .board-square');
    const squareCount = await squares.count();

    if (squareCount >= 4) {
      // Make multiple moves
      for (let i = 0; i < Math.min(6, squareCount - 1); i += 2) {
        await squares.nth(i).click();
        await squares.nth(i + 1).click();

        // Wait for API call to complete
        await page.waitForTimeout(200);
      }
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
    await page.goto('/tutorial/interactive/1');
    await page.waitForLoadState('networkidle');

    // Wait for board to be ready
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

    const interactionTimes = [];
    const duration = 5000; // 5 seconds of continuous interaction
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const iterationStart = Date.now();

      // Random interaction
      const squares = page.locator('.square, [data-square], .board-square');
      const squareCount = await squares.count();

      if (squareCount > 0) {
        // Click random square
        const randomIndex = Math.floor(Math.random() * squareCount);
        await squares.nth(randomIndex).click();
      }

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
    await page.goto('/tutorial/interactive/1');
    await page.waitForLoadState('networkidle');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // Perform many interactions
    const squares = page.locator('.square, [data-square], .board-square');
    const squareCount = await squares.count();

    if (squareCount >= 4) {
      // Make 50 moves
      for (let i = 0; i < Math.min(100, squareCount * 2); i += 2) {
        await squares.nth(i % squareCount).click();
        await squares.nth((i + 1) % squareCount).click();
        await page.waitForTimeout(50);
      }
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

    await page.goto('/tutorial/interactive/1');
    await page.waitForLoadState('networkidle');

    // Wait for chess board
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

    const loadTime = Date.now() - startTime;

    // Mobile performance budget (slightly more lenient)
    expect(loadTime).toBeLessThan(4000); // Should load within 4 seconds on mobile

    // Test touch interactions
    const interactionStart = Date.now();
    const pieces = page.locator('[data-piece], .piece');
    const pieceCount = await pieces.count();

    if (pieceCount > 0) {
      // Simulate touch
      await pieces.first().tap();

      // Wait for feedback
      await page.waitForSelector('.selected, [data-selected], .highlight', { state: 'visible', timeout: 1000 });

      const interactionTime = Date.now() - interactionStart;
      expect(interactionTime).toBeLessThan(300); // Touch interaction under 300ms

      console.log(`Mobile load time: ${loadTime}ms`);
      console.log(`Mobile touch interaction time: ${interactionTime}ms`);
    }
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
    await page.goto('/tutorial/interactive/1');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="chess-board"], .chessboard').waitFor({ state: 'visible' });

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