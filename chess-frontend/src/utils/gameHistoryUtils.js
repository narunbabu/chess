// src/utils/gameHistoryUtils.js
import { formatDistanceToNow } from "date-fns";
import { Chess } from "chess.js";
import { decodeGameHistory } from "./gameHistoryStringUtils";

/**
 * Formats a date string to a relative time (e.g., "2 hours ago")
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted relative time
 */
export const formatGameDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Unknown date";
  }
};

/**
 * Extracts game summary information for display in history list
 * @param {Object} gameHistory - Complete game history object
 * @returns {Object} Summary information
 */
export const extractGameSummary = (gameHistory) => {
  const date = gameHistory.played_at || gameHistory.date;
  const playerColorRaw = gameHistory.player_color;
  const computerLevelRaw = gameHistory.computer_level;
  const resultRaw = gameHistory.result || "";
  const finalScoreRaw =
    gameHistory.final_score ??
    gameHistory.finalScore ??
    gameHistory.score ??
    0;

  // Handle moves: if missing, default to empty array.
  let moves = [];
  if (gameHistory.moves) {
    if (typeof gameHistory.moves === "string") {
      try {
        moves = decodeGameHistory(gameHistory.moves);
      } catch (err) {
        console.error("Error decoding moves for summary:", err);
        moves = [];
      }
    } else {
      moves = gameHistory.moves;
    }
  }

  // Calculate game duration
  let totalTime = 0;
  moves.forEach((move) => {
    // Accept either snake_case or camelCase time properties.
    if (move.time_spent || move.timeSpent) {
      totalTime += move.time_spent || move.timeSpent;
    }
  });

  // Format duration (mm:ss)
  const minutes = Math.floor(totalTime / 60);
  const seconds = Math.floor(totalTime % 60);
  const duration = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;

  // Get move count (checking for either property, e.g. move or san)
  const moveCount = moves.filter((move) => move.move || move.san).length;

  return {
    date: formatGameDate(date),
    rawDate: date,
    playerColor: playerColorRaw === "w" ? "White" : "Black",
    computerLevel: computerLevelRaw,
    result: resultRaw.toLowerCase().includes("you won")
      ? "Won"
      : resultRaw.toLowerCase().includes("computer won")
      ? "Lost"
      : "Draw",
    finalScore: Math.abs(finalScoreRaw).toFixed(1),
    duration,
    moveCount,
  };
};

/**
 * Sorts game histories by date (newest first)
 * @param {Array} gameHistories - Array of game history objects
 * @returns {Array} Sorted game histories
 */
export const sortGameHistories = (gameHistories) => {
  return [...gameHistories].sort((a, b) => {
    const dateA = new Date(a.date || a.played_at);
    const dateB = new Date(b.date || b.played_at);
    return dateB - dateA;
  });
};

/**
 * Gets PGN notation for a game
 * @param {Object} gameHistory - Game history object
 * @returns {string} PGN notation
 */
export const getGamePGN = (gameHistory) => {
  try {
    const chess = new Chess();
    // If moves is stored as JSON, parse it.
    let moves = [];
    if (gameHistory.moves) {
      moves =
        typeof gameHistory.moves === "string"
          ? JSON.parse(gameHistory.moves)
          : gameHistory.moves;
    }
    const { playerColor, result } = gameHistory;

    // Apply all moves
    moves.forEach((moveObj) => {
      if (moveObj.move) {
        try {
          chess.move(moveObj.move);
        } catch (e) {
          console.error("Invalid move in history:", moveObj.move);
        }
      }
    });

    // Set PGN headers
    chess.header(
      "Event",
      "Chess Trainer Game",
      "Site",
      "Chess Trainer App",
      "Date",
      new Date(gameHistory.date || gameHistory.played_at)
        .toISOString()
        .split("T")[0],
      "White",
      playerColor === "w" ? "Player" : "Computer",
      "Black",
      playerColor === "b" ? "Player" : "Computer",
      "Result",
      result === "Checkmate - You won!"
        ? "1-0"
        : result === "Checkmate - Computer won!"
        ? "0-1"
        : "1/2-1/2"
    );

    return chess.pgn();
  } catch (error) {
    console.error("Error generating PGN:", error);
    return "Error generating PGN";
  }
};

/**
 * Filters game histories by criteria
 * @param {Array} gameHistories - Array of game history objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered game histories
 */
export const filterGameHistories = (gameHistories, filters = {}) => {
  return gameHistories.filter((game) => {
    let match = true;

    // Use snake_case field names as returned by the backend
    if (filters.playerColor && game.player_color !== filters.playerColor) {
      match = false;
    }
    if (filters.result && !game.result.includes(filters.result)) {
      match = false;
    }
    if (filters.level && game.computer_level !== filters.level) {
      match = false;
    }
    if (filters.dateRange) {
      const gameDate = new Date(game.date || game.played_at);
      if (
        gameDate < filters.dateRange.start ||
        gameDate > filters.dateRange.end
      ) {
        match = false;
      }
    }
    return match;
  });
};
