// src/utils/compactGameFormats.js
import { encodeGameHistory, decodeGameHistory } from './gameHistoryStringUtils';
import { Chess } from 'chess.js';

/**
 * Enhanced compact format that includes evaluations and metadata
 * Format: <san>,<time>,<eval>;<san>,<time>,<eval>;...
 *
 * Examples:
 * - Basic: "e4,2.50,;a6,3.20,;Nc3,1.80,0.25"
 * - With evals: "e4,2.50,0.30;a6,3.20,-0.15;Nc3,1.80,0.25"
 *
 * Backwards compatible with existing format
 */

/**
 * Encodes game history into enhanced compact format
 * @param {Array} gameHistory - Array of move objects
 * @param {Object} options - Encoding options
 * @returns {string} Encoded game string
 */
export function encodeCompactGameHistory(gameHistory, options = {}) {
  const {
    includeEvaluations = true,
    maxDecimalPlaces = 2,
    skipMissingEvals = true
  } = options;

  let parts = [];

  gameHistory.forEach((entry, index) => {
    let san, time, evaluation = '';

    // Extract data based on format
    if (typeof entry === 'string') {
      // Already compact format - passthrough
      parts.push(entry);
      return;
    }

    // Computer game format
    if (entry.move?.san) {
      san = entry.move.san;
      time = entry.timeSpent || entry.time_spent || 0;
      evaluation = entry.evaluation || entry.eval || '';
    }
    // Server/multiplayer format
    else if (entry.san) {
      san = entry.san;
      time = (entry.move_time_ms || 0) / 1000;
      evaluation = entry.evaluation || entry.eval || '';
    }
    // Fallback
    else {
      console.warn(`Skipping invalid move entry at index ${index}:`, entry);
      return;
    }

    // Format time
    const timeStr = time.toFixed(maxDecimalPlaces);

    // Format evaluation
    let evalStr = '';
    if (includeEvaluations && evaluation !== undefined && evaluation !== null && evaluation !== '') {
      // Handle both numeric evaluations and evaluation objects
      if (typeof evaluation === 'object') {
        evalStr = evaluation.total ? evaluation.total.toString() : '';
      } else {
        evalStr = evaluation.toString();
      }
    } else if (!skipMissingEvals && includeEvaluations) {
      evalStr = ''; // Empty eval for missing data
    }

    // Build part: san,time,eval (eval optional for backwards compatibility)
    parts.push(evalStr ? `${san},${timeStr},${evalStr}` : `${san},${timeStr}`);
  });

  return parts.join(';');
}

/**
 * Decodes enhanced compact format
 * @param {string} gameString - Compact game string
 * @returns {Array} Array of move objects with san, timeSpent, evaluation
 */
export function decodeCompactGameHistory(gameString) {
  const parts = gameString.split(';');
  let moves = [];

  parts.forEach((part, index) => {
    if (!part.trim()) return;

    const segments = part.split(',');

    if (segments.length < 2) {
      console.warn(`Invalid move format at index ${index}: ${part}`);
      return;
    }

    const san = segments[0];
    const timeSpent = parseFloat(segments[1]) || 0;
    const evaluation = segments.length > 2 ? parseFloat(segments[2]) || null : null;

    moves.push({
      san,
      timeSpent,
      evaluation
    });
  });

  return moves;
}

/**
 * Converts enhanced compact format to full move history with FENs
 * @param {string} gameString - Compact game string
 * @param {Object} options - Reconstruction options
 * @returns {Array} Full move history with chess.js move objects
 */
export function reconstructGameFromCompact(gameString, options = {}) {
  const {
    includeEvaluations = true,
    startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  } = options;

  const moves = decodeCompactGameHistory(gameString);
  const chess = new Chess(startingFen);
  let reconstructedHistory = [];

  // Add initial position
  reconstructedHistory.push({
    fen: startingFen,
    initialPosition: true,
    playerColor: startingFen.split(' ')[1] === 'w' ? 'w' : 'b',
    moveNumber: 0
  });

  moves.forEach((moveData, index) => {
    const beforeFen = chess.fen();

    try {
      const moveObj = chess.move(moveData.san, { sloppy: true });
      if (!moveObj) {
        console.warn(`Invalid move at index ${index}: ${moveData.san}`);
        return;
      }

      const afterFen = chess.fen();

      reconstructedHistory.push({
        moveNumber: Math.floor(index / 2) + 1,
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
        evaluation: includeEvaluations ? moveData.evaluation : null,
      });
    } catch (error) {
      console.error(`Error reconstructing move ${index + 1}: ${moveData.san}`, error);
    }
  });

  return reconstructedHistory;
}

/**
 * Evaluates size savings of compact format vs full JSON
 * @param {Array} fullHistory - Full move history
 * @returns {Object} Size comparison statistics
 */
export function analyzeCompactSavings(fullHistory) {
  const jsonString = JSON.stringify(fullHistory);
  const compactString = encodeCompactGameHistory(fullHistory);

  const jsonSize = new Blob([jsonString]).size;
  const compactSize = new Blob([compactString]).size;

  return {
    originalSize: jsonSize,
    compactSize: compactSize,
    savings: jsonSize - compactSize,
    savingsPercentage: ((jsonSize - compactSize) / jsonSize * 100).toFixed(1),
    compressionRatio: (jsonSize / compactSize).toFixed(2)
  };
}

/**
 * Validates a compact game string format
 * @param {string} gameString - Compact game string to validate
 * @returns {Object} Validation result with errors
 */
export function validateCompactFormat(gameString) {
  const errors = [];
  const warnings = [];

  if (!gameString || typeof gameString !== 'string') {
    errors.push('Invalid game string: must be non-empty string');
    return { valid: false, errors, warnings };
  }

  const parts = gameString.split(';');
  let moveNumber = 0;

  for (const part of parts) {
    if (!part.trim()) continue;

    moveNumber++;
    const segments = part.split(',');

    if (segments.length < 2) {
      errors.push(`Move ${moveNumber}: Missing required data (san,time)`);
      continue;
    }

    const san = segments[0];
    const timeStr = segments[1];
    const evalStr = segments[2];

    // Validate SAN notation (basic check)
    if (!san.match(/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$/)) {
      warnings.push(`Move ${moveNumber}: Unusual SAN notation: ${san}`);
    }

    // Validate time
    const time = parseFloat(timeStr);
    if (isNaN(time) || time < 0) {
      errors.push(`Move ${moveNumber}: Invalid time value: ${timeStr}`);
    }

    // Validate evaluation if present
    if (evalStr) {
      const evaluation = parseFloat(evalStr);
      if (isNaN(evaluation)) {
        errors.push(`Move ${moveNumber}: Invalid evaluation: ${evalStr}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    moveCount: moveNumber
  };
}