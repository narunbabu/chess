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
    <div className="training-hub">
      <h2>Training Exercises & Puzzles</h2>
      <p>Select an exercise below to improve your chess skills:</p>

      {/* Beginner */}
      <h3>Beginner Level</h3>
      <div className="training-grid">
        {trainingData.beginner.map((exercise) => (
          <Link
            to={`/training/beginner/${exercise.id}`}
            key={`beginner-${exercise.id}`}
            style={{ textDecoration: "none" }}
          >
            <div className="training-card">
              <span className="difficulty beginner">Beginner</span>
              <h3>{exercise.title}</h3>
              <p>{exercise.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Intermediate */}
      <h3>Intermediate Level</h3>
      <div className="training-grid">
        {trainingData.intermediate.map((exercise) => (
          <Link
            to={`/training/intermediate/${exercise.id}`}
            key={`intermediate-${exercise.id}`}
            style={{ textDecoration: "none" }}
          >
            <div className="training-card">
              <span className="difficulty intermediate">Intermediate</span>
              <h3>{exercise.title}</h3>
              <p>{exercise.description}</p>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Advanced */}
      <h3>Advanced Level</h3>
      <div className="training-grid">
        {trainingData.advanced.map((exercise) => (
          <Link
            to={`/training/advanced/${exercise.id}`}
            key={`advanced-${exercise.id}`}
            style={{ textDecoration: "none" }}
          >
            <div className="training-card">
              <span className="difficulty advanced">Advanced</span>
              <h3>{exercise.title}</h3>
              <p>{exercise.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TrainingHub;