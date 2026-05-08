const BEGINNER_SYNTHETIC_PLAYERS = [
  { id: 'local-800-1', name: 'Aarav Beginner', avatar_seed: 'aarav-beginner', computer_level: 1, rating: 800 },
  { id: 'local-850-1', name: 'Meera Starter', avatar_seed: 'meera-starter', computer_level: 2, rating: 850 },
  { id: 'local-900-1', name: 'Kabir Learner', avatar_seed: 'kabir-learner', computer_level: 2, rating: 900 },
  { id: 'local-950-1', name: 'Ananya Practice', avatar_seed: 'ananya-practice', computer_level: 3, rating: 950 },
  { id: 'local-1000-1', name: 'Tara Casual', avatar_seed: 'tara-casual', computer_level: 4, rating: 1000 },
];

const VALID_LEARNING_HELP_LIMITS = [1, 3, 5, 7];

export const pickBeginnerSyntheticPlayer = () => {
  return BEGINNER_SYNTHETIC_PLAYERS[Math.floor(Math.random() * BEGINNER_SYNTHETIC_PLAYERS.length)];
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
