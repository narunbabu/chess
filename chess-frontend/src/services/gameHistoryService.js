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
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      // Save to backend
      const response = await api.post("/game-history", {
        ...gameData,
        played_at: new Date().toISOString(),
        moves: JSON.stringify(gameData.moves), // Stringify moves for storage
      });
      return response.data;
    } else {
      // Prepare a history record that always has `finalScore`
  const record = {
    ...gameData,
    finalScore: gameData.finalScore ?? gameData.score,
    finalNormScore: gameData.finalNormScore ?? null,
        id: Date.now().toString(),
        played_at: new Date().toISOString(),
        moves: JSON.stringify(gameData.moves),
      };
      const existingGames = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const newGame = record;
      existingGames.unshift(newGame);
      localStorage.setItem("chess_trainer_game_history", JSON.stringify(existingGames.slice(0, 50)));
      return newGame;
    }
  } catch (error) {
    console.error("Error saving game history:", error);
    throw error;
  }
};

export const getGameHistories = async () => {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
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
        return { ...game, moves: parsedMoves };
      });
    } else {
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
    }
  } catch (error) {
    console.error("Error retrieving game histories:", error);
    return [];
  }
};

export const getGameHistoryById = async (id) => {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      const res = await api.get(`/game-history/${id}`);
      const game = res.data.data;
      let parsedMoves = game.moves;
      if (typeof game.moves === 'string') {
        try {
          parsedMoves = JSON.parse(game.moves);
        } catch (parseError) {
          console.error(`Error parsing moves JSON for game ID ${game.id}:`, parseError, "Raw moves:", game.moves);
          parsedMoves = []; // Assign empty array on parse error
        }
      }
      return { ...game, moves: parsedMoves };
    } else {
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
    }
  } catch (error) {
    console.error("Error retrieving game history by ID:", error);
    return null;
  }
};

export const deleteGameHistory = async (id) => {
  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      await api.delete(`/game-history/${id}`);
    } else {
      const games = JSON.parse(localStorage.getItem("chess_trainer_game_history") || "[]");
      const filteredGames = games.filter(game => game.id !== id);
      localStorage.setItem("chess_trainer_game_history", JSON.stringify(filteredGames));
    }
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
      await api.delete("/game-history");
    } else {
      localStorage.removeItem("chess_trainer_game_history");
    }
    return true;
  } catch (error) {
    console.error("Error clearing game history:", error);
    return false;
  }
};
