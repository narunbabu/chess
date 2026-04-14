// src/utils/cctAnalysis.js
// CCT (Checks, Captures, Threats) positional scanner for live learning.
// Pure chess.js logic — zero latency, no engine needed.

import { Chess } from 'chess.js';

const PIECE_VALUES = { p: 1, n: 3, b: 3.25, r: 5, q: 9, k: 0 };
const PIECE_NAMES  = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

/**
 * Returns the FEN with active color flipped (used to enumerate opponent's options).
 * Clears en passant to keep the position valid.
 */
function flipActiveTurn(fen) {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-'; // en passant only valid immediately after a double-pawn push
  return parts.join(' ');
}

/**
 * Analyze Checks, Captures, and Threats for either the current player or opponent.
 *
 * @param {Chess}  game        - live chess.js instance
 * @param {string} perspective - 'mine' | 'opponent'
 * @returns {{ checks: object[], captures: object[], threats: object[] }}
 */
export function analyzeCCT(game, perspective = 'mine') {
  if (!game) return { checks: [], captures: [], threats: [] };

  const fen = perspective === 'opponent' ? flipActiveTurn(game.fen()) : game.fen();

  let tempGame;
  try {
    tempGame = new Chess(fen);
  } catch {
    return { checks: [], captures: [], threats: [] };
  }

  let allMoves;
  try {
    allMoves = tempGame.moves({ verbose: true });
  } catch {
    return { checks: [], captures: [], threats: [] };
  }

  const checks   = computeChecks(fen, allMoves);
  const captures = computeCaptures(allMoves);
  const threats  = computeThreats(fen, allMoves);

  return { checks, captures, threats };
}

// ─── CHECKS ─────────────────────────────────────────────────────────────────

function computeChecks(fen, moves) {
  const checks = [];
  for (const m of moves) {
    try {
      const g = new Chess(fen);
      g.move(m.san);
      if (g.isCheck()) {
        checks.push({
          ...m,
          label: m.san,
          isCheckmate: g.isCheckmate(),
        });
      }
    } catch { /* skip invalid */ }
  }
  return checks;
}

// ─── CAPTURES (MVV-LVA order) ────────────────────────────────────────────────

function computeCaptures(moves) {
  return moves
    .filter(m => m.captured)
    .map(m => ({
      ...m,
      label: m.san,
      victimValue:   PIECE_VALUES[m.captured] ?? 0,
      attackerValue: PIECE_VALUES[m.piece]    ?? 0,
      victimName:    PIECE_NAMES[m.captured]  ?? m.captured,
    }))
    .sort((a, b) => {
      const diff = b.victimValue - a.victimValue;
      return diff !== 0 ? diff : a.attackerValue - b.attackerValue; // prefer cheapest attacker
    });
}

// ─── THREATS ─────────────────────────────────────────────────────────────────
// A non-capturing move is a "threat" when the piece that just moved can NOW
// capture an equal-or-higher-value opponent piece.

function computeThreats(fen, moves) {
  const activeTurn = fen.split(' ')[1]; // color that is moving
  const threats = [];

  for (const m of moves) {
    if (m.captured) continue;   // already a capture, not a threat
    if (m.piece === 'k') continue; // king moves rarely create direct threats

    try {
      // Simulate the move
      const afterGame = new Chess(fen);
      afterGame.move(m.san);

      // Flip color back so we can enumerate what OUR piece at m.to attacks
      const flipFen = flipActiveTurn(afterGame.fen());
      const flipFen2 = flipFen.split(' ');
      flipFen2[1] = activeTurn;
      const attackGame = new Chess(flipFen2.join(' '));

      const attackMoves = attackGame.moves({ verbose: true })
        .filter(pm => pm.from === m.to && pm.captured);

      const attackerValue = PIECE_VALUES[m.piece] ?? 0;
      const bestVictim = attackMoves
        .map(pm => ({ ...pm, victimValue: PIECE_VALUES[pm.captured] ?? 0 }))
        .filter(pm => pm.victimValue >= attackerValue)
        .sort((a, b) => b.victimValue - a.victimValue)[0];

      if (bestVictim) {
        threats.push({
          ...m,
          label:          m.san,
          threatens:      bestVictim.to,
          threatenedPiece: bestVictim.captured,
          victimValue:    bestVictim.victimValue,
          attackerValue,
          victimName:     PIECE_NAMES[bestVictim.captured] ?? bestVictim.captured,
        });
      }
    } catch { /* skip */ }
  }

  return threats.sort((a, b) => (b.victimValue ?? 0) - (a.victimValue ?? 0));
}

// ─── ARROW CONVERSION ────────────────────────────────────────────────────────

/**
 * Convert a CCT result into ChessBoard.js arrow objects: { from, to, color }
 *
 * Arrow semantics:
 *   Checks   → from the checking piece TO the square it moves to (where it gives check)
 *   Captures → from the attacking piece TO the capture square
 *   Threats  → from the intermediate move-square TO the threatened enemy piece
 *              (shows "if you move to HERE, you threaten THAT piece")
 */
export function cctToArrows({ checks = [], captures = [], threats = [] }) {
  const arrows = [];
  // Limit display: max 3 of each category to avoid board clutter
  checks.slice(0, 3).forEach(m =>
    arrows.push({ from: m.from, to: m.to, color: 'rgba(239,68,68,0.85)' })
  );
  captures.slice(0, 4).forEach(m =>
    arrows.push({ from: m.from, to: m.to, color: 'rgba(249,115,22,0.85)' })
  );
  // For threats: arrow FROM the move destination TO the enemy piece being threatened.
  // "If you go here (m.to) → you attack THIS piece (m.threatens)"
  // Tip lands on the actual target — maximally informative for learning.
  threats.slice(0, 3).forEach(m => {
    if (m.to && m.threatens) {
      arrows.push({ from: m.to, to: m.threatens, color: 'rgba(234,179,8,0.85)' });
    }
  });
  return arrows;
}

/**
 * Classify a UCI move string against computed CCT data to produce a tag.
 * Used by the Best Moves panel to annotate engine suggestions.
 */
export function classifyMoveAgainstCCT(uciMove, cct) {
  if (!cct || !uciMove) return 'Positional';
  const from = uciMove.slice(0, 2);
  const to   = uciMove.slice(2, 4);

  const isCheck   = cct.checks.some(m   => m.from === from && m.to === to);
  const isCapture = cct.captures.some(m => m.from === from && m.to === to);
  const isThreat  = cct.threats.some(m  => m.from === from && m.to === to);

  if (isCheck && isCapture) return 'Check+Capture';
  if (isCheck)   return 'Check';
  if (isCapture) return 'Capture';
  if (isThreat)  return 'Threat';
  return 'Positional';
}
