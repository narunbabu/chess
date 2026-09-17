// File: src/utils/multiplayerBestBudget.js
//
// Multiplayer Best-move budget accounting (Module 4 parity follow-up).
//
// The casual/learning multiplayer Best toggle draws from the SAME pool as the
// takeback budget (`undoChancesRemaining`, seeded from the server's
// `undo_white_remaining` / `undo_black_remaining`, fallback 9) — the same
// shared-pool accounting the learning computer mode uses for Best + Undo.
//
// The server only decrements the pool for accepted takebacks, so every Best
// spend is persisted as a `best-move` marker in the move's `learning_help`
// array (sent with the move payload, stored server-side). Rebuilding the
// budget therefore means: server remaining minus the number of MY moves that
// carry a `best-move` marker. That keeps the budget — and the lifeline
// summary that reads the same markers — correct across reloads.

import { normalizeLearningHelpMarkers } from './gameHistoryStringUtils';

export const BEST_MOVE_MARKER = 'best-move';

/**
 * Counts how many of the player's own moves were made with a paid Best
 * reveal. Accepts the raw server move list (objects with `learning_help`
 * arrays), compact history entries (`learningHelp`/`lifelines`) or decoded
 * history records — anything `normalizeLearningHelpMarkers` understands.
 *
 * @param {Array} moves  Move entries; falsy entries are skipped.
 * @param {string|null} myColor 'w' | 'b' (chess.js colour). When null every
 *                              move is counted (spectator-safe fallback).
 * @returns {number}
 */
export function countBestMoveSpend(moves, myColor) {
  if (!Array.isArray(moves)) return 0;

  return moves.reduce((spend, move) => {
    if (!move) return spend;
    const moveColor = typeof move.color === 'string' ? move.color : move.playerColor;
    if (myColor && moveColor && moveColor !== myColor) return spend;

    const markers = normalizeLearningHelpMarkers(
      move.learningHelp || move.lifelines || move.learning_help || move.helpUsed,
    );
    const usedBest = markers.some(marker => (
      String(marker?.type || '').toLowerCase() === BEST_MOVE_MARKER
    ));
    return usedBest ? spend + 1 : spend;
  }, 0);
}

/**
 * Seeds the shared undo/Best pool for a (re)load.
 *
 * @param {object} options
 * @param {boolean}        options.rated            Rated games get no pool.
 * @param {number|null}    options.serverRemaining  `undo_*_remaining` from the server.
 * @param {number}         options.fallback         Pool when the server predates the column (9).
 * @param {Array}          options.moves            Persisted move list.
 * @param {string|null}    options.myColor          'w' | 'b'.
 * @returns {number}
 */
export function budgetedUndoChances({ rated, serverRemaining, fallback, moves, myColor }) {
  if (rated) return 0;

  const serverCount = serverRemaining !== null && serverRemaining !== undefined
    ? Math.max(0, Number(serverRemaining) || 0)
    : Math.max(0, Number(fallback) || 0);

  return Math.max(0, serverCount - countBestMoveSpend(moves, myColor));
}
