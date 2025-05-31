// src/utils/trainingExercises.js

export const trainingExercises = {
  beginner: {
    1: {
      title: "Basic Mate: King + Queen vs King",
      description:
        "Deliver checkmate in one move with your queen, supported by your king.",
      position: "4k3/7Q/4K3/8/8/8/8/8 w - - 0 1",
      solution: ["h7e7"],
      successMessage:
        "Well done! Qe7# is checkmate with the queen supported by your king.",
    },
    2: {
      title: "Basic Mate: King + Rook vs King",
      description:
        "Deliver checkmate in one move with your rook, with the king nearby to restrict escape.",
      position: "7k/6K1/8/8/8/8/8/7R w - - 0 1",
      solution: ["h1h8"],
      successMessage: "Excellent! Rh8# is a classic rook-and-king checkmate.",
    },
    3: {
      title: "Simple Pawn Promotion",
      description:
        "Promote your pawn to deliver mate in one. Find the winning promotion move.",
      position: "7k/6P1/5K2/8/8/8/8/8 w - - 0 1",
      solution: ["g7g8=Q"],
      successMessage: "Nice job! g7g8=Q is checkmate by promoting your pawn.",
    }
  },

  intermediate: {
    1: {
      title: "Back Rank Checkmate",
      description:
        "Black’s king is trapped on the back rank. Find the mating rook move!",
      position: "5rk1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1",
      solution: ["f1f8"],
      successMessage: "Perfect! Rf8# is a classic back rank mate.",
    },
    2: {
      title: "Double Attack",
      description:
        "Attack the rook and threaten mate simultaneously with one decisive move!",
      position: "3rk3/8/8/8/8/8/4Q3/4K3 w - - 0 1",
      solution: ["e2e7"],
      successMessage:
        "Excellent! Qe7 attacks the rook and threatens mate on e8.",
    },
    3: {
      title: "Basic Pawn Endgame: Opposition",
      description:
        "Use the concept of opposition to force a winning king-and-pawn endgame.",
      position: "4k3/8/8/3P4/3K4/8/8/8 w - - 0 1",
      solution: ["d4e5"],
      successMessage:
        "Well done! Ke5 secures the opposition and paves the way for promotion.",
    }
  },
};

/**
 * Helper function to retrieve a specific exercise by level and ID.
 * For example, getExercise('beginner', 1)
 */
export const getExercise = (level, id) => {
  if (!trainingExercises[level] || !trainingExercises[level][id]) {
    return null;
  }
  return trainingExercises[level][id];
};
