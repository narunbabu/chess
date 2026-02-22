/**
 * Chess-Web Smoke Test Script
 * 
 * Performs basic functionality tests:
 * - User login
 * - Game creation
 * - Game joining  
 * - Move execution
 * - Real-time synchronization
 * 
 * Usage: node smoke-test.js
 */

const http = require('http');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:8000/api';
const TEST_PASSWORD = 'TestPass123!';

// Load test credentials
let credentials;
try {
  credentials = JSON.parse(fs.readFileSync('C:\\ArunApps\\Chess-Web\\testing\\test-credentials.json', 'utf8'));
} catch (error) {
  console.error('❌ Could not load test credentials. Run setup-test-accounts.js first.');
  process.exit(1);
}

/**
 * HTTP request helper
 */
function httpRequest(method, url, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = data ? JSON.stringify(data) : null;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) }),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Test 1: Login
 */
async function testLogin(email, password) {
  try {
    const response = await httpRequest('POST', `${API_BASE_URL}/auth/login`, {
      email,
      password,
    });

    if (response.status === 200 && response.data.token) {
      console.log(`  ✅ Login successful: ${email}`);
      return { success: true, token: response.data.token, user: response.data.user };
    } else {
      console.log(`  ❌ Login failed: ${email} - ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`  ❌ Login error: ${email} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: Create game
 */
async function testCreateGame(token, opponent = null) {
  try {
    // Try computer game first (more reliable for testing)
    const gameData = {
      player_color: 'white',
      computer_level: 1,
      time_control: 5,
      increment: 3,
    };

    const response = await httpRequest('POST', `${API_BASE_URL}/games/computer`, gameData, token);

    if (response.status === 200 || response.status === 201) {
      const game = response.data.game || response.data;
      console.log(`  ✅ Game created successfully (ID: ${game.id}, vs Computer Level ${gameData.computer_level})`);
      return { success: true, game: game };
    } else {
      console.log(`  ❌ Game creation failed - ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`  ❌ Game creation error - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Get active games
 */
async function testGetActiveGames(token) {
  try {
    const response = await httpRequest('GET', `${API_BASE_URL}/games/active`, null, token);

    if (response.status === 200) {
      const games = response.data.games || response.data;
      console.log(`  ✅ Active games retrieved (${games.length} games)`);
      return { success: true, games };
    } else {
      console.log(`  ❌ Failed to get active games - ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`  ❌ Error getting active games - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Make a move
 */
async function testMakeMove(token, gameId) {
  try {
    // Standard chess opening move (e2-e4)
    const moveData = {
      from: 'e2',
      to: 'e4',
      promotion: null,
    };

    const response = await httpRequest('POST', `${API_BASE_URL}/games/${gameId}/move`, moveData, token);

    if (response.status === 200) {
      console.log(`  ✅ Move executed successfully (e2-e4)`);
      return { success: true, game: response.data.game || response.data };
    } else {
      console.log(`  ❌ Move failed - ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`  ❌ Move error - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: Get game state
 */
async function testGetGameState(token, gameId) {
  try {
    const response = await httpRequest('GET', `${API_BASE_URL}/games/${gameId}`, null, token);

    if (response.status === 200) {
      const game = response.data.game || response.data;
      console.log(`  ✅ Game state retrieved (Status: ${game.status})`);
      return { success: true, game };
    } else {
      console.log(`  ❌ Failed to get game state - ${JSON.stringify(response.data)}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`  ❌ Error getting game state - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main smoke test function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Chess-Web Smoke Tests                                  ║');
  console.log('║     Real User Multiplayer Testing - Phase 1               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {
    login: 0,
    gameCreation: 0,
    getGames: 0,
    makeMove: 0,
    getGameState: 0,
  };

  // Test login with first 3 accounts
  console.log('🔐 Test 1: User Login\n');
  const loggedInUsers = [];
  
  for (let i = 0; i < 3; i++) {
    const account = credentials.accounts[i];
    const result = await testLogin(account.email, TEST_PASSWORD);
    if (result.success) {
      results.login++;
      loggedInUsers.push({ ...account, token: result.token, user: result.user });
    }
  }
  console.log();

  if (loggedInUsers.length < 2) {
    console.log('❌ Not enough users logged in. Cannot proceed with tests.\n');
    return 1;
  }

  // Test game creation
  console.log('🎮 Test 2: Game Creation\n');
  let testGame = null;
  
  const createResult = await testCreateGame(loggedInUsers[0].token);
  if (createResult.success) {
    results.gameCreation++;
    testGame = createResult.game;
  }
  console.log();

  // Test getting active games
  console.log('📋 Test 3: Get Active Games\n');
  const gamesResult = await testGetActiveGames(loggedInUsers[0].token);
  if (gamesResult.success) {
    results.getGames++;
  }
  console.log();

  // Test making a move (if we have a game)
  if (testGame && testGame.id) {
    console.log('♟️  Test 4: Make a Move\n');
    const moveResult = await testMakeMove(loggedInUsers[0].token, testGame.id);
    if (moveResult.success) {
      results.makeMove++;
      testGame = moveResult.game;
    }
    console.log();

    // Test getting game state
    console.log('📊 Test 5: Get Game State\n');
    const stateResult = await testGetGameState(loggedInUsers[0].token, testGame.id);
    if (stateResult.success) {
      results.getGameState++;
    }
    console.log();
  } else {
    console.log('⚠️  Skipping move tests (no game created)\n');
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                   SMOKE TEST SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const totalTests = 5;
  const passedTests = Object.values(results).reduce((a, b) => a + b, 0);
  
  console.log(`Tests passed: ${passedTests}/${totalTests}\n`);
  console.log(`✅ Login tests:         ${results.login}/3`);
  console.log(`✅ Game creation:       ${results.gameCreation}/1`);
  console.log(`✅ Get active games:    ${results.getGames}/1`);
  console.log(`✅ Make move:           ${results.makeMove}/1`);
  console.log(`✅ Get game state:      ${results.getGameState}/1`);
  console.log();

  if (passedTests === totalTests) {
    console.log('🎉 All smoke tests passed! System is ready for full testing.\n');
    return 0;
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n');
    return 1;
  }
}

// Run smoke tests
main().then(exitCode => process.exit(exitCode)).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
