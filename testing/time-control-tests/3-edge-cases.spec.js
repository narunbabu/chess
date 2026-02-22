/**
 * Chess-Web Time Control Edge Cases Testing
 * Phase 2 - Task 3: Edge Cases
 * 
 * Tests:
 * 1. Very fast moves (< 1 second apart) - does clock update correctly?
 * 2. Reconnection - disconnect one player, reconnect - does clock resume correctly?
 * 3. Multiple games - run 3-4 concurrent games - do clocks interfere?
 * 4. Page refresh - refresh during game - does clock state recover?
 */

const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const credentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'test-credentials.json'), 'utf-8')
);

const BASE_URL = 'http://localhost:3000';

// Helper functions
function parseTimeDisplay(timeStr) {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
}

async function login(page, email, password) {
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function getClockTime(page, player = 'white') {
  const selector = `.clock-${player}`;
  const timeStr = await page.textContent(selector);
  return parseTimeDisplay(timeStr);
}

async function makeMove(page, from, to) {
  await page.click(`[data-square="${from}"]`);
  await page.click(`[data-square="${to}"]`);
  await page.waitForTimeout(100);
}

test.describe('Time Control Edge Cases', () => {

  /**
   * TEST 1: Very Fast Moves (<1 second apart)
   */
  test('Fast Moves: Rapid move execution clock handling', async () => {
    const testResults = {
      testName: 'Very Fast Moves',
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

      await login(page1, credentials.accounts[0].email, credentials.password);
      await login(page2, credentials.accounts[1].email, credentials.password);

      // Create game
      await page1.click('button:has-text("New Game")');
      await page1.selectOption('select[name="timeControl"]', '180');
      await page1.selectOption('select[name="opponent"]', credentials.accounts[1].email);
      await page1.click('button:has-text("Create & Invite")');
      
      await page1.waitForSelector('.chess-board', { timeout: 10000 });
      await page2.click('button:has-text("Accept Game")');
      await page2.waitForSelector('.chess-board', { timeout: 10000 });

      await page1.waitForTimeout(1000);

      // Make 20 rapid moves (alternating between players)
      const moves = [
        ['e2', 'e4'], ['e7', 'e5'],
        ['g1', 'f3'], ['b8', 'c6'],
        ['f1', 'c4'], ['f8', 'c5'],
        ['c2', 'c3'], ['g8', 'f6'],
        ['d2', 'd4'], ['e5', 'd4'],
        ['c3', 'd4'], ['c5', 'b4'],
        ['b1', 'c3'], ['f6', 'e4'],
        ['e1', 'g1'], ['e4', 'c3'],
        ['b2', 'c3'], ['b4', 'c3'],
        ['d1', 'b3'], ['d7', 'd5']
      ];

      let moveNumber = 0;
      for (const [from, to] of moves) {
        const beforeMove = Date.now();
        const clockBefore = await getClockTime(
          moveNumber % 2 === 0 ? page1 : page2,
          moveNumber % 2 === 0 ? 'white' : 'black'
        );

        // Make move
        await makeMove(moveNumber % 2 === 0 ? page1 : page2, from, to);
        
        // Minimal wait (< 1 second)
        await page1.waitForTimeout(200);

        const afterMove = Date.now();
        const clockAfter = await getClockTime(
          moveNumber % 2 === 0 ? page1 : page2,
          moveNumber % 2 === 0 ? 'white' : 'black'
        );

        const moveTime = afterMove - beforeMove;
        const clockChange = clockBefore - clockAfter;

        testResults.measurements.push({
          moveNumber: moveNumber + 1,
          moveTimeMs: moveTime,
          clockBefore,
          clockAfter,
          clockChangeSeconds: clockChange,
          expectedClockChange: moveTime / 1000,
          accuracy: Math.abs(clockChange - moveTime / 1000)
        });

        // Clock should reflect actual elapsed time
        if (Math.abs(clockChange - moveTime / 1000) > 0.5) {
          testResults.issues.push(
            `Move ${moveNumber + 1}: Clock change ${clockChange.toFixed(1)}s ` +
            `vs actual ${(moveTime / 1000).toFixed(1)}s`
          );
        }

        moveNumber++;
      }

      // Calculate statistics
      const accuracies = testResults.measurements.map(m => m.accuracy);
      testResults.avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      testResults.maxAccuracy = Math.max(...accuracies);
      testResults.passed = testResults.maxAccuracy <= 0.5 && testResults.issues.length === 0;

      // Save results
      await fs.promises.mkdir(path.join(__dirname, '../results'), { recursive: true });
      await fs.promises.writeFile(
        path.join(__dirname, '../results/fast-moves.json'),
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

  /**
   * TEST 2: Reconnection - Clock State Recovery
   */
  test('Reconnection: Clock resumes correctly after disconnect', async () => {
    const testResults = {
      testName: 'Reconnection Recovery',
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

      await login(page1, credentials.accounts[2].email, credentials.password);
      await login(page2, credentials.accounts[3].email, credentials.password);

      // Create game
      await page1.click('button:has-text("New Game")');
      await page1.selectOption('select[name="timeControl"]', '300');
      await page1.selectOption('select[name="opponent"]', credentials.accounts[3].email);
      await page1.click('button:has-text("Create & Invite")');
      
      await page1.waitForSelector('.chess-board', { timeout: 10000 });
      await page2.click('button:has-text("Accept Game")');
      await page2.waitForSelector('.chess-board', { timeout: 10000 });

      await page1.waitForTimeout(1000);

      // Make a move and let clock run
      await makeMove(page1, 'e2', 'e4');
      await page1.waitForTimeout(2000);

      // Get clock state before disconnect
      const clockBeforeDisconnect = await getClockTime(page2, 'black');
      const timeBeforeDisconnect = Date.now();

      testResults.measurements.push({
        stage: 'before_disconnect',
        timestamp: timeBeforeDisconnect,
        clockTime: clockBeforeDisconnect
      });

      // Simulate disconnect by going offline
      await context2.setOffline(true);
      
      // Wait 5 seconds while disconnected
      await page1.waitForTimeout(5000);
      
      const timeAfterWait = Date.now();
      const disconnectDuration = (timeAfterWait - timeBeforeDisconnect) / 1000;

      // Reconnect
      await context2.setOffline(false);
      await page2.reload();
      
      // Wait for game to reload
      await page2.waitForSelector('.chess-board', { timeout: 10000 });
      await page2.waitForTimeout(2000);

      // Get clock state after reconnect
      const clockAfterReconnect = await getClockTime(page2, 'black');
      const timeAfterReconnect = Date.now();

      testResults.measurements.push({
        stage: 'after_reconnect',
        timestamp: timeAfterReconnect,
        clockTime: clockAfterReconnect,
        disconnectDurationSeconds: disconnectDuration
      });

      // Clock should reflect the time that passed while disconnected
      const expectedClockAfter = clockBeforeDisconnect - disconnectDuration;
      const actualClockChange = clockBeforeDisconnect - clockAfterReconnect;
      const accuracy = Math.abs(actualClockChange - disconnectDuration);

      testResults.clockBeforeDisconnect = clockBeforeDisconnect;
      testResults.clockAfterReconnect = clockAfterReconnect;
      testResults.expectedClockAfter = expectedClockAfter;
      testResults.accuracy = accuracy;

      if (accuracy > 1.0) {
        testResults.issues.push(
          `Clock recovery inaccurate: ${accuracy.toFixed(1)}s difference`
        );
      }

      testResults.passed = accuracy <= 1.0;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/reconnection.json'),
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

  /**
   * TEST 3: Multiple Concurrent Games - Clock Isolation
   */
  test('Multiple Games: Concurrent games clock isolation', async () => {
    const testResults = {
      testName: 'Multiple Concurrent Games',
      games: [],
      passed: false,
      issues: []
    };

    const browsers = [];
    const contexts = [];
    const pages = [];

    try {
      // Create 4 games (8 players total)
      for (let i = 0; i < 8; i++) {
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await login(page, credentials.accounts[i].email, credentials.password);
        
        browsers.push(browser);
        contexts.push(context);
        pages.push(page);
      }

      // Create 4 games
      for (let gameNum = 0; gameNum < 4; gameNum++) {
        const player1Index = gameNum * 2;
        const player2Index = gameNum * 2 + 1;

        // Player 1 creates game
        await pages[player1Index].click('button:has-text("New Game")');
        await pages[player1Index].selectOption('select[name="timeControl"]', '180');
        await pages[player1Index].selectOption(
          'select[name="opponent"]',
          credentials.accounts[player2Index].email
        );
        await pages[player1Index].click('button:has-text("Create & Invite")');
        
        await pages[player1Index].waitForSelector('.chess-board', { timeout: 10000 });
        
        // Player 2 accepts
        await pages[player2Index].click('button:has-text("Accept Game")');
        await pages[player2Index].waitForSelector('.chess-board', { timeout: 10000 });

        testResults.games.push({
          gameNumber: gameNum + 1,
          player1: credentials.accounts[player1Index].email,
          player2: credentials.accounts[player2Index].email,
          measurements: []
        });
      }

      await pages[0].waitForTimeout(2000);

      // Make moves in all games simultaneously and check clocks
      for (let round = 0; round < 5; round++) {
        const roundData = [];

        for (let gameNum = 0; gameNum < 4; gameNum++) {
          const player1Index = gameNum * 2;
          const player2Index = gameNum * 2 + 1;

          // Get clock times before moves
          const whiteTimeBefore = await getClockTime(pages[player1Index], 'white');
          const blackTimeBefore = await getClockTime(pages[player1Index], 'black');

          // Player 1 makes move
          await makeMove(pages[player1Index], 'e2', 'e4');
          await pages[player1Index].waitForTimeout(500);

          // Player 2 makes move
          await makeMove(pages[player2Index], 'e7', 'e5');
          await pages[player2Index].waitForTimeout(500);

          // Get clock times after moves
          const whiteTimeAfter = await getClockTime(pages[player1Index], 'white');
          const blackTimeAfter = await getClockTime(pages[player1Index], 'black');

          roundData.push({
            gameNumber: gameNum + 1,
            round: round + 1,
            whiteTimeBefore,
            blackTimeBefore,
            whiteTimeAfter,
            blackTimeAfter,
            whiteDelta: whiteTimeBefore - whiteTimeAfter,
            blackDelta: blackTimeBefore - blackTimeAfter
          });

          testResults.games[gameNum].measurements.push(roundData[roundData.length - 1]);
        }

        // Check if any game's clock affected another
        for (let i = 0; i < 4; i++) {
          for (let j = i + 1; j < 4; j++) {
            const game1White = roundData[i].whiteTimeAfter;
            const game2White = roundData[j].whiteTimeAfter;
            
            // Clocks should be independent
            if (Math.abs(game1White - game2White) < 1 && Math.abs(game1White - 180) > 10) {
              testResults.issues.push(
                `Round ${round + 1}: Game ${i + 1} and Game ${j + 1} clocks suspiciously similar`
              );
            }
          }
        }
      }

      testResults.passed = testResults.issues.length === 0;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/multiple-games.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    } finally {
      // Cleanup all browsers
      for (let i = 0; i < pages.length; i++) {
        if (pages[i]) await pages[i].close();
        if (contexts[i]) await contexts[i].close();
        if (browsers[i]) await browsers[i].close();
      }
    }
  });

  /**
   * TEST 4: Page Refresh - Clock State Recovery
   */
  test('Page Refresh: Clock state persists after refresh', async () => {
    const testResults = {
      testName: 'Page Refresh Recovery',
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

      await login(page1, credentials.accounts[6].email, credentials.password);
      await login(page2, credentials.accounts[7].email, credentials.password);

      // Create game
      await page1.click('button:has-text("New Game")');
      await page1.selectOption('select[name="timeControl"]', '180');
      await page1.selectOption('select[name="opponent"]', credentials.accounts[7].email);
      await page1.click('button:has-text("Create & Invite")');
      
      await page1.waitForSelector('.chess-board', { timeout: 10000 });
      await page2.click('button:has-text("Accept Game")');
      await page2.waitForSelector('.chess-board', { timeout: 10000 });

      await page1.waitForTimeout(1000);

      // Make some moves
      await makeMove(page1, 'e2', 'e4');
      await page1.waitForTimeout(2000);
      await makeMove(page2, 'e7', 'e5');
      await page1.waitForTimeout(2000);

      // Get clock state before refresh
      const whiteBeforeRefresh = await getClockTime(page1, 'white');
      const blackBeforeRefresh = await getClockTime(page1, 'black');
      const timeBeforeRefresh = Date.now();

      testResults.measurements.push({
        stage: 'before_refresh',
        timestamp: timeBeforeRefresh,
        whiteTime: whiteBeforeRefresh,
        blackTime: blackBeforeRefresh
      });

      // Refresh page1
      await page1.reload();
      await page1.waitForSelector('.chess-board', { timeout: 10000 });
      await page1.waitForTimeout(1000);

      const timeAfterRefresh = Date.now();
      const refreshDuration = (timeAfterRefresh - timeBeforeRefresh) / 1000;

      // Get clock state after refresh
      const whiteAfterRefresh = await getClockTime(page1, 'white');
      const blackAfterRefresh = await getClockTime(page1, 'black');

      testResults.measurements.push({
        stage: 'after_refresh',
        timestamp: timeAfterRefresh,
        whiteTime: whiteAfterRefresh,
        blackTime: blackAfterRefresh,
        refreshDurationSeconds: refreshDuration
      });

      // Clock should reflect the time that passed during refresh
      const expectedWhiteAfter = whiteBeforeRefresh - refreshDuration;
      const whiteAccuracy = Math.abs(whiteAfterRefresh - expectedWhiteAfter);

      testResults.whiteBeforeRefresh = whiteBeforeRefresh;
      testResults.whiteAfterRefresh = whiteAfterRefresh;
      testResults.expectedWhiteAfter = expectedWhiteAfter;
      testResults.whiteAccuracy = whiteAccuracy;

      if (whiteAccuracy > 2.0) {
        testResults.issues.push(
          `Clock recovery after refresh inaccurate: ${whiteAccuracy.toFixed(1)}s`
        );
      }

      // Check if board state is preserved
      const movesCount = await page1.evaluate(() => {
        return document.querySelectorAll('.move-history .move').length;
      });

      if (movesCount < 2) {
        testResults.issues.push('Move history not preserved after refresh');
      }

      testResults.passed = whiteAccuracy <= 2.0 && movesCount >= 2;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/page-refresh.json'),
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

  /**
   * TEST 5: Time Display Edge Cases
   */
  test('Time Display: Edge cases (0:59, 0:01, 0:00)', async ({ page }) => {
    const testResults = {
      testName: 'Time Display Edge Cases',
      tests: [],
      passed: false,
      issues: []
    };

    try {
      await login(page, credentials.accounts[8].email, credentials.password);

      // Create very short game (10 seconds)
      await page.click('button:has-text("New Game")');
      await page.selectOption('select[name="timeControl"]', '10');
      await page.click('button:has-text("Create Game")');
      
      await page.waitForSelector('.chess-board', { timeout: 10000 });

      // Make move to start clock
      await makeMove(page, 'e2', 'e4');

      // Watch clock as it counts down through edge cases
      let previousTime = 10;
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1000);
        
        const clockDisplay = await page.textContent('.clock-black');
        const clockSeconds = parseTimeDisplay(clockDisplay);

        testResults.tests.push({
          second: i + 1,
          display: clockDisplay,
          parsedSeconds: clockSeconds,
          isValid: /^\d{1,2}:\d{2}$/.test(clockDisplay),
          isDecreasing: clockSeconds < previousTime
        });

        // Check format is always valid
        if (!/^\d{1,2}:\d{2}$/.test(clockDisplay)) {
          testResults.issues.push(
            `Second ${i + 1}: Invalid format "${clockDisplay}"`
          );
        }

        // Check clock is decreasing
        if (clockSeconds >= previousTime && clockSeconds > 0) {
          testResults.issues.push(
            `Second ${i + 1}: Clock not decreasing (${clockSeconds} >= ${previousTime})`
          );
        }

        previousTime = clockSeconds;

        // Stop when game ends
        const gameOver = await page.locator('.game-over-message').isVisible();
        if (gameOver) {
          break;
        }
      }

      testResults.passed = testResults.issues.length === 0;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/time-display-edge-cases.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    }
  });
});

test.describe.configure({ mode: 'serial' });
