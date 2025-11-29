/**
 * Unfinished Game Service
 * Handles saving and retrieving unfinished games for both guest and logged-in users
 */

import api from './api';

const UNFINISHED_GAMES_KEY = 'chess_unfinished_games';
const COMPLETED_GAMES_KEY = 'chess_completed_games';
const TTL_DAYS = 7; // Keep unfinished games for 7 days

/**
 * Save unfinished game state
 * @param {Object} gameState - Current game state
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @param {string|null} gameId - Backend game ID (null for guests)
 * @param {string|null} updateGameId - Update existing game with this ID
 * @returns {Promise<Object>} Save result
 */
export async function saveUnfinishedGame(gameState, isAuthenticated, gameId = null, updateGameId = null) {
  console.log('[UnfinishedGame] saveUnfinishedGame called with:', {
    isAuthenticated,
    gameId,
    updateGameId,
    gameStateKeys: Object.keys(gameState)
  });

  const timestamp = Date.now();
  const ttl = timestamp + (TTL_DAYS * 24 * 60 * 60 * 1000);

  let finalGameId = gameId;

  // For guest users (localStorage), use updateGameId if provided, otherwise create new game
  if (!isAuthenticated && !gameId) {
    if (updateGameId) {
      // Update existing game with specified ID
      finalGameId = updateGameId;
      console.log('[UnfinishedGame] 🔄 Updating existing game with ID:', finalGameId);
    } else {
      // Create new game - always generate new ID for new games
      finalGameId = `local_${timestamp}`;
      console.log('[UnfinishedGame] ✨ Creating new game with ID:', finalGameId);
    }
  }

  const unfinishedGameData = {
    id: finalGameId,
    gameId: finalGameId,
    fen: gameState.fen,
    pgn: gameState.pgn,
    moves: gameState.moves,
    playerColor: gameState.playerColor,
    opponentName: gameState.opponentName,
    gameMode: gameState.gameMode || 'computer', // computer, multiplayer
    computerLevel: gameState.computerLevel || null,
    timerState: gameState.timerState || null,
    turn: gameState.turn,
    timestamp,
    ttl,
    savedReason: gameState.savedReason || 'navigation', // navigation, pause, beforeunload
    startTime: gameState.startTime || null,
    status: 'unfinished' // Explicit status for storage separation
  };

  console.log('[UnfinishedGame] Prepared game data:', {
    id: unfinishedGameData.id,
    status: unfinishedGameData.status,
    timestamp,
    ttl
  });

  if (isAuthenticated && gameId) {
    // Logged-in user: Update backend
    try {
      const response = await api.post(`/games/${gameId}/pause-navigation`, {
        fen: gameState.fen,
        pgn: gameState.pgn,
        white_time_remaining_ms: gameState.timerState?.whiteMs,
        black_time_remaining_ms: gameState.timerState?.blackMs,
        paused_reason: gameState.savedReason || 'navigation'
      });

      console.log('[UnfinishedGame] ✅ Saved to backend:', gameId);
      return { success: true, location: 'backend', gameId };
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Backend save failed:', error);
      // Fallback to localStorage array
      let games = JSON.parse(localStorage.getItem(UNFINISHED_GAMES_KEY) || '[]');
      // Remove existing game with same id if present
      games = games.filter(g => g.id !== unfinishedGameData.id);
      games.unshift(unfinishedGameData);
      localStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(games));
      console.log('[UnfinishedGame] 💾 Fallback to localStorage array');
      return { success: true, location: 'localStorage', gameId };
    }
  } else {
    // Guest user: Save to localStorage array
    let games = JSON.parse(localStorage.getItem(UNFINISHED_GAMES_KEY) || '[]');
    // Remove existing game with same id if present (update)
    games = games.filter(g => g.id !== unfinishedGameData.id);
    games.unshift(unfinishedGameData); // Add to front for recent first
    localStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(games));
    console.log('[UnfinishedGame] 💾 Saved to localStorage array (guest)', { totalGames: games.length });
    return { success: true, location: 'localStorage', gameId: null };
  }
}

/**
 * Get unfinished game from localStorage or backend
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @returns {Promise<Object|null>} Unfinished game data or null
 */
export async function getUnfinishedGame(isAuthenticated) {
  // Check localStorage first (for guests or offline saves)
  try {
    const localData = localStorage.getItem(UNFINISHED_GAMES_KEY);
    if (localData) {
      const localGames = JSON.parse(localData);
      const validLocalGames = localGames.filter(game =>
        game.status === 'unfinished' && Date.now() <= game.ttl
      );

      if (validLocalGames.length > 0) {
        // Return the most recent unfinished game
        const mostRecent = validLocalGames.sort((a, b) => b.timestamp - a.timestamp)[0];
        console.log('[UnfinishedGame] 📂 Found most recent unfinished game in localStorage');
        return { ...mostRecent, source: 'localStorage' };
      }
    }
  } catch (error) {
    console.error('[UnfinishedGame] ❌ Failed to parse localStorage games:', error);
    localStorage.removeItem(UNFINISHED_GAMES_KEY);
  }

  // If authenticated, check backend for paused games
  if (isAuthenticated) {
    try {
      const response = await api.get('/games/unfinished');

      if (response.data && response.data.length > 0) {
        // Get most recent unfinished game
        const game = response.data[0];
        console.log('[UnfinishedGame] 📂 Found unfinished game in backend:', game.id);

        return {
          id: game.id,
          gameId: game.id,
          fen: game.fen,
          pgn: game.pgn,
          moves: game.moves ? JSON.parse(game.moves) : [],
          playerColor: game.white_player_id === game.current_user_id ? 'w' : 'b',
          opponentName: game.opponent_name,
          gameMode: 'multiplayer',
          computerLevel: null,
          timerState: {
            whiteMs: game.white_time_remaining_ms,
            blackMs: game.black_time_remaining_ms,
            incrementMs: game.increment_seconds * 1000
          },
          turn: game.turn,
          timestamp: new Date(game.paused_at).getTime(),
          savedReason: game.paused_reason,
          source: 'backend'
        };
      }
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to fetch backend games:', error);
    }
  }

  return null;
}

/**
 * Clear unfinished game from localStorage
 * @param {string|null} specificGameId - Clear specific game ID only, or null to clear all unfinished games
 */
export function clearUnfinishedGame(specificGameId = null) {
  if (specificGameId) {
    // Clear only specific unfinished game
    try {
      const games = JSON.parse(localStorage.getItem(UNFINISHED_GAMES_KEY) || '[]');
      const filteredGames = games.filter(game => game.id !== specificGameId);
      localStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(filteredGames));
      console.log('[UnfinishedGame] 🗑️ Cleared specific unfinished game:', specificGameId);
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to clear specific unfinished game:', error);
    }
  } else {
    // Clear all unfinished games (for explicit user action)
    localStorage.removeItem(UNFINISHED_GAMES_KEY);
    console.log('[UnfinishedGame] 🗑️ Cleared all localStorage unfinished games');
  }
}

/**
 * Save completed game to proper storage based on authentication
 * @param {Object} gameState - Final game state
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @param {Object} gameResult - Game result information
 * @returns {Promise<Object>} Save result
 */
