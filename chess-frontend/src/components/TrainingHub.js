
import React from "react";
import { Link } from "react-router-dom";

// Training exercises data
const trainingData = {
  beginner: [
    {
      id: 1,
      title: "Basic King Movement",
      description:
        "Learn how the king moves and practice not placing it in check.",
      difficulty: "beginner",
    },
    {
      id: 2,
      title: "Basic Mate: King + Queen vs King",
      description:
        "Practice checkmating with a King and Queen against a lone King.",
      difficulty: "beginner",
    }
  ],

  intermediate: [
    {
      id: 1,
      title: "Complex Pawn Structures",
      description:
        "Learn to play around doubled, isolated, or backward pawns effectively.",
      difficulty: "intermediate",
    },
    {
      id: 2,
      title: "Minor Piece Endgames",
      description:
        "Practice bishop and knight endgames and converting small advantages.",
      difficulty: "intermediate",
    },
    {
      id: 3,
      title: "Bishop Pair Advantage",
      description:
        "Understand the value of two bishops in open or semi-open positions.",
      difficulty: "intermediate",
    }
  ],
  
  advanced: [
    {
      id: 1,
      title: "Advanced Tactics",
      description:
        "Master complex tactical patterns and combinations.",
      difficulty: "advanced",
    },
    {
      id: 2,
      title: "Strategic Positional Play",
      description:
        "Learn to evaluate positions and create long-term plans.",
      difficulty: "advanced",
    }
  ]
};

const TrainingHub = () => {
  return (
    <div className="training-hub p-6 min-h-screen text-white">
      <h2 className="text-4xl font-bold text-center mb-4 text-white">Training Exercises & Puzzles</h2>
      <p className="text-lg text-center text-gray-300 mb-10">Select an exercise below to improve your chess skills:</p>

      <div className="space-y-12">
        {Object.entries(trainingData).map(([level, exercises]) => (
          <div key={level}>
            <h3 className="text-2xl font-bold mb-4 capitalize text-primary">{level} Level</h3>
            <div className="training-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exercises.map((exercise) => (
                <Link
                  to={`/training/${level}/${exercise.id}`}
                  key={`${level}-${exercise.id}`}
                  className="training-card-link transform hover:scale-105 transition-transform duration-300 block"
                >
                  <div className="training-card bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 h-full flex flex-col">
                    <span className={`difficulty-tag ${level} self-start mb-2 text-accent`}>{exercise.difficulty}</span>
                    <h4 className="text-xl font-bold mb-2 text-secondary">{exercise.title}</h4>
                    <p className="text-gray-300 flex-grow">{exercise.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainingHub;