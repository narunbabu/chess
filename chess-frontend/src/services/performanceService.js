// src/services/performanceService.js

import api from "./api";

export const performanceService = {
  /**
   * Get performance metrics for a specific game
   * @param {number} gameId - The game ID
   * @returns {Promise<Object>} Performance metrics
   */
  getGamePerformance: async (gameId) => {
    const response = await api.get(`/performance/game/${gameId}`);
    return response.data;
  },

  /**
   * Get move-by-move analysis for a specific game
   * @param {number} gameId - The game ID
   * @returns {Promise<Object>} Move analysis data
   */
  getMoveAnalysis: async (gameId) => {
    const response = await api.get(`/performance/game/${gameId}/moves`);
    return response.data;
  },

  /**
   * Get user performance statistics
   * @returns {Promise<Object>} User performance stats
   */
  getUserStats: async () => {
    const response = await api.get('/performance/stats');
    return response.data;
  },

  /**
   * Get performance history for the current user
   * @param {Object} params - Query parameters { limit, game_type }
   * @returns {Promise<Object>} Performance history
   */
  getPerformanceHistory: async (params = {}) => {
    const response = await api.get('/performance/history', { params });
    return response.data;
  }
};

export default performanceService;
