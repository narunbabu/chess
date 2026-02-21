
import React, { useState } from "react";
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

const STORAGE_KEY = 'training_completed_exercises';

const getCompleted = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

const TrainingHub = () => {
  const [completed, setCompleted] = useState(getCompleted);

  const toggleComplete = (level, id) => {
    const key = `${level}-${id}`;
    setCompleted(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const totalExercises = Object.values(trainingData).reduce((s, arr) => s + arr.length, 0);
  const completedCount = completed.length;

  return (
    <div className="training-hub p-6 min-h-screen text-white">
      {/* Cross-link back to Tutorial Hub */}
      <div className="flex justify-center mb-6">
        <Link
          to="/tutorial"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-[#bababa] hover:text-white hover:border-[#81b64c] hover:bg-white/15 transition-all text-sm font-semibold"
        >
          ← 🎓 Back to Interactive Lessons
        </Link>
      </div>

      <h2 className="text-4xl font-bold text-center mb-4 text-white">Training Exercises & Puzzles</h2>
      <p className="text-lg text-center text-[#bababa] mb-4">Select an exercise below to improve your chess skills:</p>

      {/* Progress tracking bar (TR-R2) */}
      <div style={{ maxWidth: '480px', margin: '0 auto 2rem', background: '#312e2b', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span style={{ color: '#bababa', fontWeight: 600 }}>Your Progress</span>
          <span style={{ color: '#81b64c', fontWeight: 700 }}>{completedCount} / {totalExercises} completed</span>
        </div>
        <div style={{ height: '8px', background: '#3d3a37', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            width: `${totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0}%`,
            background: 'linear-gradient(90deg, #81b64c, #a3d160)',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      <div className="space-y-12">
        {Object.entries(trainingData).map(([level, exercises]) => (
          <div key={level}>
            <h3 className="text-2xl font-bold mb-4 capitalize text-primary">{level} Level</h3>
            <div className="training-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exercises.map((exercise) => {
                const key = `${level}-${exercise.id}`;
                const isDone = completed.includes(key);
                return (
                <div key={key} style={{ position: 'relative' }}>
                  <Link
                    to={`/training/${level}/${exercise.id}`}
                    className="training-card-link transform hover:scale-105 transition-transform duration-300 block"
                  >
                    <div className="training-card bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 h-full flex flex-col"
                      style={isDone ? { borderColor: 'rgba(129,182,76,0.5)', background: 'rgba(129,182,76,0.08)' } : {}}>
                      <span className={`difficulty-tag ${level} self-start mb-2 text-accent`}>{exercise.difficulty}</span>
                      <h4 className="text-xl font-bold mb-2 text-secondary">{exercise.title}</h4>
                      <p className="text-[#bababa] flex-grow">{exercise.description}</p>
                    </div>
                  </Link>
                  {/* Mark done toggle */}
                  <button
                    onClick={() => toggleComplete(level, exercise.id)}
                    style={{
                      position: 'absolute', top: '12px', right: '12px',
                      padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                      border: `1px solid ${isDone ? '#81b64c' : '#4a4744'}`,
                      background: isDone ? 'rgba(129,182,76,0.2)' : 'rgba(0,0,0,0.3)',
                      color: isDone ? '#81b64c' : '#8b8987',
                      cursor: 'pointer', backdropFilter: 'blur(4px)'
                    }}
                    title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {isDone ? '✓ Done' : 'Mark done'}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainingHub;