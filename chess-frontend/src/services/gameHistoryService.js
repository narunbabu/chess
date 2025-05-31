import api from './api';

export const getGameHistories = async (page = 1) => {
  const response = await api.get(`/game-history?page=${page}`);
  return response.data;
};

export const getGameHistory = async (id) => {
  const response = await api.get(`/game-history/${id}`);
  return response.data;
};

export const getSharedGame = async (token) => {
  const response = await api.get(`/games/${token}`);
  return response.data;
};

export const saveGameHistory = async (gameData) => {
  const response = await api.post('/game-history', gameData);
  return response.data;
};

export const generateShareLink = async (gameId) => {
  const response = await api.post(`/game-history/${gameId}/share`);
  return response.data;
};

export const getRankings = async () => {
  const response = await api.get('/rankings');
  return response.data;
};

export const calculateCreditCost = (opponentType, difficultyLevel) => {
  switch (opponentType) {
    case 'stockfish':
      return 1 + difficultyLevel;
    case 'llm':
      return difficultyLevel * 3;
    case 'human':
      return 5;
    default:
      return 0;
  }
};

export const calculateWinnings = (wagered, opponentType) => {
  switch (opponentType) {
    case 'stockfish':
      return Math.floor(wagered * 1.5);
    case 'llm':
      return wagered * 2;
    case 'human':
      return wagered * 2;
    default:
      return 0;
  }
};