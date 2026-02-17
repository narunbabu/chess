import api from './api';

const matchmakingService = {
  /**
   * Get lobby players (real online + synthetic)
   */
  getLobbyPlayers: async () => {
    const response = await api.get('/lobby/players');
    return response.data;
  },

  /**
   * Join the matchmaking queue with optional preferences
   */
  joinQueue: async (preferences = {}) => {
    const response = await api.post('/matchmaking/join', preferences);
    return response.data;
  },

  /**
   * Poll the matchmaking status
   */
  checkStatus: async (entryId) => {
    const response = await api.get(`/matchmaking/status/${entryId}`);
    return response.data;
  },

  /**
   * Cancel matchmaking
   */
  cancelQueue: async (entryId) => {
    const response = await api.delete(`/matchmaking/cancel/${entryId}`);
    return response.data;
  },

  /**
   * Search users by name (for friend search)
   */
  searchUsers: async (query) => {
    const response = await api.get(`/users?search=${encodeURIComponent(query)}`);
    return response.data;
  },
};

export default matchmakingService;
