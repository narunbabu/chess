// src/utils/gameHistoryUtils.js
import { formatDistanceToNow } from "date-fns";
import { Chess } from "chess.js";
import { decodeGameHistory } from "./gameHistoryStringUtils";
import { isWin, isLoss, getResultDetails } from "./resultStandardization";

/**
 * Normalize moves to standard array of move objects
 * Handles various formats:
 * - Plain strings: ["d4", "e6", ...]
 * - Move objects with .move.san: [{move: {san: "d4"}}, ...]
 * - Move objects with .san: [{san: "d4"}, ...]
 * @param {Array|string} moves - Moves in any format
 * @returns {Array} Normalized array of {san, move?} objects
 */
export const normalizeMoves = (moves) => {
  if (!moves) return [];

  // Handle string format (JSON or plain string array from API)
  if (typeof moves === "string") {
    try {
      const parsed = JSON.parse(moves);
      return normalizeMoves(parsed); // Recurse with parsed data
    } catch {
      return []; // Not valid JSON
    }
  }

  if (!Array.isArray(moves)) return [];

  // Empty array
  if (moves.length === 0) return [];

  // Check if plain string array: ["d4", "e6", ...]
  if (typeof moves[0] === "string") {
    return moves.map(san => ({ san, move: san }));
  }

  // Check if already in {move: {san: "..."}} format
  if (moves[0]?.move?.san) {
    return moves.map(m => ({ san: m.move.san, move: m.move.san }));
  }

  // Check if in {san: "..."} format
  if (moves[0]?.san) {
    return moves.map(m => ({ san: m.san, move: m.san }));
  }

  // Check if in {move: "..."} format (some legacy formats)
  if (moves[0]?.move && typeof moves[0].move === "string") {
    return moves.map(m => ({ san: m.move, move: m.move }));
  }

  // Unknown format, return as-is
  return moves;
};

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

  // Handle moves: use normalizeMoves to handle all formats (strings, objects, etc.)
  const normalizedMoves = normalizeMoves(gameHistory.moves);

  // Calculate game duration (only if moves have time data)
  let totalTime = 0;
  const originalMoves = gameHistory.moves || [];
  if (Array.isArray(originalMoves) && originalMoves.length > 0 && typeof originalMoves[0] === 'object') {
    originalMoves.forEach((move) => {
      // Accept either snake_case or camelCase time properties.
      if (move.time_spent || move.timeSpent) {
        totalTime += move.time_spent || move.timeSpent;
      }
    });
  }

  // Format duration (mm:ss)
  const minutes = Math.floor(totalTime / 60);
  const seconds = Math.floor(totalTime % 60);
  const duration = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;

  // Get move count from normalized moves
  const moveCount = normalizedMoves.filter((move) => move.san || move.move).length;

  // Determine result with player color context for legacy format parsing
  let resultText = "Draw";
  if (typeof resultRaw === 'object' && resultRaw.status) {
    // Standardized format
    resultText = resultRaw.status === 'won' ? "Won" : resultRaw.status === 'lost' ? "Lost" : "Draw";
  } else if (typeof resultRaw === 'string') {
    // Legacy format - parse with player color context
    const lowerResult = resultRaw.toLowerCase();
    const isPlayerWhite = playerColorRaw === 'w';
    if (lowerResult.includes('white wins')) {
      resultText = isPlayerWhite ? "Won" : "Lost";
    } else if (lowerResult.includes('black wins')) {
      resultText = isPlayerWhite ? "Lost" : "Won";
    } else if (lowerResult.includes('draw') || lowerResult.includes('stalemate')) {
      resultText = "Draw";
    } else if (lowerResult === 'won') {
      resultText = "Won";
    } else if (lowerResult === 'lost') {
      resultText = "Lost";
    } else if (lowerResult === 'draw') {
      resultText = "Draw";
    }
  } else {
    // Fallback to isWin/isLoss for object formats
    resultText = isWin(resultRaw) ? "Won" : isLoss(resultRaw) ? "Lost" : "Draw";
  }

  return {
    date: formatGameDate(date),
    rawDate: date,
    playerColor: playerColorRaw === "w" ? "White" : "Black",
    computerLevel: computerLevelRaw,
    result: resultText,
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
    const moves = normalizeMoves(gameHistory.moves);
    const { playerColor, result } = gameHistory;

    // Apply all moves
    moves.forEach((moveObj) => {
      const notation = moveObj.san || moveObj.move;
      if (notation) {
        try {
          chess.move(notation);
        } catch (e) {
          console.error("Invalid move in history:", notation);
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
    if (filters.result) {
      const resultText = getResultDetails(game.result);
      if (!resultText.includes(filters.result)) {
        match = false;
      }
    }
    if (filters.level && game.computer_level !== filters.level) {
      match = false;
    }
    if (filters.gameMode) {
      const mode = game.game_mode || game.gameMode || '';
      if (filters.gameMode === 'computer' && mode !== 'computer') match = false;
      if (filters.gameMode === 'multiplayer' && mode !== 'multiplayer') match = false;
    }
    if (filters.opponentName) {
      const opp = (game.opponent_name || '').toLowerCase();
      if (!opp.includes(filters.opponentName.toLowerCase())) match = false;
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
