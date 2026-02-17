/**
 * Result Standardization Utilities
 *
 * Provides utilities to create, parse, and interpret game results in a standardized format.
 * Supports both legacy (string) and new (object) result formats for backward compatibility.
 *
 * @module resultStandardization
 */

/**
 * Standardized result structure
 * @typedef {Object} StandardizedResult
 * @property {'won'|'lost'|'draw'} status - Player-specific outcome
 * @property {string} details - Human-readable description of the result
 * @property {'checkmate'|'resignation'|'timeout'|'stalemate'|'insufficient_material'|'threefold_repetition'|'fifty_move_rule'|'agreement'} end_reason - Reason the game ended
 * @property {'player'|'opponent'|null} winner - Who won the game (null for draws)
 */

/**
 * Valid game status values
 */
export const GAME_STATUS = {
  WON: 'won',
  LOST: 'lost',
  DRAW: 'draw'
};

/**
 * Valid end reasons
 */
export const END_REASON = {
  CHECKMATE: 'checkmate',
  RESIGNATION: 'resignation',
  TIMEOUT: 'timeout',
  STALEMATE: 'stalemate',
  INSUFFICIENT_MATERIAL: 'insufficient_material',
  THREEFOLD_REPETITION: 'threefold_repetition',
  FIFTY_MOVE_RULE: 'fifty_move_rule',
  AGREEMENT: 'agreement'
};

/**
 * Create a standardized result object
 *
 * @param {'won'|'lost'|'draw'} status - Player-specific outcome
 * @param {string} details - Human-readable description
 * @param {string} endReason - Reason the game ended
 * @param {'player'|'opponent'|null} winner - Who won (null for draws)
 * @returns {StandardizedResult} Standardized result object
 *
 * @example
 * createStandardizedResult('won', 'Checkmate! You won!', 'checkmate', 'player')
 * // Returns: { status: 'won', details: 'Checkmate! You won!', end_reason: 'checkmate', winner: 'player' }
 */
export const createStandardizedResult = (status, details, endReason, winner) => {
  return {
    status: status || GAME_STATUS.DRAW,
    details: details || 'Game ended',
    end_reason: endReason || END_REASON.AGREEMENT,
    winner: winner || null
  };
};

/**
 * Parse result status from any format (string or object)
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {'won'|'lost'|'draw'} Status value
 *
 * @example
 * parseResultStatus("won") // Returns: "won"
 * parseResultStatus({ status: "lost", details: "..." }) // Returns: "lost"
 * parseResultStatus("Checkmate! Black wins!") // Returns: "draw" (fallback for unparseable)
 */
export const parseResultStatus = (result) => {
  // Handle null/undefined
  if (!result) {
    return GAME_STATUS.DRAW;
  }

  // If it's already an object with status property
  if (typeof result === 'object' && result.status) {
    return result.status;
  }

  // If it's a string, try to parse it
  if (typeof result === 'string') {
    const lowerResult = result.toLowerCase();

    // Direct matches (new format strings)
    if (lowerResult === 'won') return GAME_STATUS.WON;
    if (lowerResult === 'lost') return GAME_STATUS.LOST;
    if (lowerResult === 'draw') return GAME_STATUS.DRAW;

    // Legacy format detection (not reliable without player color - returns draw as safe fallback)
    // These should be replaced with proper structured data
    if (lowerResult.includes('draw') || lowerResult.includes('stalemate')) {
      return GAME_STATUS.DRAW;
    }

    // Can't determine reliably from descriptive text alone
    // This is why we need the standardized format!
    // Using debug log to avoid console noise for legacy data
    if (process.env.NODE_ENV === 'development') {
      console.debug('[resultStandardization] Legacy format detected:', result);
    }
    return GAME_STATUS.DRAW; // Safe fallback
  }

  return GAME_STATUS.DRAW; // Default fallback
};

/**
 * Determine if the player won
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {boolean} True if player won
 *
 * @example
 * isPlayerWin("won") // Returns: true
 * isPlayerWin({ status: "lost" }) // Returns: false
 */
