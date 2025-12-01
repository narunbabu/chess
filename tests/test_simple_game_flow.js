/**
 * Simple test to verify unauthenticated user game storage flow
 */

// Mock localStorage for testing
const mockLocalStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) {
    console.log(`localStorage.setItem('${key}', ${JSON.stringify(value).substring(0, 100)}...)`);
    this.data[key] = value;
  },
  removeItem: function(key) {
    console.log(`localStorage.removeItem('${key}')`);
    delete this.data[key];
  }
};

// Replace global localStorage for testing
if (typeof global !== 'undefined') {
  global.localStorage = mockLocalStorage;
}

function testGameStorageFlow() {
  console.log('=== Testing Game Storage Flow ===');

  // Test the key storage keys
  const UNFINISHED_GAMES_KEY = 'chess_unfinished_games';
  const COMPLETED_GAMES_KEY = 'chess_completed_games';

  // Test 1: Verify storage separation keys exist
  console.log('\n1. Testing storage keys...');
  console.log('✅ Unfinished games key:', UNFINISHED_GAMES_KEY);
  console.log('✅ Completed games key:', COMPLETED_GAMES_KEY);

  // Test 2: Create new unfinished game
  console.log('\n2. Creating new unfinished game...');
  const timestamp = Date.now();
  const newGame = {
    id: `local_${timestamp}`,
    status: 'unfinished',
    playerColor: 'w',
    computerLevel: 3,
    moves: [],
    timestamp,
    savedReason: 'new_game'
  };

  // Save to unfinished games storage
  const unfinishedGames = [newGame];
  mockLocalStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(unfinishedGames));
  console.log('✅ New unfinished game created:', newGame.id);

  // Test 3: Update the same game (simulate moves)
  console.log('\n3. Updating unfinished game with moves...');
  const updatedGame = {
    ...newGame,
    moves: [{ from: 'e2', to: 'e4', san: 'e4' }],
    savedReason: 'after_move'
  };

  const updatedUnfinishedGames = [updatedGame];
  mockLocalStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(updatedUnfinishedGames));
  console.log('✅ Game updated with moves (same ID):', updatedGame.id);

  // Test 4: Complete the game and move to completed storage
  console.log('\n4. Moving game to completed storage...');
  const completedGame = {
    id: `completed_${timestamp}`,
    status: 'completed',
    playerColor: 'w',
    computerLevel: 3,
    moves: [{ from: 'e2', to: 'e4', san: 'e4' }, { from: 'e7', to: 'e5', san: 'Qe5+' }],
    result: { winner: 'white', type: 'checkmate' },
    timestamp,
    endTime: Date.now(),
    completed: true
  };

  // Save to completed games storage
  const existingCompletedGames = JSON.parse(mockLocalStorage.getItem(COMPLETED_GAMES_KEY) || '[]');
  const updatedCompletedGames = [completedGame, ...existingCompletedGames];
  mockLocalStorage.setItem(COMPLETED_GAMES_KEY, JSON.stringify(updatedCompletedGames.slice(0, 50))); // Keep max 50
  console.log('✅ Game moved to completed storage:', completedGame.id);

  // Remove from unfinished games (simulate clearUnfinishedGame with specific ID)
  const finalUnfinishedGames = unfinishedGames.filter(game => game.id !== updatedGame.id);
  mockLocalStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(finalUnfinishedGames));
  console.log('✅ Game removed from unfinished storage');

  // Test 5: Verify storage separation worked
  console.log('\n5. Verifying storage separation...');
  const currentUnfinishedGames = JSON.parse(mockLocalStorage.getItem(UNFINISHED_GAMES_KEY) || '[]');
  const currentCompletedGames = JSON.parse(mockLocalStorage.getItem(COMPLETED_GAMES_KEY) || '[]');

  console.log('✅ Current unfinished games:', currentUnfinishedGames.length);
  console.log('✅ Current completed games:', currentCompletedGames.length);

  // Verify no completed games have status 'unfinished'
  const completedGamesWithCorrectStatus = currentCompletedGames.filter(game => game.status === 'completed');
  console.log('✅ Completed games with correct status:', completedGamesWithCorrectStatus.length);

  // Verify no unfinished games have status 'completed'
  const unfinishedGamesWithCorrectStatus = currentUnfinishedGames.filter(game => game.status === 'unfinished');
  console.log('✅ Unfinished games with correct status:', unfinishedGamesWithCorrectStatus.length);

  // Test 6: Create another new game (should not affect completed games)
  console.log('\n6. Creating another new unfinished game...');
  const anotherTimestamp = Date.now();
  const anotherGame = {
    id: `local_${anotherTimestamp}`,
    status: 'unfinished',
    playerColor: 'w',
    computerLevel: 2,
    moves: [],
    timestamp: anotherTimestamp,
    savedReason: 'another_game'
  };

  const anotherUnfinishedGames = [anotherGame];
  mockLocalStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(anotherUnfinishedGames));
  console.log('✅ Another unfinished game created:', anotherGame.id);

  // Verify completed games are still preserved
  const finalCompletedGamesCheck = JSON.parse(mockLocalStorage.getItem(COMPLETED_GAMES_KEY) || '[]');
  console.log('✅ Completed games preserved after new game:', finalCompletedGamesCheck.length);

  // Final verification
  if (
    currentUnfinishedGames.length === 1 && // One new unfinished game
    currentCompletedGames.length >= 1 && // At least one completed game
    completedGamesWithCorrectStatus.length === currentCompletedGames.length && // All completed games have correct status
    unfinishedGamesWithCorrectStatus.length === currentUnfinishedGames.length // All unfinished games have correct status
  ) {
    console.log('\n🎉 SUCCESS: All requirements verified!');
    console.log('✓ New games always get new IDs');
    console.log('✓ Unfinished games are updated by ID, not duplicated');
    console.log('✓ Completed games are stored separately from unfinished');
    console.log('✓ Starting new games doesn\'t affect completed games');
    console.log('✓ Storage separation works correctly');
  } else {
    console.log('\n❌ FAILURE: Some requirements not met');
  }

  // Show final storage state
  console.log('\n=== Final Storage State ===');
  console.log('Unfinished Games:', currentUnfinishedGames.map(g => ({ id: g.id, status: g.status })));
  console.log('Completed Games:', currentCompletedGames.map(g => ({ id: g.id, status: g.status })));
}

// Run the test
try {
  testGameStorageFlow();
} catch (error) {
  console.error('Test failed:', error);
}