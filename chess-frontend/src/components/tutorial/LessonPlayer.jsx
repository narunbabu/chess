import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Chess } from 'chess.js';
import ChessBoard from '../play/ChessBoard';

const LessonPlayer = () => {
  const { lessonId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [userProgress, setUserProgress] = useState(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState('');
  const [solution, setSolution] = useState([]);
  const [puzzlePosition, setPuzzlePosition] = useState('');
  const [playerColor, setPlayerColor] = useState('white');
  const [chessGame, setChessGame] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({}); // Track quiz answers: {questionIndex: selectedOptionIndex}

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  useEffect(() => {
    if (lesson) {
      setupCurrentStep();
    }
  }, [lesson, currentStep]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tutorial/lessons/${lessonId}`);
      setLesson(response.data.data);
      setUserProgress(response.data.data.user_progress);
      setStartTime(Date.now());

      // Start the lesson to create attendance record
      if (response.data.data.user_progress?.status === 'not_started' || !response.data.data.user_progress) {
        await startLesson();
      }
    } catch (error) {
      console.error('Error loading lesson:', error);
      if (error.response?.status === 403) {
        navigate('/tutorial');
      }
    } finally {
      setLoading(false);
    }
  };

  const setupCurrentStep = () => {
    if (lesson.lesson_type === 'theory') {
      // For theory lessons, check if current slide has a diagram
      const slides = lesson.content_data?.slides || [];
      const currentSlide = slides[currentStep];

      if (currentSlide?.diagram) {
        try {
          const game = new Chess(currentSlide.diagram);
          setChessGame(game);
        } catch (error) {
          console.error('❌ Invalid FEN in theory slide:', error, 'FEN:', currentSlide.diagram);
          // Fall back to default starting position if FEN is invalid
          console.log('🔄 Using default chess position due to invalid FEN');
          setChessGame(new Chess());
        }
      } else {
        setChessGame(null);
      }
      return;
    }

    if (lesson.lesson_type === 'puzzle') {
      const puzzles = lesson.content_data?.puzzles || [];
      const currentPuzzle = puzzles[currentStep];

      if (currentPuzzle) {
        setPuzzlePosition(currentPuzzle.fen);
        setSolution(currentPuzzle.solution || []);
        setCurrentHint('');
        setShowHint(false);

        // Create Chess instance for puzzle
        try {
          const game = new Chess(currentPuzzle.fen);
          setChessGame(game);
        } catch (error) {
          console.error('❌ Invalid FEN in puzzle:', error, 'FEN:', currentPuzzle.fen);
          // Fall back to default starting position if FEN is invalid
          console.log('🔄 Using default chess position due to invalid FEN');
          setChessGame(new Chess());
        }
      }
    }

    if (lesson.lesson_type === 'practice_game') {
      // Create new game for practice
      const game = new Chess();
      setChessGame(game);
    }
  };

  const startLesson = async () => {
    try {
      await api.post(`/tutorial/lessons/${lessonId}/start`);
      // Refresh progress
      await loadLesson();
    } catch (error) {
      console.error('Error starting lesson:', error);
    }
  };

  const moveToNextStep = () => {
    const totalSteps = getTotalSteps();
    const isLastStep = currentStep >= totalSteps - 1;

    if (isLastStep) {
      completeLesson();
    } else {
      setCurrentStep(prev => prev + 1);
      setShowHint(false);
      setQuizAnswers({}); // Reset quiz answers when moving to next step
    }
  };

  const moveToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setShowHint(false);
      setQuizAnswers({}); // Reset quiz answers when moving to previous step
    }
  };

  const getTotalSteps = () => {
    switch (lesson.lesson_type) {
      case 'theory':
        return lesson.content_data?.slides?.length || 1;
      case 'puzzle':
        return lesson.content_data?.puzzles?.length || 1;
      case 'practice_game':
        return 1;
      default:
        return 1;
    }
  };

  const handlePuzzleSolve = (isCorrect) => {
    if (isCorrect) {
      setScore(prev => Math.min(100, prev + (100 / getTotalSteps())));
      moveToNextStep();
    } else {
      setScore(prev => Math.max(0, prev - 10));
      setShowHint(true);
    }
    setAttempts(prev => prev + 1);
  };

  const handleMove = (move) => {
    if (lesson.lesson_type === 'puzzle') {
      // Check if move matches solution
      const currentSolution = solution[0];
      if (move === currentSolution) {
        handlePuzzleSolve(true);
      } else {
        handlePuzzleSolve(false);
      }
    }
  };

  const showHintHandler = () => {
    if (lesson.lesson_type === 'puzzle') {
      const puzzles = lesson.content_data?.puzzles || [];
      const currentPuzzle = puzzles[currentStep];
      const hints = currentPuzzle?.hints || [];

      if (hints.length > 0) {
        setCurrentHint(hints[0]);
        setShowHint(true);
        setScore(prev => Math.max(0, prev - 5)); // Small penalty for hints
      }
    }
  };

  const completeLesson = async () => {
    try {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // For theory lessons, calculate score based on quiz performance
      let finalScore = score;
      if (lesson.lesson_type === 'theory') {
        const slides = lesson.content_data?.slides || [];
        let totalQuizQuestions = 0;
        let correctQuizAnswers = 0;

        // Calculate quiz performance across all slides
        slides.forEach((slide, slideIndex) => {
          if (slide.quiz && Array.isArray(slide.quiz)) {
            totalQuizQuestions += slide.quiz.length;
            slide.quiz.forEach((question, qIndex) => {
              if (quizAnswers[`${slideIndex}-${qIndex}`] === question.correct) {
                correctQuizAnswers++;
              }
            });
          }
        });

        // If there were quiz questions, base score on quiz performance
        if (totalQuizQuestions > 0) {
          finalScore = Math.round((correctQuizAnswers / totalQuizQuestions) * 100);
        } else {
          // For lessons without quizzes, base score on completion time
          const expectedTime = lesson.estimated_duration_minutes * 60 || 300; // default 5 minutes
          const timeScore = Math.max(60, 100 - Math.max(0, (timeSpent - expectedTime) / 60)); // Lose 1 point per minute over expected
          finalScore = Math.round(timeScore);
        }
      }

      finalScore = Math.max(0, Math.min(100, finalScore)); // Ensure score is between 0-100

      console.log('🎯 Completing lesson:', {
        lessonId,
        lessonTitle: lesson?.title,
        lessonType: lesson?.lesson_type,
        finalScore,
        timeSpent,
        attempts: Math.max(1, attempts),
        quizAnswers,
        totalSteps: getTotalSteps(),
        completedSteps: currentStep + 1
      });

      const response = await api.post(`/tutorial/lessons/${lessonId}/complete`, {
        score: finalScore,
        time_spent_seconds: timeSpent,
        attempts: Math.max(1, attempts)
      });

      console.log('✅ Lesson completion API response:', {
        status: response.status,
        success: response.data?.success,
        xpAwarded: response.data?.data?.xp_awarded,
        moduleCompleted: response.data?.data?.module_completed,
        userStats: response.data?.data?.user_stats
      });

      setCompleted(true);

      // Navigate back to tutorial hub with completion data
      setTimeout(() => {
        navigate('/tutorial', {
          state: {
            completed: true,
            score: finalScore,
            lessonTitle: lesson.title,
            xpAwarded: response.data?.data?.xp_awarded,
            moduleCompleted: response.data?.data?.module_completed,
            verifiedProgress: response.data?.data?.user_stats
          }
        });
      }, 2000);

    } catch (error) {
      console.error('❌ Error completing lesson:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Still navigate even if API fails, to avoid getting user stuck
      navigate('/tutorial', {
        state: {
          completed: false,
          error: 'Failed to save lesson completion',
          lessonTitle: lesson.title
        }
      });
    }
  };

  const renderProgressBar = () => {
    const progress = ((currentStep + 1) / getTotalSteps()) * 100;

    return (
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-100 via-blue-100 to-green-100 opacity-40"></div>
        <div
          className="h-3 rounded-full transition-all duration-500 relative z-10"
          style={{
            width: `${progress}%`,
            background: 'var(--tutorial-gradient-rainbow)',
            boxShadow: '0 0 12px rgba(124, 58, 237, 0.5)'
          }}
        />
      </div>
    );
  };

  const renderTheorySlide = (slide, index) => {
    if (index !== currentStep) return null;

    return (
      <div className="bg-white rounded-lg p-6 shadow-sm">
        {slide.title && (
          <h2 className="text-2xl font-bold mb-4 text-gray-800">{slide.title}</h2>
        )}

        {slide.content && (
          <div className="prose max-w-none mb-6 text-gray-700">
            <div dangerouslySetInnerHTML={{ __html: slide.content }} />
          </div>
        )}

        {slide.diagram && chessGame && (
          <div className="mb-6">
            <div className="text-center text-sm font-semibold text-gray-700 mb-2">
              📋 Board Position
            </div>
            <ChessBoard
              game={chessGame}
              boardOrientation="white"
              isReplayMode={true}
              playerColor="white"
            />
          </div>
        )}

        {slide.quiz && (
          <div className="rounded-lg p-5 border-2" style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            borderColor: 'var(--tutorial-info)',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)'
          }}>
            <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--tutorial-info-dark)' }}>🎯 Quiz Time!</h3>
            <div className="space-y-2">
              {slide.quiz.map((question, qIndex) => {
                const answerKey = `${index}-${qIndex}`;
                const selectedAnswer = quizAnswers[answerKey];
                const isAnswered = selectedAnswer !== undefined;
                const isCorrect = isAnswered && selectedAnswer === question.correct;

                return (
                  <div key={qIndex} className="mb-4">
                    <p className="font-bold mb-3 text-gray-800">{question.question}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {question.options.map((option, oIndex) => {
                        const isSelected = selectedAnswer === oIndex;
                        const isCorrectAnswer = oIndex === question.correct;

                        let buttonClass = "p-4 border-2 rounded-lg text-sm font-semibold transition-all ";

                        if (isSelected && isCorrectAnswer) {
                          // Correct answer selected
                          buttonClass += "bg-green-100 border-green-500 text-green-800";
                        } else if (isSelected && !isCorrectAnswer) {
                          // Wrong answer selected
                          buttonClass += "bg-red-100 border-red-500 text-red-800";
                        } else if (isAnswered && isCorrectAnswer) {
                          // Show correct answer after wrong selection
                          buttonClass += "bg-green-50 border-green-400 text-green-700";
                        } else {
                          // Not selected
                          buttonClass += "bg-white border-blue-300 text-gray-800 hover:bg-blue-50 hover:border-blue-500 hover:scale-105 hover:shadow-md";
                        }

                        return (
                          <button
                            key={oIndex}
                            onClick={() => {
                              // Set the selected answer with slide-specific key
                              const answerKey = `${index}-${qIndex}`;
                              setQuizAnswers(prev => ({ ...prev, [answerKey]: oIndex }));

                              // Update immediate score feedback
                              if (oIndex === question.correct) {
                                setScore(prev => Math.min(100, prev + 10)); // Small reward for correct answers
                              } else {
                                setScore(prev => Math.max(0, prev - 2)); // Small penalty for wrong answers
                              }
                            }}
                            disabled={isAnswered}
                            className={buttonClass}
                          >
                            {option}
                            {isSelected && isCorrectAnswer && " ✓"}
                            {isSelected && !isCorrectAnswer && " ✗"}
                            {isAnswered && !isSelected && isCorrectAnswer && " ✓"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quiz completion status */}
            {slide.quiz && (() => {
              const allQuestionsAnswered = slide.quiz.every((_, qIndex) => {
                const answerKey = `${index}-${qIndex}`;
                return quizAnswers[answerKey] !== undefined;
              });

              if (allQuestionsAnswered) {
                const correctAnswers = slide.quiz.filter((q, qIndex) => {
                  const answerKey = `${index}-${qIndex}`;
                  return quizAnswers[answerKey] === q.correct;
                }).length;
                return (
                  <div className="mt-6 p-4 rounded-lg text-center" style={{
                    background: correctAnswers === slide.quiz.length
                      ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                      : 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)',
                    border: `2px solid ${correctAnswers === slide.quiz.length ? '#10b981' : '#f59e0b'}`
                  }}>
                    <div className="text-lg font-bold mb-2">
                      {correctAnswers === slide.quiz.length ? '🎉 Perfect!' : '✅ Quiz Completed'}
                    </div>
                    <div className="text-sm font-semibold">
                      You got {correctAnswers} out of {slide.quiz.length} correct!
                    </div>
                    <div className="text-xs mt-2 text-gray-600">
                      Click "Next" below to continue
                    </div>
                  </div>
                );
              }

              const remainingQuestions = slide.quiz.filter((_, qIndex) => {
                const answerKey = `${index}-${qIndex}`;
                return quizAnswers[answerKey] === undefined;
              }).length;

              return (
                <div className="mt-4 text-center text-sm font-semibold text-gray-700">
                  📝 {remainingQuestions} question(s) remaining
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  const renderPuzzle = () => {
    const puzzles = lesson.content_data?.puzzles || [];
    const currentPuzzle = puzzles[currentStep];

    if (!currentPuzzle) return null;

    return (
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-xl font-bold mb-2 text-gray-800">
            🧩 Puzzle {currentStep + 1} of {puzzles.length}
          </h3>
          <p className="text-gray-700 font-medium">{currentPuzzle.objective}</p>
        </div>

        <div className="mb-4">
          {chessGame && (
            <ChessBoard
              game={chessGame}
              boardOrientation={playerColor}
              playerColor={playerColor}
              isReplayMode={false}
              onDrop={(sourceSquare, targetSquare) => {
                const move = `${sourceSquare}${targetSquare}`;
                handleMove(move);
                return true;
              }}
              moveFrom=""
              setMoveFrom={() => {}}
              rightClickedSquares={{}}
              setRightClickedSquares={() => {}}
              moveSquares={{}}
              setMoveSquares={() => {}}
            />
          )}
        </div>

        {showHint && currentHint && (
          <div className="rounded-lg p-4 mb-4 border-2" style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderColor: 'var(--tutorial-warning)',
            boxShadow: '0 4px 15px rgba(251, 191, 36, 0.3)'
          }}>
            <div className="flex items-start">
              <span className="text-3xl mr-3">💡</span>
              <div>
                <div className="font-bold text-lg mb-1" style={{ color: 'var(--tutorial-warning-dark)' }}>Hint:</div>
                <div className="font-medium" style={{ color: 'var(--tutorial-warning-dark)' }}>{currentHint}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={showHintHandler}
            className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
            style={{
              background: 'var(--tutorial-xp-gradient)',
              boxShadow: '0 4px 15px rgba(251, 191, 36, 0.3)'
            }}
          >
            💡 Show Hint (-5 XP)
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              boxShadow: '0 4px 15px rgba(100, 116, 139, 0.3)'
            }}
          >
            🔄 Reset Position
          </button>
        </div>
      </div>
    );
  };

  const renderPracticeGame = () => {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-xl font-bold mb-2 text-gray-800">🎮 Practice Game</h3>
          <p className="text-gray-700 font-medium">
            Play against AI to practice what you've learned!
          </p>
        </div>

        <div className="mb-4">
          {chessGame && (
            <ChessBoard
              game={chessGame}
              boardOrientation={playerColor}
              playerColor={playerColor}
              isReplayMode={false}
              onDrop={(sourceSquare, targetSquare) => {
                // Handle practice game moves
                console.log('Practice game move:', sourceSquare, targetSquare);
                return true;
              }}
              moveFrom=""
              setMoveFrom={() => {}}
              rightClickedSquares={{}}
              setRightClickedSquares={() => {}}
              moveSquares={{}}
              setMoveSquares={() => {}}
            />
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setPlayerColor(playerColor === 'white' ? 'black' : 'white')}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            Play as {playerColor === 'white' ? 'Black' : 'White'}
          </button>

          <button
            onClick={completeLesson}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Complete Practice
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium">Loading lesson...</div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-medium mb-4">Lesson not found</div>
          <button
            onClick={() => navigate('/tutorial')}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            Back to Tutorial
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-white rounded-lg p-8 shadow-lg max-w-md mx-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--tutorial-green-dark)' }}>
            Lesson Completed!
          </h2>
          <div className="mb-6">
            <div className="text-lg font-semibold text-gray-800 mb-2">{lesson.title}</div>
            <div className="text-gray-600">
              Great job! You've successfully completed this lesson.
            </div>
          </div>

          {/* Score Display */}
          <div className="mb-6 p-4 rounded-lg" style={{
            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            border: '2px solid #22c55e'
          }}>
            <div className="text-2xl font-bold mb-2" style={{
              background: 'var(--tutorial-gradient-green)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {Math.round(score)}% Score
            </div>
            <div className="text-sm font-semibold text-gray-700">
              {score >= 90 ? 'Excellent!' : score >= 70 ? 'Good job!' : 'Keep practicing!'}
            </div>
          </div>

          {/* XP Reward */}
          <div className="mb-6 p-4 rounded-lg" style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #f59e0b'
          }}>
            <div className="text-xl font-bold mb-1" style={{
              background: 'var(--tutorial-xp-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              +{lesson.xp_reward} XP
            </div>
            <div className="text-sm font-semibold text-gray-700">Experience earned</div>
          </div>

          <div className="animate-pulse">
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Returning to tutorial hub...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/tutorial')}
          className="mb-4 inline-flex items-center font-semibold px-4 py-2 rounded-lg transition-all hover:scale-105"
          style={{
            background: 'var(--tutorial-gradient-purple)',
            color: 'white',
            boxShadow: '0 2px 10px rgba(124, 58, 237, 0.3)'
          }}
        >
          ← Back to {lesson.module.name}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-800">{lesson.title}</h1>
            <div className="flex items-center space-x-4 text-gray-700 font-medium">
              <span>⏱️ {lesson.formatted_duration}</span>
              <span>🎯 {lesson.difficulty_level}</span>
              <span>🏆 {lesson.xp_reward} XP</span>
            </div>
          </div>

          <div className="text-center p-4 rounded-lg" style={{
            background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
            boxShadow: '0 4px 15px rgba(34, 197, 94, 0.2)'
          }}>
            <div className="text-xs font-semibold text-gray-600 mb-1">Score</div>
            <div className="text-3xl font-bold" style={{
              background: 'var(--tutorial-gradient-green)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {Math.round(score)}%
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Step Counter */}
      <div className="text-center mb-6 text-gray-700 font-semibold">
        📍 Step {currentStep + 1} of {getTotalSteps()}
      </div>

      {/* Lesson Content */}
      <div className="mb-8">
        {lesson.lesson_type === 'theory' && lesson.content_data?.slides?.map((slide, index) => (
          <div key={index}>
            {renderTheorySlide(slide, index)}
          </div>
        ))}

        {lesson.lesson_type === 'puzzle' && renderPuzzle()}

        {lesson.lesson_type === 'practice_game' && renderPracticeGame()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={moveToPreviousStep}
          disabled={currentStep === 0}
          className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: currentStep === 0 ? '#9ca3af' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            boxShadow: currentStep === 0 ? 'none' : '0 4px 15px rgba(100, 116, 139, 0.3)'
          }}
        >
          ← Previous
        </button>

        <div className="flex space-x-4">
          {lesson.lesson_type === 'theory' && (
            <button
              onClick={() => navigate('/tutorial')}
              className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
              }}
            >
              🚪 Exit Lesson
            </button>
          )}

          <button
            onClick={moveToNextStep}
            disabled={(() => {
              // For theory lessons, check if current slide has a quiz
              if (lesson.lesson_type === 'theory') {
                const slides = lesson.content_data?.slides || [];
                const currentSlide = slides[currentStep];
                if (currentSlide?.quiz) {
                  // Disable if not all quiz questions are answered
                  return !currentSlide.quiz.every((_, qIndex) => {
                    const answerKey = `${currentStep}-${qIndex}`;
                    return quizAnswers[answerKey] !== undefined;
                  });
                }
              }
              return false;
            })()}
            className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: currentStep >= getTotalSteps() - 1 ? 'var(--tutorial-gradient-green)' : 'var(--tutorial-gradient-purple)',
              boxShadow: currentStep >= getTotalSteps() - 1 ? '0 4px 15px rgba(34, 197, 94, 0.4)' : '0 4px 15px rgba(124, 58, 237, 0.4)'
            }}
          >
            {currentStep >= getTotalSteps() - 1 ? '✅ Complete Lesson' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonPlayer;