// src/services/ratingService.js

import api from './api';

/**
 * Update user rating after a game
 * @param {Object} ratingData - Rating update data
 * @param {number} ratingData.opponent_rating - Opponent's rating
 * @param {string} ratingData.result - Game result: 'win', 'draw', or 'loss'
 * @param {string} ratingData.game_type - Game type: 'computer' or 'multiplayer'
 * @param {number} [ratingData.computer_level] - Computer difficulty level (1-16) for computer games
 * @param {number} [ratingData.opponent_id] - Opponent user ID for multiplayer games
 * @param {number} [ratingData.game_id] - Game ID
 * @returns {Promise<Object>} Rating update response with old_rating, new_rating, rating_change
 */
export const updateRating = async (ratingData) => {
  try {
    const response = await api.post('/api/rating/update', ratingData);
    return response.data;
  } catch (error) {
    console.error('Error updating rating:', error);
    throw error;
  }
};

/**
 * Get current user's rating information
 * @returns {Promise<Object>} User rating data
 */
export const getUserRating = async () => {
  try {
    const response = await api.get('/api/rating');
    return response.data;
  } catch (error) {
    console.error('Error fetching user rating:', error);
    throw error;
  }
};

/**
 * Get user's rating history
 * @param {number} [limit=50] - Number of records to fetch
 * @returns {Promise<Object>} Rating history with stats
 */
export const getRatingHistory = async (limit = 50) => {
  try {
    const response = await api.get(`/api/rating/history?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching rating history:', error);
    throw error;
  }
};

/**
 * Get leaderboard (top rated players)
 * @param {number} [limit=100] - Number of players to fetch
 * @returns {Promise<Array>} Top rated players
 */
export const getLeaderboard = async (limit = 100) => {
  try {
    const response = await api.get(`/api/rating/leaderboard?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

export default {
  updateRating,
  getUserRating,
  getRatingHistory,
  getLeaderboard,
};