export async function saveCompletedGame(gameState, isAuthenticated = false, gameResult = null) {
  const timestamp = Date.now();
  const gameId = `completed_${timestamp}`;

  const difficulty = gameState.computerLevel ? `Level ${gameState.computerLevel}` : 'Medium';

  const completedGameData = {
    id: gameId,
    gameId,
    fen: gameState.fen || 'rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: gameState.pgn || '',
    moves: gameState.moves || [],
    playerColor: gameState.playerColor || 'w',
    opponentName: gameState.opponentName || 'Computer',
    gameMode: gameState.gameMode || 'computer',
    computerLevel: gameState.computerLevel || null,
    difficulty,
    timerState: gameState.timerState || null,
    turn: gameState.turn || 'w',
    startTime: gameState.startTime || timestamp,
    endTime: timestamp,
    result: gameResult || gameState.result,
    playerScore: gameState.playerScore || 0,
    opponentScore: gameState.opponentScore || 0,
    timestamp,
    status: 'completed', // Explicit completion status
    completed: true,
    opening: gameState.opening || null,
    source: 'localStorage',
    // Additional fields for GameEndCard compatibility
    has_moves: !!gameState.moves && gameState.moves.length > 0,
    moves_type: Array.isArray(gameState.moves) ? 'array' : (typeof gameState.moves === 'string' ? 'string' : 'undefined'),
    moves_length: Array.isArray(gameState.moves) ? gameState.moves.length : (typeof gameState.moves === 'string' ? gameState.moves.split(';').length : 0),
    last_move_at: gameState.timestamp || null,
    created_at: gameState.startTime || timestamp,
    played_at: gameState.startTime || timestamp,
    ended_at: timestamp
  };

  if (isAuthenticated) {
    // Authenticated users save through backend - no localStorage needed
    console.log('[CompletedGame] ✅ Game completed for authenticated user (backend handled)');
    return { success: true, location: 'backend', gameId };
  } else {
    // Guest user: Save to completed games localStorage
    try {
      const existingCompletedGames = JSON.parse(localStorage.getItem(COMPLETED_GAMES_KEY) || '[]');
      const updatedCompletedGames = [completedGameData, ...existingCompletedGames];

      // Keep only last 50 completed games for guests
      const limitedGames = updatedCompletedGames.slice(0, 50);

      localStorage.setItem(COMPLETED_GAMES_KEY, JSON.stringify(limitedGames));
      console.log('[CompletedGame] 💾 Saved completed game to localStorage');

      // Also remove from unfinished games if present
      const unfinishedGames = JSON.parse(localStorage.getItem(UNFINISHED_GAMES_KEY) || '[]');
      const filteredUnfinishedGames = unfinishedGames.filter(game =>
        game.id !== completedGameData.id && game.status === 'unfinished'
      );
      localStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(filteredUnfinishedGames));
      console.log('[CompletedGame] 🗑️ Removed game from unfinished storage');

      return { success: true, location: 'localStorage', gameId };
    } catch (error) {
      console.error('[CompletedGame] ❌ Failed to save completed game:', error);
      return { success: false, error };
    }
  }
}

/**
 * Get completed games from localStorage or backend
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @returns {Promise<Array>} Array of completed games
 */
