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

  // ─── Smart Real-User Matchmaking ────────────────────────────────────

  /**
   * Find online players and send match requests
   */
  findPlayers: async (preferences = {}) => {
    const response = await api.post('/matchmaking/find-players', preferences);
    return response.data;
  },

  /**
   * Accept a match request (as a target player)
   */
  acceptMatchRequest: async (token) => {
    const response = await api.post(`/matchmaking/accept/${token}`);
    return response.data;
  },

  /**
   * Decline a match request (as a target player)
   */
  declineMatchRequest: async (token) => {
    const response = await api.post(`/matchmaking/decline/${token}`);
    return response.data;
  },

  /**
   * Cancel finding players (as the requester)
   */
  cancelFindPlayers: async (token) => {
    const response = await api.post(`/matchmaking/cancel-find/${token}`);
    return response.data;
  },
};

export default matchmakingService;
