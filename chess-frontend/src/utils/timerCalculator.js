// Timer calculation utility for chess games
// Calculates remaining time for each player based on move history

/**
 * Calculate remaining time for each player from move history
 * @param {Array} moves - Array of move objects with time_taken_ms
 * @param {number} initialTimeMs - Starting time in milliseconds (e.g., 10 * 60 * 1000)
 * @returns {Object} { whiteMs, blackMs } - Remaining time for each player
 */
export function calculateRemainingTime(moves, initialTimeMs) {
  let whiteTimeUsed = 0;
  let blackTimeUsed = 0;

  if (!Array.isArray(moves)) {
    console.warn('[TimerCalc] Invalid moves array provided:', moves);
    return {
      whiteMs: initialTimeMs,
      blackMs: initialTimeMs
    };
  }

  moves.forEach((move, index) => {
    // Support both move_time_ms (from game data) and time_taken_ms (alternative format)
    const timeTaken = move.move_time_ms || move.time_taken_ms || 0;

    // Even index (0, 2, 4...) = white's move
    // Odd index (1, 3, 5...) = black's move
    if (index % 2 === 0) {
      whiteTimeUsed += timeTaken;
    } else {
      blackTimeUsed += timeTaken;
    }
  });

  const whiteMs = Math.max(0, initialTimeMs - whiteTimeUsed);
  const blackMs = Math.max(0, initialTimeMs - blackTimeUsed);

  console.log('[TimerCalc] Calculated remaining time:', {
    initialTimeMs,
    initialTimeSecs: Math.floor(initialTimeMs / 1000),
    movesCount: moves.length,
    whiteTimeUsedMs: whiteTimeUsed,
    whiteTimeUsedSecs: Math.floor(whiteTimeUsed / 1000),
    blackTimeUsedMs: blackTimeUsed,
    blackTimeUsedSecs: Math.floor(blackTimeUsed / 1000),
    whiteRemainingMs: whiteMs,
    whiteRemainingSecs: Math.floor(whiteMs / 1000),
    blackRemainingMs: blackMs,
    blackRemainingSecs: Math.floor(blackMs / 1000)
  });

  return {
    whiteMs,
    blackMs
  };
}