export const isPlayerWin = (result) => {
  const status = parseResultStatus(result);
  return status === GAME_STATUS.WON;
};

/**
 * Determine if the player lost
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {boolean} True if player lost
 *
 * @example
 * isPlayerLoss("lost") // Returns: true
 * isPlayerLoss({ status: "won" }) // Returns: false
 */
export const isPlayerLoss = (result) => {
  const status = parseResultStatus(result);
  return status === GAME_STATUS.LOST;
};

/**
 * Determine if the game was a draw
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {boolean} True if draw
 *
 * @example
 * isDraw("draw") // Returns: true
 * isDraw({ status: "draw", end_reason: "stalemate" }) // Returns: true
 */
export const isDraw = (result) => {
  const status = parseResultStatus(result);
  return status === GAME_STATUS.DRAW;
};

/**
 * Get human-readable result details
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {string} Human-readable description
 *
 * @example
 * getResultDetails("won") // Returns: "won"
 * getResultDetails({ details: "Checkmate! You won!" }) // Returns: "Checkmate! You won!"
 */
export const getResultDetails = (result) => {
  if (!result) return 'Game ended';

  // If it's an object with details property
  if (typeof result === 'object' && result.details) {
    return result.details;
  }

  // If it's a string, return as-is
  if (typeof result === 'string') {
    return result;
  }

  return 'Game ended';
};

/**
 * Get the end reason
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {string|null} End reason or null if not available
 *
 * @example
 * getEndReason({ end_reason: "checkmate" }) // Returns: "checkmate"
 * getEndReason("won") // Returns: null
 */
export const getEndReason = (result) => {
  if (!result) return null;

  // If it's an object with end_reason property
  if (typeof result === 'object' && result.end_reason) {
    return result.end_reason;
  }

  // Try to infer from string (legacy format)
  if (typeof result === 'string') {
    const lowerResult = result.toLowerCase();
    if (lowerResult.includes('checkmate')) return END_REASON.CHECKMATE;
    if (lowerResult.includes('resignation') || lowerResult.includes('resign')) return END_REASON.RESIGNATION;
    if (lowerResult.includes('timeout') || lowerResult.includes('time')) return END_REASON.TIMEOUT;
    if (lowerResult.includes('stalemate')) return END_REASON.STALEMATE;
    if (lowerResult.includes('draw')) return END_REASON.AGREEMENT;
  }

  return null;
};

/**
 * Get the winner
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {'player'|'opponent'|null} Winner or null for draws
 *
 * @example
 * getWinner({ status: "won", winner: "player" }) // Returns: "player"
 * getWinner({ status: "draw" }) // Returns: null
 */
export const getWinner = (result) => {
  if (!result) return null;

  // If it's an object with winner property
  if (typeof result === 'object' && result.winner) {
    return result.winner;
  }

  // Infer from status
  const status = parseResultStatus(result);
  if (status === GAME_STATUS.WON) return 'player';
  if (status === GAME_STATUS.LOST) return 'opponent';
  return null;
};

/**
 * Create standardized result from legacy PlayComputer.js format
 *
 * @param {string} resultText - Result text like "Checkmate! Black wins!"
 * @param {string} playerColor - Player's color ('w' or 'b')
 * @param {Object} gameStatus - Chess.js game status object
 * @returns {StandardizedResult} Standardized result
 *
 * @example
 * createResultFromComputerGame("Checkmate! Black wins!", "w", { in_checkmate: true })
 * // Returns: { status: "lost", details: "Checkmate! Black wins!", end_reason: "checkmate", winner: "opponent" }
 */
