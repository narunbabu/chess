
export const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-domain.com' 
  : 'http://localhost:8000';

export const API_BASE_URL = `${BACKEND_URL}/api`;

export const CREDIT_COSTS = {
  stockfish: {
    base: 1,
    perLevel: 1
  },
  llm: {
    base: 3,
    perLevel: 3
  },
  human: 5
};

export const CREDIT_REWARDS = {
  stockfish: 1.5,
  llm: 2,
  human: 2
};

export const WELCOME_CREDITS = 100;
export const REFERRAL_BONUS = 25;
