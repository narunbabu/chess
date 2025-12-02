/**
 * Tutorial system constants
 * Centralized location for all magic numbers and configuration values
 */

// Scoring constants
export const SCORING = {
  HINT_PENALTY: 2,
  WRONG_ANSWER_PENALTY: 5,
  CORRECT_ANSWER_BONUS: 10,  // Legacy - not used in interactive lessons
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  // Note: Interactive lessons use proportional scoring: 100 / total_stages per stage
};

// Timing constants (in milliseconds)
export const TIMING = {
  AUTO_RESET_DEFAULT_DELAY: 1500,
  COMPLETION_MESSAGE_DURATION: 5000,
  ANIMATION_DURATION: 300,
};

// Board sizing constants (in pixels)
export const BOARD_SIZES = {
  MOBILE: 320,
  TABLET: 400,
  DESKTOP: 500,
  DEFAULT: 500,
};

// Breakpoints for responsive design (in pixels)
export const BREAKPOINTS = {
  MOBILE: 640,
  TABLET: 1024,
  DESKTOP: 1280,
};

// Tier configuration
export const TIER_CONFIG = {
  beginner: {
    color: 'bg-green-500',
    icon: '🌱',
    name: 'Beginner',
    textColor: 'text-green-700',
    borderColor: 'border-green-500',
  },
  intermediate: {
    color: 'bg-blue-500',
    icon: '🎯',
    name: 'Intermediate',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
  },
  advanced: {
    color: 'bg-purple-600',
    icon: '🏆',
    name: 'Advanced',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-600',
  },
  expert: {
    color: 'bg-red-600',
    icon: '⚡',
    name: 'Expert',
    textColor: 'text-red-700',
    borderColor: 'border-red-600',
  },
};

// Helper functions
export const getTierConfig = (tier) => {
  return TIER_CONFIG[tier] || TIER_CONFIG.beginner;
};

export const getTierColor = (tier) => {
  return getTierConfig(tier).color;
};

export const getTierIcon = (tier) => {
  return getTierConfig(tier).icon;
};

export const getTierName = (tier) => {
  return getTierConfig(tier).name;
};

// Default values
export const DEFAULTS = {
  TOTAL_LESSONS: 9,
  COMPLETION_PERCENTAGE: 0,
  AVERAGE_SCORE: 0,
  CURRENT_STREAK: 0,
  SKILL_TIER: 'beginner',
  LEVEL: 1,
  XP: 0,
  FORMATTED_TIME_SPENT: '0m',
};
