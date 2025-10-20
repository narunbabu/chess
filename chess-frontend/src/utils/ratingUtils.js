// src/utils/ratingUtils.js

/**
 * Calculate engine level from opponent rating for difficulty scaling
 * Maps rating ranges to engine difficulty (1-16)
 *
 * @param {number} rating - Opponent's rating
 * @returns {number} Engine level (1-16)
 */
export const calculateEngineLevelFromRating = (rating) => {
  if (!rating || rating < 1000) return 1;

  // Maps rating to difficulty:
  // 1000 → level 1
  // 1100 → level 2
  // 1600 → level 7
  // 2400+ → level 16
  const level = 1 + Math.floor((rating - 1000) / 100);

  // Clamp between 1 and 16
  return Math.min(16, Math.max(1, level));
};

/**
 * Calculate K-factor for Elo rating updates
 * Higher K-factor = faster rating changes
 *
 * @param {object} user - User object with rating, games_played, is_provisional
 * @returns {number} K-factor value
 */
export const calculateKFactor = (user) => {
  if (!user) return 32;

  // Provisional period: first 20 games
  if (user.is_provisional || (user.games_played && user.games_played < 20)) {
    return 64;
  }

  const rating = user.rating || 1200;

  // Established players: based on rating level
  if (rating >= 2400) {
    return 10; // Expert/Master level
  } else if (rating >= 2000) {
    return 16; // Strong players
  } else {
    return 32; // Active players
  }
};

/**
 * Calculate expected score using Elo formula
 *
 * @param {number} playerRating - Player's current rating
 * @param {number} opponentRating - Opponent's current rating
 * @returns {number} Expected score (0.0 to 1.0)
 */
export const calculateExpectedScore = (playerRating, opponentRating) => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
};

/**
 * Calculate new rating after a game
 *
 * @param {number} currentRating - Player's current rating
 * @param {number} opponentRating - Opponent's rating
 * @param {number} actualScore - Actual game result (1.0 = win, 0.5 = draw, 0.0 = loss)
 * @param {number} kFactor - K-factor for this player
 * @returns {object} Rating update information
 */
export const calculateRatingChange = (currentRating, opponentRating, actualScore, kFactor) => {
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  const ratingChange = kFactor * (actualScore - expectedScore);
  const newRating = Math.round(currentRating + ratingChange);

  return {
    oldRating: currentRating,
    newRating: newRating,
    ratingChange: Math.round(ratingChange),
    expectedScore: Math.round(expectedScore * 1000) / 1000,
    kFactor: kFactor
  };
};

/**
 * Get rating category label
 *
 * @param {number} rating - Player's rating
 * @returns {string} Category label
 */
export const getRatingCategory = (rating) => {
  if (rating < 1000) return 'Beginner';
  if (rating < 1500) return 'Intermediate';
  if (rating < 2000) return 'Advanced';
  if (rating < 2400) return 'Expert';
  return 'Master';
};

/**
 * Get rating color for UI display
 *
 * @param {number} rating - Player's rating
 * @returns {string} Color code
 */
export const getRatingColor = (rating) => {
  if (rating < 1000) return '#94a3b8'; // Gray
  if (rating < 1500) return '#10b981'; // Green
  if (rating < 2000) return '#3b82f6'; // Blue
  if (rating < 2400) return '#a855f7'; // Purple
  return '#f59e0b'; // Gold
};

/**
 * Format rating display with provisional indicator
 *
 * @param {number} rating - Player's rating
 * @param {boolean} isProvisional - Whether rating is provisional
 * @returns {string} Formatted rating string
 */
export const formatRating = (rating, isProvisional) => {
  const ratingStr = rating.toString();
  return isProvisional ? `${ratingStr}?` : ratingStr;
};

/**
 * Calculate difficulty factor for scoring (matches evaluate.js logic)
 * Used in evaluateMove function
 *
 * @param {number} engineLevel - Engine difficulty level (1-16)
 * @returns {number} Difficulty multiplier
 */
export const calculateDifficultyFactor = (engineLevel) => {
  return 1 + (Math.max(1, engineLevel) - 1) * 0.08;
};
