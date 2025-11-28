/**
 * Unfinished Game Service
 * Handles saving and retrieving unfinished games for both guest and logged-in users
 */

import api from './api';

const UNFINISHED_GAME_KEY = 'chess_unfinished_game';
const TTL_DAYS = 7; // Keep unfinished games for 7 days

/**
 * Save unfinished game state
 * @param {Object} gameState - Current game state
 * @param {boolean} isAuthenticated - Whether user is logged in
 * @param {string|null} gameId - Backend game ID (null for guests)
 * @returns {Promise<Object>} Save result
 */
export async function saveUnfinishedGame(gameState, isAuthenticated, gameId = null) {
  const timestamp = Date.now();
  const ttl = timestamp + (TTL_DAYS * 24 * 60 * 60 * 1000);

  const unfinishedGameData = {
    gameId,
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
    savedReason: gameState.savedReason || 'navigation' // navigation, pause, beforeunload
  };

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
      // Fallback to localStorage
      localStorage.setItem(UNFINISHED_GAME_KEY, JSON.stringify(unfinishedGameData));
      console.log('[UnfinishedGame] 💾 Fallback to localStorage');
      return { success: true, location: 'localStorage', gameId };
    }
  } else {
    // Guest user: Save to localStorage
    localStorage.setItem(UNFINISHED_GAME_KEY, JSON.stringify(unfinishedGameData));
    console.log('[UnfinishedGame] 💾 Saved to localStorage (guest)');
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
  const localData = localStorage.getItem(UNFINISHED_GAME_KEY);

  if (localData) {
    try {
      const game = JSON.parse(localData);

      // Check TTL
      if (Date.now() > game.ttl) {
        console.log('[UnfinishedGame] ⏰ LocalStorage game expired, clearing');
        clearUnfinishedGame();
        return null;
      }

      console.log('[UnfinishedGame] 📂 Found game in localStorage');
      return { ...game, source: 'localStorage' };
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to parse localStorage game:', error);
      clearUnfinishedGame();
    }
  }

  // If authenticated, check backend for paused games
  if (isAuthenticated) {
    try {
      const response = await api.get('/games/unfinished');

      if (response.data && response.data.length > 0) {
        // Get most recent unfinished game
        const game = response.data[0];
        console.log('[UnfinishedGame] 📂 Found game in backend:', game.id);

        return {
          gameId: game.id,
          fen: game.fen,
          pgn: game.pgn,
          moves: game.moves ? JSON.parse(game.moves) : [],
          playerColor: game.white_player_id === game.current_user_id ? 'white' : 'black',
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
 */
export function clearUnfinishedGame() {
  localStorage.removeItem(UNFINISHED_GAME_KEY);
  console.log('[UnfinishedGame] 🗑️ Cleared localStorage');
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
  const localData = localStorage.getItem(UNFINISHED_GAME_KEY);
  if (localData) {
    try {
      const game = JSON.parse(localData);

      // Check TTL
      if (Date.now() <= game.ttl) {
        games.push({
          ...game,
          source: 'localStorage'
        });
        console.log('[UnfinishedGame] 📂 Found game in localStorage');
      } else {
        console.log('[UnfinishedGame] ⏰ LocalStorage game expired, clearing');
        clearUnfinishedGame();
      }
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to parse localStorage game:', error);
      clearUnfinishedGame();
    }
  }

  // If authenticated, also fetch from backend
  if (isAuthenticated) {
    try {
      const response = await api.get('/games/unfinished');

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
          timerState: {
            whiteMs: game.white_time_remaining_ms,
            blackMs: game.black_time_remaining_ms,
            incrementMs: game.increment_seconds * 1000
          },
          turn: game.turn,
          timestamp: new Date(game.paused_at || game.updated_at).getTime(),
          savedReason: game.paused_reason || 'navigation',
          source: 'backend'
        }));

        games.push(...backendGames);
        console.log('[UnfinishedGame] 📂 Loaded', backendGames.length, 'unfinished games from backend');
      }
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to fetch unfinished games from backend:', error);
    }
  }

  console.log('[UnfinishedGame] 📂 Total unfinished games found:', games.length);
  return games;
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
    // Guest user: Delete from localStorage
    try {
      localStorage.removeItem(UNFINISHED_GAME_KEY);
      console.log('[UnfinishedGame] ✅ Deleted from localStorage');
      return true;
    } catch (error) {
      console.error('[UnfinishedGame] ❌ Failed to delete from localStorage:', error);
      return false;
    }
  }
}
