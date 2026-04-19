// src/utils/gameStateUtils.js
import { evaluatePlayerMove, PIECE_VALUES } from "./evaluate";

/**
 * Returns the FEN key used for repetition tracking.
 * Excludes the halfmove clock (index 4) and fullmove number (index 5)
 * because those don't affect position identity.
 */
export const getFenKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

/**
 * Checks for draws that a player must CLAIM voluntarily.
 * Returns { canClaim: bool, reason: string|null }
 *
 * Rules:
 *  - Threefold repetition: same position occurred ≥3 times — player to move may claim.
 *  - 50-move rule: halfmove clock ≥100 — either player may claim.
 *
 * @param {Object} game - chess.js instance
 * @param {Map<string,number>} [positionCounts] - Map<fenKey, count> maintained by caller.
 *        When provided, threefold is checked against this map instead of chess.js's internal
 *        history, which is unreliable because the game object is frequently rebuilt from FEN
 *        after remote moves (losing all internal history).
 */
export const getClaimableDrawStatus = (game, positionCounts) => {
  // Automatic game-overs take precedence — no claim available
  if (game.isCheckmate() || game.isStalemate() || game.isInsufficientMaterial()) {
    return { canClaim: false, reason: null };
  }

  // Use positionCounts map when available (reliable across FEN rebuilds),
  // fall back to chess.js internal history otherwise.
  if (positionCounts) {
    const key = getFenKey(game.fen());
    if ((positionCounts.get(key) || 0) >= 3) {
      return { canClaim: true, reason: 'threefold_repetition' };
    }
  } else if (game.isThreefoldRepetition()) {
    return { canClaim: true, reason: 'threefold_repetition' };
  }

  const halfmoveClock = parseInt(game.fen().split(' ')[4], 10);
  if (halfmoveClock >= 100) {
    return { canClaim: true, reason: 'fifty_move_rule' };
  }

  return { canClaim: false, reason: null };
};

/**
 * Checks for draws that are AUTOMATIC (no claim needed — FIDE mandatory).
 * positionCounts: Map<fenKey, number>  — maintained by the caller across all moves.
 * consecutiveQueenMoves: number        — half-move counter reset on any non-queen move.
 *
 * Returns { isDraw: bool, reason: string|null }
 */
export const getAutoDrawStatus = (game, positionCounts, consecutiveQueenMoves) => {
  // 75-move rule
  const halfmoveClock = parseInt(game.fen().split(' ')[4], 10);
  if (halfmoveClock >= 150) {
    return { isDraw: true, reason: 'seventy_five_move_rule' };
  }

  // Fivefold repetition
  if (positionCounts) {
    const key = getFenKey(game.fen());
    if ((positionCounts.get(key) || 0) >= 5) {
      return { isDraw: true, reason: 'fivefold_repetition' };
    }
  }

  // 16 consecutive queen moves by each side = 32 consecutive half-moves
  if (consecutiveQueenMoves >= 32) {
    return { isDraw: true, reason: 'sixteen_queen_moves' };
  }

  return { isDraw: false, reason: null };
};

export const updateGameStatus = (game, setGameStatus, playerColor) => { // <-- Add playerColor
  let status = {
    gameOver: false,
    outcome: null, // 'win', 'loss', 'draw', null
    winner: null, // 'w', 'b', null
    reason: null, // 'checkmate', 'stalemate', 'repetition', 'material', 'draw_agreement' (future), null
    isCheck: false,
    turn: game.turn(),
    text: "", // The final display text
  };

  try {
    if (game.isCheckmate()) {
      status.gameOver = true;
      status.reason = "checkmate";
      status.winner = game.turn() === "w" ? "b" : "w"; // The player whose turn it *was* wins
      status.outcome = status.winner === playerColor ? "win" : "loss";
      status.text = `Checkmate! ${status.winner === "w" ? "White" : "Black"} wins!`;
    } else if (game.isStalemate()) {
      status.gameOver = true;
      status.outcome = "draw";
      status.reason = "stalemate";
      status.text = "Draw by stalemate!";
    } else if (game.isInsufficientMaterial()) {
      status.gameOver = true;
      status.outcome = "draw";
      status.reason = "material";
      status.text = "Draw — insufficient material!";
    }
    // Add explicit checks if needed, though isDraw() should cover them
    // else if (game.isStalemate()) { ... }
    // else if (game.isThreefoldRepetition()) { ... }
    // else if (game.isInsufficientMaterial()) { ... }
    else {
      // Game is ongoing
      status.isCheck = game.isCheck();
      if (status.isCheck) {
        status.text = `${status.turn === "w" ? "White" : "Black"} is in check`;
      } else {
        // Indicate whose turn it is for better appeal
        status.text = `${status.turn === "w" ? "White" : "Black"}'s turn`;
      }
    }
  } catch (error) {
    console.error("Game status check critical error:", error); // Log error more prominently
    status.text = "Error checking game state"; // Provide error feedback
    // You might want to set gameOver to true here depending on desired behavior on error
  }

  setGameStatus(status.text); // Update the status state (or pass the whole object if UI uses it)

  // Return the detailed status object
  return status;
};

export const evaluateMove = (
  move,
  previousState,
  newState,
  moveTimeInSeconds,
  entityRating,
  setLastMoveEvaluation,
  updateScoreCallback,
  engineLevel = 1,
  opponentLossCallback = null  // Penalize opponent when this move captures their piece
) => {
  try {
    // Ensure evaluatePlayerMove is properly imported and implemented
    if (typeof evaluatePlayerMove !== 'function') {
        throw new Error("evaluatePlayerMove function is not available or not imported correctly.");
    }

    const evaluation = evaluatePlayerMove(
      move,
      previousState,
      newState,
      moveTimeInSeconds,
      entityRating,
      engineLevel
    );

    setLastMoveEvaluation(evaluation);
    // Use functional update for safety if many rapid updates could occur
    updateScoreCallback((prevScore) => prevScore + (evaluation?.total || 0));

    // Penalize the opponent when this move captures one of their pieces
    // This makes blunders (losing material) produce negative score impact
    if (move.captured && opponentLossCallback) {
      const capturedValue = PIECE_VALUES[move.captured.toLowerCase()] || 0;
      opponentLossCallback((prevScore) => prevScore - capturedValue);
    }

    return evaluation;

  } catch (error) {
    console.error("Move evaluation error:", error); // Log the actual error object

    // Provide a neutral fallback evaluation
    const defaultEvaluation = {
      components: { error: -1 }, // Indicate an error occurred
      total: 0, // Assign a neutral score change
      engineDifference: null, // Indicate unknown difference
      moveClassification: "Unknown", // Classification is unknown due to error
    };

    setLastMoveEvaluation(defaultEvaluation);
    // updateScoreCallback((prev) => prev + 0); // No score change on evaluation error

    return defaultEvaluation;
  }
};
