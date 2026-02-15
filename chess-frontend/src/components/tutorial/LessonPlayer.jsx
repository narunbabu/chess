import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Chess } from 'chess.js';
import ChessBoard from '../play/ChessBoard';
import EnhancedInteractiveLesson from './EnhancedInteractiveLesson';
import DOMPurify from 'dompurify';
import ErrorBoundary from './ErrorBoundary';
import PuzzlePlayer from './PuzzlePlayer';

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
  const [playerColor, setPlayerColor] = useState('white');
  const [chessGame, setChessGame] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({}); // Track quiz answers: {questionIndex: selectedOptionIndex}
  const [totalQuizQuestions, setTotalQuizQuestions] = useState(0); // Total quiz questions across all slides

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
      const loadedLesson = response.data.data;
      setLesson(loadedLesson);
      setUserProgress(loadedLesson.user_progress);
      setStartTime(Date.now());

      // Calculate total quiz questions for proportional scoring
      if (loadedLesson.lesson_type === 'theory' && loadedLesson.content_data?.slides) {
        const total = loadedLesson.content_data.slides.reduce((sum, slide) => {
          return sum + (slide.quiz?.length || 0);
        }, 0);
        setTotalQuizQuestions(total);
        console.log('📊 Quiz scoring setup:', {
          totalQuestions: total,
          pointsPerQuestion: total > 0 ? Math.round((100 / total) * 100) / 100 : 0
        });
      }

      // Start the lesson to create attendance record
      if (loadedLesson.user_progress?.status === 'not_started' || !loadedLesson.user_progress) {
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

    if (lesson.lesson_type === 'practice_game') {
      // Create new game for practice
      const game = new Chess();
      setChessGame(game);
    }

    if (lesson.lesson_type === 'interactive') {
      // For interactive lessons, check if current slide has a diagram
      const slides = lesson.content_data?.slides || [];
      const currentSlide = slides[currentStep];

      if (currentSlide?.diagram) {
        try {
          const game = new Chess(currentSlide.diagram);
          setChessGame(game);
          console.log('✅ Interactive lesson FEN loaded successfully:', currentSlide.diagram);
        } catch (error) {
          console.error('❌ Invalid FEN in interactive slide:', error, 'FEN:', currentSlide.diagram);
          // Fall back to default starting position if FEN is invalid
          console.log('🔄 Using default chess position due to invalid FEN');
          setChessGame(new Chess());
        }
      } else {
        console.log('⚠️ No diagram found in interactive slide, using default position');
        setChessGame(new Chess());
      }
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
      setQuizAnswers({}); // Reset quiz answers when moving to next step
    }
  };

  const moveToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setQuizAnswers({}); // Reset quiz answers when moving to previous step
    }
  };

  const getTotalSteps = () => {
    switch (lesson.lesson_type) {
      case 'theory':
        return lesson.content_data?.slides?.length || 1;
      case 'puzzle':
        return lesson.content_data?.puzzles?.length || 1;
      case 'interactive':
        return lesson.content_data?.slides?.length || 1;
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
    }
    setAttempts(prev => prev + 1);
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
      <div className="w-full bg-[#3d3a37] rounded-full h-3 mb-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#4e7837] via-[#81b64c] to-[#a3d160] opacity-20"></div>
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
      <div className="bg-[#312e2b] rounded-2xl p-8 shadow-xl border-2 border-[#3d3a37]">
        {slide.title && (
          <h2 className="text-3xl font-bold mb-6 text-white">{slide.title}</h2>
        )}

        {slide.content && (
          <div className="prose max-w-none mb-8 text-[#bababa] text-lg leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(slide.content) }} />
          </div>
        )}

        {slide.diagram && chessGame && (
          <div className="mb-8 bg-[#262421] p-6 rounded-xl border-2 border-[#3d3a37]">
            <div className="text-center text-base font-bold text-white mb-4">
              📋 Board Position
            </div>
            <div className="flex justify-center items-center">
              <div style={{ width: '500px', height: '500px' }}>
                <ChessBoard
                  game={chessGame}
                  boardOrientation="white"
                  playerColor="white"
                  isReplayMode={slide.highlights ? false : true}
                  onDrop={slide.highlights ? (sourceSquare, targetSquare) => {
                    const move = `${sourceSquare}${targetSquare}`;
                    // For interactive theory lessons, allow any move and provide feedback
                    console.log('Interactive move attempted:', move);
                    // Reset the position to the original diagram
                    try {
                      const newGame = new Chess(slide.diagram);
                      setChessGame(newGame);
                    } catch (error) {
                      console.error('Error resetting position:', error);
                    }
                    return true;
                  } : undefined}
                  moveFrom=""
                  setMoveFrom={() => {}}
                  rightClickedSquares={{}}
                  setRightClickedSquares={() => {}}
                  moveSquares={slide.highlights ? slide.highlights.reduce((acc, square) => {
                    acc[square] = { backgroundColor: 'rgba(255, 255, 0, 0.5)' };
                    return acc;
                  }, {}) : {}}
                  setMoveSquares={() => {}}
                />
              </div>
            </div>
            {slide.highlights && (
              <div className="text-center text-sm text-[#e8a93e] mt-4 font-semibold bg-[#3d3a37] p-3 rounded-lg border border-[#4a4744]">
                💡 Try moving the pieces on the board above!
              </div>
            )}
          </div>
        )}

        {slide.quiz && (
          <div className="rounded-lg p-5 border-2" style={{
            background: '#262421',
            borderColor: '#3d3a37',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 className="font-bold text-lg mb-4" style={{ color: '#e8a93e' }}>🎯 Quiz Time!</h3>
            <div className="space-y-2">
              {slide.quiz.map((question, qIndex) => {
                const answerKey = `${index}-${qIndex}`;
                const selectedAnswer = quizAnswers[answerKey];
                const isAnswered = selectedAnswer !== undefined;
                const isCorrect = isAnswered && selectedAnswer === question.correct;

                return (
                  <div key={qIndex} className="mb-4">
                    <p className="font-bold mb-3 text-white">{question.question}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {question.options.map((option, oIndex) => {
                        const isSelected = selectedAnswer === oIndex;
                        const isCorrectAnswer = oIndex === question.correct;

                        let buttonClass = "p-4 border-2 rounded-lg text-sm font-semibold transition-all ";

                        if (isSelected && isCorrectAnswer) {
                          // Correct answer selected
                          buttonClass += "bg-[#4e7837]/30 border-[#81b64c] text-[#a3d160]";
                        } else if (isSelected && !isCorrectAnswer) {
                          // Wrong answer selected
                          buttonClass += "bg-[#e74c3c]/20 border-[#e74c3c] text-[#fa6a5b]";
                        } else if (isAnswered && isCorrectAnswer) {
                          // Show correct answer after wrong selection
                          buttonClass += "bg-[#4e7837]/20 border-[#81b64c] text-[#81b64c]";
                        } else {
                          // Not selected
                          buttonClass += "bg-[#3d3a37] border-[#4a4744] text-[#bababa] hover:bg-[#4a4744] hover:border-[#81b64c] hover:scale-105 hover:shadow-md";
                        }

                        return (
                          <button
                            key={oIndex}
                            onClick={() => {
                              // Set the selected answer with slide-specific key
                              const answerKey = `${index}-${qIndex}`;
                              setQuizAnswers(prev => ({ ...prev, [answerKey]: oIndex }));

                              // Update immediate score feedback with proportional scoring
                              const pointsPerQuestion = totalQuizQuestions > 0
                                ? Math.round((100 / totalQuizQuestions) * 100) / 100
                                : 10;

                              if (oIndex === question.correct) {
                                setScore(prev => Math.min(100, prev + pointsPerQuestion));
                                console.log(`✅ Correct answer! +${pointsPerQuestion} points`);
                              } else {
                                const penalty = Math.round(pointsPerQuestion * 0.2 * 100) / 100; // 20% penalty
                                setScore(prev => Math.max(0, prev - penalty));
                                console.log(`❌ Wrong answer! -${penalty} points`);
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
                      ? 'rgba(78, 120, 55, 0.3)'
                      : 'rgba(232, 169, 62, 0.2)',
                    border: `2px solid ${correctAnswers === slide.quiz.length ? '#81b64c' : '#e8a93e'}`
                  }}>
                    <div className="text-lg font-bold mb-2 text-white">
                      {correctAnswers === slide.quiz.length ? '🎉 Perfect!' : '✅ Quiz Completed'}
                    </div>
                    <div className="text-sm font-semibold text-[#bababa]">
                      You got {correctAnswers} out of {slide.quiz.length} correct!
                    </div>
                    <div className="text-xs mt-2 text-[#8b8987]">
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
                <div className="mt-4 text-center text-sm font-semibold text-[#8b8987]">
                  📝 {remainingQuestions} question(s) remaining
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  const renderPuzzle = () => (
    <PuzzlePlayer
      puzzles={lesson.content_data?.puzzles || []}
      currentStep={currentStep}
      onSolved={handlePuzzleSolve}
      onHintUsed={() => setScore(prev => Math.max(0, prev - 5))}
      score={score}
      attempts={attempts}
    />
  );

  const renderPracticeGame = () => {
    return (
      <div className="bg-[#312e2b] rounded-2xl p-8 shadow-xl border-2 border-[#3d3a37]">
        <div className="mb-6 bg-[#262421] p-6 rounded-xl border-2 border-[#3d3a37]">
          <h3 className="text-2xl font-bold mb-3 text-white">🎮 Practice Game</h3>
          <p className="text-[#bababa] font-semibold text-lg">
            Play against AI to practice what you've learned!
          </p>
        </div>

        <div className="mb-6 bg-[#262421] p-6 rounded-xl border-2 border-[#3d3a37]">
          {chessGame && (
            <div className="flex justify-center items-center">
              <div style={{ width: '500px', height: '500px' }}>
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
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setPlayerColor(playerColor === 'white' ? 'black' : 'white')}
            className="px-4 py-2 bg-[#81b64c] text-white rounded-lg hover:bg-[#a3d160] transition-colors"
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

  const renderInteractive = () => {
    // Use the enhanced interactive lesson component with error boundary
    return (
      <ErrorBoundary errorMessage="The interactive lesson encountered an error. Please try reloading.">
        <EnhancedInteractiveLesson
          lesson={lesson}
          user={user}
          onLessonComplete={(completionData) => {
            console.log('🎉 Interactive lesson completed:', completionData);
            // You can handle completion here, e.g., navigate back with completion data
            setTimeout(() => {
              navigate('/tutorial', {
                state: {
                  completed: true,
                  score: completionData.xp_awarded || score,
                  lessonTitle: lesson.title,
                  xpAwarded: completionData.xp_awarded,
                  moduleCompleted: completionData.module_completed,
                  verifiedProgress: completionData.user_stats
                }
              });
          }, 2000);
        }}
      />
      </ErrorBoundary>
    );
  };

  if (loading) {
    return (
      <div className="tutorial-lesson-container flex-grow min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81b64c] mx-auto mb-4"></div>
          <div className="text-lg font-medium text-[#bababa]">Loading lesson...</div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="tutorial-lesson-container flex-grow min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-medium mb-4 text-[#bababa]">Lesson not found</div>
          <button
            onClick={() => navigate('/tutorial')}
            className="px-4 py-2 bg-[#81b64c] text-white rounded-lg hover:bg-[#a3d160] transition-colors"
          >
            Back to Tutorial
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="tutorial-lesson-container flex-grow min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center bg-[#312e2b] rounded-lg p-8 shadow-lg max-w-md mx-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--tutorial-green-dark)' }}>
            Lesson Completed!
          </h2>
          <div className="mb-6">
            <div className="text-lg font-semibold text-white mb-2">{lesson.title}</div>
            <div className="text-[#bababa]">
              Great job! You've successfully completed this lesson.
            </div>
          </div>

          {/* Score Display */}
          <div className="mb-6 p-4 rounded-lg" style={{
            background: 'rgba(78, 120, 55, 0.3)',
            border: '2px solid #81b64c'
          }}>
            <div className="text-2xl font-bold mb-2" style={{
              background: 'var(--tutorial-gradient-green)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {Math.round(score)}% Score
            </div>
            <div className="text-sm font-semibold text-[#bababa]">
              {score >= 90 ? 'Excellent!' : score >= 70 ? 'Good job!' : 'Keep practicing!'}
            </div>
          </div>

          {/* XP Reward */}
          <div className="mb-6 p-4 rounded-lg" style={{
            background: 'rgba(232, 169, 62, 0.2)',
            border: '2px solid #e8a93e'
          }}>
            <div className="text-xl font-bold mb-1" style={{
              background: 'var(--tutorial-xp-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              +{lesson.xp_reward} XP
            </div>
            <div className="text-sm font-semibold text-[#bababa]">Experience earned</div>
          </div>

          <div className="animate-pulse">
            <div className="flex items-center justify-center space-x-2 text-gray-600">
              <svg className="animate-spin h-5 w-5 text-[#81b64c]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    <div className="tutorial-lesson-container flex-grow bg-[#1a1a18] min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-140px)] overflow-y-auto -webkit-overflow-scrolling-touch pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
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

        <div className="bg-[#312e2b] rounded-2xl p-6 shadow-xl border-2 border-[#3d3a37] flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-3 text-white">{lesson.title}</h1>
            <div className="flex items-center space-x-6 text-[#bababa] font-semibold text-base">
              <span className="bg-[#262421] px-4 py-2 rounded-lg border border-[#3d3a37]">⏱️ {lesson.formatted_duration}</span>
              <span className="bg-[#262421] px-4 py-2 rounded-lg border border-[#3d3a37]">🎯 {lesson.difficulty_level}</span>
              <span className="bg-[#262421] px-4 py-2 rounded-lg border border-[#3d3a37]">🏆 {lesson.xp_reward} XP</span>
            </div>
          </div>

          <div className="text-center p-6 rounded-xl border-2 border-[#81b64c]" style={{
            background: 'rgba(78, 120, 55, 0.3)',
            boxShadow: '0 4px 15px rgba(129, 182, 76, 0.3)'
          }}>
            <div className="text-sm font-bold text-[#bababa] mb-2">Score</div>
            <div className="text-4xl font-extrabold text-[#81b64c]">
              {Math.round(score)}%
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Step Counter */}
      <div className="text-center mb-6">
        <div className="inline-block bg-[#312e2b] px-8 py-4 rounded-xl shadow-lg border-2 border-[#3d3a37]">
          <span className="text-white font-bold text-xl">
            📍 Step {currentStep + 1} of {getTotalSteps()}
          </span>
        </div>
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

        {lesson.lesson_type === 'interactive' && renderInteractive()}
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
    </div>
  );
};

export default LessonPlayer;