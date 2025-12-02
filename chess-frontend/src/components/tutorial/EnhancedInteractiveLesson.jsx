import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../play/ChessBoard';
import FeedbackCard from './FeedbackCard';
import VisualAidsOverlay from './VisualAidsOverlay';
import api from '../../services/api';
import logger from '../../utils/logger';
import useBoardSize from '../../hooks/useBoardSize';
import { SCORING, TIMING } from '../../constants/tutorialConstants';

const EnhancedInteractiveLesson = ({ lesson, user, onLessonComplete }) => {
  const boardSize = useBoardSize();
  const [stages, setStages] = useState([]);
  const [currentStage, setCurrentStage] = useState(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [chessGame, setChessGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());
  const [processingMove, setProcessingMove] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [isCompletingLesson, setIsCompletingLesson] = useState(false);
  const [visualAids, setVisualAids] = useState({ arrows: [], highlights: [] });
  const [stageProgress, setStageProgress] = useState({});
  const [moveFrom, setMoveFrom] = useState('');
  const [moveSquares, setMoveSquares] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});

  useEffect(() => {
    const totalScore = Object.values(stageProgress).reduce((sum, p) => sum + (p.best_score || 0), 0);
    setScore(Math.round(totalScore));
  }, [stageProgress]);

  // Initialize the lesson
  useEffect(() => {
    loadInteractiveLesson();
  }, [lesson]);

  // Initialize score based on stage types
  useEffect(() => {
    if (stages.length > 0) {
      // Calculate proportional score per stage: 100 / total_stages
      const totalStages = stages.length;
      const scorePerStage = totalStages > 0 ? Math.round((100 / totalStages) * 100) / 100 : 0;

      // Count how many demonstration stages have been completed
      const demonstrationStages = stages.filter(stage => stage.is_demonstration);
      const baseScore = demonstrationStages.length * scorePerStage;

      logger.debug('Initializing lesson score', {
        totalStages,
        scorePerStage,
        demonstrationStages: demonstrationStages.length,
        baseScore: Math.round(baseScore)
      });

      setScore(Math.round(baseScore));
    }
  }, [stages]);

  // Load interactive lesson data
  const loadInteractiveLesson = async () => {
    try {
      setLoading(true);

      // Start the lesson (create progress record if not exists)
      await api.post(`/tutorial/lessons/${lesson.id}/start`);

      const response = await api.get(`/tutorial/lessons/${lesson.id}/interactive`);
      const lessonData = response.data.data;

      setStages(lessonData.interactive_stages || []);
      setCurrentStage(lessonData.current_stage);
      setCurrentStageIndex(0);

      // Initialize stage progress mapping
      const progressMap = {};
      lessonData.interactive_stages?.forEach(stage => {
        progressMap[stage.id] = {
          is_completed: stage.is_completed || false,
          attempts: stage.user_progress?.attempts || 0,
          best_score: stage.user_progress?.best_score || 0
        };
      });
      setStageProgress(progressMap);

      if (lessonData.current_stage) {
        initializeStage(lessonData.current_stage);
      }
    } catch (error) {
      console.error('Error loading interactive lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize a specific stage
  const initializeStage = useCallback((stage) => {
    try {
      // Create chess game with FEN validation
      let game;

      if (stage.initial_fen && stage.initial_fen !== 'start') {
        try {
          // Fix escaped slashes in FEN - replace \/ with /
          const normalizedFen = stage.initial_fen.replace(/\\\//g, '/');

          // Try to create a Chess instance with the normalized FEN
          game = new Chess(normalizedFen);

          // Verify the FEN loaded successfully (compare with normalized FEN)
          if (game.fen() === normalizedFen || game.fen().split(' ')[0] === normalizedFen.split(' ')[0]) {
            // FEN loaded successfully
            logger.debug('FEN loaded successfully', { fen: normalizedFen, original: stage.initial_fen });
          } else {
            throw new Error('FEN did not load correctly');
          }
        } catch (fenError) {
          logger.debug('FEN validation error:', fenError.message);

          if (lesson.allow_invalid_fen) {
            // Custom board setup for teaching positions
            game = new Chess();
            game.clear();

            logger.warn('Lesson:invalid-fen', 'Using custom position');

            setFeedback({
              type: 'info',
              message: 'Custom board position loaded for this lesson',
              success: true
            });
          } else {
            setFeedback({
              type: 'error',
              message: 'Failed to load position. Using starting position instead.',
              success: false
            });

            game = new Chess(); // Fallback to starting position
          }
        }
      } else {
        game = new Chess(); // Default starting position
      }

      setChessGame(game);
      setVisualAids(stage.visual_aids || { arrows: [], highlights: [] });

      // Don't clear feedback if it's an info message about custom position
      if (feedback?.type !== 'info') {
        setFeedback(null);
      }

      setShowHint(false);
      setCurrentHint('');
      setHintIndex(0);

      // Auto-mark demonstration stages as completed
      if (stage.is_demonstration) {
        // Calculate proportional score for this stage
        const totalStages = stages.length;
        const scorePerStage = totalStages > 0 ? Math.round((100 / totalStages) * 100) / 100 : 0;

        setStageProgress(prev => ({
          ...prev,
          [stage.id]: {
            ...prev[stage.id],
            is_completed: true,
            attempts: 0,
            best_score: scorePerStage
          }
        }));
      }
    } catch (error) {
      console.error('Error initializing stage:', error);

      setFeedback({
        type: 'error',
        message: 'Failed to initialize stage. Please try again.',
        success: false
      });

      // Fallback to default position
      setChessGame(new Chess());
    }
  }, [lesson.allow_invalid_fen, feedback]);

  // Handle move validation and feedback
  const handleInteractiveMove = useCallback(async (sourceSquare, targetSquare) => {
    if (processingMove || !currentStage || !chessGame) return;

    setProcessingMove(true);
    const move = `${sourceSquare}${targetSquare}`;
    const startTime = Date.now();

    try {
      // Apply the move locally for immediate feedback
      const tempGame = new Chess(chessGame.fen());
      const moveResult = tempGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Default to queen promotion
      });

      if (moveResult) {
        const fenAfter = tempGame.fen();
        const timeSpentMs = Date.now() - startTime;

        // Call API to validate the move
        const response = await api.post(`/tutorial/lessons/${lesson.id}/validate-move`, {
          stage_id: currentStage.id,
          move: move,
          fen_after: fenAfter,
          time_spent_ms: timeSpentMs
        });

        const validation = response.data.data.validation_result;

        // Show the move on board (even if it's wrong)
        setChessGame(tempGame);

        // Show feedback
        setFeedback({
          type: validation.feedback_type,
          message: validation.feedback,
          success: validation.success
        });

        // Calculate base score per stage
        const totalStages = stages.length;
        const baseScore = totalStages > 0 ? 100 / totalStages : 0;

        const stageId = currentStage.id;
        const prevProgress = stageProgress[stageId] || { attempts: 0, best_score: 0, is_completed: false, is_locked: false };
        const currentAttempts = prevProgress.attempts || 0;

        // Check if stage is locked (3 failed attempts)
        if (prevProgress.is_locked) {
          setFeedback({
            type: 'warning',
            message: '⚠️ This stage is locked after 3 failed attempts. Please continue to the next stage.',
            success: false
          });
          return;
        }

        if (validation.success) {
          // Calculate score based on attempt number: full score for 1st, half for 2nd, quarter for 3rd
          const stageScore = baseScore / Math.pow(2, currentAttempts);

          console.log('✅ Stage completed:', {
            stageId,
            currentAttempts,
            baseScore,
            stageScore,
            calculation: `${baseScore} / 2^${currentAttempts} = ${stageScore}`
          });

          setStageProgress(prevState => ({
            ...prevState,
            [stageId]: {
              ...prevProgress,
              attempts: currentAttempts + 1,
              is_completed: true,
              best_score: stageScore,
              is_locked: false
            }
          }));

          // Auto-reset to next stage if configured
          if (currentStage.auto_reset_on_success) {
            setTimeout(() => {
              moveToNextStage();
            }, currentStage.auto_reset_delay_ms || TIMING.AUTO_RESET_DEFAULT_DELAY);
          }
        } else {
          // Failed attempt - increment attempts
          const newAttempts = currentAttempts + 1;

          // Check if this is the 3rd failed attempt
          if (newAttempts >= 3) {
            console.log('🚫 Stage locked after 3 failed attempts:', {
              stageId,
              attempts: newAttempts
            });

            setStageProgress(prevState => ({
              ...prevState,
              [stageId]: {
                ...prevProgress,
                attempts: newAttempts,
                best_score: 0, // 0% score after 3 failures
                is_completed: true, // Mark as completed (with 0 score) to allow progression
                is_locked: true // Lock the stage - no more attempts allowed
              }
            }));

            setFeedback({
              type: 'error',
              message: '❌ 3 attempts failed. This stage scored 0%. Moving to next stage...',
              success: false
            });

            // Auto-move to next stage after 3 failures
            setTimeout(() => {
              moveToNextStage();
            }, 3000); // 3 second delay

          } else {
            // Failed but still have attempts remaining
            const attemptsRemaining = 3 - newAttempts;

            console.log('❌ Stage attempt failed:', {
              stageId,
              currentAttempts,
              newAttempts,
              attemptsRemaining
            });

            setStageProgress(prevState => ({
              ...prevState,
              [stageId]: {
                ...prevProgress,
                attempts: newAttempts,
                best_score: prevProgress.best_score,
                is_locked: false
              }
            }));

            setFeedback({
              type: 'warning',
              message: validation.feedback + ` (${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining)`,
              success: false
            });
          }
        }
      } else {
        setFeedback({
          type: 'error',
          message: 'Invalid move. Try again.',
          success: false
        });
      }
    } catch (error) {
      console.error('Error validating move:', error);
      setFeedback({
        type: 'error',
        message: 'Error validating move. Please try again.',
        success: false
      });
    } finally {
      setProcessingMove(false);
    }
  }, [processingMove, currentStage, chessGame, lesson.id, stages, stageProgress]);

  // Move to next stage
  const moveToNextStage = () => {
    const nextIndex = currentStageIndex + 1;
    if (nextIndex < stages.length) {
      const nextStage = stages[nextIndex];
      setCurrentStageIndex(nextIndex);
      setCurrentStage(nextStage);
      initializeStage(nextStage);
    } else {
      // Lesson completed
      handleLessonCompletion();
    }
  };

  // Move to previous stage
  const moveToPreviousStage = () => {
    if (currentStageIndex > 0) {
      const prevIndex = currentStageIndex - 1;
      const prevStage = stages[prevIndex];
      setCurrentStageIndex(prevIndex);
      setCurrentStage(prevStage);
      initializeStage(prevStage);
    }
  };

  // Handle lesson completion
  const handleLessonCompletion = async () => {
    if (isCompletingLesson) return;

    setIsCompletingLesson(true);
    try {
      // Calculate total time spent
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      // Calculate final score from sum of all stage scores
      const finalScore = Math.round(score);

      // Calculate total attempts across all stages
      const totalAttempts = Object.values(stageProgress).reduce((sum, p) => sum + (p.attempts || 0), 0);

      console.log('📊 LESSON COMPLETION DEBUG:', {
        finalScore,
        timeSpent,
        totalAttempts,
        totalStages: stages.length,
        stageProgress
      });

      logger.info('Completing interactive lesson', {
        lessonId: lesson.id,
        finalScore,
        timeSpent,
        totalAttempts,
        totalStages: stages.length
      });

      const requestPayload = {
        score: finalScore,
        time_spent_seconds: timeSpent,
        attempts: Math.max(1, totalAttempts)
      };

      console.log('📤 Sending to backend:', requestPayload);

      const response = await api.post(`/tutorial/lessons/${lesson.id}/complete`, requestPayload);

      console.log('📥 Backend response:', response.data);
      logger.info('Lesson completion response', response.data);

      onLessonComplete && onLessonComplete(response.data.data);
    } catch (error) {
      console.error('❌ Error completing lesson:', error);
      console.error('Error details:', error.response?.data);
      setFeedback({
        type: 'error',
        message: 'Failed to complete lesson. Please try again.',
        success: false
      });
    } finally {
      setIsCompletingLesson(false);
    }
  };

  // Request hint
  const requestHint = async () => {
    if (!currentStage || !lesson.interactive_config?.enable_hints || isRequestingHint) return;

    setIsRequestingHint(true);
    try {
      const response = await api.post(`/tutorial/lessons/${lesson.id}/hint`, {
        stage_id: currentStage.id,
        hint_index: hintIndex
      });

      setCurrentHint(response.data.data.hint);
      setShowHint(true);
      setHintIndex(response.data.data.hint_index + 1);

      // Small score penalty for using hints
      setScore(prev => Math.max(0, prev - 2));
    } catch (error) {
      console.error('Error getting hint:', error);
      setFeedback({
        type: 'error',
        message: 'Failed to get hint. Please try again.',
        success: false
      });
    } finally {
      setIsRequestingHint(false);
    }
  };

  // Reset current stage
  const resetStage = async () => {
    if (!currentStage || isResetting) return;

    setIsResetting(true);
    try {
      const response = await api.post(`/tutorial/lessons/${lesson.id}/reset-stage`, {
        stage_id: currentStage.id
      });

      const resetStage = response.data.data.stage;

      // Update the current stage with fresh data
      setCurrentStage(resetStage);

      // Update stage progress - increment attempts on reset
      const stageId = resetStage.id;
      const prevProgress = stageProgress[stageId] || { attempts: 0, best_score: 0, is_completed: false };
      const newAttempts = (prevProgress.attempts || 0) + 1;

      const totalStages = stages.length;
      const baseScore = totalStages > 0 ? 100 / totalStages : 0;
      const stageScore = newAttempts >= 3 ? 0 : prevProgress.best_score;

      setStageProgress(prev => ({
        ...prev,
        [stageId]: {
          ...prevProgress,
          attempts: newAttempts,
          best_score: stageScore,
          is_completed: resetStage.is_demonstration || false
        }
      }));

      // Reinitialize the stage
      initializeStage(resetStage);
      setMoveHistory([]);
      setFeedback(null);
      setShowHint(false);
    } catch (error) {
      console.error('Error resetting stage:', error);
      setFeedback({
        type: 'error',
        message: 'Failed to reset stage. Please try again.',
        success: false
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage = stages.length > 0
    ? (Object.values(stageProgress).filter(p => p.is_completed).length / stages.length) * 100
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading interactive lesson...</span>
      </div>
    );
  }

  if (!currentStage) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2 text-gray-800">🎮 Interactive Lesson</h3>
          <p className="text-gray-700 font-medium">No stages available for this interactive lesson.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Stage Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2 text-gray-800">
              {currentStage.title || `Stage ${currentStageIndex + 1}`}
            </h3>
            <p className="text-gray-700 font-medium">
              {currentStage.instruction_text}
            </p>
          </div>

          <div className="text-right ml-6">
            <div className="text-sm font-semibold text-gray-600 mb-1">Score</div>
            <div className="text-2xl font-bold text-blue-600">{Math.round(progressPercentage)}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="text-sm text-gray-600 mt-1">
          Stage {currentStageIndex + 1} of {stages.length} • {Math.round(progressPercentage)}% Complete
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chess Board */}
          <div className="order-2 lg:order-1">
            {chessGame && (
              <div className="flex flex-col items-center">
                <div className="relative" style={{ width: `${boardSize}px`, height: `${boardSize}px` }}>
                  <ChessBoard
                    game={chessGame}
                    boardOrientation={currentStage.orientation || 'white'}
                    playerColor={currentStage.orientation || 'white'}
                    isReplayMode={false}
                    allowAllMoves={false}
                    onDrop={handleInteractiveMove}
                    moveFrom={moveFrom}
                    setMoveFrom={setMoveFrom}
                    rightClickedSquares={rightClickedSquares}
                    setRightClickedSquares={setRightClickedSquares}
                    moveSquares={moveSquares}
                    setMoveSquares={setMoveSquares}
                    lessonArrows={[]}
                    lessonHighlights={[]}
                  />

                  {/* Visual aids overlay - positioned absolutely over the board */}
                  <VisualAidsOverlay
                    visualAids={visualAids}
                    boardSize={boardSize}
                  />
                </div>

                {/* Visual aids hint */}
                {visualAids.arrows && visualAids.arrows.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600 text-center">
                    💡 Follow the suggested arrows on the board
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls and Feedback */}
          <div className="order-1 lg:order-2 space-y-4">
            {/* Feedback */}
            {feedback && (
              <FeedbackCard
                feedback={feedback}
                onDismiss={() => setFeedback(null)}
                autoDismiss={false}
              />
            )}

            {/* Hint */}
            {showHint && currentHint && (
              <FeedbackCard
                feedback={{
                  type: 'hint',
                  message: currentHint,
                  subtext: `Hint ${hintIndex}/${currentStage.hints?.length || 0}`
                }}
                onDismiss={() => setShowHint(false)}
                autoDismiss={false}
              />
            )}

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Stage Attempts</div>
                <div className="text-xl font-bold text-gray-800">
                  {stageProgress[currentStage.id]?.attempts || 0}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">Stage Progress</div>
                <div className="text-xl font-bold text-gray-800">
                  {currentStageIndex + 1}/{stages.length}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={requestHint}
                disabled={!lesson.interactive_config?.enable_hints || processingMove || isRequestingHint}
                className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRequestingHint ? '⏳ Loading Hint...' : '💡 Get Hint (-2 points)'}
              </button>

              <button
                onClick={resetStage}
                disabled={processingMove || isResetting}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isResetting ? '⏳ Resetting...' : '🔄 Reset Stage'}
              </button>
            </div>

            {/* Stage Navigation */}
            <div className="flex space-x-2">
              <button
                onClick={moveToPreviousStage}
                disabled={currentStageIndex === 0 || processingMove || isResetting}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous Stage
              </button>

              <button
                onClick={moveToNextStage}
                disabled={
                  !(stageProgress[currentStage.id]?.is_completed ||
                    (stageProgress[currentStage.id]?.attempts || 0) >= 3) ||
                  processingMove ||
                  isCompletingLesson
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCompletingLesson && currentStageIndex === stages.length - 1
                  ? '⏳ Completing...'
                  : currentStageIndex === stages.length - 1
                    ? (stageProgress[currentStage.id]?.attempts >= 3 && !stageProgress[currentStage.id]?.is_completed
                        ? 'Complete Lesson (0%)'
                        : 'Complete Lesson')
                    : 'Next Stage →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInteractiveLesson;
