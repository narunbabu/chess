// src/utils/gameStateUtils.js
import { evaluatePlayerMove } from "./evaluate"; // Assuming evaluate.js exists as per old context

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
    } else if (game.isDraw()) {
      status.gameOver = true;
      status.outcome = "draw";
      // Determine specific draw reason
      if (game.isStalemate()) status.reason = "stalemate";
      else if (game.isThreefoldRepetition()) status.reason = "repetition";
      else if (game.isInsufficientMaterial()) status.reason = "material";
      // else if (game.isFiftyMoves()) status.reason = "fifty_move"; // isDraw covers this
      else status.reason = "draw"; // Generic draw
      status.text = `Draw by ${status.reason}!`;
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
  engineLevel = 1          // <‑‑ add param
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
      engineLevel         // <‑‑ forward
    );

    setLastMoveEvaluation(evaluation);
    // Use functional update for safety if many rapid updates could occur
    updateScoreCallback((prevScore) => prevScore + (evaluation?.total || 0));

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
