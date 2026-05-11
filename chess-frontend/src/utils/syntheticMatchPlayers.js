import { isRatingInWindow } from './ratingWindow';

const BEGINNER_SYNTHETIC_PLAYERS = [
  { id: 'local-200-1', name: 'Riya First Moves', avatar_seed: 'riya-first-moves', computer_level: 1, rating: 200 },
  { id: 'local-250-1', name: 'Om Piece Finder', avatar_seed: 'om-piece-finder', computer_level: 1, rating: 250 },
  { id: 'local-300-1', name: 'Isha Safe King', avatar_seed: 'isha-safe-king', computer_level: 1, rating: 300 },
  { id: 'local-350-1', name: 'Vivaan Board Basics', avatar_seed: 'vivaan-board-basics', computer_level: 1, rating: 350 },
  { id: 'local-400-1', name: 'Nisha Center Pawns', avatar_seed: 'nisha-center-pawns', computer_level: 1, rating: 400 },
  { id: 'local-450-1', name: 'Arjun One-Step', avatar_seed: 'arjun-one-step', computer_level: 1, rating: 450 },
  { id: 'local-500-1', name: 'Tara Simple Tactics', avatar_seed: 'tara-simple-tactics', computer_level: 2, rating: 500 },
  { id: 'local-550-1', name: 'Kabir Calm Player', avatar_seed: 'kabir-calm-player', computer_level: 2, rating: 550 },
  { id: 'local-600-1', name: 'Maya Open Files', avatar_seed: 'maya-open-files', computer_level: 2, rating: 600 },
  { id: 'local-650-1', name: 'Dev Slow Planner', avatar_seed: 'dev-slow-planner', computer_level: 2, rating: 650 },
  { id: 'local-700-1', name: 'Anika Pin Spotter', avatar_seed: 'anika-pin-spotter', computer_level: 3, rating: 700 },
  { id: 'local-750-1', name: 'Rohan Rising', avatar_seed: 'rohan-rising', computer_level: 3, rating: 750 },
];

const VALID_LEARNING_HELP_LIMITS = [1, 3, 5, 7];

export const pickBeginnerSyntheticPlayer = (ratingWindow) => {
  const candidates = ratingWindow
    ? BEGINNER_SYNTHETIC_PLAYERS.filter(player => isRatingInWindow(player.rating, ratingWindow))
    : BEGINNER_SYNTHETIC_PLAYERS;
  const pool = candidates.length > 0 ? candidates : BEGINNER_SYNTHETIC_PLAYERS;

  return pool[Math.floor(Math.random() * pool.length)];
};

export const normalizeLearningHelpLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  return VALID_LEARNING_HELP_LIMITS.includes(parsed) ? parsed : 5;
};

export const getStoredLearningHelpLimit = () => {
  try {
    return normalizeLearningHelpLimit(localStorage.getItem('learningHelpLimit'));
  } catch {
    return 5;
  }
};
