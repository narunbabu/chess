// eloUtils.js - Elo rating system utilities for frontend
import { isWin, isDraw } from "./resultStandardization";

/**
 * Calculate expected score for Elo rating
 * @param {number} playerRating - Player's current rating
 * @param {number} opponentRating - Opponent's rating
 * @returns {number} Expected score (0-1)
 */
export const calculateExpectedScore = (playerRating, opponentRating) => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
};

/**
 * Calculate K-factor based on games played and rating
 * @param {number} gamesPlayed - Number of games played
 * @param {number} rating - Current rating
 * @returns {number} K-factor
 */
export const calculateKFactor = (gamesPlayed, rating) => {
  // High K-factor for new players (fast adjustment)
  if (gamesPlayed < 10) {
    return 40;
  }

  // Medium K-factor for intermediate players
  if (gamesPlayed < 30) {
    return 30;
  }

  // Lower K-factor for experienced players (stable rating)
  // But slightly higher for very high rated players to maintain accuracy
  if (rating >= 2400) {
    return 24;
  }

  return 20;
};

/**
 * Calculate new rating after a game (client-side prediction)
 * @param {number} currentRating - Current rating
 * @param {number} opponentRating - Opponent's rating
 * @param {string} result - 'win', 'draw', or 'loss'
 * @param {number} gamesPlayed - Games played count
 * @returns {object} { newRating, ratingChange, expectedScore }
 */
export const calculateNewRating = (currentRating, opponentRating, result, gamesPlayed) => {
  const actualScore = result === 'win' ? 1.0 : result === 'draw' ? 0.5 : 0.0;
  const expectedScore = calculateExpectedScore(currentRating, opponentRating);
  const kFactor = calculateKFactor(gamesPlayed, currentRating);

  const ratingChange = Math.round(kFactor * (actualScore - expectedScore));
  const newRating = Math.max(400, Math.min(3200, currentRating + ratingChange)); // Match backend bounds

  return {
    newRating,
    ratingChange,
    expectedScore: Math.round(expectedScore * 100) / 100, // Round to 2 decimals
    kFactor,
    actualScore,
  };
};

/**
 * Get rating category based on rating value
 * @param {number} rating - Player rating
 * @returns {object} { category, color, label }
 */
export const getRatingCategory = (rating) => {
  if (rating < 1000) {
    return { category: 'beginner', color: '#9ca3af', label: 'Beginner' };
  }
  if (rating < 1400) {
    return { category: 'casual', color: '#60a5fa', label: 'Casual Player' };
  }
  if (rating < 1800) {
    return { category: 'intermediate', color: '#34d399', label: 'Intermediate' };
  }
  if (rating < 2000) {
    return { category: 'advanced', color: '#fbbf24', label: 'Advanced' };
  }
  if (rating < 2200) {
    return { category: 'expert', color: '#f97316', label: 'Expert' };
  }
  if (rating < 2400) {
    return { category: 'master', color: '#ef4444', label: 'Master' };
  }
  return { category: 'grandmaster', color: '#a855f7', label: 'Grandmaster' };
};

/**
 * Format rating display with provisional indicator
 * @param {number} rating - Player rating
 * @param {boolean} isProvisional - Whether rating is provisional
 * @returns {string} Formatted rating string
 */
export const formatRating = (rating, isProvisional = false) => {
  return isProvisional ? `${rating}?` : `${rating}`;
};

/**
 * Get rating change color (positive = green, negative = red)
 * @param {number} change - Rating change amount
 * @returns {string} Color code
 */
export const getRatingChangeColor = (change) => {
  if (change > 0) return '#10b981'; // Green
  if (change < 0) return '#ef4444'; // Red
  return '#6b7280'; // Gray (no change)
};

/**
 * Format rating change with +/- sign
 * @param {number} change - Rating change amount
 * @returns {string} Formatted change string
 */
export const formatRatingChange = (change) => {
  if (change > 0) return `+${change}`;
  if (change < 0) return `${change}`;
  return '0';
};

/**
 * Calculate win probability given two ratings
 * @param {number} playerRating - Player's rating
 * @param {number} opponentRating - Opponent's rating
 * @returns {number} Win probability as percentage (0-100)
 */
export const calculateWinProbability = (playerRating, opponentRating) => {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating);
  return Math.round(expectedScore * 100);
};

/**
 * 16-Level Computer Rating System
 * Maps computer difficulty levels to estimated ELO ratings
 */
