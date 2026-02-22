/**
 * Chess-Web Multi-Browser Clock Synchronization Testing
 * Phase 2 - Task 2: Multi-Browser Clock Sync
 * 
 * Tests:
 * 1. Open 2 browser windows (Player A and Player B)
 * 2. Start a game between them
 * 3. Verify clocks are synchronized (±200ms tolerance)
 * 4. Make moves and check both sides update correctly
 * 5. Test in Chrome + Firefox
 */

const { test, expect, chromium, firefox } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Load test credentials
const credentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'test-credentials.json'), 'utf-8')
);

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000';

// Helper function to parse time display (mm:ss format)
function parseTimeDisplay(timeStr) {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
}

// Helper function to login
async function login(page, email, password) {
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

// Helper function to get clock time
async function getClockTime(page, player = 'white') {
  const selector = `.clock-${player}`;
  const timeStr = await page.textContent(selector);
  return parseTimeDisplay(timeStr);
}

// Helper function to make a move
async function makeMove(page, from, to) {
  await page.click(`[data-square="${from}"]`);
  await page.click(`[data-square="${to}"]`);
  await page.waitForTimeout(100);
}

test.describe('Multi-Browser Clock Synchronization', () => {

  /**
   * TEST 1: Two Chrome browsers - Clock synchronization
   */
  test('Chrome + Chrome: Clock sync between two players', async () => {
    const testResults = {
      testName: 'Chrome + Chrome Sync',
      browsers: ['Chrome', 'Chrome'],
      timeControl: 180,
      measurements: [],
      passed: false,
      issues: []
    };

    let browser1, browser2, context1, context2, page1, page2;

    try {
      // Launch two Chrome browsers
      browser1 = await chromium.launch({ headless: false });
      browser2 = await chromium.launch({ headless: false });

      context1 = await browser1.newContext();
      context2 = await browser2.newContext();

      page1 = await context1.newPage();
      page2 = await context2.newPage();

      // Login as different users
      await login(page1, credentials.accounts[0].email, credentials.password);
      await login(page2, credentials.accounts[1].email, credentials.password);

      // Player 1 creates a game and invites Player 2
      await page1.click('button:has-text("New Game")');
      await page1.selectOption('select[name="timeControl"]', '180');
      await page1.selectOption('select[name="opponent"]', credentials.accounts[1].email);
      await page1.click('button:has-text("Create & Invite")');
      
      // Wait for game to be created
      await page1.waitForSelector('.chess-board', { timeout: 10000 });
      
      // Player 2 accepts the game
      await page2.click('button:has-text("Accept Game")');
      await page2.waitForSelector('.chess-board', { timeout: 10000 });

      // Wait a moment for both boards to initialize
      await page1.waitForTimeout(1000);

      // Initial clock sync check
      const whiteTime1 = await getClockTime(page1, 'white');
      const whiteTime2 = await getClockTime(page2, 'white');
      const syncDiff = Math.abs(whiteTime1 - whiteTime2);

      testResults.measurements.push({
        timestamp: Date.now(),
        stage: 'initial',
        browser1Time: whiteTime1,
        browser2Time: whiteTime2,
        syncDifferenceMs: syncDiff * 1000
      });

      if (syncDiff * 1000 > 200) {
        testResults.issues.push(
          `Initial clock sync diff: ${(syncDiff * 1000).toFixed(0)}ms (exceeds 200ms)`
        );
      }

      // Player 1 makes a move
      await makeMove(page1, 'e2', 'e4');
      await page1.waitForTimeout(500);

      // Check if move appears on both boards
      const boardState1 = await page1.evaluate(() => {
        return window.chess ? window.chess.fen() : null;
      });
      const boardState2 = await page2.evaluate(() => {
        return window.chess ? window.chess.fen() : null;
      });

      if (boardState1 !== boardState2) {
        testResults.issues.push('Board states not synchronized after move');
      }

      // Check clock sync after move
      const blackTime1After = await getClockTime(page1, 'black');
      const blackTime2After = await getClockTime(page2, 'black');
      const syncDiffAfter = Math.abs(blackTime1After - blackTime2After);

      testResults.measurements.push({
        timestamp: Date.now(),
        stage: 'after_move_1',
        browser1Time: blackTime1After,
        browser2Time: blackTime2After,
        syncDifferenceMs: syncDiffAfter * 1000
      });

      if (syncDiffAfter * 1000 > 200) {
        testResults.issues.push(
          `Clock sync diff after move: ${(syncDiffAfter * 1000).toFixed(0)}ms (exceeds 200ms)`
        );
      }

      // Player 2 makes a move
      await makeMove(page2, 'e7', 'e5');
      await page2.waitForTimeout(500);

      // Check clock sync after second move
      const whiteTime1After2 = await getClockTime(page1, 'white');
      const whiteTime2After2 = await getClockTime(page2, 'white');
      const syncDiffAfter2 = Math.abs(whiteTime1After2 - whiteTime2After2);

      testResults.measurements.push({
        timestamp: Date.now(),
        stage: 'after_move_2',
        browser1Time: whiteTime1After2,
        browser2Time: whiteTime2After2,
        syncDifferenceMs: syncDiffAfter2 * 1000
      });

      // Test multiple rapid moves
      for (let i = 0; i < 5; i++) {
        await makeMove(page1, 'd2', 'd4'); // Example moves
        await page1.waitForTimeout(300);
        
        const time1 = await getClockTime(page1, 'black');
        const time2 = await getClockTime(page2, 'black');
        const diff = Math.abs(time1 - time2);

        testResults.measurements.push({
          timestamp: Date.now(),
          stage: `rapid_move_${i + 1}`,
          browser1Time: time1,
          browser2Time: time2,
          syncDifferenceMs: diff * 1000
        });

        if (diff * 1000 > 200) {
          testResults.issues.push(
            `Rapid move ${i + 1} sync diff: ${(diff * 1000).toFixed(0)}ms`
          );
        }

        await makeMove(page2, 'd7', 'd5');
        await page2.waitForTimeout(300);
      }

      // Calculate statistics
      const syncDiffs = testResults.measurements.map(m => m.syncDifferenceMs);
      testResults.avgSyncDiff = syncDiffs.reduce((a, b) => a + b, 0) / syncDiffs.length;
      testResults.maxSyncDiff = Math.max(...syncDiffs);
      testResults.minSyncDiff = Math.min(...syncDiffs);
      testResults.passed = testResults.maxSyncDiff <= 200;

      // Save results
      await fs.promises.mkdir(path.join(__dirname, '../results'), { recursive: true });
      await fs.promises.writeFile(
        path.join(__dirname, '../results/chrome-chrome-sync.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    } finally {
      // Cleanup
      if (page1) await page1.close();
      if (page2) await page2.close();
      if (context1) await context1.close();
      if (context2) await context2.close();
      if (browser1) await browser1.close();
      if (browser2) await browser2.close();
    }
  });

  /**
   * TEST 2: Chrome + Firefox - Cross-browser clock synchronization
   */
  test('Chrome + Firefox: Cross-browser clock sync', async () => {
    const testResults = {
      testName: 'Chrome + Firefox Sync',
      browsers: ['Chrome', 'Firefox'],
      timeControl: 300,
      measurements: [],
      passed: false,
      issues: []
    };

    let chromeBrowser, firefoxBrowser, chromeContext, firefoxContext, chromePage, firefoxPage;

    try {
      // Launch Chrome and Firefox
      chromeBrowser = await chromium.launch({ headless: false });
      firefoxBrowser = await firefox.launch({ headless: false });

      chromeContext = await chromeBrowser.newContext();
      firefoxContext = await firefoxBrowser.newContext();

      chromePage = await chromeContext.newPage();
      firefoxPage = await firefoxContext.newPage();

      // Login
      await login(chromePage, credentials.accounts[2].email, credentials.password);
      await login(firefoxPage, credentials.accounts[3].email, credentials.password);

      // Create game
      await chromePage.click('button:has-text("New Game")');
      await chromePage.selectOption('select[name="timeControl"]', '300');
      await chromePage.selectOption('select[name="opponent"]', credentials.accounts[3].email);
      await chromePage.click('button:has-text("Create & Invite")');
      
      await chromePage.waitForSelector('.chess-board', { timeout: 10000 });
      
      await firefoxPage.click('button:has-text("Accept Game")');
      await firefoxPage.waitForSelector('.chess-board', { timeout: 10000 });

      await chromePage.waitForTimeout(1000);

      // Initial sync check
      const chromeTime = await getClockTime(chromePage, 'white');
      const firefoxTime = await getClockTime(firefoxPage, 'white');
      const syncDiff = Math.abs(chromeTime - firefoxTime);

      testResults.measurements.push({
        timestamp: Date.now(),
        stage: 'initial',
        chromeTime,
        firefoxTime,
        syncDifferenceMs: syncDiff * 1000
      });

      // Make moves and check sync
      await makeMove(chromePage, 'e2', 'e4');
      await chromePage.waitForTimeout(2000);

      const chromeTimeAfter = await getClockTime(chromePage, 'black');
      const firefoxTimeAfter = await getClockTime(firefoxPage, 'black');
      const syncDiffAfter = Math.abs(chromeTimeAfter - firefoxTimeAfter);

      testResults.measurements.push({
        timestamp: Date.now(),
        stage: 'after_move',
        chromeTime: chromeTimeAfter,
        firefoxTime: firefoxTimeAfter,
        syncDifferenceMs: syncDiffAfter * 1000
      });

      // Test continuous sync over 30 seconds
      const startTime = Date.now();
      while (Date.now() - startTime < 30000) {
        await chromePage.waitForTimeout(5000);
        
        const cTime = await getClockTime(chromePage, 'black');
        const fTime = await getClockTime(firefoxPage, 'black');
        const diff = Math.abs(cTime - fTime);

        testResults.measurements.push({
          timestamp: Date.now(),
          elapsed: (Date.now() - startTime) / 1000,
          chromeTime: cTime,
          firefoxTime: fTime,
          syncDifferenceMs: diff * 1000
        });
      }

      // Calculate statistics
      const syncDiffs = testResults.measurements.map(m => m.syncDifferenceMs);
      testResults.avgSyncDiff = syncDiffs.reduce((a, b) => a + b, 0) / syncDiffs.length;
      testResults.maxSyncDiff = Math.max(...syncDiffs);
      testResults.passed = testResults.maxSyncDiff <= 200;

      if (testResults.maxSyncDiff > 200) {
        testResults.issues.push(
          `Max sync diff: ${testResults.maxSyncDiff.toFixed(0)}ms (exceeds 200ms threshold)`
        );
      }

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/chrome-firefox-sync.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    } finally {
      if (chromePage) await chromePage.close();
      if (firefoxPage) await firefoxPage.close();
      if (chromeContext) await chromeContext.close();
      if (firefoxContext) await firefoxContext.close();
      if (chromeBrowser) await chromeBrowser.close();
      if (firefoxBrowser) await firefoxBrowser.close();
    }
  });

  /**
   * TEST 3: Clock Update Propagation Speed
   */
  test('Clock Update Speed: Measure propagation latency', async () => {
    const testResults = {
      testName: 'Clock Update Propagation',
      measurements: [],
      passed: false,
      issues: []
    };

    let browser1, browser2, context1, context2, page1, page2;

    try {
      browser1 = await chromium.launch({ headless: false });
      browser2 = await chromium.launch({ headless: false });

      context1 = await browser1.newContext();
      context2 = await browser2.newContext();

      page1 = await context1.newPage();
      page2 = await context2.newPage();

      await login(page1, credentials.accounts[4].email, credentials.password);
      await login(page2, credentials.accounts[5].email, credentials.password);

      // Create and join game
      await page1.click('button:has-text("New Game")');
      await page1.selectOption('select[name="timeControl"]', '180');
      await page1.selectOption('select[name="opponent"]', credentials.accounts[5].email);
      await page1.click('button:has-text("Create & Invite")');
      
      await page1.waitForSelector('.chess-board', { timeout: 10000 });
      await page2.click('button:has-text("Accept Game")');
      await page2.waitForSelector('.chess-board', { timeout: 10000 });

      // Test update speed
      for (let i = 0; i < 10; i++) {
        const beforeMove = Date.now();
        await makeMove(page1, 'e2', 'e4');
        
        // Wait for clock to update on page2
        await page2.waitForFunction(
          () => {
            const blackClock = document.querySelector('.clock-black');
            return blackClock && blackClock.classList.contains('active');
          },
          { timeout: 5000 }
        );
        
        const afterUpdate = Date.now();
        const propagationTime = afterUpdate - beforeMove;

        testResults.measurements.push({
          moveNumber: i + 1,
          propagationTimeMs: propagationTime
        });

        if (propagationTime > 500) {
          testResults.issues.push(
            `Move ${i + 1} propagation: ${propagationTime}ms (slow)`
          );
        }

        // Undo move for next test
        await page1.click('button:has-text("Undo")');
        await page1.waitForTimeout(500);
      }

      // Calculate statistics
      const times = testResults.measurements.map(m => m.propagationTimeMs);
      testResults.avgPropagation = times.reduce((a, b) => a + b, 0) / times.length;
      testResults.maxPropagation = Math.max(...times);
      testResults.minPropagation = Math.min(...times);
      testResults.passed = testResults.avgPropagation <= 300; // Average should be under 300ms

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/clock-propagation.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    } finally {
      if (page1) await page1.close();
      if (page2) await page2.close();
      if (context1) await context1.close();
      if (context2) await context2.close();
      if (browser1) await browser1.close();
      if (browser2) await browser2.close();
    }
  });
});

test.describe.configure({ mode: 'serial' });
