// File: src/utils/gameHistoryStringUtils.js
import { Chess } from "chess.js";

/**
 * Encodes a game history (array of move entries) into a concise string.
 * The format is a semicolon-separated list of moves:
 *   <san>,<time>;<san>,<time>;...
 * Example:
 *   e4,1.10;a6,4.55;Nc3,4.54;...
 */
export function encodeGameHistory(gameHistory) {
  let parts = [];
  // For each move entry that has a move property, add the move info.
  gameHistory.forEach((entry) => {
    if (entry.move) {
      // Store just the SAN and timeSpent (to 2 decimals).
      parts.push(entry.move.san + "," + entry.timeSpent.toFixed(2));
    }
  });
  return parts.join(";");
}

/**
 * Decodes a concise game string back into an array of moves.
 * Returns an array of objects: { san, timeSpent }
 */
export function decodeGameHistory(gameString) {
  const parts = gameString.split(";");
  let moves = [];
  parts.forEach((part) => {
    if (part) {
      const [san, timeStr] = part.split(",");
      moves.push({ san: san, timeSpent: parseFloat(timeStr) });
    }
  });
  return moves;
}

/**
 * Reconstructs a full move history JSON array by replaying the moves using chess.js.
 * Each move entry in the returned array is in the format your application uses.
 * Since standard chess always starts at the same position, we use the default starting FEN.
 */
export function reconstructGameFromHistory(gameString) {
  const moves = decodeGameHistory(gameString);
  const defaultFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const chess = new Chess(defaultFen);
  let reconstructedHistory = [];

  // Add initial position entry.
  reconstructedHistory.push({
    fen: defaultFen,
    initialPosition: true,
    playerColor: defaultFen.split(" ")[1] === "w" ? "w" : "b",
  });

  moves.forEach((moveData, index) => {
    const beforeFen = chess.fen(); // Get FEN *before* the move
    console.log(`Reconstructing move #${index + 1}: ${moveData.san}`);
    console.log(`FEN before move #${index + 1}: ${beforeFen}`); // Log FEN before attempting move
    let moveObj;
    try {
      moveObj = chess.move(moveData.san, { sloppy: true });
      // If move is successful, log the FEN *after* the move
      if (moveObj) {
          console.log(`FEN after move #${index + 1}: ${chess.fen()}`); // Log FEN after successful move
      }
    } catch (error) {
      // Enhanced error diagnostics
      console.error(`[Move Reconstruction Error] At move ${index + 1}/${moves.length}:`, {
        san: moveData.san,
        beforeFen,
        error: error.message,
        fullMoveList: moves.map(m => m.san)
      });
      console.warn('This error indicates corrupted move data or incompatible SAN notation. Some history features may be unavailable.');
      return; // Skip invalid move
    }
    if (!moveObj) {
      // This case might indicate a different issue than an exception (e.g., ambiguous move without sloppy)
      console.error(`Move object null at step ${index + 1}, SAN: ${moveData.san}, FEN was: ${beforeFen}`);
      return; // Skip invalid move
    }
    const afterFen = chess.fen(); // FEN after the move was successfully made
    reconstructedHistory.push({
      moveNumber: moveObj.color === "w" ? Math.floor(index / 2) + 1 : undefined, // Move number calculation seems okay
      fen: beforeFen,
      move: {
        color: moveObj.color,
        from: moveObj.from,
        to: moveObj.to,
        piece: moveObj.piece,
        flags: moveObj.flags,
        san: moveObj.san,
        lan: moveObj.from + moveObj.to,
        before: beforeFen,
        after: afterFen,
      },
      playerColor: moveObj.color,
      timeSpent: moveData.timeSpent,
      evaluation: null, // Evaluation can be recalculated on replay if desired.
    });
  });

  return reconstructedHistory;
}

/**
 * Maps chess piece codes to their full names.
 */
const pieceNames = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king", // Included for completeness, though king captures are not standard
};

/**
 * Formats a move object into a descriptive string, especially for captures.
 * If the move is a capture, it returns "Color captured Piece on Square".
 * Otherwise, it returns the Standard Algebraic Notation (SAN).
 *
 * @param {object} move - The move object from chess.js (e.g., selectedGame.moves[i].move)
 * @returns {string} The formatted move description or SAN.
 */
export function formatMoveDescription(move) {
  if (!move) {
    return ""; // Handle cases where move might be null or undefined
  }

  // Check if the move is a capture ('c' flag) and has captured piece info
  if (move.flags && move.flags.includes('c') && move.captured) {
    const playerColor = move.color === 'w' ? 'White' : 'Black';
    const capturedPieceName = pieceNames[move.captured.toLowerCase()] || move.captured; // Fallback to code if name not found
    const destinationSquare = move.to;
    return `${playerColor} captured ${capturedPieceName} on ${destinationSquare}`;
  }

  // For non-captures or if capture info is missing, return SAN
  return move.san || ""; // Fallback to empty string if SAN is missing
}
