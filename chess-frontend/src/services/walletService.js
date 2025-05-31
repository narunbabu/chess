
import api from './api';

export const getBalance = async () => {
  const response = await api.get('/wallet/balance');
  return response.data;
};

export const getTransactions = async (page = 1) => {
  const response = await api.get(`/wallet/transactions?page=${page}`);
  return response.data;
};

export const transferCredits = async (amount, reason, description, gameId = null) => {
  const response = await api.post('/wallet/transfer', {
    amount,
    reason,
    description,
    game_id: gameId
  });
  return response.data;
};

export const purchaseCredits = async (amount, paymentId, paymentMethod) => {
  const response = await api.post('/wallet/purchase', {
    amount,
    payment_id: paymentId,
    payment_method: paymentMethod
  });
  return response.data;
};
