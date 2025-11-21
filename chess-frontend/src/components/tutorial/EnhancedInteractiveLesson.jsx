import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../play/ChessBoard';
import FeedbackCard from './FeedbackCard';
import VisualAidsOverlay from './VisualAidsOverlay';
import api from '../../services/api';

const EnhancedInteractiveLesson = ({ lesson, user, onLessonComplete }) => {
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
  const [attempts, setAttempts] = useState(0);
  const [processingMove, setProcessingMove] = useState(false);
  const [visualAids, setVisualAids] = useState({ arrows: [], highlights: [] });
  const [stageProgress, setStageProgress] = useState({});

  // Initialize the lesson
  useEffect(() => {
    loadInteractiveLesson();
  }, [lesson]);

  // Load interactive lesson data
  const loadInteractiveLesson = async () => {
    try {
      setLoading(true);
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
      if (lesson.allow_invalid_fen) {
        // For lessons that allow invalid FEN (like Pawn Wars without Kings)
        game = new Chess();
        // We'll need to manually set up the board position
        // This is a simplified approach - in production, you'd want proper FEN parsing
        if (stage.initial_fen && stage.initial_fen !== 'start') {
          // For now, fall back to starting position for invalid FENs
          console.log('Using fallback position for invalid FEN');
        }
      } else {
        game = stage.initial_fen && stage.initial_fen !== 'start'
          ? new Chess(stage.initial_fen)
          : new Chess();
      }

      setChessGame(game);
      setVisualAids(stage.visual_aids || { arrows: [], highlights: [] });
      setFeedback(null);
      setShowHint(false);
      setCurrentHint('');
      setHintIndex(0);
    } catch (error) {
      console.error('Error initializing stage:', error);
      // Fallback to default position
      setChessGame(new Chess());
    }
  }, [lesson.allow_invalid_fen]);

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

        // Update local game state
        setChessGame(tempGame);
        setMoveHistory(prev => [...prev, { move, validation, timestamp: Date.now() }]);
        setAttempts(prev => prev + 1);

        // Update stage progress
        setStageProgress(prev => ({
          ...prev,
          [currentStage.id]: {
            ...prev[currentStage.id],
            attempts: (prev[currentStage.id]?.attempts || 0) + 1
          }
        }));

        // Show feedback
        setFeedback({
          type: validation.feedback_type,
          message: validation.feedback,
          success: validation.success,
          scoreChange: validation.score_change
        });

        // Update score
        if (validation.score_change) {
          setScore(prev => Math.max(0, Math.min(100, prev + validation.score_change)));
        }

        // Handle successful completion
        if (validation.success) {
          // Mark stage as completed
          setStageProgress(prev => ({
            ...prev,
            [currentStage.id]: {
              ...prev[currentStage.id],
              is_completed: true,
              best_score: Math.max(prev[currentStage.id]?.best_score || 0, score + (validation.score_change || 0))
            }
          }));

          // Auto-reset to next stage if configured
          if (currentStage.auto_reset_on_success) {
            setTimeout(() => {
              moveToNextStage();
            }, currentStage.auto_reset_delay_ms || 1500);
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
  }, [currentStage, chessGame, lesson.id, score, processingMove]);

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
    try {
      const response = await api.post(`/tutorial/lessons/${lesson.id}/complete`, {
        score: score,
        time_spent_seconds: Math.floor(moveHistory.reduce((total, move) => total + (move.timeSpentMs || 0), 0) / 1000),
        attempts: attempts
      });

      onLessonComplete && onLessonComplete(response.data.data);
    } catch (error) {
      console.error('Error completing lesson:', error);
    }
  };

  // Request hint
  const requestHint = async () => {
    if (!currentStage || !lesson.interactive_config?.enable_hints) return;

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
    }
  };

  // Reset current stage
  const resetStage = async () => {
    if (!currentStage) return;

    try {
      await api.post(`/tutorial/lessons/${lesson.id}/reset-stage`, {
        stage_id: currentStage.id
      });

      // Reinitialize current stage
      initializeStage(currentStage);
      setMoveHistory([]);
      setFeedback(null);
      setShowHint(false);
    } catch (error) {
      console.error('Error resetting stage:', error);
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
            <div className="text-2xl font-bold text-blue-600">{Math.round(score)}%</div>
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
              <div className="relative">
                <ChessBoard
                  game={chessGame}
                  boardOrientation={currentStage.orientation || 'white'}
                  playerColor={currentStage.orientation || 'white'}
                  isReplayMode={false}
                  allowAllMoves={lesson.interactive_config?.allow_all_moves ?? true}
                  onDrop={handleInteractiveMove}
                  moveFrom=""
                  setMoveFrom={() => {}}
                  rightClickedSquares={{}}
                  setRightClickedSquares={() => {}}
                  moveSquares={visualAids.highlights?.reduce((acc, square) => {
                    acc[square] = { backgroundColor: 'rgba(59, 130, 246, 0.3)' };
                    return acc;
                  }, {}) || {}}
                  setMoveSquares={() => {}}
                  lessonArrows={visualAids.arrows?.map(arrow => ({
                    from: arrow.from,
                    to: arrow.to,
                    color: arrow.color || 'rgba(255, 0, 0, 0.7)'
                  })) || []}
                  lessonHighlights={visualAids.highlights?.map(square => ({
                    square: square,
                    type: 'move'
                  })) || []}
                />

                {/* Visual aids overlay */}
                <VisualAidsOverlay
                  visualAids={visualAids}
                  boardSize={480}
                />

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
                <div className="text-sm text-gray-600">Attempts</div>
                <div className="text-xl font-bold text-gray-800">{attempts}</div>
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
                disabled={!lesson.interactive_config?.enable_hints || processingMove}
                className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                💡 Get Hint (-2 points)
              </button>

              <button
                onClick={resetStage}
                disabled={processingMove}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                🔄 Reset Stage
              </button>
            </div>

            {/* Stage Navigation */}
            <div className="flex space-x-2">
              <button
                onClick={moveToPreviousStage}
                disabled={currentStageIndex === 0 || processingMove}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous Stage
              </button>

              <button
                onClick={moveToNextStage}
                disabled={!stageProgress[currentStage.id]?.is_completed || processingMove}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {currentStageIndex === stages.length - 1 ? 'Complete Lesson' : 'Next Stage →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedInteractiveLesson;