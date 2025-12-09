// Timer calculation utility for chess games
// Calculates remaining time for each player based on move history

/**
 * Calculate remaining time for each player from move history
 * @param {Array} moves - Array of move objects or compact move strings
 * @param {number} initialTimeMs - Starting time in milliseconds (e.g., 10 * 60 * 1000)
 * @param {number} incrementMs - Increment in milliseconds (e.g., 5 * 1000 for 5 seconds)
 * @returns {Object} { whiteMs, blackMs } - Remaining time for each player
 */
export function calculateRemainingTime(moves, initialTimeMs, incrementMs = 0) {
  let whiteTimeUsed = 0;
  let blackTimeUsed = 0;

  console.log('[TimerCalc] Input analysis:', {
    movesCount: Array.isArray(moves) ? moves.length : 'invalid',
    movesType: Array.isArray(moves) ? (typeof moves[0] === 'object' ? 'object' : 'compact_string') : 'invalid',
    initialTimeMs,
    initialTimeMinutes: Math.floor(initialTimeMs / 60000),
    incrementMs,
    incrementSeconds: Math.floor(incrementMs / 1000)
  });

  if (!Array.isArray(moves)) {
    console.warn('[TimerCalc] Invalid moves array provided:', moves);
    return {
      whiteMs: initialTimeMs,
      blackMs: initialTimeMs
    };
  }

  moves.forEach((move, index) => {
    let timeTaken = 0;

    // Handle different move formats
    if (typeof move === 'object' && move !== null) {
      // Object format: { move_time_ms: 3000 } or { time_taken_ms: 3000 }
      timeTaken = move.move_time_ms || move.time_taken_ms || 0;
    } else if (typeof move === 'string') {
      // Compact string format: "e4,3.00" (move, time in seconds)
      const parts = move.split(',');
      if (parts.length >= 2) {
        timeTaken = parseFloat(parts[1]) * 1000; // Convert seconds to milliseconds
      }
    }

    // Even index (0, 2, 4...) = white's move
    // Odd index (1, 3, 5...) = black's move
    if (index % 2 === 0) {
      whiteTimeUsed += timeTaken;
    } else {
      blackTimeUsed += timeTaken;
    }

    // Log first few moves for debugging
    if (index < 5) {
      console.log(`[TimerCalc] Move ${index}:`, {
        move: typeof move === 'object' ? (move.san || move.piece || 'object') : move,
        timeTaken: timeTaken,
        timeTakenSeconds: (timeTaken / 1000).toFixed(2),
        isWhiteMove: index % 2 === 0,
        cumulativeWhite: (whiteTimeUsed / 1000).toFixed(2) + 's',
        cumulativeBlack: (blackTimeUsed / 1000).toFixed(2) + 's'
      });
    }
  });

  // Calculate total increments earned (each player gets increment after their moves)
  const whiteMoveCount = Math.ceil(moves.length / 2); // White moves on even indices
  const blackMoveCount = Math.floor(moves.length / 2); // Black moves on odd indices
  const whiteIncrementEarned = whiteMoveCount * incrementMs;
  const blackIncrementEarned = blackMoveCount * incrementMs;

  // Calculate remaining time with increments
  const whiteMs = Math.max(0, initialTimeMs - whiteTimeUsed + whiteIncrementEarned);
  const blackMs = Math.max(0, initialTimeMs - blackTimeUsed + blackIncrementEarned);

  console.log('[TimerCalc] ================= TIMER CALCULATION SUMMARY =================');
  console.log('[TimerCalc] Game Setup:', {
    initialTimeMs,
    initialTimeMinutes: Math.floor(initialTimeMs / 60000),
    incrementMs,
    incrementSeconds: Math.floor(incrementMs / 1000),
    totalMoves: moves.length
  });

  console.log('[TimerCalc] Move Count Analysis:', {
    whiteMoves: whiteMoveCount,
    blackMoves: blackMoveCount,
    whiteTimeUsed: (whiteTimeUsed / 1000).toFixed(2) + 's',
    blackTimeUsed: (blackTimeUsed / 1000).toFixed(2) + 's',
    whiteTimeUsedMs: whiteTimeUsed,
    blackTimeUsedMs: blackTimeUsed
  });

  console.log('[TimerCalc] Increment Calculation:', {
    whiteIncrementEarned: (whiteIncrementEarned / 1000).toFixed(2) + 's',
    blackIncrementEarned: (blackIncrementEarned / 1000).toFixed(2) + 's',
    whiteIncrementEarnedMs: whiteIncrementEarned,
    blackIncrementEarnedMs: blackIncrementEarned
  });

  console.log('[TimerCalc] Final Remaining Time:', {
    whiteMs: whiteMs,
    whiteMinutes: Math.floor(whiteMs / 60000),
    whiteSeconds: Math.floor((whiteMs % 60000) / 1000),
    whiteTimeStr: `${Math.floor(whiteMs / 60000)}:${String(Math.floor((whiteMs % 60000) / 1000)).padStart(2, '0')}`,
    blackMs: blackMs,
    blackMinutes: Math.floor(blackMs / 60000),
    blackSeconds: Math.floor((blackMs % 60000) / 1000),
    blackTimeStr: `${Math.floor(blackMs / 60000)}:${String(Math.floor((blackMs % 60000) / 1000)).padStart(2, '0')}`
  });
  console.log('[TimerCalc] ================================================================');

  return {
    whiteMs,
    blackMs
  };
}
