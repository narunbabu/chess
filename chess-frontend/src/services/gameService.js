// src/services/gameService.js

import api from "./api";

export const gameService = {
  /**
   * Create a new computer game
   */
  createComputerGame: async (gameData) => {
    const response = await api.post('/games/computer', gameData);
    return response.data;
  },

  /**
   * Create a new multiplayer game
   */
  createGame: async (opponentId) => {
    const response = await api.post('/games', { opponent_id: opponentId });
    return response.data;
  },

  /**
   * Get game details
   */
  getGame: async (gameId) => {
    const response = await api.get(`/games/${gameId}`);
    return response.data;
  },

  /**
   * Get active games for the current user
   */
  getActiveGames: async () => {
    const response = await api.get('/games/active');
    return response.data;
  },

  /**
   * Get unfinished games for the current user
   */
  getUnfinishedGames: async () => {
    const response = await api.get('/games/unfinished');
    return response.data;
  },

  /**
   * Submit a move
   */
  submitMove: async (gameId, move) => {
    const response = await api.post(`/games/${gameId}/move`, move);
    return response.data;
  },

  /**
   * Resign from a game
   */
  resign: async (gameId) => {
    const response = await api.post(`/games/${gameId}/resign`);
    return response.data;
  },

  /**
   * Pause a game
   */
  pauseGame: async (gameId) => {
    const response = await api.post(`/games/${gameId}/pause-navigation`);
    return response.data;
  },

  /**
   * Get game moves
   */
  getGameMoves: async (gameId) => {
    const response = await api.get(`/games/${gameId}/moves`);
    return response.data;
  },

  /**
   * Create game from unfinished guest game
   */
  createFromUnfinished: async (gameData) => {
    const response = await api.post('/games/create-from-unfinished', gameData);
    return response.data;
  },

  /**
   * Delete unfinished game
   */
  deleteUnfinished: async (gameId) => {
    const response = await api.delete(`/games/${gameId}/unfinished`);
    return response.data;
  },

  /**
   * Get user games with pagination
   */
  getUserGames: async (params = {}) => {
    const response = await api.get('/games', { params });
    return response.data;
  },

  /**
   * Set game mode (rated/casual)
   */
  setGameMode: async (gameId, mode) => {
    const response = await api.post(`/games/${gameId}/mode`, { mode });
    return response.data;
  },

  /**
   * Get game mode for a specific game
   */
  getGameMode: async (gameId) => {
    const response = await api.get(`/games/${gameId}/mode`);
    return response.data;
  },

  /**
   * Get rating change details after game completion
   */
  getRatingChange: async (gameId) => {
    const response = await api.get(`/games/${gameId}/rating-change`);
    return response.data;
  },

  /**
   * Offer a draw in a game
   */
  offerDraw: async (gameId) => {
    const response = await api.post(`/games/${gameId}/draw/offer`);
    return response.data;
  },

  /**
   * Accept a draw offer
   */
  acceptDraw: async (gameId) => {
    const response = await api.post(`/games/${gameId}/draw/accept`);
    return response.data;
  },

  /**
   * Decline a draw offer
   */
  declineDraw: async (gameId) => {
    const response = await api.post(`/games/${gameId}/draw/decline`);
    return response.data;
  },

  /**
   * Cancel a draw offer
   */
  cancelDraw: async (gameId) => {
    const response = await api.post(`/games/${gameId}/draw/cancel`);
    return response.data;
  },

  /**
   * Get current draw offer status
   */
  getDrawStatus: async (gameId) => {
    const response = await api.get(`/games/${gameId}/draw/status`);
    return response.data;
  },

  /**
   * Get draw history for a game
   */
  getDrawHistory: async (gameId) => {
    const response = await api.get(`/games/${gameId}/draw/history`);
    return response.data;
  },

  /**
   * Validate if a draw offer is allowed
   */
  validateDrawOffer: async (gameId) => {
    const response = await api.get(`/games/${gameId}/draw/validate`);
    return response.data;
  }
};

export default gameService;