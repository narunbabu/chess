export const DEFAULT_USER_RATING = 400;
export const MIN_OPPONENT_RATING = 200;
export const MAX_OPPONENT_RATING = 3200;
export const DEFAULT_WINDOW_BELOW = 200;
export const DEFAULT_WINDOW_ABOVE = 350;

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
