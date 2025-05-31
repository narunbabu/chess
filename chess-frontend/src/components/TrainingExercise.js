import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { getExercise } from '../utils/trainingExercises';

const TrainingExercise = () => {
  const { level, id } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [moveFrom, setMoveFrom] = useState('');
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showSolution, setShowSolution] = useState(false);

  // Initialize the exercise
  useEffect(() => {
    const exerciseData = getExercise(level, Number(id));
    if (!exerciseData) {
      navigate('/training');
      return;
    }
    
    setExercise(exerciseData);
    const newGame = new Chess(exerciseData.position);
    setGame(newGame);
    setMessage('');
    setMessageType('');
    setShowSolution(false);
  }, [level, id, navigate]);

  // Function to get possible moves for a piece
  function getMoveOptions(square) {
    if (!game) return {};
    
    const moves = game.moves({
      square,
      verbose: true
    });
    
    if (moves.length === 0) {
      setMoveFrom('');
      return {};
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
    return newSquares;
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
      const moveString = sourceSquare + targetSquare;
      if (exercise.solution.includes(moveString)) {
        setMessage(exercise.successMessage);
        setMessageType('success');
      } else {
        setMessage('That\'s not the correct move. Try again or check the solution.');
        setMessageType('error');
        // Undo the move
        game.undo();
        setGame(new Chess(game.fen()));
        return false;
      }
      
      setGame(new Chess(game.fen()));
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
      const move = {
        from: moveFrom,
        to: square,
        promotion: 'q' // always promote to queen for simplicity
      };
      
      try {
        const result = onDrop(moveFrom, square);
        setMoveFrom('');
        return result;
      } catch (e) {
        setMoveFrom('');
        return false;
      }
    }

    // Get piece on the square
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setMoveFrom(square);
      return true;
    }
    
    setMoveFrom('');
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
    
    const newGame = new Chess(exercise.position);
    setGame(newGame);
    setMessage('');
    setMessageType('');
    setMoveFrom('');
    setRightClickedSquares({});
    setShowSolution(false);
  };

  // Show the solution
  const revealSolution = () => {
    if (!exercise || !game) return;
    
    setShowSolution(true);
    
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
    ...(moveFrom ? getMoveOptions(moveFrom) : {}),
    ...rightClickedSquares
  };

  if (!exercise || !game) {
    return <div>Loading exercise...</div>;
  }

  return (
    <div className="chess-game">
      <h2>{exercise.title}</h2>
      
      <div className="exercise-instructions">
        <p>{exercise.description}</p>
      </div>
      
      <div className="board-container">
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
        <div className={`${messageType}-message`}>
          {message}
        </div>
      )}
      
      <div className="game-controls">
        <button onClick={resetExercise}>Reset Exercise</button>
        <button onClick={revealSolution}>Show Solution</button>
        <button onClick={goBack}>Back to Training Hub</button>
      </div>
    </div>
  );
};

export default TrainingExercise;