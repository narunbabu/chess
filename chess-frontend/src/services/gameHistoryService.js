// This service handles saving and retrieving game history
// In a real application, this would connect to a backend API
// For now, we'll use localStorage for persistence
import axios from "axios";
import { BACKEND_URL } from "../config";
import api from "./api";
const STORAGE_KEY = "chess_trainer_game_history";

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

  // Prepare data for backend (Laravel format)
  const backendData = {
    played_at: formatDateForLaravel(gameData.played_at || new Date().toISOString()),
    player_color: gameData.player_color || gameData.playerColor,
    computer_level: gameData.computer_level || gameData.computer_depth || gameData.computerLevel,
    moves: typeof gameData.moves === 'string' ? gameData.moves : JSON.stringify(gameData.moves),
    final_score: gameData.final_score || gameData.finalScore || gameData.score,
    result: gameData.result
  };

  // Prepare a history record for localStorage (keeps original format)
  const record = {
    ...gameData,
    finalScore: gameData.finalScore ?? gameData.final_score ?? gameData.score,
    finalNormScore: gameData.finalNormScore ?? null,
    id: gameData.id || `local_${Date.now()}`,
    played_at: gameData.played_at || new Date().toISOString(),
    moves: typeof gameData.moves === 'string' ? gameData.moves : JSON.stringify(gameData.moves),
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
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const res = await api.get("/game-history");
        return res.data.data.map(game => {
          let parsedMoves = game.moves;
          if (typeof game.moves === 'string') {
            try {
              parsedMoves = JSON.parse(game.moves);
            } catch (parseError) {
              console.error(`Error parsing moves JSON for game ID ${game.id}:`, parseError, "Raw moves:", game.moves);
              parsedMoves = []; // Assign empty array on parse error
            }
          }

          // Normalize finalScore from backend data
          const raw = game.finalScore ?? game.final_score ?? game.score;
          const finalScore = raw == null
            ? null
            : (typeof raw === 'string' ? parseFloat(raw) : raw);

          return { ...game, moves: parsedMoves, finalScore };
        });
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
    return games.map(game => {
      // 1) parse out the moves
      let parsedMoves = game.moves;
      if (typeof parsedMoves === 'string') {
        try { parsedMoves = JSON.parse(parsedMoves) }
        catch (_){ parsedMoves = [] }
      }

      // 2) normalize finalScore into a Number
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
  } catch (error) {
    console.error("Error retrieving game histories:", error);
    return [];
  }
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
