// Service for handling shared game results
import api from './api';

/**
 * Upload game result image and get shareable URL
 * @param {string} imageDataUrl - Base64 encoded image data URL
 * @param {object} resultData - Game result metadata
 * @returns {Promise<object>} - Response with share_url and unique_id
 */
export const uploadGameResultImage = async (imageDataUrl, resultData = {}) => {
  try {
    const response = await api.post('/shared-results', {
      image: imageDataUrl,
      game_id: resultData.game_id || null,
      user_id: resultData.user_id || null,
      result_data: JSON.stringify({
        winner: resultData.winner,
        playerName: resultData.playerName,
        opponentName: resultData.opponentName,
        result: resultData.result,
        gameMode: resultData.gameMode
      })
    });

    return response.data;
  } catch (error) {
    console.error('Failed to upload game result image:', error);
    throw error;
  }
};

/**
 * Get shared result by unique ID
 * @param {string} uniqueId - Unique identifier for shared result
 * @returns {Promise<object>} - Shared result data
 */
export const getSharedResult = async (uniqueId) => {
  try {
    const response = await api.get(`/shared-results/${uniqueId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get shared result:', error);
    throw error;
  }
};

/**
 * Get Open Graph data for shared result
 * @param {string} uniqueId - Unique identifier for shared result
 * @returns {Promise<object>} - Open Graph metadata
 */
export const getSharedResultOgData = async (uniqueId) => {
  try {
    const response = await api.get(`/shared-results/${uniqueId}/og-data`);
    return response.data;
  } catch (error) {
    console.error('Failed to get OG data:', error);
    throw error;
  }
};