export const createResultFromComputerGame = (resultText, playerColor, gameStatus = {}) => {
  const lowerResult = (resultText || '').toLowerCase();
  const isPlayerWhite = playerColor === 'w' || playerColor === 'white';

  // Determine end reason
  let endReason = END_REASON.AGREEMENT;
  if (gameStatus.in_checkmate || lowerResult.includes('checkmate')) {
    endReason = END_REASON.CHECKMATE;
  } else if (gameStatus.in_stalemate || lowerResult.includes('stalemate')) {
    endReason = END_REASON.STALEMATE;
  } else if (gameStatus.in_draw || lowerResult.includes('draw')) {
    if (lowerResult.includes('insufficient')) endReason = END_REASON.INSUFFICIENT_MATERIAL;
    else if (lowerResult.includes('threefold')) endReason = END_REASON.THREEFOLD_REPETITION;
    else if (lowerResult.includes('fifty')) endReason = END_REASON.FIFTY_MOVE_RULE;
    else endReason = END_REASON.AGREEMENT;
  }

  // Determine status and winner
  let status = GAME_STATUS.DRAW;
  let winner = null;

  if (lowerResult.includes('white wins')) {
    status = isPlayerWhite ? GAME_STATUS.WON : GAME_STATUS.LOST;
    winner = isPlayerWhite ? 'player' : 'opponent';
  } else if (lowerResult.includes('black wins')) {
    status = isPlayerWhite ? GAME_STATUS.LOST : GAME_STATUS.WON;
    winner = isPlayerWhite ? 'opponent' : 'player';
  } else if (lowerResult.includes('draw') || lowerResult.includes('stalemate')) {
    status = GAME_STATUS.DRAW;
    winner = null;
  }

  const result = createStandardizedResult(status, resultText, endReason, winner);
  // Add game_mode for computer games to help GameEndCard distinguish game types
  result.game_mode = 'computer';
  result.player_color = playerColor;
  return result;
};

/**
 * Create standardized result from multiplayer game event
 *
 * @param {number|null} winnerUserId - ID of winning user or null for draw
 * @param {number} currentUserId - Current user's ID
 * @param {string} endReason - End reason from server
 * @param {string} resultDetails - Human-readable details from server
 * @returns {StandardizedResult} Standardized result
 *
 * @example
 * createResultFromMultiplayerGame(123, 123, "checkmate", "You won by checkmate!")
 * // Returns: { status: "won", details: "You won by checkmate!", end_reason: "checkmate", winner: "player" }
 */
export const createResultFromMultiplayerGame = (winnerUserId, currentUserId, endReason, resultDetails) => {
  let status = GAME_STATUS.DRAW;
  let winner = null;

  if (winnerUserId === currentUserId) {
    status = GAME_STATUS.WON;
    winner = 'player';
  } else if (winnerUserId && winnerUserId !== currentUserId) {
    status = GAME_STATUS.LOST;
    winner = 'opponent';
  } else {
    status = GAME_STATUS.DRAW;
    winner = null;
  }

  return createStandardizedResult(
    status,
    resultDetails || `Game ended by ${endReason}`,
    endReason || END_REASON.AGREEMENT,
    winner
  );
};

/**
 * Validate a result object
 *
 * @param {any} result - Result to validate
 * @returns {boolean} True if valid standardized result
 */
export const isValidStandardizedResult = (result) => {
  if (!result || typeof result !== 'object') return false;

  const hasStatus = ['won', 'lost', 'draw'].includes(result.status);
  const hasDetails = typeof result.details === 'string';
  const hasEndReason = typeof result.end_reason === 'string';

  return hasStatus && hasDetails && hasEndReason;
};

/**
 * Convert any result format to standardized format
 * (Best effort conversion for legacy formats)
 *
 * @param {string|StandardizedResult} result - Result in any format
 * @returns {StandardizedResult} Standardized result
 */
export const toStandardizedResult = (result) => {
  // Already standardized
  if (isValidStandardizedResult(result)) {
    return result;
  }

  // Convert string to standardized format (best effort)
  if (typeof result === 'string') {
    const status = parseResultStatus(result);
    const endReason = getEndReason(result);
    const winner = getWinner(result);

    return createStandardizedResult(
      status,
      result, // Use original string as details
      endReason || END_REASON.AGREEMENT,
      winner
    );
  }

  // Fallback for invalid input
  return createStandardizedResult(
    GAME_STATUS.DRAW,
    'Game ended',
    END_REASON.AGREEMENT,
    null
  );
};

// Export aliases for backward compatibility
export { isPlayerWin as isWin };
export { isPlayerLoss as isLoss };
export { getResultDetails as getResultDisplayText };

