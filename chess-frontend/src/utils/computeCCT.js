import { Chess } from 'chess.js';

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE_NAMES  = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

/** Return a Chess instance set up for `color` to move, even if it isn't their turn. */
function chessForColor(fen, color) {
  try {
    const chess = new Chess(fen);
    if (chess.turn() === color) return chess;
    const parts = fen.split(' ');
    parts[1] = color;
    return new Chess(parts.join(' '));
  } catch {
    return null;
  }
}

/** Find the king square of `kingColor` on a chess instance's board. */
function findKingSquare(chess, kingColor) {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (sq && sq.type === 'k' && sq.color === kingColor) {
        return String.fromCharCode(97 + c) + (8 - r);
      }
    }
  }
  return null;
}

/**
 * Determine whether a move at mv.to genuinely delivers a new check, or whether
 * the check was pre-existing (opponent's king already attacked before our move).
 * Removes the moved piece from the post-move position: if the king is still attacked
 * by `attackerColor` without that piece, the check is not from this move.
 * Note: discovered checks through a pre-existing check are a known edge-case
 * that may be conservatively excluded; this is acceptable for CCT training purposes.
 */
function isGenuineNewCheck(postChess, movedTo, attackerColor, oppColor) {
  try {
    const kingSq = findKingSquare(postChess, oppColor);
    if (!kingSq) return true; // can't determine — treat as genuine
    const testBoard = new Chess(postChess.fen());
    testBoard.remove(movedTo);
    return !testBoard.isAttacked(kingSq, attackerColor);
  } catch {
    return false; // conservative: don't count on error
  }
}

/** Compute all checks and captures for `color` from `fen`. */
function computeChecksAndCaptures(fen, color) {
  const chess = chessForColor(fen, color);
  if (!chess) return { checks: [], captures: [] };

  const oppColor = color === 'w' ? 'b' : 'w';

  // Detect pre-existing check on opponent's king.
  // This happens when chessForColor flipped the turn, creating an illegal position
  // where the opponent's king is already in check. In that case temp.inCheck() returns
  // true for nearly every move — we must filter out these false-positive checks.
  let opponentAlreadyInCheck = false;
  try {
    const oppPerspective = chessForColor(fen, oppColor);
    if (oppPerspective) opponentAlreadyInCheck = oppPerspective.inCheck();
  } catch { /* ignore */ }

  let moves;
  try { moves = chess.moves({ verbose: true }); }
  catch { return { checks: [], captures: [] }; }

  const checks   = [];
  const captures = [];

  for (const mv of moves) {
    const temp = new Chess(chess.fen());
    try { temp.move({ from: mv.from, to: mv.to, promotion: 'q' }); }
    catch { continue; }

    let givesCheck = temp.inCheck();
    if (givesCheck && opponentAlreadyInCheck) {
      givesCheck = isGenuineNewCheck(temp, mv.to, color, oppColor);
    }

    if (givesCheck) {
      checks.push({ from: mv.from, to: mv.to, piece: mv.piece, san: mv.san });
    }
    if (mv.captured) {
      captures.push({ from: mv.from, to: mv.to, piece: mv.piece, captured: mv.captured, san: mv.san });
    }
  }

  return { checks, captures };
}

/**
 * Classify a quiet move (from→to) by `color` for threat quality.
 *
 * Forcing rules (exchange evaluation):
 *   Undefended target ≥ minor         → forcing-free-piece  ✓
 *   Defended target, victim > attacker → forcing-profitable  ✓
 *   Fork: 2+ newly-attacked valuables → fork               ✓
 *   Even trade (defended, same value)  → not forcing
 *   Bad trade (victim < attacker)      → not forcing
 *
 * Returns:
 *   { kind, isForcing, message, threatens, isFork, victims, isSelfHang }
 */
