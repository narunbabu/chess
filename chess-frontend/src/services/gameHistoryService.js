// This service handles saving and retrieving game history
// In a real application, this would connect to a backend API
// For now, we'll use localStorage for persistence
// import axios from "axios";
// import { BACKEND_URL } from "../config";
import api from "./api";
import { encodeGameHistory } from "../utils/gameHistoryStringUtils";

const STORAGE_KEY = "chess_trainer_game_history";

// Request deduplication: Track in-flight requests to prevent duplicate API calls
let gameHistoriesRequest = null;
let gameHistoriesCache = null;
let gameHistoriesCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Save a completed game to history
 * @param {Object} gameData - The game data to save
 * @param {string} gameData.date - ISO string of date when game was played
 * @param {string} gameData.playerColor - Player's color (w/b)
 * @param {number} gameData.computerLevel - Computer difficulty level
 * @param {Array} gameData.moves - Array of move objects
 * @param {number} gameData.finalScore - Player's final score
 * @param {string} gameData.result - Game result text
 */

export const saveGameHistory = async (gameData) => {
  // Helper function to convert ISO date to Laravel format (Y-m-d H:i:s)
  const formatDateForLaravel = (isoString) => {
    const date = new Date(isoString);
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0') + ' ' +
           String(date.getHours()).padStart(2, '0') + ':' +
           String(date.getMinutes()).padStart(2, '0') + ':' +
           String(date.getSeconds()).padStart(2, '0');
  };

  // Convert moves to encoded string format if needed
  let movesString;
  if (typeof gameData.moves === 'string') {
    movesString = gameData.moves;
  } else if (Array.isArray(gameData.moves)) {
    movesString = encodeGameHistory(gameData.moves);
    console.log('[gameHistoryService] 🔄 Encoded moves array to string format');
  } else {
    movesString = '';
    console.warn('[gameHistoryService] ⚠️ Invalid moves format, using empty string');
  }

  // Prepare data for backend (Laravel format)
  const backendData = {
    played_at: formatDateForLaravel(gameData.played_at || new Date().toISOString()),
    player_color: gameData.player_color || gameData.playerColor,
    computer_level: gameData.computer_level || gameData.computer_depth || gameData.computerLevel,
    moves: movesString,
    final_score: gameData.final_score ?? gameData.finalScore ?? gameData.score ?? 0,
    opponent_score: gameData.opponent_score ?? gameData.opponentScore ?? 0,
    result: gameData.result,
    // Opponent identity fields (synthetic AI or multiplayer)
    game_id: gameData.game_id || null,
    opponent_name: gameData.opponent_name || null,
    opponent_avatar_url: gameData.opponent_avatar_url || null,
    opponent_rating: gameData.opponent_rating || null,
    game_mode: gameData.game_mode || 'computer'
  };

  // Debug logging to verify data structure before sending
  console.log('[gameHistoryService] 📤 Attempting to save game with data:', {
    played_at: backendData.played_at,
    player_color: backendData.player_color,
    computer_level: backendData.computer_level,
    moves: backendData.moves,
    moves_type: typeof backendData.moves,
    moves_length: backendData.moves?.length || 0,
    moves_sample: backendData.moves?.substring?.(0, 100) || 'NO_MOVES',
    final_score: backendData.final_score,
    opponent_score: backendData.opponent_score,
    result: backendData.result,
    game_id: backendData.game_id,
    opponent_name: backendData.opponent_name,
    game_mode: backendData.game_mode
  });

  // Prepare a history record for localStorage (uses encoded format)
  const record = {
    ...gameData,
    finalScore: gameData.finalScore ?? gameData.final_score ?? gameData.score,
    finalNormScore: gameData.finalNormScore ?? null,
    id: gameData.id || `local_${Date.now()}`,
    played_at: gameData.played_at || new Date().toISOString(),
    moves: movesString, // Use the encoded string format
  };

  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        // Try to save to authenticated backend
        const response = await api.post("/game-history", backendData);
        return response.data;
      } catch (authError) {
        console.warn("Authenticated save failed, trying public endpoint:", authError.message);
        // Try public endpoint if authentication fails
        const response = await api.post("/public/game-history", backendData);
        return response.data;
      }
    } else {
      // No token, try public endpoint first
      try {
        const response = await api.post("/public/game-history", backendData);
        return response.data;
      } catch (publicError) {
        console.warn("Public endpoint failed, falling back to localStorage:", publicError.message);
      }
    }
  } catch (error) {
    console.warn("Backend save failed, falling back to localStorage:", error.message);
  }

  // Fallback to localStorage on any error (including network errors)
  const existingGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  existingGames.unshift(record);
  localStorage.setItem("chess_trainer_game_history", JSON.stringify(existingGames.slice(0, 50)));
  return record;
};

