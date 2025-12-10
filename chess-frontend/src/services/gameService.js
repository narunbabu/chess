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
  }
};

export default gameService;