export function classifyThreatAttempt(fen, from, to, color) {
  const failed = (kind, message) => ({
    kind, isForcing: false, message, threatens: null, isFork: false, victims: [], isSelfHang: false,
  });

  const chess = chessForColor(fen, color);
  if (!chess) return failed('illegal', 'Invalid position.');

  const piece = chess.get(from);
  if (!piece || piece.color !== color) return failed('illegal', 'That is not your piece.');

  const oppColor = color === 'w' ? 'b' : 'w';

  // Detect pre-existing check on opponent's king before our move.
  let opponentAlreadyInCheck = false;
  try {
    const oppPerspective = chessForColor(fen, oppColor);
    if (oppPerspective) opponentAlreadyInCheck = oppPerspective.inCheck();
  } catch { /* ignore */ }

  const postGame = new Chess(chess.fen());
  let mv;
  try {
    mv = postGame.move({ from, to, promotion: 'q' });
    if (!mv) return failed('illegal', `${from}→${to} is not a legal move.`);
  } catch {
    return failed('illegal', `${from}→${to} is not a legal move.`);
  }

  let givesNewCheck = postGame.inCheck();
  if (givesNewCheck && opponentAlreadyInCheck) {
    givesNewCheck = isGenuineNewCheck(postGame, to, color, oppColor);
  }

  if (givesNewCheck || mv.captured) {
    return failed('not-quiet', 'This is a check or capture — mark it in the correct mode.');
  }

  const attackerValue = PIECE_VALUES[mv.piece] ?? 0;
  const attackerName  = PIECE_NAMES[mv.piece]  ?? mv.piece;

  // Self-hang: destination attacked by opponent AND not defended by another of our pieces
  let isSelfHang = false;
  try {
    isSelfHang = postGame.isAttacked(to, oppColor) && !postGame.isAttacked(to, color);
  } catch { /* ignore */ }

  // What can our piece at `to` capture in the post-move position?
  const attackFlipped = chessForColor(postGame.fen(), color);
  let attackMoves = [];
  if (attackFlipped) {
    try {
      attackMoves = attackFlipped.moves({ square: to, verbose: true }).filter(m => m.captured);
    } catch {}
  }

  if (attackMoves.length === 0) {
    const hangNote = isSelfHang ? ` Your ${attackerName} on ${to} is also undefended.` : '';
    return failed(
      'no-new-attack',
      `Your ${attackerName} on ${to} doesn't attack any opponent piece.${hangNote}`,
    );
  }

  // Filter: only valuable targets (minor piece or better)
  const valuableAttacks = attackMoves.filter(m => (PIECE_VALUES[m.captured] ?? 0) >= 3);
  const pawnAttacks     = attackMoves.filter(m => (PIECE_VALUES[m.captured] ?? 0) < 3);

  if (valuableAttacks.length === 0) {
    const pawnList = pawnAttacks.map(m => `pawn on ${m.to}`).join(', ');
    return failed(
      'pawn-only',
      `Attacks only ${pawnList} — the trainer scores threats against minor pieces or higher.`,
    );
  }

  // Filter: newly attacked (not already attacked by `color` before our move)
  const preGame = chessForColor(fen, color);
  const newlyAttacked = valuableAttacks.filter(m => {
    try { return preGame ? !preGame.isAttacked(m.to, color) : true; }
    catch { return true; }
  });

  if (newlyAttacked.length === 0) {
    const alreadyList = valuableAttacks
      .map(m => `${PIECE_NAMES[m.captured] ?? m.captured} on ${m.to}`)
      .join(', ');
    return failed(
      'no-new-attack',
      `Your piece already attacked ${alreadyList} — this move doesn't create a new threat.`,
    );
  }

  // Exchange evaluation for each newly-attacked valuable piece
  const forcingTargets    = [];
  const notForcingTargets = [];

  for (const atk of newlyAttacked) {
    const victimValue = PIECE_VALUES[atk.captured] ?? 0;
    const victimName  = PIECE_NAMES[atk.captured]  ?? atk.captured;

    let isDefended = false;
    try { isDefended = postGame.isAttacked(atk.to, oppColor); } catch {}

    if (!isDefended) {
      forcingTargets.push({ sq: atk.to, piece: atk.captured, victimValue, victimName, reason: 'undefended' });
    } else if (victimValue > attackerValue) {
      const gain = victimValue - attackerValue;
      forcingTargets.push({ sq: atk.to, piece: atk.captured, victimValue, victimName, reason: 'profitable', gain });
    } else if (victimValue === attackerValue) {
      notForcingTargets.push({ sq: atk.to, piece: atk.captured, victimValue, victimName, reason: 'even-trade' });
    } else {
      notForcingTargets.push({ sq: atk.to, piece: atk.captured, victimValue, victimName, reason: 'bad-trade' });
    }
  }

  const hangSuffix = isSelfHang
    ? ` ⚠️ Your piece on ${to} is undefended though — opponent may take it first.`
    : '';

  // No forcing targets — educational rejection
  if (forcingTargets.length === 0) {
    const best = notForcingTargets.sort((a, b) => b.victimValue - a.victimValue)[0];
    if (best.reason === 'even-trade') {
      return failed(
        'even-trade',
        `Even trade: your ${attackerName} attacks defended ${best.victimName} on ${best.sq} — opponent just recaptures, no material gained.${hangSuffix}`,
      );
    }
    return failed(
      'bad-trade',
      `Bad trade: your ${attackerName} (worth ${attackerValue}) attacks ${best.victimName} on ${best.sq} (worth ${best.victimValue}) — you'd lose material capturing.${hangSuffix}`,
    );
  }

  // Forcing — check for fork
  const isFork = forcingTargets.length >= 2;
  const best   = forcingTargets.sort((a, b) => b.victimValue - a.victimValue)[0];

  if (isFork) {
    const targetList = forcingTargets.map(t => `${t.victimName} on ${t.sq}`).join(' and ');
    return {
      kind: 'fork',
      isForcing: true,
      message: `Fork! Attacks ${targetList} — they can't save both.${hangSuffix}`,
      threatens: best.sq,
      isFork: true,
      victims: forcingTargets,
      isSelfHang,
    };
  }

  if (best.reason === 'undefended') {
    return {
      kind: 'forcing-free-piece',
      isForcing: true,
      message: `Forcing: ${best.victimName} on ${best.sq} is undefended — if they don't move it, you win it free.${hangSuffix}`,
      threatens: best.sq,
      isFork: false,
      victims: forcingTargets,
      isSelfHang,
    };
  }

  return {
    kind: 'forcing-profitable',
    isForcing: true,
    message: `Forcing: your ${attackerName} attacks defended ${best.victimName} on ${best.sq} — profitable trade (+${best.gain ?? 0} points).${hangSuffix}`,
    threatens: best.sq,
    isFork: false,
    victims: forcingTargets,
    isSelfHang,
  };
}

