/**
 * Test script to verify GameEndCard compatibility with completed games
 */

// Mock localStorage
const mockLocalStorage = {
  data: {
    'chess_completed_games': JSON.stringify([{
      id: 'completed_16996543212',
      gameId: 'completed_16996543212',
      fen: 'rnbqkbnr/pppppppp/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '1. e4 e5 2. Nf6 Nc6 3. e4',
      moves: [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }],
      playerColor: 'w',
      opponentName: 'Computer',
      gameMode: 'computer',
      computerLevel: 3,
      result: { winner: 'white', type: 'checkmate' },
      playerScore: 100,
      opponentScore: 0,
      timestamp: 1699654321212,
      status: 'completed',
      completed: true,
      source: 'localStorage'
    }])
  },
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; }
};

global.localStorage = mockLocalStorage;

// Test the GameEndCard component requirements
console.log('=== Testing GameEndCard Compatibility ===');

// Test 1: Check if completed game has all required properties
const completedGame = JSON.parse(mockLocalStorage.getItem('chess_completed_games'))[0];

console.log('1. Testing completed game structure:');
console.log('   has_moves:', !!completedGame.moves);
console.log('   moves_type:', Array.isArray(completedGame.moves) ? 'array' : (typeof completedGame.moves === 'string' ? 'string' : 'undefined'));
console.log('   moves_length:', Array.isArray(completedGame.moves) ? completedGame.moves.length : (typeof completedGame.moves === 'string' ? completedGame.moves.split(';').length : 0));
console.log('   has_created_at:', !!completedGame.created_at);
console.log('   has_played_at:', !!completedGame.played_at);
console.log('   has_ended_at:', !!completedGame.ended_at);

// Test 2: Simulate GameEndCard duration calculation
const testDurationCalculation = (game) => {
  console.log('\n2. Testing duration calculation with:');
  console.log('   created_at:', game.created_at);
  console.log('   ended_at:', game.ended_at);

  if (!game.created_at || !game.ended_at) {
    console.log('   ❌ Missing timestamps - cannot calculate duration');
    return 'Error';
  }

  const createdDate = new Date(game.created_at);
  const endedDate = new Date(game.ended_at);
  const durationMs = endedDate.getTime() - createdDate.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);

  if (durationSeconds < 0) {
    console.log('   ❌ Negative duration calculated');
    return 'Error';
  }

  if (durationSeconds > 7200) {
    console.log('   ✅ Duration capped at 2 hours');
    return '2h 0m 0s';
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  console.log('   ✅ Duration calculated:', durationText);
  return durationText;
};

const result = testDurationCalculation(completedGame);
console.log('   Duration result:', result);

console.log('\n=== Compatibility Test Results ===');

if (
  !!completedGame.moves &&
  Array.isArray(completedGame.moves) &&
  completedGame.moves.length > 0 &&
  completedGame.created_at &&
  completedGame.ended_at &&
  testDurationCalculation(completedGame) !== 'Error'
) {
  console.log('✅ SUCCESS: GameEndCard should work correctly with completed games!');
  console.log('✓ All required properties are present');
  console.log('✓ Duration calculation should work');
  console.log('✓ No more "has_moves: false" or "moves_type: undefined" errors');
} else {
  console.log('❌ FAILURE: GameEndCard compatibility issues remain');
  console.log('❌ Missing required properties or invalid data structure');
}

console.log('\n=== Test Complete ===');