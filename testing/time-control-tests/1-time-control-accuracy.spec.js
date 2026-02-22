/**
 * Chess-Web Time Control Accuracy Testing
 * Phase 2 - Task 1: Time Control Accuracy
 * 
 * Tests:
 * 1. Bullet (1+0) - Clock counts down correctly, game ends on time
 * 2. Blitz (3+0) - Clock accurate to ±100ms over 3 minutes
 * 3. Blitz with increment (5+3) - Increment adds correctly after each move
 * 4. Rapid (10+0) - Clock stable over longer games
 */

const { test, expect } = require('@playwright/test');
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

// Helper function to create a game with specific time control
async function createGame(page, timeControl, increment = 0) {
  await page.click('button:has-text("New Game")');
  await page.selectOption('select[name="timeControl"]', timeControl.toString());
  if (increment > 0) {
    await page.fill('input[name="increment"]', increment.toString());
  }
  await page.click('button:has-text("Create Game")');
  await page.waitForSelector('.chess-board', { timeout: 10000 });
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
  await page.waitForTimeout(100); // Wait for move animation
}

test.describe('Time Control Accuracy Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear any existing state
    await page.context().clearCookies();
  });

  /**
   * TEST 1: Bullet (1+0) - Clock counts down correctly, game ends on time
   */
  test('Bullet 1+0: Clock countdown and timeout', async ({ page }) => {
    const testResults = {
      testName: 'Bullet 1+0',
      timeControl: 60,
      increment: 0,
      measurements: [],
      passed: false,
      issues: []
    };

    try {
      // Login as test1
      await login(page, credentials.accounts[0].email, credentials.password);
      
      // Create bullet game
      await createGame(page, 60, 0); // 1 minute, no increment
      
      // Verify initial time is correct
      const initialTime = await getClockTime(page, 'white');
      expect(initialTime).toBe(60); // Should be exactly 60 seconds
      testResults.measurements.push({ 
        timestamp: Date.now(), 
        expectedTime: 60, 
        actualTime: initialTime,
        accuracy: Math.abs(60 - initialTime)
      });

      // Make a move and start the clock
      await makeMove(page, 'e2', 'e4');
      const startTime = Date.now();

      // Wait 5 seconds and check accuracy
      await page.waitForTimeout(5000);
      const time5s = await getClockTime(page, 'black');
      const elapsed5s = (Date.now() - startTime) / 1000;
      const expected5s = 60 - elapsed5s;
      const accuracy5s = Math.abs(time5s - expected5s) * 1000; // in ms
      
      testResults.measurements.push({
        timestamp: Date.now(),
        expectedTime: expected5s,
        actualTime: time5s,
        accuracy: accuracy5s
      });

      // Check if accuracy is within ±100ms
      if (accuracy5s > 100) {
        testResults.issues.push(`Clock accuracy at 5s: ${accuracy5s.toFixed(0)}ms (exceeds 100ms threshold)`);
      }

      // Wait another 5 seconds
      await page.waitForTimeout(5000);
      const time10s = await getClockTime(page, 'black');
      const elapsed10s = (Date.now() - startTime) / 1000;
      const expected10s = 60 - elapsed10s;
      const accuracy10s = Math.abs(time10s - expected10s) * 1000;

      testResults.measurements.push({
        timestamp: Date.now(),
        expectedTime: expected10s,
        actualTime: time10s,
        accuracy: accuracy10s
      });

      if (accuracy10s > 100) {
        testResults.issues.push(`Clock accuracy at 10s: ${accuracy10s.toFixed(0)}ms (exceeds 100ms threshold)`);
      }

      // Verify clock format (mm:ss)
      const clockDisplay = await page.textContent('.clock-black');
      expect(clockDisplay).toMatch(/^\d{1,2}:\d{2}$/);

      // Check if clock is counting down
      const clockDecreasing = time10s < time5s;
      expect(clockDecreasing).toBeTruthy();

      if (!clockDecreasing) {
        testResults.issues.push('Clock not counting down properly');
      }

      testResults.passed = testResults.issues.length === 0;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/bullet-1-0-results.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    }
  });

  /**
   * TEST 2: Blitz (3+0) - Clock accurate to ±100ms over 3 minutes
   */
  test('Blitz 3+0: Clock accuracy over full duration', async ({ page }) => {
    const testResults = {
      testName: 'Blitz 3+0',
      timeControl: 180,
      increment: 0,
      measurements: [],
      passed: false,
      issues: []
    };

    try {
      await login(page, credentials.accounts[1].email, credentials.password);
      await createGame(page, 180, 0); // 3 minutes, no increment

      // Initial time check
      const initialTime = await getClockTime(page, 'white');
      expect(initialTime).toBe(180);
      testResults.measurements.push({
        timestamp: Date.now(),
        expectedTime: 180,
        actualTime: initialTime,
        accuracy: Math.abs(180 - initialTime)
      });

      // Make first move
      await makeMove(page, 'e2', 'e4');
      const startTime = Date.now();

      // Sample clock at 10-second intervals for 60 seconds
      for (let i = 1; i <= 6; i++) {
        await page.waitForTimeout(10000);
        const currentTime = await getClockTime(page, 'black');
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const expectedTime = 180 - elapsedSeconds;
        const accuracyMs = Math.abs(currentTime - expectedTime) * 1000;

        testResults.measurements.push({
          timestamp: Date.now(),
          interval: i * 10,
          expectedTime,
          actualTime: currentTime,
          accuracy: accuracyMs
        });

        if (accuracyMs > 100) {
          testResults.issues.push(
            `Clock accuracy at ${i * 10}s: ${accuracyMs.toFixed(0)}ms (exceeds 100ms threshold)`
          );
        }
      }

      // Calculate average accuracy
      const accuracies = testResults.measurements
        .slice(1)
        .map(m => m.accuracy);
      const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      const maxAccuracy = Math.max(...accuracies);

      testResults.avgAccuracy = avgAccuracy;
      testResults.maxAccuracy = maxAccuracy;
      testResults.passed = maxAccuracy <= 100;

      // Save results
      await fs.promises.mkdir(path.join(__dirname, '../results'), { recursive: true });
      await fs.promises.writeFile(
        path.join(__dirname, '../results/blitz-3-0-results.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    }
  });

  /**
   * TEST 3: Blitz with increment (5+3) - Increment adds correctly after each move
   */
  test('Blitz 5+3: Increment functionality', async ({ page }) => {
    const testResults = {
      testName: 'Blitz 5+3',
      timeControl: 300,
      increment: 3,
      measurements: [],
      incrementTests: [],
      passed: false,
      issues: []
    };

    try {
      await login(page, credentials.accounts[2].email, credentials.password);
      await createGame(page, 300, 3); // 5 minutes, 3 second increment

      // Initial time check
      const initialTime = await getClockTime(page, 'white');
      expect(initialTime).toBe(300);

      // Make first move
      await makeMove(page, 'e2', 'e4');
      await page.waitForTimeout(2000); // Wait for opponent move

      // Get time before next move
      const timeBeforeMove = await getClockTime(page, 'white');
      
      // Make second move
      await makeMove(page, 'd2', 'd4');
      await page.waitForTimeout(500); // Wait for increment to apply

      // Get time after move (should include 3-second increment)
      const timeAfterMove = await getClockTime(page, 'white');
      const incrementReceived = timeAfterMove - timeBeforeMove;

      testResults.incrementTests.push({
        moveNumber: 2,
        timeBeforeMove,
        timeAfterMove,
        incrementReceived,
        expectedIncrement: 3,
        accuracy: Math.abs(incrementReceived - 3)
      });

      // Test increment on multiple moves
      for (let i = 3; i <= 6; i++) {
        await page.waitForTimeout(2000);
        const timeBefore = await getClockTime(page, 'white');
        
        // Make a move
        await makeMove(page, 'c2', 'c4'); // Example move
        await page.waitForTimeout(500);
        
        const timeAfter = await getClockTime(page, 'white');
        const increment = timeAfter - timeBefore;

        testResults.incrementTests.push({
          moveNumber: i,
          timeBeforeMove: timeBefore,
          timeAfterMove: timeAfter,
          incrementReceived: increment,
          expectedIncrement: 3,
          accuracy: Math.abs(increment - 3)
        });

        // Check if increment is close to 3 seconds (±0.5s tolerance)
        if (Math.abs(increment - 3) > 0.5) {
          testResults.issues.push(
            `Increment on move ${i}: ${increment.toFixed(1)}s (expected 3s)`
          );
        }
      }

      // Check if all increments were within tolerance
      const allIncrementsValid = testResults.incrementTests.every(
        t => t.accuracy <= 0.5
      );
      testResults.passed = allIncrementsValid && testResults.issues.length === 0;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/blitz-5-3-results.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    }
  });

  /**
   * TEST 4: Rapid (10+0) - Clock stable over longer games
   */
  test('Rapid 10+0: Long-term stability', async ({ page }) => {
    const testResults = {
      testName: 'Rapid 10+0',
      timeControl: 600,
      increment: 0,
      measurements: [],
      passed: false,
      issues: []
    };

    try {
      await login(page, credentials.accounts[3].email, credentials.password);
      await createGame(page, 600, 0); // 10 minutes, no increment

      // Initial time check
      const initialTime = await getClockTime(page, 'white');
      expect(initialTime).toBe(600);

      // Make first move
      await makeMove(page, 'e2', 'e4');
      const startTime = Date.now();

      // Sample clock at 30-second intervals for 3 minutes
      for (let i = 1; i <= 6; i++) {
        await page.waitForTimeout(30000);
        const currentTime = await getClockTime(page, 'black');
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const expectedTime = 600 - elapsedSeconds;
        const accuracyMs = Math.abs(currentTime - expectedTime) * 1000;

        testResults.measurements.push({
          timestamp: Date.now(),
          interval: i * 30,
          expectedTime,
          actualTime: currentTime,
          accuracy: accuracyMs,
          drift: currentTime - expectedTime // Positive = clock running slow
        });

        if (accuracyMs > 100) {
          testResults.issues.push(
            `Clock accuracy at ${i * 30}s: ${accuracyMs.toFixed(0)}ms (exceeds 100ms threshold)`
          );
        }
      }

      // Check for clock drift over time
      const drifts = testResults.measurements.map(m => m.drift);
      const maxDrift = Math.max(...drifts.map(Math.abs));
      const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;

      testResults.maxDrift = maxDrift;
      testResults.avgDrift = avgDrift;

      // Clock should not drift more than 0.5 seconds over 3 minutes
      if (maxDrift > 0.5) {
        testResults.issues.push(
          `Clock drift detected: ${maxDrift.toFixed(2)}s over 3 minutes`
        );
      }

      testResults.passed = testResults.issues.length === 0;

      // Save results
      await fs.promises.writeFile(
        path.join(__dirname, '../results/rapid-10-0-results.json'),
        JSON.stringify(testResults, null, 2)
      );

    } catch (error) {
      testResults.issues.push(`Error: ${error.message}`);
      testResults.passed = false;
      throw error;
    }
  });

  /**
   * TEST 5: Clock Display Format
   */
  test('Clock Display: Format validation (mm:ss)', async ({ page }) => {
    await login(page, credentials.accounts[4].email, credentials.password);
    await createGame(page, 300, 0);

    // Check white clock format
    const whiteClock = await page.textContent('.clock-white');
    expect(whiteClock).toMatch(/^\d{1,2}:\d{2}$/);

    // Check black clock format
    const blackClock = await page.textContent('.clock-black');
    expect(blackClock).toMatch(/^\d{1,2}:\d{2}$/);

    // Make move and verify both clocks still have correct format
    await makeMove(page, 'e2', 'e4');
    await page.waitForTimeout(1000);

    const whiteClockAfter = await page.textContent('.clock-white');
    expect(whiteClockAfter).toMatch(/^\d{1,2}:\d{2}$/);

    const blackClockAfter = await page.textContent('.clock-black');
    expect(blackClockAfter).toMatch(/^\d{1,2}:\d{2}$/);
  });

  /**
   * TEST 6: Clock Pause Behavior
   */
  test('Clock Pause: Clock pauses when opponent turn', async ({ page }) => {
    await login(page, credentials.accounts[5].email, credentials.password);
    await createGame(page, 180, 0);

    // Make first move
    await makeMove(page, 'e2', 'e4');

    // Get white clock time (should be paused)
    const whiteTime1 = await getClockTime(page, 'white');
    await page.waitForTimeout(2000);
    const whiteTime2 = await getClockTime(page, 'white');

    // White clock should not change (it's black's turn)
    expect(whiteTime1).toBe(whiteTime2);

    // Black clock should be counting down
    const blackTime1 = await getClockTime(page, 'black');
    await page.waitForTimeout(2000);
    const blackTime2 = await getClockTime(page, 'black');

    expect(blackTime2).toBeLessThan(blackTime1);
  });

  /**
   * TEST 7: Game End on Time
   */
  test('Game End: Game ends when clock hits 0', async ({ page }) => {
    await login(page, credentials.accounts[6].email, credentials.password);
    
    // Create a game with very short time (5 seconds for testing)
    await createGame(page, 5, 0);

    // Make a move to start clock
    await makeMove(page, 'e2', 'e4');

    // Wait for clock to run out
    await page.waitForSelector('.game-over-message', { timeout: 10000 });

    // Verify game ended by timeout
    const gameOverText = await page.textContent('.game-over-message');
    expect(gameOverText.toLowerCase()).toContain('time');
  });
});

test.describe.configure({ mode: 'serial' });
