// Test file for pending game functionality
// This can be run in browser console to test the implementation

import { storePendingGame, getPendingGame, savePendingGame } from './gameHistoryService';

console.log('🧪 Testing Pending Game Functionality');

// 1. Test storing pending game
const testGameData = {
  result: { winner: 'white', reason: 'checkmate' },
  score: 10,
  opponentScore: 8,
  playerColor: 'w',
  timestamp: new Date().toISOString(),
  computerLevel: 5,
  moves: ['e4', 'e5', 'Nf3'],
  gameId: null,
  opponentRating: null,
  opponentId: null,
  championshipData: null,
  isMultiplayer: false
};

console.log('📝 Storing test game data...');
storePendingGame(testGameData);

// 2. Test retrieving pending game
const retrievedGame = getPendingGame();
console.log('📖 Retrieved pending game:', retrievedGame);

// 3. Test that the data persists
setTimeout(() => {
  const gameAfterTime = getPendingGame();
  console.log('⏰ Game data persists after timeout:', gameAfterTime);
}, 1000);

// Note: savePendingGame would require authentication
// This would be tested as part of the full login flow