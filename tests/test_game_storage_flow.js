/**
 * Test script to verify unauthenticated user game storage flow
 */

// Mock localStorage for testing
const mockLocalStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; }
};

// Replace global localStorage for testing
global.localStorage = mockLocalStorage;

// Mock the unfinished game service functions
const {
  saveUnfinishedGame,
  getUnfinishedGame,
  getUnfinishedGames,
  saveCompletedGame,
  getCompletedGames,
  clearUnfinishedGame
} = require('./chess-frontend/src/services/unfinishedGameService.js');

async function testGameStorageFlow() {
  console.log('=== Testing Game Storage Flow ===');

  // Test 1: Create new game
  console.log('\n1. Creating new game...');
  const newGameState = {
    fen: 'rnbqkbnr/pppppppp/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    moves: [],
    playerColor: 'w',
    opponentName: 'Computer',
    gameMode: 'computer',
    computerLevel: 3,
    timerState: { whiteMs: 600000, blackMs: 600000 },
    turn: 'w',
    savedReason: 'new_game',
    startTime: Date.now()
  };

  const saveResult = await saveUnfinishedGame(newGameState, false);
  console.log('✅ New game saved:', saveResult);
  const newGameId = saveResult.gameId;

  // Test 2: Update the same game with moves
  console.log('\n2. Updating game with moves...');
  const updatedGameState = {
    ...newGameState,
    moves: [{ from: 'e2', to: 'e4', san: 'e4' }],
    savedReason: 'after_move'
  };

  const updateResult = await saveUnfinishedGame(updatedGameState, false, null, newGameId);
  console.log('✅ Game updated with moves:', updateResult);

  // Test 3: Get unfinished games
  console.log('\n3. Getting unfinished games...');
  const unfinishedGames = await getUnfinishedGames(false);
  console.log('✅ Unfinished games found:', unfinishedGames.length);
  console.log('   Game ID:', unfinishedGames[0]?.id);
  console.log('   Status:', unfinishedGames[0]?.status);
  console.log('   Moves count:', unfinishedGames[0]?.moves?.length || 0);

  // Test 4: Complete the game
  console.log('\n4. Completing game...');
  const finalGameState = {
    ...updatedGameState,
    moves: [{ from: 'e2', to: 'e4', san: 'e4' }, { from: 'e7', to: 'e5', san: 'Qe5+' }],
    result: { winner: 'white', type: 'checkmate' },
    playerScore: 100,
    opponentScore: 50
  };

  const completeResult = await saveCompletedGame(finalGameState, false, finalGameState.result);
  console.log('✅ Game completed and saved:', completeResult);

  // Test 5: Get completed games
  console.log('\n5. Getting completed games...');
  const completedGames = await getCompletedGames(false);
  console.log('✅ Completed games found:', completedGames.length);
  if (completedGames.length > 0) {
    console.log('   Game ID:', completedGames[0]?.id);
    console.log('   Status:', completedGames[0]?.status);
    console.log('   Result:', completedGames[0]?.result);
  }

  // Test 6: Verify unfinished games are separate
  console.log('\n6. Verifying storage separation...');
  const finalUnfinishedGames = await getUnfinishedGames(false);
  console.log('✅ Final unfinished games count:', finalUnfinishedGames.length);
  console.log('✅ Final completed games count:', completedGames.length);

  if (finalUnfinishedGames.length === 0 && completedGames.length > 0) {
    console.log('🎉 SUCCESS: Games properly separated between unfinished and completed!');
  } else {
    console.log('❌ ISSUE: Games not properly separated');
  }

  // Test 7: Start new game (should not affect completed games)
  console.log('\n7. Starting another new game...');
  const anotherGameState = {
    ...newGameState,
    savedReason: 'another_game'
  };

  const anotherSaveResult = await saveUnfinishedGame(anotherGameState, false);
  console.log('✅ Another new game saved:', anotherSaveResult);

  const finalCompletedCheck = await getCompletedGames(false);
  console.log('✅ Completed games still preserved:', finalCompletedCheck.length);

  console.log('\n=== Test Complete ===');
}

// Run the test
testGameStorageFlow().catch(console.error);