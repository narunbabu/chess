// src/utils/devLogger.js
/**
 * Environment-aware logging utility for development and production
 * Reduces console spam while maintaining necessary debugging capabilities
 */

// Global log state for tracking changes
let lastLoggedTurn = null;
let lastLoggedBoardSize = null;

// Check if we're in development environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Performance threshold for logging slow operations (ms)
const PERFORMANCE_THRESHOLD = 100;

/**
 * Environment-aware logger with different levels
 * @param {string} level - Log level: 'info', 'warn', 'error'
 * @param {string} prefix - Log prefix for identification
 * @param {any} data - Data to log (optional)
 */
const devLog = (level = 'info', prefix, data = null) => {
  if (!isDevelopment) return;

  const logFn = level === 'error' ? console.error :
                 level === 'warn' ? console.warn : console.log;

  if (data !== null) {
    logFn(prefix, data);
  } else {
    logFn(prefix);
  }
};

/**
 * Log turn changes only when they actually change
 * @param {Object} turnData - Turn status data
 */
export const logTurnChange = (turnData) => {
  const { isPlayerTurn, gameTurn, playerColor } = turnData;
  const currentTurn = `${isPlayerTurn}-${gameTurn}-${playerColor}`;

  if (lastLoggedTurn !== currentTurn) {
    devLog('info', '🔄 [ChessBoard] Turn changed:', turnData);
    lastLoggedTurn = currentTurn;
  }
};

/**
 * Log board size changes only when they actually change
 * @param {number} oldSize - Previous board size
 * @param {number} newSize - New board size
 * @param {Object} containerData - Container dimensions (optional)
 */
export const logBoardResize = (oldSize, newSize, containerData = null) => {
  if (lastLoggedBoardSize !== newSize && newSize > 0) {
    const message = containerData
      ? `📐 Board resized: ${oldSize} → ${newSize}px (${containerData.width}x${containerData.height})`
      : `📐 Board resized: ${oldSize} → ${newSize}px`;

    devLog('info', message);
    lastLoggedBoardSize = newSize;
  }
};

/**
 * Log piece selection with appropriate level
 * @param {string} action - Action type: 'select', 'attempt', 'reject'
 * @param {Object} data - Piece selection data
 */
export const logPieceSelection = (action, data) => {
  const prefixes = {
    select: '✅ [ChessBoard] Selected piece:',
    attempt: '👆 [ChessBoard] Piece selection attempt:',
    reject: '❌ [ChessBoard] Cannot select piece:'
  };

  devLog(action === 'reject' ? 'warn' : 'info', prefixes[action] || '👆 [ChessBoard] Piece interaction:', data);
};

/**
 * Log move evaluation with appropriate level based on score magnitude
 * @param {Object} evaluationData - Move evaluation data
 */
export const logMoveEvaluation = (evaluationData) => {
  const { total, move, classification, totalBeforeCap } = evaluationData;

  // Handle undefined values safely
  const safeTotal = typeof total === 'number' ? total : 0;
  const safeTotalBeforeCap = typeof totalBeforeCap === 'number' ? totalBeforeCap : 0;
  const safeClassification = classification || 'Unknown';
  const absTotal = Math.abs(safeTotal);

  let level = 'info';
  if (absTotal > 3) level = 'error';
  else if (absTotal > 2) level = 'warn';
  else if (absTotal > 1) level = 'info';

  const moveNotation = move?.san || (move?.from && move?.to ? `${move.from}-${move.to}` : 'unknown');
  const message = `📊 [Eval] ${moveNotation}: ${safeTotal.toFixed(1)}pts (${safeClassification})`;

  devLog(level, message, {
    beforeCap: safeTotalBeforeCap.toFixed(2),
    final: safeTotal.toFixed(1),
    class: safeClassification
  });
};

/**
 * Performance monitor for detecting slow operations
 * @param {string} operation - Operation name
 * @param {Function} callback - Function to monitor
 * @param {boolean} logFast - Whether to log fast operations too
 */
export const monitorPerformance = (operation, callback, logFast = false) => {
  const startTime = performance.now();

  try {
    const result = callback();
    const duration = performance.now() - startTime;

    if (duration > PERFORMANCE_THRESHOLD) {
      devLog('warn', `⚡ Slow ${operation}: ${duration.toFixed(2)}ms`);
    } else if (logFast && isDevelopment) {
      devLog('info', `⚡ ${operation}: ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    devLog('error', `❌ ${operation} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

/**
 * Reset log state (useful for game resets)
 */
export const resetLogState = () => {
  lastLoggedTurn = null;
  lastLoggedBoardSize = null;
};

/**
 * Check if development logging is enabled
 * @returns {boolean}
 */
export const isDevLoggingEnabled = () => isDevelopment;

// Export main logger for custom usage
export { devLog };

// Default export with all functions
export default {
  devLog,
  logTurnChange,
  logBoardResize,
  logPieceSelection,
  logMoveEvaluation,
  monitorPerformance,
  resetLogState,
  isDevLoggingEnabled
};