export const getGameHistories = async () => {
  // Check cache first
  const now = Date.now();
  if (gameHistoriesCache && (now - gameHistoriesCacheTime) < CACHE_TTL) {
    console.log('[gameHistoryService] 📦 Returning cached game histories (age:', now - gameHistoriesCacheTime, 'ms)');
    return gameHistoriesCache;
  }

  // If request already in-flight, wait for it
  if (gameHistoriesRequest) {
    console.log('[gameHistoryService] ⏳ Request already in-flight, waiting for existing request...');
    return gameHistoriesRequest;
  }

  // Start new request
  console.log('[gameHistoryService] 🚀 Starting new game histories request');
  gameHistoriesRequest = (async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          const res = await api.get("/game-history");
          console.log('[gameHistoryService] ✅ Fetched from backend - Keeping moves as string');
          const processedData = res.data.data.map(game => {
          // console.log(`[gameHistoryService] Game ${game.id}: moves type = ${typeof game.moves}, value =`, game.moves?.substring?.(0, 50));
          let parsedMoves = game.moves;
          if (typeof game.moves === 'string') {
            // Keep as string - let the consuming component parse it
            // This preserves the original semicolon-separated format: "e4,2.52;Nf6,0.98;..."
            parsedMoves = game.moves;
            // console.log(`[gameHistoryService] Game ${game.id}: Keeping as string (${game.moves.length} chars)`);
          }

          // Normalize finalScore from backend data
          const raw = game.finalScore ?? game.final_score ?? game.score;
          const finalScore = raw == null
            ? null
            : (typeof raw === 'string' ? parseFloat(raw) : raw);

            return { ...game, moves: parsedMoves, finalScore };
          });

          // Cache the result
          gameHistoriesCache = processedData;
          gameHistoriesCacheTime = Date.now();
          return processedData;
        } catch (backendError) {
          console.warn("Backend fetch failed (likely unauthenticated), falling back to localStorage:", backendError.message);
          // Clear invalid token if authentication failed
          if (backendError.response?.status === 401) {
            localStorage.removeItem("auth_token");
          }
          // Fallback to localStorage if backend fails
        }
      }

      // Get from localStorage (either no token or backend failed)
      const games = JSON.parse(localStorage.getItem("chess_trainer_game_history") || "[]");
      const processedData = games.map(game => {
        // Keep moves as string - let the consuming component parse it
        let parsedMoves = game.moves;
        if (typeof parsedMoves === 'string') {
          parsedMoves = game.moves; // Keep as string
        }

        // Normalize finalScore into a Number
        const raw = game.finalScore ?? game.final_score ?? game.score;
        const finalScore = raw == null
          ? null
          : (typeof raw === 'string' ? parseFloat(raw) : raw);

        return {
          ...game,
          moves: parsedMoves,
          finalScore
        };
      });

      // Cache the result
      gameHistoriesCache = processedData;
      gameHistoriesCacheTime = Date.now();
      return processedData;
    } catch (error) {
      console.error("Error retrieving game histories:", error);
      return [];
    } finally {
      // Clear in-flight request tracker
      gameHistoriesRequest = null;
    }
  })();

  return gameHistoriesRequest;
};

