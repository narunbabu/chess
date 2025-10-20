// src/components/auth/SkillAssessment.js

import React, { useState } from 'react';
import './SkillAssessment.css';

const SKILL_QUESTIONS = [
  {
    id: 'experience',
    question: "How would you describe your chess experience?",
    options: [
      { label: "Complete beginner - Learning the rules", value: 800 },
      { label: "Casual player - Know basic tactics", value: 1100 },
      { label: "Club player - Study openings & tactics", value: 1500 },
      { label: "Tournament player - Serious study", value: 1800 },
      { label: "Expert/Master level", value: 2200 }
    ]
  },
  {
    id: 'rated_experience',
    question: "Have you played rated chess before?",
    options: [
      { label: "Never played rated chess", value: 0 },
      { label: "Online rated games (Chess.com, Lichess, etc.)", value: 100 },
      { label: "Official FIDE/USCF rated", value: 200 }
    ]
  },
  {
    id: 'known_rating',
    question: "What's your approximate rating elsewhere? (if known)",
    options: [
      { label: "Don't know / Not applicable", value: 0 },
      { label: "Under 1000", value: -200 },
      { label: "1000-1499", value: -50 },
      { label: "1500-1999", value: 100 },
      { label: "2000+", value: 300 }
    ]
  }
];

const SkillAssessment = ({ onComplete, onSkip }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const handleAnswer = (questionId, value) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    // Move to next question or show results
    if (currentQuestion < SKILL_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate final rating
      const calculatedRating = calculateInitialRating(newAnswers);
      setShowResults(true);

      // Call onComplete after a brief delay to show the result
      setTimeout(() => {
        onComplete(calculatedRating);
      }, 2000);
    }
  };

  const calculateInitialRating = (answers) => {
    // Base rating from experience level (Q1)
    const baseRating = answers.experience || 1200;

    // Bonuses from other questions
    const ratedBonus = answers.rated_experience || 0;
    const knownRatingBonus = answers.known_rating || 0;

    // Calculate total
    const totalRating = baseRating + ratedBonus + knownRatingBonus;

    // Clamp between 600 and 2600
    return Math.max(600, Math.min(2600, totalRating));
  };

  const handleSkip = () => {
    // Default to 1200 if user skips
    onSkip(1200);
  };

  const currentQ = SKILL_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / SKILL_QUESTIONS.length) * 100;

  if (showResults) {
    const finalRating = calculateInitialRating(answers);
    return (
      <div className="skill-assessment-container">
        <div className="skill-assessment-card results">
          <div className="results-icon">✅</div>
          <h2>Your Starting Rating</h2>
          <div className="rating-display">{finalRating}</div>
          <p className="rating-description">
            {finalRating < 1000 && "Beginner - You're just starting your chess journey!"}
            {finalRating >= 1000 && finalRating < 1500 && "Intermediate - You know the basics well!"}
            {finalRating >= 1500 && finalRating < 2000 && "Advanced - Solid chess knowledge!"}
            {finalRating >= 2000 && "Expert - Strong player!"}
          </p>
          <p className="provisional-note">
            This is a provisional rating. Your rating will adjust quickly as you play your first 20 games.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-assessment-container">
      <div className="skill-assessment-card">
        <div className="assessment-header">
          <h2>Quick Skill Assessment</h2>
          <p className="assessment-subtitle">
            Help us match you with appropriate opponents (takes 30 seconds)
          </p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="progress-text">Question {currentQuestion + 1} of {SKILL_QUESTIONS.length}</p>
        </div>

        <div className="question-section">
          <h3 className="question-text">{currentQ.question}</h3>

          <div className="options-list">
            {currentQ.options.map((option, index) => (
              <button
                key={index}
                className="option-button"
                onClick={() => handleAnswer(currentQ.id, option.value)}
              >
                <span className="option-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="assessment-footer">
          <button className="skip-button" onClick={handleSkip}>
            Skip (Start at 1200)
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillAssessment;