/**
 * Enumerate all forcing threats for `color` from `fen`.
 * Marks the solution move (if provided as UCI string) with `isSolutionMove: true`.
 */
function enumerateForcingThreats(fen, color, solutionUCI = null) {
  const chess = chessForColor(fen, color);
  if (!chess) return [];

  let moves;
  try { moves = chess.moves({ verbose: true }); }
  catch { return []; }

  const threats = [];

  for (const mv of moves) {
    if (mv.captured) continue;  // captures handled separately
    if (mv.piece === 'k') continue; // king moves rarely create direct forcing threats

    const cls = classifyThreatAttempt(fen, mv.from, mv.to, color);
    if (!cls.isForcing) continue;

    const isSolutionMove = solutionUCI
      ? mv.from === solutionUCI.slice(0, 2) && mv.to === solutionUCI.slice(2, 4)
      : false;

    threats.push({
      from: mv.from,
      to: mv.to,
      piece: mv.piece,
      san: mv.san,
      threatens: cls.threatens,
      isFork: cls.isFork,
      isSolutionMove,
    });
  }

  return threats;
}

/**
 * Compute CCTs for both player and opponent.
 * Threats use full exchange-evaluation scan (forcing only) for both sides.
 *
 * Returns { my: { checks, captures, threats }, opponent: { checks, captures, threats } }
 */
export function computeCCTFromPuzzle(puzzle) {
  const { fen, moves, playerColor } = puzzle;
  const oppColor    = playerColor === 'w' ? 'b' : 'w';
  const solutionUCI = moves && moves.length > 0 ? moves[0] : null;

  const myCC   = computeChecksAndCaptures(fen, playerColor);
  const oppCC  = computeChecksAndCaptures(fen, oppColor);
  const myT    = enumerateForcingThreats(fen, playerColor, solutionUCI);
  const oppT   = enumerateForcingThreats(fen, oppColor, null);

  return {
    my:       { ...myCC, threats: myT },
    opponent: { ...oppCC, threats: oppT },
  };
}

/**
 * Compute CCTs without puzzle context.
 * Returns { checks, captures, threats }
 */
export function computeCCT(fen, color) {
  const cc = computeChecksAndCaptures(fen, color);
  return { ...cc, threats: enumerateForcingThreats(fen, color) };
}

/**
 * Return the legal target squares for a piece on `square` when `color` moves.
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
 * Validate a user-drawn CCT arrow for checks and captures only.
 * Quiet moves return { valid: false, actualType: 'none' } — caller should
 * then call classifyThreatAttempt() for the rich threat feedback.
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
      // Quiet move — let classifyThreatAttempt handle it
      return { valid: false, actualType: 'none', qualifies: [], feedback: null };
    }

    const actualType = ['check', 'capture'].find(t => qualifies.has(t));
    return { valid: true, actualType, qualifies: [...qualifies], feedback: null };
  } catch {
    return { valid: false, actualType: null, feedback: `${from}→${to} is not a legal move.` };
  }
}