export const getGameHistoryById = async (id) => {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const res = await api.get(`/game-history/${id}`);
        const game = res.data.data;
        let parsedMoves = game.moves;
        if (typeof game.moves === 'string') {
          // Check if it's JSON format or semicolon-separated format
          if (game.moves.startsWith('[') || game.moves.startsWith('{')) {
            try {
              parsedMoves = JSON.parse(game.moves);
            } catch (parseError) {
              console.error(`Error parsing moves JSON for game ID ${game.id}:`, parseError, "Raw moves:", game.moves);
              parsedMoves = []; // Assign empty array on parse error
            }
          } else {
            // Handle semicolon-separated format: "e4,3.24;d5,2.85"
            if (game.moves.includes(';')) {
              parsedMoves = game.moves.split(';').map(move => {
                const [notation, time] = move.split(',');
                return { notation, time: parseFloat(time) || 0 };
              });
            } else {
              parsedMoves = [];
            }
          }
        }

        // Normalize finalScore from backend data
        const raw = game.finalScore ?? game.final_score ?? game.score;
        const finalScore = raw == null
          ? null
          : (typeof raw === 'string' ? parseFloat(raw) : raw);

        return { ...game, moves: parsedMoves, finalScore };
      } catch (backendError) {
        console.warn("Backend fetch failed, falling back to localStorage:", backendError.message);
        // Fallback to localStorage if backend fails
      }
    }

    // Get from localStorage (either no token or backend failed)
    const games = JSON.parse(localStorage.getItem("chess_trainer_game_history") || "[]");
    const game = games.find(g => g.id === id);
    if (!game) return null;

    // parse moves
    let parsedMoves = game.moves;
    if (typeof parsedMoves === 'string') {
      try { parsedMoves = JSON.parse(parsedMoves) }
      catch (_){ parsedMoves = [] }
    }

    // normalize score
    const raw = game.finalScore ?? game.final_score ?? game.score;
    const finalScore = raw == null
      ? null
      : (typeof raw === 'string' ? parseFloat(raw) : raw);

    return {
      ...game,
      moves: parsedMoves,
      finalScore
    };
  } catch (error) {
    console.error("Error retrieving game history by ID:", error);
    return null;
  }
};

export const deleteGameHistory = async (id) => {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        await api.delete(`/game-history/${id}`);
        return true;
      } catch (backendError) {
        console.warn("Backend delete failed, falling back to localStorage:", backendError.message);
        // Fallback to localStorage if backend fails
      }
    }

    // Delete from localStorage (either no token or backend failed)
    const games = JSON.parse(localStorage.getItem("chess_trainer_game_history") || "[]");
    const filteredGames = games.filter(game => game.id !== id);
    localStorage.setItem("chess_trainer_game_history", JSON.stringify(filteredGames));
    return true;
  } catch (error) {
    console.error("Error deleting game history:", error);
    return false;
  }
};

// PENDING GAME STORAGE FOR "LOGIN TO SAVE" FUNCTIONALITY
const PENDING_GAME_KEY = "pending_chess_game_save";

/**
 * Store game data locally for deferred saving after login
 * @param {Object} gameData - The game data to save later
 */
export const storePendingGame = (gameData) => {
  // Handle undefined/null/empty moves for backend compatibility
  let movesAsString;

  if (gameData.moves === undefined || gameData.moves === null || gameData.moves === '') {
    // If moves is undefined/null/empty, create an empty string to satisfy validation
    movesAsString = '';
    console.warn('[PendingGame] ⚠️ Moves field is undefined/null/empty, using empty string for backend validation');
  } else if (typeof gameData.moves === 'string') {
    // If already a string, use as-is
    movesAsString = gameData.moves;
    console.log('[PendingGame] 📝 Moves already in string format:', movesAsString?.substring(0, 100));
  } else if (Array.isArray(gameData.moves)) {
    // If array, use encodeGameHistory to convert to semicolon-separated format
    movesAsString = encodeGameHistory(gameData.moves);
    console.log('[PendingGame] 🔄 Moves converted from array to semicolon format:', movesAsString?.substring(0, 100));
  } else {
    // Fallback for unknown formats
    movesAsString = JSON.stringify(gameData.moves);
    console.warn('[PendingGame] ⚠️ Unknown moves format, using JSON.stringify as fallback');
  }

  const pendingGame = {
    gameData: {
      result: gameData.result,
      score: gameData.score,
      opponentScore: gameData.opponentScore,
      playerColor: gameData.playerColor,
      timestamp: gameData.timestamp || new Date().toISOString(),
      computerLevel: gameData.computerLevel,
      moves: movesAsString, // Store as string for backend compatibility
      gameId: gameData.gameId,
      opponentRating: gameData.opponentRating,
      opponentId: gameData.opponentId,
      championshipData: gameData.championshipData,
      isMultiplayer: gameData.isMultiplayer
    },
    metadata: {
      timestamp: Date.now(),
      source: 'game_completion',
      redirectAfterSave: '/dashboard'
    },
    ttl: 24 * 60 * 60 * 1000 // 24 hours expiry
  };

  localStorage.setItem(PENDING_GAME_KEY, JSON.stringify(pendingGame));
  console.log('[PendingGame] 📝 Game data stored for deferred save:', pendingGame);
  console.log('[PendingGame] 📊 Final moves verification:', {
    original_type: typeof gameData.moves,
    original_value: gameData.moves,
    final_type: typeof movesAsString,
    final_value: movesAsString,
    is_empty: movesAsString === '',
    backend_compatible: movesAsString !== undefined && movesAsString !== null
  });
};

