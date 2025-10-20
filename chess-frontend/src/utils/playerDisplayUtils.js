/**
 * Utility functions for displaying player information
 */

/**
 * Truncate player name to first 4 characters followed by ".."
 * @param {string} name - Full player name
 * @returns {string} Truncated name (e.g., "arun.." for "arun babu")
 */
export const truncatePlayerName = (name) => {
  if (!name || typeof name !== 'string') {
    return 'User..';
  }

  // Get first 4 characters and add ".."
  const truncated = name.substring(0, 4);
  return `${truncated}..`;
};

/**
 * Get player avatar URL with fallback
 * @param {Object} playerData - Player data object
 * @returns {string|null} Avatar URL or null if not available
 */
export const getPlayerAvatar = (playerData) => {
  return playerData?.avatar_url || playerData?.avatar || null;
};

/**
 * Get player display name (truncated)
 * @param {Object} playerData - Player data object
 * @param {string} fallback - Fallback name if player data not available
 * @returns {string} Truncated display name
 */
export const getPlayerDisplayName = (playerData, fallback = 'User') => {
  const name = playerData?.name || fallback;
  return truncatePlayerName(name);
};
