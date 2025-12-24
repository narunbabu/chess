// src/utils/gamePreferences.js

/**
 * Game Preferences Utility
 * Manages user preferences for game settings using localStorage
 */

const STORAGE_KEY = 'chess_game_preferences';

/**
 * Get the user's preferred game mode
 * @returns {string} 'rated' or 'casual' - defaults to 'rated'
 */
export const getPreferredGameMode = () => {
  try {
    const preferences = localStorage.getItem(STORAGE_KEY);
    if (preferences) {
      const parsed = JSON.parse(preferences);
      return parsed.gameMode || 'rated';
    }
    return 'rated'; // Default to rated
  } catch (error) {
    console.error('[GamePreferences] Error reading game mode preference:', error);
    return 'rated'; // Default to rated on error
  }
};

/**
 * Save the user's preferred game mode
 * @param {string} mode - 'rated' or 'casual'
 */
export const setPreferredGameMode = (mode) => {
  try {
    const preferences = localStorage.getItem(STORAGE_KEY);
    const parsed = preferences ? JSON.parse(preferences) : {};
    parsed.gameMode = mode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    console.log('[GamePreferences] Saved game mode preference:', mode);
  } catch (error) {
    console.error('[GamePreferences] Error saving game mode preference:', error);
  }
};

/**
 * Clear all game preferences
 */
export const clearGamePreferences = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[GamePreferences] Cleared all game preferences');
  } catch (error) {
    console.error('[GamePreferences] Error clearing game preferences:', error);
  }
};