/**
 * Retrieve pending game data
 * @returns {Object|null} Pending game data or null if none exists/expired
 */
export const getPendingGame = () => {
  try {
    const pendingGameStr = localStorage.getItem(PENDING_GAME_KEY);
    if (!pendingGameStr) return null;

    const pendingGame = JSON.parse(pendingGameStr);

    // Check if pending game has expired (24 hours)
    if (Date.now() - pendingGame.metadata.timestamp > pendingGame.ttl) {
      localStorage.removeItem(PENDING_GAME_KEY);
      console.log('[PendingGame] Pending game expired, removing from storage');
      return null;
    }

    console.log('[PendingGame] Found pending game:', pendingGame);
    return pendingGame;
  } catch (error) {
    console.error('[PendingGame] Error retrieving pending game:', error);
    localStorage.removeItem(PENDING_GAME_KEY);
    return null;
  }
};

/**
 * Save pending game to backend and clear from localStorage
 * @returns {Promise<boolean>} Success status
 */
export const savePendingGame = async () => {
  const pendingGame = getPendingGame();
  if (!pendingGame) return false;

  try {
    console.log('[PendingGame] 📤 Saving pending game to backend...');
    console.log('[PendingGame] 📊 Game data being saved:', pendingGame.gameData);

    // Verify moves format before sending
    const movesType = typeof pendingGame.gameData.moves;
    const movesLength = pendingGame.gameData.moves?.length || 0;
    console.log('[PendingGame] 🎯 Moves verification:', {
      moves_type: movesType,
      moves_length: movesLength,
      moves_sample: pendingGame.gameData.moves?.substring?.(0, 100),
      is_empty: !pendingGame.gameData.moves,
      is_null: pendingGame.gameData.moves === null,
      is_undefined: pendingGame.gameData.moves === undefined
    });

    const response = await saveGameHistory(pendingGame.gameData);

    if (response) {
      localStorage.removeItem(PENDING_GAME_KEY);
      console.log('[PendingGame] ✅ Pending game saved successfully:', response);
      return true;
    } else {
      console.warn('[PendingGame] Backend returned no response for pending game');
      return false;
    }
  } catch (error) {
    console.error('[PendingGame] ❌ Failed to save pending game:', error);
    console.error('[PendingGame] 📄 Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    // Don't remove from localStorage on failure, let it retry
    return false;
  }
};

/**
 * Clear pending game from localStorage
 */
export const clearPendingGame = () => {
  localStorage.removeItem(PENDING_GAME_KEY);
  console.log('[PendingGame] Pending game cleared from storage');
};

export const clearGameHistory = async () => {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        await api.delete("/game-history");
        return true;
      } catch (backendError) {
        console.warn("Backend clear failed, falling back to localStorage:", backendError.message);
        // Fallback to localStorage if backend fails
      }
    }

    // Clear localStorage (either no token or backend failed)
    localStorage.removeItem("chess_trainer_game_history");
    return true;
  } catch (error) {
    console.error("Error clearing game history:", error);
    return false;
  }
};