export const COMPUTER_LEVEL_RATINGS = {
  1: 400,   // Complete Beginner
  2: 600,   // Novice
  3: 800,   // Learning
  4: 1000,  // Casual Player
  5: 1200,  // Intermediate
  6: 1400,  // Club Player
  7: 1600,  // Strong Club
  8: 1800,  // Expert
  9: 2000,  // Advanced Expert
  10: 2200, // Master
  11: 2400, // International Master
  12: 2600, // Grandmaster
  13: 2750, // Strong GM
  14: 2900, // Super GM
  15: 3050, // Elite
  16: 3200  // Maximum Strength
};

/**
 * Get rating from computer level (1-16)
 * @param {number} level - Computer difficulty level (1-16)
 * @returns {number} Estimated rating
 */
export const getRatingFromLevel = (level) => {
  return COMPUTER_LEVEL_RATINGS[level] || 1500; // Default to 1500 if invalid
};

/**
 * Get appropriate computer level from rating (inverse mapping)
 * @param {number} rating - Target rating
 * @returns {number} Computer level (1-16)
 */
export const getLevelFromRating = (rating) => {
  const levels = Object.entries(COMPUTER_LEVEL_RATINGS);

  // Find closest level
  let closestLevel = 1;
  let minDiff = Math.abs(rating - COMPUTER_LEVEL_RATINGS[1]);

  for (const [level, levelRating] of levels) {
    const diff = Math.abs(rating - levelRating);
    if (diff < minDiff) {
      minDiff = diff;
      closestLevel = parseInt(level);
    }
  }

  return closestLevel;
};

// Legacy function names for backward compatibility
export const getEngineLevelFromRating = getLevelFromRating;
export const getRatingFromEngineLevel = getRatingFromLevel;

/**
 * Check if player should be prompted for skill reassessment
 * @param {number} initialRating - Rating from skill assessment
 * @param {number} currentRating - Current actual rating
 * @param {number} gamesPlayed - Games played count
 * @returns {boolean} True if reassessment recommended
 */
export const shouldReassessSkill = (initialRating, currentRating, gamesPlayed) => {
  if (gamesPlayed < 20) return false;

  const ratingDifference = Math.abs(currentRating - initialRating);

  // Suggest reassessment if rating changed by more than 200 points
  return ratingDifference > 200;
};

/**
 * Calculate rating percentile (simplified)
 * @param {number} rating - Player rating
 * @returns {number} Percentile (0-100)
 */
export const getRatingPercentile = (rating) => {
  // Simplified percentile calculation based on normal distribution
  // Assume mean = 1200, standard deviation = 300
  const mean = 1200;
  const stdDev = 300;
  const z = (rating - mean) / stdDev;

  // Approximate percentile using z-score
  // This is a rough approximation
  if (z <= -2) return 2;
  if (z <= -1.5) return 7;
  if (z <= -1) return 16;
  if (z <= -0.5) return 31;
  if (z <= 0) return 50;
  if (z <= 0.5) return 69;
  if (z <= 1) return 84;
  if (z <= 1.5) return 93;
  if (z <= 2) return 98;
  return 99;
};

/**
 * Get performance rating from series of games
 * @param {Array} games - Array of game objects with { opponentRating, result }
 * @returns {number} Performance rating
 */
export const calculatePerformanceRating = (games) => {
  if (games.length === 0) return 0;

  let totalPerformance = 0;

  games.forEach(game => {
    const score = isWin(game.result) ? 1.0 : isDraw(game.result) ? 0.5 : 0.0;
    // Performance rating = opponent rating + 400 * log10(score / (1 - score))
    // For wins: performance = opponent + 400
    // For losses: performance = opponent - 400
    // For draws: performance = opponent
    if (score === 1.0) {
      totalPerformance += game.opponentRating + 400;
    } else if (score === 0.0) {
      totalPerformance += game.opponentRating - 400;
    } else {
      totalPerformance += game.opponentRating;
    }
  });

  return Math.round(totalPerformance / games.length);
};

const eloUtils = {
  calculateExpectedScore,
  calculateKFactor,
  calculateNewRating,
  getRatingCategory,
  formatRating,
  getRatingChangeColor,
  formatRatingChange,
  calculateWinProbability,
  getEngineLevelFromRating,
  getRatingFromEngineLevel,
  getRatingFromLevel,
  getLevelFromRating,
  COMPUTER_LEVEL_RATINGS,
  shouldReassessSkill,
  getRatingPercentile,
  calculatePerformanceRating,
};

export default eloUtils;