export async function getCompletedGames(isAuthenticated = false) {
  if (isAuthenticated) {
    // Authenticated users get games from backend API
    try {
      const response = await api.get('/games/completed');

      if (response.data && Array.isArray(response.data)) {
        const backendGames = response.data.map(game => ({
          gameId: game.id,
          fen: game.fen,
          pgn: game.pgn,
          moves: game.moves ? JSON.parse(game.moves) : [],
          playerColor: game.white_player_id === game.current_user_id ? 'white' : 'black',
          opponentName: game.opponent_name || 'Computer',
          gameMode: game.game_type === 'computer' ? 'computer' : 'multiplayer',
          computerLevel: game.computer_level,
          difficulty: game.computer_level || 'Medium',
          timerState: {
            whiteMs: game.white_time_remaining_ms,
            blackMs: game.black_time_remaining_ms,
            incrementMs: game.increment_seconds * 1000
          },
          turn: game.turn,
          startTime: new Date(game.started_at).getTime(),
          endTime: new Date(game.finished_at).getTime(),
          result: game.result,
          playerScore: game.white_player_id === game.current_user_id ? game.white_score : game.black_score,
          opponentScore: game.white_player_id === game.current_user_id ? game.black_score : game.white_score,
          timestamp: new Date(game.finished_at).getTime(),
          status: 'completed',
          completed: true,
          opening: game.opening || null,
          source: 'backend'
        }));

        console.log('[CompletedGame] 📂 Loaded', backendGames.length, 'completed games from backend');
        return backendGames;
      }
    } catch (error) {
      console.error('[CompletedGame] ❌ Failed to fetch completed games from backend:', error);
    }
  }

  // For guests or as fallback, get from localStorage
  try {
    const localData = localStorage.getItem(COMPLETED_GAMES_KEY);

    if (localData) {
      const games = JSON.parse(localData);
      const completedGames = games.filter(game => game.status === 'completed' || game.completed === true);
      console.log('[CompletedGame] 📂 Found', completedGames.length, 'completed games in localStorage');

      // Sort by timestamp (newest first) and add source
      return completedGames
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(game => ({
          ...game,
          source: 'localStorage'
        }));
    }
  } catch (error) {
    console.error('[CompletedGame] ❌ Failed to parse completed games from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem(COMPLETED_GAMES_KEY);
  }

  return [];
}

/**
 * Migrate guest unfinished game to backend after login
 * @param {string} userId - Logged-in user ID
 * @returns {Promise<Object|null>} Migrated game data or null
 */
export async function migrateGuestGame(game) {
  if (!game) {
    console.log('[UnfinishedGame] ⚠️ No game provided for migration');
    return false;
  }

  try {
    // Only migrate computer games (multiplayer games need opponent)
    if (game.gameMode !== 'computer') {
      console.log('[UnfinishedGame] ⏭️ Skipping migration - not a computer game');
      return false;
    }

    // Create new game in backend
    const response = await api.post('/games/create-from-unfinished', {
      fen: game.fen,
      pgn: game.pgn,
      moves: game.moves,
      player_color: game.playerColor,
      computer_level: game.computerLevel,
      white_time_remaining_ms: game.timerState?.whiteMs,
      black_time_remaining_ms: game.timerState?.blackMs,
      increment_seconds: game.timerState?.incrementMs ? game.timerState.incrementMs / 1000 : 0,
      turn: game.turn,
      player_score: game.playerScore,
      opponent_score: game.opponentScore
    });

    console.log('[UnfinishedGame] ✅ Migrated guest game to backend:', response.data.id);
    return true;
  } catch (error) {
    console.error('[UnfinishedGame] ❌ Migration failed:', error);
    return false;
  }
}

/**
 * Check if user has unfinished game
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @returns {Promise<boolean>} True if unfinished game exists
 */
export async function hasUnfinishedGame(isAuthenticated) {
  const game = await getUnfinishedGame(isAuthenticated);
  return game !== null;
}

/**
 * Get all unfinished games for the current user
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @returns {Promise<Array>} Array of unfinished games
 */
export async function getUnfinishedGames(isAuthenticated = false) {
  const games = [];

  // Always check localStorage first (for guests or offline saves)
  try {
    const localData = localStorage.getItem(UNFINISHED_GAMES_KEY);
    if (localData) {
      const localGames = JSON.parse(localData);
      const validLocalGames = localGames.filter(game =>
        game.status === 'unfinished' && Date.now() <= game.ttl
      );
      const localGamesWithSource = validLocalGames.map(game => ({
        ...game,
        id: game.id || `local_${game.timestamp}`,
        source: 'localStorage'
      }));
      games.push(...localGamesWithSource);
      console.log('[UnfinishedGame] 📂 Found', localGamesWithSource.length, 'valid unfinished games in localStorage');

      // Clean up expired games
      if (localGames.length !== validLocalGames.length) {
        localStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(validLocalGames));
        console.log('[UnfinishedGame] 🧹 Cleaned up', localGames.length - validLocalGames.length, 'expired games');
      }
    }
  } catch (error) {
    console.error('[UnfinishedGame] ❌ Failed to parse localStorage games:', error);
    localStorage.removeItem(UNFINISHED_GAMES_KEY);
  }

  // If authenticated, also fetch from backend
  if (isAuthenticated) {
    try {
      const response = await api.get('/games/unfinished');

      if (response.data && Array.isArray(response.data)) {
        const backendGames = response.data.map(game => ({
          id: game.id,
          gameId: game.id,
          fen: game.fen,
          pgn: game.pgn,
          moves: game.moves ? JSON.parse(game.moves) : [],
          playerColor: game.white_player_id === game.current_user_id ? 'w' : 'b',
          opponentName: game.opponent_name || 'Computer',
          gameMode: game.game_type === 'computer' ? 'computer' : 'multiplayer',
          computerLevel: game.computer_level,
          timerState: {
            whiteMs: game.white_time_remaining_ms,
            blackMs: game.black_time_remaining_ms,
            incrementMs: game.increment_seconds * 1000
          },
          turn: game.turn,
          timestamp: new Date(game.paused_at || game.updated_at).getTime(),
          savedReason: game.paused_reason || 'navigation',
          source: 'backend',
          status: 'unfinished'
        }));

        games.push(...backendGames);
        console.log('[UnfinishedGame] 📂 Loaded', backendGames.length, 'unfinished games from backend');
      }
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to fetch unfinished games from backend:', error);
    }
  }

  // Sort by timestamp descending (most recent first)
  const sortedGames = games.sort((a, b) => b.timestamp - a.timestamp);

  console.log('[UnfinishedGame] 📂 Total unfinished games found:', sortedGames.length);
  return sortedGames;
}

