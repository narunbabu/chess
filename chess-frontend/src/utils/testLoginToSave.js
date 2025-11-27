// Test script to verify "Login to Save" functionality
// Can be run in browser console to test the implementation

import { storePendingGame, getPendingGame, savePendingGame } from '../services/gameHistoryService';

console.log('🧪 Testing "Login to Save" Implementation');

// Test 1: Store pending game with array moves
const testGameData = {
  result: { winner: 'white', reason: 'checkmate' },
  score: 10,
  opponentScore: 8,
  playerColor: 'w',
  timestamp: new Date().toISOString(),
  computerLevel: 5,
  moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], // Array format
  gameId: null,
  opponentRating: null,
  opponentId: null,
  championshipData: null,
  isMultiplayer: false
};

console.log('📝 Step 1: Storing pending game with array moves...');
storePendingGame(testGameData);

// Test 2: Retrieve pending game
console.log('📖 Step 2: Retrieving pending game...');
const retrievedGame = getPendingGame();

if (retrievedGame) {
  console.log('✅ Pending game found!');
  console.log('📊 Moves format:', typeof retrievedGame.gameData.moves);
  console.log('📊 Moves sample:', retrievedGame.gameData.moves?.substring?.(0, 100));

  // Test 3: Validate moves format for backend
  if (typeof retrievedGame.gameData.moves === 'string') {
    console.log('✅ Moves converted to string for backend compatibility');
  } else {
    console.error('❌ Moves not converted to string properly');
  }

  // Test 4: Check for expiry
  const now = Date.now();
  const pendingAge = now - retrievedGame.metadata.timestamp;
  const hoursRemaining = (24 * 60 * 60 * 1000 - pendingAge) / (1000 * 60 * 60);
  console.log(`⏰ Pending game age: ${Math.round(pendingAge / 1000)}s`);
  console.log(`⏰ Hours remaining: ${Math.round(hoursRemaining * 10) / 10}h`);

} else {
  console.error('❌ Pending game not found!');
}

// Test 5: Simulate savePendingGame (would require authentication)
console.log('💡 Step 5: savePendingGame() requires authentication token');
console.log('   After login, the system will automatically call savePendingGame()');

// Manual test for users:
console.log(`
🧪 MANUAL TEST INSTRUCTIONS:

1. Play a complete game (single player recommended)
2. In the game completion screen, click "Login to Save"
3. Check browser console for:
   - "[GameCompletionAnimation] Game data stored for deferred save"
   - "[PendingGame] Game data stored for deferred save"
   - "[PendingGame] Moves converted to string format"
4. Complete login (Google, GitHub, or email)
5. Check browser console for:
   - "[Auth] 📝 Found pending game, attempting to save after authentication"
   - "[PendingGame] Saving pending game to backend..."
   - "[Auth] ✅ Pending game saved successfully after login!"
6. Verify game appears in your history
7. Check that moves are playable in history viewer

🔧 Debugging Tips:
- Check localStorage for "pending_chess_game_save" key
- Verify moves field is a string before login
- Check network tab for game-history POST request after login
- Verify backend receives proper moves string format
`);

export { testGameData };