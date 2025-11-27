// Debug script for moves field validation issue
// Run this in browser console to test the saveGameHistory function

import { saveGameHistory } from '../services/gameHistoryService';

console.log('🐛 DEBUG: Testing moves field issue...');

// Test with sample game data that should match backend validation
const testGameData = {
  result: { winner: 'white', reason: 'checkmate' },
  score: 10,
  opponentScore: 8,
  playerColor: 'w',
  timestamp: new Date().toISOString(),
  computerLevel: 5,
  moves: JSON.stringify([
    { move: { san: 'e4', uci: 'e2e4', piece: 'p', color: 'w', from: 'e2', to: 'e4' }, time: 1500 },
    { move: { san: 'e5', uci: 'e7e5', piece: 'p', color: 'b', from: 'e7', to: 'e5' }, time: 1200 },
    { move: { san: 'Nf3', uci: 'g1f3', piece: 'n', color: 'w', from: 'g1', to: 'f3' }, time: 800 },
    { move: { san: 'Nc6', uci: 'b8c6', piece: 'n', color: 'b', from: 'b8', to: 'c6' }, time: 2000 }
  ]),
  gameId: null,
  opponentRating: null,
  opponentId: null,
  championshipData: null,
  isMultiplayer: false
};

console.log('🎮 Test game data structure:', {
  result: testGameData.result,
  score: testGameData.score,
  opponentScore: testGameData.opponentScore,
  playerColor: testGameData.playerColor,
  computerLevel: testGameData.computerLevel,
  moves_type: typeof testGameData.moves,
  moves_value: testGameData.moves,
  moves_length: testGameData.moves?.length,
  moves_sample: testGameData.moves?.substring?.(0, 100),
  timestamp: testGameData.timestamp,
  gameId: testGameData.gameId,
  opponentRating: testGameData.opponentRating,
  opponentId: testGameData.opponentId,
  championshipData: testGameData.championshipData,
  isMultiplayer: testGameData.isMultiplayer
});

console.log('🚀 Starting saveGameHistory test...');

// Test the actual save function
saveGameHistory(testGameData)
  .then(response => {
    console.log('✅ saveGameHistory SUCCESS:', response);
    console.log('📊 Response data:', response.data);
    console.log('📝 Game saved successfully!');
  })
  .catch(error => {
    console.error('❌ saveGameHistory FAILED:', error);
    console.error('📄 Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: error.config,
      // Check if it's a Laravel validation error
      is_laravel_validation: error.response?.status === 422,
      validation_errors: error.response?.data?.errors,
      missing_moves: error.response?.data?.errors?.moves,
      request_data: error.config?.data,
      request_headers: error.config?.headers
    });

    // Check if the request was properly formed
    if (error.config?.data) {
      console.log('🔍 Request data analysis:', {
        has_moves: 'moves' in error.config.data,
        moves_value: error.config.data.moves,
        moves_type: typeof error.config.data.moves,
        moves_empty: !error.config.data.moves,
        moves_null: error.config.data.moves === null,
        moves_undefined: error.config.data.moves === undefined,
        all_keys: Object.keys(error.config.data)
      });
    }
  });

console.log(`
🔧 DEBUG INSTRUCTIONS:

1. Make sure you have a valid auth token in localStorage
2. Run this script in browser console
3. Check the console output:
   - Look for "moves_type: string"
   - Look for "moves_value: [..."
   - Look for "has_moves: true" in error analysis
   - Look for Laravel validation errors

4. Expected behavior:
   - "Request data analysis" should show "has_moves: true"
   - "moves_value" should be a JSON string
   - No validation errors for moves field

5. If you see "The moves field is required" error:
   - Check if "has_moves: false" (moves field missing)
   - Check if "moves_value: undefined" (moves field undefined)
   - Check request headers for proper Authorization

6. For Laravel validation 422 errors:
   - Check if validation_errors shows moves field issues
   - Check if other required fields are missing

📋 TROUBLESHOOTING:
- If moves field is missing: Check how saveGameHistory constructs request data
- If moves field is null/undefined: Check pending game storage/retrieval
- If auth issues: Check localStorage for auth_token
- If CORS issues: Check backend CORS configuration
`);