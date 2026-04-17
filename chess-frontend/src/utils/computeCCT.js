import { Chess } from 'chess.js';

// Piece values — used for threat threshold (we only flag threats against pieces worth >= 3)
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Return a Chess instance set up for `color` to move, even if it isn't their turn. */
function chessForColor(fen, color) {
  try {
    const chess = new Chess(fen);
    if (chess.turn() === color) return chess;
    // Flip the active-color byte in the FEN
    const parts = fen.split(' ');
    parts[1] = color;
    // If flipping leaves the *other* side in check (illegal), chess.js will throw — catch below
    return new Chess(parts.join(' '));
  } catch {
    return null;
  }
}

/** Compute all checks and captures for `color` from `fen`. Exact — no false positives. */
function computeChecksAndCaptures(fen, color) {
  const chess = chessForColor(fen, color);
  if (!chess) return { checks: [], captures: [] };

  let moves;
  try { moves = chess.moves({ verbose: true }); }
  catch { return { checks: [], captures: [] }; }

  const checks = [];
  const captures = [];

  for (const mv of moves) {
    const temp = new Chess(chess.fen());
    try { temp.move({ from: mv.from, to: mv.to, promotion: 'q' }); }
    catch { continue; }

    if (temp.inCheck()) {
      checks.push({ from: mv.from, to: mv.to, piece: mv.piece, san: mv.san });
    }
    if (mv.captured) {
      captures.push({ from: mv.from, to: mv.to, piece: mv.piece, captured: mv.captured, san: mv.san });
    }
  }

  return { checks, captures };
}

/**
 * If puzzle.moves[0] is a quiet move (not check, not capture) it IS the threat to identify.
 * Returns an array of 0 or 1 threat objects.
 *
 * This approach eliminates false positives: instead of scanning ALL quiet moves with a
 * heuristic filter, we trust the puzzle's own solution to tell us what the real threat is.
 */
function extractThreatFromSolution(fen, solutionMoves, playerColor) {
  if (!solutionMoves || solutionMoves.length === 0) return [];

  const chess = chessForColor(fen, playerColor);
  if (!chess) return [];

  const firstUCI = solutionMoves[0];
  const from     = firstUCI.slice(0, 2);
  const to       = firstUCI.slice(2, 4);
  const promo    = firstUCI.length === 5 ? firstUCI[4] : 'q';

  const temp = new Chess(chess.fen());
  let mv;
  try {
    mv = temp.move({ from, to, promotion: promo });
    if (!mv) return [];
  } catch { return []; }

  // Only a quiet move is a "threat" in the CCT sense
  if (temp.inCheck() || mv.captured) return [];

  // Determine what the moved piece threatens (for the UI "threatens" annotation)
  const oppColor = playerColor === 'w' ? 'b' : 'w';
  const flipped  = chessForColor(temp.fen(), playerColor);
  let threatens  = null;
  let isFork     = false;

  if (flipped) {
    try {
      const followUps = flipped.moves({ square: to, verbose: true })
        .filter(m => m.captured && PIECE_VALUES[m.captured] >= 3);

      // Only count newly-attacked targets (ones the piece couldn't already reach)
      const newlyAttacked = followUps.filter(m => {
        try { return !chess.isAttacked(m.to, playerColor); }
        catch { return true; }
      });

      isFork = newlyAttacked.length >= 2;
      if (newlyAttacked.length > 0) {
        const best = newlyAttacked.reduce((a, b) =>
          PIECE_VALUES[b.captured] > PIECE_VALUES[a.captured] ? b : a
        );
        threatens = best.to;
      }
    } catch { /* ignore */ }
  }

  return [{ from, to, piece: mv.piece, san: mv.san, threatens, isFork }];
}

/**
 * Compute CCTs for both player and opponent sides using the puzzle's solution to
 * derive threats (instead of the heuristic algorithm).
 *
 * Checks & captures: exact (chess.js enumerates all legal moves).
 * Player threats:    derived from puzzle.moves[0] — the intended threat is the
 *                    solution move when it is a quiet move.
 * Opponent threats:  [] — checks and captures already cover the critical opponent
 *                    forcing moves; quiet opponent threats add noise in tactical positions.
 *
 * Returns { my: { checks, captures, threats }, opponent: { checks, captures, threats } }
 */
export function computeCCTFromPuzzle(puzzle) {
  const { fen, moves, playerColor } = puzzle;
  const oppColor = playerColor === 'w' ? 'b' : 'w';

  const myCC  = computeChecksAndCaptures(fen, playerColor);
  const oppCC = computeChecksAndCaptures(fen, oppColor);
  const myThreats = extractThreatFromSolution(fen, moves, playerColor);

  return {
    my:       { ...myCC, threats: myThreats },
    opponent: { ...oppCC, threats: [] },
  };
}

/**
 * Compute all checks and captures available to `color` from `fen`.
 * Threats are left empty — use computeCCTFromPuzzle() which derives threats
 * from the puzzle solution instead of a heuristic scan.
 *
 * Returns { checks, captures, threats: [] }
 */
export function computeCCT(fen, color) {
  const cc = computeChecksAndCaptures(fen, color);
  return { ...cc, threats: [] };
}

/**
 * Return the legal target squares for a piece on `square` when `color` moves.
 * Works even when it is not `color`'s turn (used for opponent CCT step).
 */
export function getLegalTargets(fen, square, color) {
  const chess = chessForColor(fen, color);
  if (!chess) return [];
  try {
    return chess.moves({ square, verbose: true }).map(m => m.to);
  } catch {
    return [];
  }
}

/**
 * Validate a user-drawn CCT arrow (from → to) for checks and captures only.
 *
 * Threats are handled separately via the puzzle-derived ground truth in
 * computeCCTFromPuzzle — the caller (TacticalPuzzleBoard) cross-checks threats
 * against the pre-computed set after this function runs.
 *
 * Returns { valid, actualType: 'check'|'capture'|'none'|null, qualifies, feedback }
 */
export function validateCCTEntry(fen, from, to, color) {
  const chess = chessForColor(fen, color);
  if (!chess) return { valid: false, actualType: null, feedback: 'Invalid position.' };

  const piece = chess.get(from);
  if (!piece || piece.color !== color) {
    return { valid: false, actualType: null, feedback: 'That is not your piece.' };
  }

  try {
    const temp = new Chess(chess.fen());
    const move = temp.move({ from, to, promotion: 'q' });
    if (!move) {
      return { valid: false, actualType: null, feedback: `${from}→${to} is not a legal move.` };
    }

    const isCheck   = temp.inCheck();
    const isCapture = !!move.captured;

    const qualifies = new Set();
    if (isCheck)   qualifies.add('check');
    if (isCapture) qualifies.add('capture');

    if (qualifies.size === 0) {
      // Might still be a threat — caller will cross-check against computedCCTs.threats
      return {
        valid: false,
        actualType: 'none',
        qualifies: [],
        feedback: `${from}→${to} is a regular move — no check, capture, or significant threat.`,
      };
    }

    const TYPE_PRIORITY = ['check', 'capture'];
    const actualType = TYPE_PRIORITY.find(t => qualifies.has(t));
    return { valid: true, actualType, qualifies: [...qualifies], feedback: null };
  } catch {
    return { valid: false, actualType: null, feedback: `${from}→${to} is not a legal move.` };
  }
}
