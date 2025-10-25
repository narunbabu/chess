// SkillAssessmentModal.js - Modal for optional skill assessment after registration
import React, { useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import './SkillAssessment.css';

const SkillAssessmentModal = ({ isOpen, onComplete, onSkip, userId }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = [
    {
      id: 1,
      question: "How would you describe your chess experience?",
      options: [
        { text: "Complete beginner - I just learned the rules", value: 800 },
        { text: "Casual player - I play occasionally for fun", value: 1200 },
        { text: "Club player - I play regularly and know basic strategies", value: 1600 },
        { text: "Tournament player - I compete in rated tournaments", value: 2000 },
        { text: "Expert player - I have significant competitive experience", value: 2400 }
      ]
    },
    {
      id: 2,
      question: "How familiar are you with chess openings and tactics?",
      options: [
        { text: "Not familiar - I play by intuition only", value: 800 },
        { text: "Basic knowledge - I know a few common openings", value: 1200 },
        { text: "Moderate knowledge - I study openings and practice tactics", value: 1600 },
        { text: "Advanced knowledge - I regularly study chess theory", value: 2000 },
        { text: "Expert knowledge - I deeply analyze games and theory", value: 2400 }
      ]
    },
    {
      id: 3,
      question: "What is your typical performance against chess engines or bots?",
      options: [
        { text: "I lose to beginner bots (Level 1-3)", value: 800 },
        { text: "I can beat beginner bots but struggle with intermediate (Level 4-6)", value: 1200 },
        { text: "I can beat intermediate bots (Level 7-10)", value: 1600 },
        { text: "I can beat advanced bots (Level 11-14)", value: 2000 },
        { text: "I can beat expert-level bots (Level 15+)", value: 2400 }
      ]
    }
  ];

  const handleAnswer = (value) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate final rating
      const avgRating = Math.round(newAnswers.reduce((sum, val) => sum + val, 0) / newAnswers.length);
      submitRating(avgRating);
    }
  };

  const submitRating = async (calculatedRating) => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${BACKEND_URL}/rating/initial`,
        { rating: calculatedRating },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      onComplete(calculatedRating);
    } catch (error) {
      console.error('Failed to submit rating:', error);
      // Still call onComplete to close modal
      onComplete(calculatedRating);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setAnswers(answers.slice(0, -1));
    }
  };

  if (!isOpen) return null;

  const progress = ((currentQuestion) / questions.length) * 100;
  const currentQ = questions[currentQuestion];

  return (
    <div className="skill-modal-overlay">
      <div className="skill-modal">
        <div className="skill-modal-header">
          <h2>🎯 Quick Skill Assessment</h2>
          <p>Help us set your starting rating (takes 30 seconds)</p>
          <button
            className="skill-modal-close"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="skill-progress-bar">
          <div
            className="skill-progress-fill"
            style={{ width: `${progress}%` }}
          />
          <span className="skill-progress-text">
            Question {currentQuestion + 1} of {questions.length}
          </span>
        </div>

        <div className="skill-modal-body">
          <h3 className="skill-question">{currentQ.question}</h3>

          <div className="skill-options">
            {currentQ.options.map((option, index) => (
              <button
                key={index}
                className="skill-option-btn"
                onClick={() => handleAnswer(option.value)}
                disabled={isSubmitting}
              >
                <span className="skill-option-number">{index + 1}</span>
                <span className="skill-option-text">{option.text}</span>
                <span className="skill-option-rating">~{option.value}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="skill-modal-footer">
          <button
            className="skill-back-btn"
            onClick={handleBack}
            disabled={currentQuestion === 0 || isSubmitting}
          >
            ← Back
          </button>
          <button
            className="skill-skip-btn"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip (Use 1200)
          </button>
        </div>

        {isSubmitting && (
          <div className="skill-submitting-overlay">
            <div className="skill-spinner"></div>
            <p>Setting your rating...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillAssessmentModal;
