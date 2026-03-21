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
 * Get the user's preferred time control
 * @returns {{ minutes: number, increment: number }}
 */
export const getPreferredTimeControl = () => {
  try {
    const preferences = localStorage.getItem(STORAGE_KEY);
    if (preferences) {
      const parsed = JSON.parse(preferences);
      if (parsed.timeControl && parsed.increment !== undefined) {
        return { minutes: parsed.timeControl, increment: parsed.increment };
      }
    }
    return { minutes: 10, increment: 5 }; // Default 10|5 Rapid
  } catch (error) {
    return { minutes: 10, increment: 5 };
  }
};

/**
 * Save the user's preferred time control
 * @param {number} minutes
 * @param {number} increment
 */
export const setPreferredTimeControl = (minutes, increment) => {
  try {
    const preferences = localStorage.getItem(STORAGE_KEY);
    const parsed = preferences ? JSON.parse(preferences) : {};
    parsed.timeControl = minutes;
    parsed.increment = increment;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    // silently fail
  }
};

/**
 * Get the user's preferred color
 * @returns {string} 'white', 'black', or 'random'
 */
export const getPreferredColor = () => {
  try {
    const preferences = localStorage.getItem(STORAGE_KEY);
    if (preferences) {
      const parsed = JSON.parse(preferences);
      return parsed.preferredColor || 'random';
    }
    return 'random';
  } catch (error) {
    return 'random';
  }
};

/**
 * Save the user's preferred color
 * @param {string} color - 'white', 'black', or 'random'
 */
export const setPreferredColor = (color) => {
  try {
    const preferences = localStorage.getItem(STORAGE_KEY);
    const parsed = preferences ? JSON.parse(preferences) : {};
    parsed.preferredColor = color;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    // silently fail
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
