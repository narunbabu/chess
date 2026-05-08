import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { getExercise } from '../utils/trainingExercises';
import { useSubscription } from '../contexts/SubscriptionContext';
import { canAccessTier, getSkillBand, getSubscriptionLabel } from '../constants/learningCurriculum';
import api from '../services/api';

const TrainingExercise = () => {
  const { level, id } = useParams();
  const navigate = useNavigate();
  const { currentTier } = useSubscription();
  
  const [game, setGame] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [moveFrom, setMoveFrom] = useState('');
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [optionSquares, setOptionSquares] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Initialize the exercise
  useEffect(() => {
    let cancelled = false;

    const loadExercise = async () => {
      let exerciseData = null;

      try {
        const response = await api.get(`/training/drills/${id}`);
        exerciseData = normalizeServerExercise(response.data?.data);
      } catch (error) {
        if (error.response?.status === 403) {
          navigate('/pricing');
          return;
        }
        exerciseData = getExercise(level, id);
      }

      if (cancelled) {
        return;
      }

      if (!exerciseData) {
        navigate('/training');
        return;
      }

      setExercise(exerciseData);
      const newGame = new Chess(exerciseData.position || exerciseData.position_fen);
      setGame(newGame);
      setMessage('');
      setMessageType('');
      setMoveFrom('');
      setOptionSquares({});
      setRightClickedSquares({});
    };

    loadExercise();

    return () => {
      cancelled = true;
    };
  }, [level, id, navigate]);

  // Function to get possible moves for a piece
  function getMoveOptions(square) {
    if (!game) {
      setOptionSquares({});
      setMoveFrom('');
      return;
    }

    const moves = game.moves({
      square,
      verbose: true
    });

    if (moves.length === 0) {
      setMoveFrom('');
      setOptionSquares({});
      return;
    }

    const newSquares = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to).color !== game.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };
    setMoveFrom(square);
    setOptionSquares(newSquares);
  }

  // Handle piece drop (move)
  function onDrop(sourceSquare, targetSquare) {
    if (!game || !exercise) return false;
    
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // always promote to queen for simplicity
      });

      if (move === null) return false;
      
      // Check if the move is the solution
      // Compare using both coordinate format (e.g., "g7g8") and with promotion (e.g., "g7g8=Q")
      const moveString = sourceSquare + targetSquare;
      const moveWithPromotion = move.promotion ? `${moveString}=${move.promotion.toUpperCase()}` : moveString;
      const solution = exercise.solution || [];
      const isCorrect = solution.includes(moveString) || solution.includes(moveWithPromotion);

      if (exercise.source === 'server') {
        submitAttempt(exercise.id, [moveString], isCorrect);
      }

      if (isCorrect) {
        setMessage(exercise.successMessage);
        setMessageType('success');
      } else {
        setMessage('That\'s not the correct move. Try again or check the solution.');
        setMessageType('error');
        // Undo the move
        game.undo();
        setGame(new Chess(game.fen()));
        setOptionSquares({});
        return false;
      }
      
      setGame(new Chess(game.fen()));
      setOptionSquares({});
      return true;
    } catch (e) {
      return false;
    }
  }

  // Handle piece move
  function onSquareClick(square) {
    if (!game) return false;

    // Reset clicked squares
    setRightClickedSquares({});

    // If square already selected, move the piece
    if (moveFrom && moveFrom !== square) {
      try {
        const result = onDrop(moveFrom, square);
        setMoveFrom('');
        setOptionSquares({});
        return result;
      } catch (e) {
        setMoveFrom('');
        setOptionSquares({});
        return false;
      }
    }

    // Get piece on the square
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      getMoveOptions(square);
      return true;
    }

    setMoveFrom('');
    setOptionSquares({});
    return false;
  }

  // Handle right-click to mark squares
  function onSquareRightClick(square) {
    const color = "rgba(0, 0, 255, 0.4)";
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]:
        rightClickedSquares[square] && rightClickedSquares[square].backgroundColor === color
          ? undefined
          : { backgroundColor: color }
    });
  }

  // Reset exercise
  const resetExercise = () => {
    if (!exercise) return;

    const newGame = new Chess(exercise.position || exercise.position_fen);
    setGame(newGame);
    setMessage('');
    setMessageType('');
    setMoveFrom('');
    setRightClickedSquares({});
    setOptionSquares({});
  };

  // Show the solution
  const revealSolution = () => {
    if (!exercise || !game) return;
    
    // Highlight the solution move
    const [from, to] = exercise.solution[0].match(/.{1,2}/g) || [];
    if (from && to) {
      setRightClickedSquares({
        [from]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' },
        [to]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' }
      });
    }
    
    setMessage(`Solution: Move from ${from} to ${to}`);
    setMessageType('info');
  };

  // Go back to training hub
  const goBack = () => {
    navigate('/training');
  };

  // Combine all square styles
  const customSquareStyles = {
    ...optionSquares,
    ...rightClickedSquares
  };

  if (!exercise || !game) {
    return <div className="p-6 min-h-screen text-white flex items-center justify-center">Loading exercise...</div>;
  }

  const isLocked = !canAccessTier(currentTier, exercise.requiredTier);
  const skillBand = getSkillBand(exercise.skillBand || exercise.skill_band);

  if (isLocked) {
    return (
      <div className="p-6 min-h-screen text-white flex items-center justify-center" style={{ background: '#262421' }}>
        <div className="max-w-lg w-full bg-[#312e2b] border border-[#3d3a37] rounded-lg p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-[#e8a93e] font-bold mb-3">
            {getSubscriptionLabel(exercise.requiredTier)} drill
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">{exercise.title}</h1>
          <p className="text-[#bababa] mb-5">{exercise.description}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={goBack} className="bg-[#3d3a37] text-[#bababa] font-bold py-2 px-4 rounded-lg">
              Back
            </button>
            <button onClick={() => navigate('/pricing')} className="bg-[#e8a93e] text-[#1f1f1d] font-bold py-2 px-4 rounded-lg">
              View plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chess-game p-6 min-h-screen text-white flex flex-col items-center" style={{ background: '#262421' }}>
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col items-center">
          <div className="text-center mb-4">
            <div className="flex justify-center gap-2 flex-wrap mb-3">
              <span className="text-xs font-bold px-2 py-1 rounded bg-[#312e2b] border border-[#3d3a37] text-[#bababa]">
                {skillBand?.label || level}
              </span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-[#312e2b] border border-[#3d3a37] text-[#81b64c]">
                {exercise.theme}
              </span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-[#312e2b] border border-[#3d3a37] text-[#e8a93e]">
                {getSubscriptionLabel(exercise.requiredTier)}
              </span>
            </div>
            <h2 className="text-3xl font-bold mb-2 text-white">{exercise.title}</h2>
          </div>
      
          <div className="exercise-instructions bg-[#312e2b] border border-[#3d3a37] rounded-lg p-4 mb-6 max-w-2xl text-center">
            <p className="text-[#bababa] m-0">{exercise.description}</p>
          </div>
      
          <div className="board-container w-full max-w-lg mx-auto mb-6">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              onSquareRightClick={onSquareRightClick}
              customSquareStyles={customSquareStyles}
              boardOrientation="white"
            />
          </div>
      
          {message && (
            <div className={`message-box ${messageType === 'success' ? 'bg-success' : messageType === 'error' ? 'bg-error' : 'bg-info'} p-3 rounded-lg max-w-2xl text-center mb-6 text-white`}>
              {message}
            </div>
          )}
      
          <div className="game-controls flex gap-4 flex-wrap justify-center">
            <button onClick={resetExercise} className="control-button bg-accent hover:bg-accent-600 text-white font-bold py-2 px-4 rounded-lg">Reset</button>
            <button onClick={revealSolution} className="control-button bg-primary hover:bg-primary-600 text-white font-bold py-2 px-4 rounded-lg">Solution</button>
            <button onClick={goBack} className="control-button bg-secondary hover:bg-secondary-600 text-white font-bold py-2 px-4 rounded-lg">Back to Hub</button>
          </div>
        </div>

        <aside className="bg-[#312e2b] border border-[#3d3a37] rounded-lg p-5 h-fit">
          <h3 className="text-lg font-bold text-white mb-2">Drill focus</h3>
          <p className="text-[#bababa] text-sm mb-4">{exercise.objective}</p>

          {exercise.thinkingSteps?.length > 0 && (
            <div className="mb-5">
              <div className="text-xs uppercase tracking-wider text-[#8b8987] font-bold mb-2">Thinking steps</div>
              <ol className="space-y-2 text-sm text-[#bababa] pl-5 list-decimal">
                {exercise.thinkingSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {exercise.hints?.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-[#8b8987] font-bold mb-2">Hints</div>
              <div className="space-y-2">
                {exercise.hints.map((hint) => (
                  <div key={hint} className="text-sm text-[#bababa] bg-[#262421] border border-[#3d3a37] rounded p-2">
                    {hint}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default TrainingExercise;

const normalizeServerExercise = (drill) => {
  if (!drill) {
    return null;
  }

  return {
    id: drill.slug,
    title: drill.title,
    description: drill.description,
    position: drill.position_fen,
    solution: [
      ...(drill.solution || []),
      ...((drill.accepted_alternatives || []).flat ? (drill.accepted_alternatives || []).flat() : []),
    ],
    successMessage: drill.explanation || 'Correct. Nice work.',
    skillBand: drill.skill_band,
    requiredTier: drill.required_tier,
    type: drill.drill_type,
    theme: drill.theme,
    objective: drill.subtheme || drill.explanation || 'Build reliable chess habits through deliberate repetition.',
    hints: drill.hints || [],
    thinkingSteps: drill.thinking_steps || [],
    source: 'server',
  };
};

const submitAttempt = async (slug, solution, isCorrect) => {
  try {
    await api.post(`/training/drills/${slug}/attempt`, {
      solution,
      time_spent_seconds: 0,
      hints_used: 0,
    });
  } catch (error) {
    if (isCorrect) {
      console.warn('[TrainingExercise] Drill solved locally, but backend progress was not saved.', error);
    }
  }
};
