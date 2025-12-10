// src/utils/movePathUtils.js
// Utilities for calculating move paths for highlighting on chess board

/**
 * Get all squares that a piece passes through during a move
 * For sliding pieces (rook, bishop, queen), returns all intermediate squares
 * For knight, returns the L-shaped path squares
 * For pawn, returns from, intermediate, and to squares
 * For king, returns just the from/to squares (no intermediate squares)
 *
 * @param {Object} move - The move object from chess.js with from, to, piece, etc.
 * @returns {Array} Array of square names (e.g., ['e2', 'e3', 'e4']) representing the path
 */
export const getMovePath = (move) => {
  if (!move || !move.from || !move.to) {
    return [];
  }

  const from = move.from;
  const to = move.to;
  const piece = move.piece?.toLowerCase() || '';

  // For pawns, return from, intermediate, and to squares
  if (piece === 'p') {
    return getPawnPath(from, to);
  }

  // For kings, just return from and to (no path)
  if (piece === 'k') {
    return [from, to];
  }

  // For knights, return the L-shaped path
  if (piece === 'n') {
    return getKnightPath(from, to);
  }

  // For sliding pieces (rook, bishop, queen), return all squares along the path
  if (piece === 'r' || piece === 'b' || piece === 'q') {
    return getSlidingPath(from, to);
  }

  // Default fallback
  return [from, to];
};

/**
 * Get the path for a pawn move
 * Returns from, intermediate, and to squares
 *
 * @param {string} from - Starting square (e.g., 'e2')
 * @param {string} to - Destination square (e.g., 'e4')
 * @returns {Array} Array of squares including intermediate
 */
export const getPawnPath = (from, to) => {
  const fromFile = from.charCodeAt(0);
  const fromRank = parseInt(from[1]);
  const toFile = to.charCodeAt(0);
  const toRank = parseInt(to[1]);

  // For captures, just return from and to
  if (fromFile !== toFile) {
    return [from, to];
  }

  const path = [from];
  const rankDiff = toRank - fromRank;
  const rankDir = rankDiff > 0 ? 1 : -1;

  // Add intermediate squares
  let currentRank = fromRank + rankDir;
  while (currentRank !== toRank) {
    const intermediateSquare = from[0] + currentRank;
    path.push(intermediateSquare);
    currentRank += rankDir;
  }

  path.push(to);
  return path;
};

/**
 * Get the L-shaped path for a knight move
 * Returns all squares that form the complete L shape
 *
 * @param {string} from - Starting square (e.g., 'b1')
 * @param {string} to - Destination square (e.g., 'c3')
 * @returns {Array} Array of squares forming the complete L-shape
 */
export const getKnightPath = (from, to) => {
  const fromFile = from.charCodeAt(0);
  const fromRank = parseInt(from[1]);
  const toFile = to.charCodeAt(0);
  const toRank = parseInt(to[1]);

  // Calculate the move deltas
  const fileDiff = Math.abs(toFile - fromFile);
  const rankDiff = Math.abs(toRank - fromRank);

  // Knights always move 2 squares in one direction and 1 in the other
  if (!((fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2))) {
    return [from, to]; // Not a valid knight move, return direct path
  }

  const path = [from];

  // Determine the direction of the L-shape
  const fileDir = toFile > fromFile ? 1 : -1;
  const rankDir = toRank > fromRank ? 1 : -1;

  if (fileDiff === 2) {
    // Knight moves 2 files, 1 rank - need 3 squares for L-shape
    const intermediateFile1 = String.fromCharCode(fromFile + fileDir);
    const intermediateFile2 = String.fromCharCode(fromFile + (fileDir * 2));
    const intermediateSquare1 = intermediateFile1 + fromRank;
    const intermediateSquare2 = intermediateFile2 + fromRank;

    // Add the squares forming the L
    path.push(intermediateSquare1);
    path.push(intermediateSquare2);

    // Add the final rank move
    const finalSquare = intermediateFile2 + (fromRank + rankDir);
    path.push(finalSquare);
  } else {
    // Knight moves 1 file, 2 ranks - need 3 squares for L-shape
    const intermediateRank1 = fromRank + rankDir;
    const intermediateRank2 = fromRank + (rankDir * 2);
    const intermediateSquare1 = from[0] + intermediateRank1;
    const intermediateSquare2 = from[0] + intermediateRank2;

    // Add the squares forming the L
    path.push(intermediateSquare1);
    path.push(intermediateSquare2);

    // Add the final file move
    const finalSquare = String.fromCharCode(fromFile + fileDir) + intermediateRank2;
    path.push(finalSquare);
  }

  return path;
};

/**
 * Get all squares along a sliding piece's path (rook, bishop, queen)
 *
 * @param {string} from - Starting square (e.g., 'a1')
 * @param {string} to - Destination square (e.g., 'a8')
 * @returns {Array} Array of all squares from start to end inclusive
 */
export const getSlidingPath = (from, to) => {
  const fromFile = from.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
  const fromRank = parseInt(from[1]) - 1; // '1' = 0, '2' = 1, etc.
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]) - 1;

  const path = [];
  const fileDir = Math.sign(toFile - fromFile);
  const rankDir = Math.sign(toRank - fromRank);

  // Start from source
  let currentFile = fromFile;
  let currentRank = fromRank;

  while (true) {
    const square = String.fromCharCode(currentFile + 97) + (currentRank + 1);
    path.push(square);

    // Check if we've reached the destination
    if (currentFile === toFile && currentRank === toRank) {
      break;
    }

    // Move one step
    currentFile += fileDir;
    currentRank += rankDir;
  }

  return path;
};

/**
 * Create highlight styles for a path of squares
 *
 * @param {Array} path - Array of square names
 * @param {string} color - CSS color (rgba format)
 * @returns {Object} Object mapping squares to highlight styles
 */
export const createPathHighlights = (path, color) => {
  const highlights = {};
  path.forEach(square => {
    highlights[square] = {
      backgroundColor: color,
      transition: 'background-color 0.3s ease'
    };
  });
  return highlights;
};

/**
 * Merge two highlight objects, with second object taking precedence
 *
 * @param {Object} highlights1 - First set of highlights
 * @param {Object} highlights2 - Second set of highlights (overwrites conflicts)
 * @returns {Object} Merged highlights
 */
export const mergeHighlights = (highlights1, highlights2) => {
  return { ...highlights1, ...highlights2 };
};