/**
 * Delete unfinished game from backend or localStorage
 * @param {string} gameId - Backend game ID (null for localStorage)
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @returns {Promise<boolean>} Success status
 */
export async function deleteUnfinishedGame(gameId, isAuthenticated = false) {
  if (isAuthenticated && gameId) {
    // Logged-in user: Delete from backend
    try {
      await api.delete(`/games/${gameId}/unfinished`);
      console.log('[UnfinishedGame] ✅ Deleted from backend:', gameId);
      return true;
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to delete from backend:', error);
      return false;
    }
  } else {
    // Guest user: Delete from localStorage array
    try {
      const games = JSON.parse(localStorage.getItem(UNFINISHED_GAMES_KEY) || '[]');
      const filteredGames = games.filter(game => game.id !== gameId);
      localStorage.setItem(UNFINISHED_GAMES_KEY, JSON.stringify(filteredGames));
      console.log('[UnfinishedGame] ✅ Deleted from localStorage array:', gameId);
      return true;
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to delete from localStorage:', error);
      return false;
    }
  }
}

/**
 * Delete completed game from localStorage or backend
 * @param {string} gameId - Game ID
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @returns {Promise<boolean>} Success status
 */
export async function deleteCompletedGame(gameId, isAuthenticated = false) {
  if (isAuthenticated) {
    // Logged-in user: Delete from backend
    try {
      await api.delete(`/games/${gameId}`);
      console.log('[CompletedGame] ✅ Deleted from backend:', gameId);
      return true;
    } catch (error) {
      console.error('[CompletedGame] ❌ Failed to delete from backend:', error);
      return false;
    }
  } else {
    // Guest user: Delete from localStorage
    try {
      const games = JSON.parse(localStorage.getItem(COMPLETED_GAMES_KEY) || '[]');
      const filteredGames = games.filter(game => game.gameId !== gameId && game.id !== gameId);
      localStorage.setItem(COMPLETED_GAMES_KEY, JSON.stringify(filteredGames));
      console.log('[CompletedGame] ✅ Deleted from localStorage:', gameId);
      return true;
    } catch (error) {
      console.error('[CompletedGame] ❌ Failed to delete from localStorage:', error);
      return false;
    }
  }
}