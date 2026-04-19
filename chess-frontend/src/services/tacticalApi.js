// src/services/tacticalApi.js

import api from './api';

/**
 * Fetch tactical trainer progress for the authenticated user.
 *
 * GET /api/v1/tactical/progress
 * @returns {Promise<Object>} Progress payload: { stats, stageProgress, badges, lastSyncedAt }
 */
export const getProgress = async () => {
  try {
    const response = await api.get('/v1/tactical/progress');
    return response.data;
  } catch (error) {
    console.error('Error fetching tactical progress:', error);
    throw error;
  }
};

/**
 * Record a tactical puzzle attempt and receive updated stats / stage progress / badges.
 *
 * POST /api/v1/tactical/attempts
 * @param {Object} attempt - Attempt payload
 * @param {number} attempt.stage_id
 * @param {string} attempt.puzzle_id
 * @param {boolean} attempt.success
 * @param {number} [attempt.puzzle_rating]
 * @param {string} [attempt.puzzle_difficulty] - 'easy' | 'medium' | 'hard' | 'very hard'
 * @param {number} [attempt.wrong_count]
 * @param {boolean} [attempt.solution_shown]
 * @param {number} [attempt.cct_my_found]
 * @param {number} [attempt.cct_my_total]
 * @param {number} [attempt.cct_opp_found]
 * @param {number} [attempt.cct_opp_total]
 * @param {number} [attempt.time_spent_ms]
 * @param {number} [attempt.stage_total_puzzles]
 * @returns {Promise<Object>} Progress payload with `attempt` details
 */
export const submitAttempt = async (attempt) => {
  try {
    const response = await api.post('/v1/tactical/attempts', attempt);
    return response.data;
  } catch (error) {
    console.error('Error submitting tactical attempt:', error);
    throw error;
  }
};

/**
 * Bulk-ingest legacy localStorage progress. Idempotent — server merges with MAX,
 * so replaying the same snapshot will not regress or duplicate state.
 *
 * POST /api/v1/tactical/sync
 * @param {Object} snapshot
 * @param {number} [snapshot.rating]
 * @param {number} [snapshot.totalAttempted]
 * @param {number} [snapshot.totalSolved]
 * @param {number} [snapshot.streak]
 * @param {Object.<string, {attempted?: number, solved?: number, unlocked?: boolean, lastIndex?: number, completedPuzzleIds?: string[]}>} [snapshot.stageProgress]
 * @returns {Promise<Object>} Progress payload with `sync` summary
 */
export const syncLocalData = async (snapshot) => {
  try {
    const response = await api.post('/v1/tactical/sync', snapshot);
    return response.data;
  } catch (error) {
    console.error('Error syncing tactical progress:', error);
    throw error;
  }
};

/**
 * Fetch the tactical leaderboard.
 *
 * GET /api/v1/tactical/leaderboard
 * @param {string} [scope='rating'] - 'rating' | 'solved' | 'streak'
 * @param {string} [period='all'] - 'all' | 'weekly'
 * @param {number} [page=1]
 * @returns {Promise<Object>} Leaderboard payload with paginated entries
 */
export const getLeaderboard = async (scope = 'rating', period = 'all', page = 1) => {
  try {
    const response = await api.get('/v1/tactical/leaderboard', {
      params: { scope, period, page },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching tactical leaderboard:', error);
    throw error;
  }
};

const tacticalApi = {
  getProgress,
  submitAttempt,
  syncLocalData,
  getLeaderboard,
};

export default tacticalApi;
