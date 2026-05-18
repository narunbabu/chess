export const DEFAULT_USER_RATING = 400;
export const MIN_OPPONENT_RATING = 200;
export const MAX_OPPONENT_RATING = 3200;
export const DEFAULT_WINDOW_BELOW = 200;
export const DEFAULT_WINDOW_ABOVE = 350;
export const OPPONENT_TARGET_WINDOW_RADIUS = 200;

const OPPONENT_RATING_TARGETS_KEY = 'chess99_opponent_rating_targets';
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

const readOpponentRatingTargets = () => {
  try {
    const rawTargets = localStorage.getItem(OPPONENT_RATING_TARGETS_KEY);
    if (!rawTargets) {
      return {};
    }

    const parsedTargets = JSON.parse(rawTargets);
    return parsedTargets && typeof parsedTargets === 'object' ? parsedTargets : {};
  } catch {
    return {};
  }
};

export const getStoredOpponentRatingForMode = (mode) => {
  const normalizedMode = normalizeRatingWindowMode(mode);
  const storedTarget = readOpponentRatingTargets()[normalizedMode];
  const rawRating = typeof storedTarget === 'number' ? storedTarget : storedTarget?.rating;
  const parsedRating = parseRating(rawRating, null);

  return parsedRating === null ? null : normalizeUserRating(parsedRating);
};

export const rememberOpponentRatingForMode = (mode, opponentRating) => {
  const parsedRating = parseRating(opponentRating, null);

  if (parsedRating === null) {
    return null;
  }

  const normalizedMode = normalizeRatingWindowMode(mode);
  const normalizedRating = normalizeUserRating(parsedRating);

  try {
    const targets = readOpponentRatingTargets();
    targets[normalizedMode] = {
      rating: normalizedRating,
      updatedAt: Date.now(),
    };
    localStorage.setItem(OPPONENT_RATING_TARGETS_KEY, JSON.stringify(targets));
  } catch {
    // Storage can be unavailable in private browsing or tests; callers still get the computed window.
  }

  return getOpponentCenteredRatingWindow(normalizedRating);
};

export const rememberRatingWindowForMode = (mode, ratingWindow) => (
  rememberOpponentRatingForMode(mode, getRatingWindowMidpoint(ratingWindow))
);

export const getModeAwareDefaultRatingWindow = (fallbackRating, mode) => {
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
