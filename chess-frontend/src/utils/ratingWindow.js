export const DEFAULT_USER_RATING = 400;
export const MIN_OPPONENT_RATING = 200;
export const MAX_OPPONENT_RATING = 3200;
export const DEFAULT_WINDOW_BELOW = 200;
export const DEFAULT_WINDOW_ABOVE = 350;
export const OPPONENT_TARGET_WINDOW_RADIUS = 200;

const OPPONENT_RATING_TARGETS_KEY = 'chess99_opponent_rating_targets';
// Explicit Elo ranges the player typed in the lobby / dashboard filter. Kept in a
// separate bucket from the auto-tracked opponent targets above so that finishing a
// game (which records the opponent's rating) can never silently move a range the
// player chose themselves.
const RATING_WINDOW_PREFS_KEY = 'chess99_rating_window_prefs';
const VALID_RATING_WINDOW_MODES = ['casual', 'rated', 'learning'];

const parseRating = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeUserRating = (rating) => {
  const parsed = parseRating(rating, DEFAULT_USER_RATING);
  return Math.max(MIN_OPPONENT_RATING, Math.min(MAX_OPPONENT_RATING, parsed));
};

export const getDefaultRatingWindow = (rating) => {
  const userRating = normalizeUserRating(rating);

  return {
    minRating: Math.max(MIN_OPPONENT_RATING, userRating - DEFAULT_WINDOW_BELOW),
    maxRating: Math.min(MAX_OPPONENT_RATING, userRating + DEFAULT_WINDOW_ABOVE),
  };
};

export const getOpponentCenteredRatingWindow = (rating) => {
  const targetRating = normalizeUserRating(rating);

  return {
    minRating: Math.max(MIN_OPPONENT_RATING, targetRating - OPPONENT_TARGET_WINDOW_RADIUS),
    maxRating: Math.min(MAX_OPPONENT_RATING, targetRating + OPPONENT_TARGET_WINDOW_RADIUS),
  };
};

export const normalizeRatingWindow = (ratingWindow = {}) => {
  let minRating = parseRating(ratingWindow.minRating, MIN_OPPONENT_RATING);
  let maxRating = parseRating(ratingWindow.maxRating, MAX_OPPONENT_RATING);

  minRating = Math.max(0, Math.min(MAX_OPPONENT_RATING, minRating));
  maxRating = Math.max(0, Math.min(MAX_OPPONENT_RATING, maxRating));

  if (minRating > maxRating) {
    [minRating, maxRating] = [maxRating, minRating];
  }

  return { minRating, maxRating };
};

export const getRatingWindowMidpoint = (ratingWindow) => {
  const { minRating, maxRating } = normalizeRatingWindow(ratingWindow);
  return normalizeUserRating(Math.round((minRating + maxRating) / 2));
};

export const normalizeRatingWindowMode = (mode) => (
  VALID_RATING_WINDOW_MODES.includes(mode) ? mode : 'casual'
);

const readStoredValue = (storageKey) => {
  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
};

const writeStoredValue = (storageKey, value) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or tests; callers still get the computed window.
  }
};

const readOpponentRatingTargets = () => readStoredValue(OPPONENT_RATING_TARGETS_KEY) || {};

/**
 * The Elo range the player explicitly picked in the lobby / dashboard filter, or
 * null when they never set one (or reset it back to "near me").
 *
 * Deliberately NOT per game mode: playing a game rewrites the preferred game mode
 * (PlayMultiplayer/PlayComputer), so a per-mode range would still drift away from
 * what the player chose as soon as they finished a game in another mode.
 */
export const getStoredRatingWindow = () => {
  const storedWindow = readStoredValue(RATING_WINDOW_PREFS_KEY);

  const minRating = parseRating(storedWindow?.minRating, null);
  const maxRating = parseRating(storedWindow?.maxRating, null);

  if (minRating === null || maxRating === null) {
    return null;
  }

  return normalizeRatingWindow({ minRating, maxRating });
};

export const hasStoredRatingWindow = () => getStoredRatingWindow() !== null;

export const getStoredOpponentRatingForMode = (mode) => {
  // An explicit range wins: matchmaking should target what the player asked for.
  const storedWindow = getStoredRatingWindow();
  if (storedWindow) {
    return getRatingWindowMidpoint(storedWindow);
  }

  const normalizedMode = normalizeRatingWindowMode(mode);
  const storedTarget = readOpponentRatingTargets()[normalizedMode];
  const rawRating = typeof storedTarget === 'number' ? storedTarget : storedTarget?.rating;
  const parsedRating = parseRating(rawRating, null);

  return parsedRating === null ? null : normalizeUserRating(parsedRating);
};

/**
 * Records the rating of an opponent the player just faced. This is an *implicit*
 * signal, so it never overwrites an explicit range from
 * {@link rememberRatingWindow} — it only feeds the fallback used before the player
 * has chosen a range of their own.
 *
 * Returns the range that should now be shown, which is the player's stored range
 * when they have one.
 */
export const rememberOpponentRatingForMode = (mode, opponentRating) => {
  const storedWindow = getStoredRatingWindow();
  const parsedRating = parseRating(opponentRating, null);

  if (parsedRating === null) {
    return storedWindow;
  }

  const normalizedMode = normalizeRatingWindowMode(mode);
  const normalizedRating = normalizeUserRating(parsedRating);
  const targets = readOpponentRatingTargets();
  targets[normalizedMode] = {
    rating: normalizedRating,
    updatedAt: Date.now(),
  };
  writeStoredValue(OPPONENT_RATING_TARGETS_KEY, targets);

  return storedWindow || getOpponentCenteredRatingWindow(normalizedRating);
};

/**
 * Persists an Elo range the player picked themselves, exactly as typed (width
 * included) so a wide range stays wide the next time the lobby opens.
 */
export const rememberRatingWindow = (ratingWindow) => {
  const minRating = parseRating(ratingWindow?.minRating, null);
  const maxRating = parseRating(ratingWindow?.maxRating, null);

  // Half-typed input (an empty box) shouldn't overwrite a good stored range.
  if (minRating === null || maxRating === null) {
    return null;
  }

  const normalizedWindow = normalizeRatingWindow({ minRating, maxRating });

  writeStoredValue(RATING_WINDOW_PREFS_KEY, {
    ...normalizedWindow,
    updatedAt: Date.now(),
  });

  return normalizedWindow;
};

/**
 * Drops the explicit range plus the auto-tracked opponent targets, so the filter
 * falls back to a window centred on the player's own rating.
 */
export const forgetRatingWindow = () => {
  try {
    localStorage.removeItem(RATING_WINDOW_PREFS_KEY);
    localStorage.removeItem(OPPONENT_RATING_TARGETS_KEY);
  } catch {
    // Storage can be unavailable in private browsing or tests.
  }
};

export const getModeAwareDefaultRatingWindow = (fallbackRating, mode) => {
  const storedWindow = getStoredRatingWindow();

  if (storedWindow) {
    return storedWindow;
  }

  const storedOpponentRating = getStoredOpponentRatingForMode(mode);

  if (storedOpponentRating !== null) {
    return getOpponentCenteredRatingWindow(storedOpponentRating);
  }

  return getDefaultRatingWindow(fallbackRating);
};

export const toRatingWindowParams = (ratingWindow) => {
  if (!ratingWindow) {
    return {};
  }

  const { minRating, maxRating } = normalizeRatingWindow(ratingWindow);

  return {
    min_rating: minRating,
    max_rating: maxRating,
  };
};

export const isRatingInWindow = (rating, ratingWindow) => {
  const { minRating, maxRating } = normalizeRatingWindow(ratingWindow);
  const normalizedRating = normalizeUserRating(rating);

  return normalizedRating >= minRating && normalizedRating <= maxRating;
};
