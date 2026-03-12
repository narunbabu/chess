/**
 * endedGamesTracker.js
 *
 * Tracks which game IDs the current user has already seen end (either via
 * the end-card closing, resignation, timeout, or on re-load finding a finished
 * game).  Persisted in localStorage so it survives page refreshes.
 *
 * Rules enforced elsewhere using this:
 *  • PlayMultiplayer: if a finished game's ID is already tracked → redirect to
 *    /play/review/:id instead of re-showing the end card.
 *  • ActiveGameBanner: never surface a tracked game as "active".
 */

const STORAGE_KEY = 'chess99_ended_game_ids';
const MAX_IDS = 200; // keep last 200 game IDs to avoid unbounded growth

function readIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Persist the given game ID as ended. Idempotent. */
export function markGameEnded(gameId) {
  if (!gameId) return;
  try {
    const ids = readIds();
    const str = String(gameId);
    if (!ids.includes(str)) {
      ids.unshift(str); // most-recent first
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_IDS)));
    }
  } catch { /* non-critical */ }
}

/** Returns true if this game has already been marked ended. */
export function isGameEnded(gameId) {
  if (!gameId) return false;
  try {
    return readIds().includes(String(gameId));
  } catch {
    return false;
  }
}
