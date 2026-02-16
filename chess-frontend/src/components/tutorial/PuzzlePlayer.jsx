import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '../play/ChessBoard';
import FeedbackCard from './FeedbackCard';
import { SCORING, TIMING } from '../../constants/tutorialConstants';

const PuzzlePlayer = ({ puzzles, currentStep, onSolved, onHintUsed, score, attempts }) => {
  const [chessGame, setChessGame] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [hintIndex, setHintIndex] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [squareStyles, setSquareStyles] = useState({});
  const [moveFrom, setMoveFrom] = useState('');
  const [moveSquares, setMoveSquares] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [puzzleStatus, setPuzzleStatus] = useState('playing'); // 'playing' | 'correct' | 'incorrect'
  const [showHintButton, setShowHintButton] = useState(false);
  const timeoutRef = useRef(null);

  const puzzle = puzzles[currentStep];

  // Initialize/reset when puzzle changes
  useEffect(() => {
    if (!puzzle?.fen) return;

    // Clear any pending timeouts from previous puzzle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      const game = new Chess(puzzle.fen);
      setChessGame(game);

      // Auto-detect board orientation from FEN turn field
      const turn = puzzle.fen.split(' ')[1];
      setBoardOrientation(turn === 'b' ? 'black' : 'white');
    } catch (error) {
      console.error('Invalid FEN in puzzle:', error, 'FEN:', puzzle.fen);
      setChessGame(new Chess());
      setBoardOrientation('white');
    }

    // Reset all puzzle state for the new puzzle
    setHintIndex(-1);
    setFeedback(null);
    setSquareStyles({});
    setMoveFrom('');
    setMoveSquares({});
    setRightClickedSquares({});
    setPuzzleStatus('playing');
    setShowHintButton(false);
  }, [currentStep, puzzle?.fen]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const resetPosition = useCallback(() => {
    if (!puzzle?.fen) return;
    try {
      const game = new Chess(puzzle.fen);
      setChessGame(game);
    } catch (error) {
      console.error('Error resetting puzzle position:', error);
    }
    setSquareStyles({});
    setMoveFrom('');
    setMoveSquares({});
  }, [puzzle?.fen]);

  const highlightSquares = useCallback((source, target, color) => {
    const bgColor = color === 'green'
      ? 'rgba(0, 180, 0, 0.45)'
      : 'rgba(220, 38, 38, 0.45)';
    setSquareStyles({
      [source]: { backgroundColor: bgColor },
      [target]: { backgroundColor: bgColor },
    });
  }, []);

  const handleShowHint = useCallback(() => {
    const hints = puzzle?.hints || [];
    const nextIndex = hintIndex + 1;
    if (nextIndex >= hints.length) return;

    setHintIndex(nextIndex);
    setFeedback({
      type: 'hint',
      message: hints[nextIndex],
    });
    onHintUsed();
  }, [puzzle?.hints, hintIndex, onHintUsed]);

  const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
    if (puzzleStatus !== 'playing' || !chessGame || !puzzle?.solution?.length) return false;

    // Validate the move using a temporary Chess instance
    const tempGame = new Chess(chessGame.fen());
    const moveResult = tempGame.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (!moveResult) return false; // Illegal move — piece snaps back

    // Compare chess.js SAN output against stored solution SAN
    const expectedSan = puzzle.solution[0];
    const isCorrect = moveResult.san === expectedSan;

    if (isCorrect) {
      // Keep the correct move visible on the board
      setChessGame(tempGame);
      highlightSquares(sourceSquare, targetSquare, 'green');
      setPuzzleStatus('correct');
      setFeedback({
        type: 'success',
        message: 'Correct! Well done!',
        scoreChange: Math.round(100 / puzzles.length),
      });
      setMoveFrom('');
      setMoveSquares({});

      // Delay advancing so the player sees the green highlight
      timeoutRef.current = setTimeout(() => {
        onSolved(true);
      }, TIMING.AUTO_RESET_DEFAULT_DELAY);
    } else {
      // Show red highlight, then reset after a short delay
      highlightSquares(sourceSquare, targetSquare, 'red');
      setPuzzleStatus('incorrect');
      setShowHintButton(true);

      // Auto-show first hint on first wrong attempt (no button penalty)
      const hints = puzzle?.hints || [];
      if (hintIndex === -1 && hints.length > 0) {
        setHintIndex(0);
        setFeedback({
          type: 'error',
          message: hints[0],
          scoreChange: -(SCORING.WRONG_ANSWER_PENALTY * 2),
        });
      } else if (hintIndex + 1 < hints.length) {
        // Auto-advance to next hint on subsequent wrong attempts
        const nextIdx = hintIndex + 1;
        setHintIndex(nextIdx);
        setFeedback({
          type: 'error',
          message: hints[nextIdx],
          scoreChange: -(SCORING.WRONG_ANSWER_PENALTY * 2),
        });
      } else {
        setFeedback({
          type: 'error',
          message: hints.length > 0 ? hints[hints.length - 1] : 'Not quite right. Try again!',
          scoreChange: -(SCORING.WRONG_ANSWER_PENALTY * 2),
        });
      }

      setMoveFrom('');
      setMoveSquares({});

      // Reset position after showing red highlight
      timeoutRef.current = setTimeout(() => {
        resetPosition();
        setPuzzleStatus('playing');
      }, 1200);

      onSolved(false);
    }

    return true;
  }, [puzzleStatus, chessGame, puzzle, puzzles.length, highlightSquares, hintIndex, resetPosition, onSolved]);

  const handleReset = useCallback(() => {
    resetPosition();
    setPuzzleStatus('playing');
    setFeedback(null);
    setSquareStyles({});
  }, [resetPosition]);

  if (!puzzle) return null;

  const hints = puzzle.hints || [];
  const allHintsShown = hintIndex >= hints.length - 1;
  const playerColor = boardOrientation;

  // Combine highlight styles with legal-move dots
  const combinedMoveSquares = {
    ...squareStyles,
    ...moveSquares,
  };

  return (
    <div className="bg-[#312e2b] rounded-2xl p-8 shadow-xl border-2 border-[#3d3a37]">
      {/* Puzzle header */}
      <div className="mb-6 bg-[#262421] p-6 rounded-xl border-2 border-[#3d3a37]">
        <h3 className="text-2xl font-bold mb-3 text-white">
          🧩 Puzzle {currentStep + 1} of {puzzles.length}
        </h3>
        {puzzle.objective && (
          <p className="text-[#bababa] font-semibold text-lg">{puzzle.objective}</p>
        )}
        <p className="text-[#8b8987] font-medium mt-1">
          {boardOrientation === 'white' ? 'White' : 'Black'} to move
        </p>
      </div>

      {/* Chess board */}
      <div className="mb-6 bg-[#262421] p-6 rounded-xl border-2 border-[#3d3a37]">
        {chessGame && (
          <div className="flex justify-center items-center">
            <div style={{ width: '500px', height: '500px' }}>
              <ChessBoard
                game={chessGame}
                boardOrientation={boardOrientation}
                playerColor={playerColor}
                isReplayMode={puzzleStatus !== 'playing'}
                onDrop={onPieceDrop}
                moveFrom={moveFrom}
                setMoveFrom={setMoveFrom}
                rightClickedSquares={rightClickedSquares}
                setRightClickedSquares={setRightClickedSquares}
                moveSquares={combinedMoveSquares}
                setMoveSquares={setMoveSquares}
              />
            </div>
          </div>
        )}
      </div>

      {/* Feedback card */}
      {feedback && (
        <div className="mb-4">
          <FeedbackCard
            feedback={feedback}
            onDismiss={() => setFeedback(null)}
            autoDismiss={feedback.type === 'success'}
          />
        </div>
      )}

      {/* Score & attempts display */}
      {attempts > 0 && (
        <div className="rounded-lg p-4 mb-4 border-2" style={{
          background: score >= 90 ? 'rgba(78, 120, 55, 0.3)' :
                     score >= 70 ? 'rgba(129, 182, 76, 0.2)' :
                     'rgba(231, 76, 60, 0.2)',
          borderColor: score >= 90 ? '#81b64c' : score >= 70 ? '#81b64c' : '#e74c3c',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
        }}>
          <div className="text-center">
            <div className="font-bold text-lg mb-2" style={{
              color: score >= 90 ? '#a3d160' : score >= 70 ? '#81b64c' : '#fa6a5b'
            }}>
              {score >= 90 ? '🎯 Excellent!' : score >= 70 ? '👍 Good Try!' : '🎯 Keep Trying!'}
            </div>
            <div className="text-sm">
              Attempts: {attempts} | Score: {Math.round(score)}%
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex space-x-4">
        {showHintButton && (
          <button
            onClick={handleShowHint}
            disabled={allHintsShown}
            className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: allHintsShown ? '#9ca3af' : 'var(--tutorial-xp-gradient)',
              boxShadow: allHintsShown ? 'none' : '0 4px 15px rgba(251, 191, 36, 0.3)'
            }}
          >
            💡 Show Hint (-5 pts)
            {hints.length > 0 && ` (${Math.min(hintIndex + 1, hints.length)}/${hints.length})`}
          </button>
        )}
        <button
          onClick={handleReset}
          disabled={puzzleStatus !== 'playing'}
          className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: puzzleStatus !== 'playing' ? '#9ca3af' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            boxShadow: puzzleStatus !== 'playing' ? 'none' : '0 4px 15px rgba(100, 116, 139, 0.3)'
          }}
        >
          🔄 Reset Position
        </button>
      </div>
    </div>
  );
};

export default PuzzlePlayer;
