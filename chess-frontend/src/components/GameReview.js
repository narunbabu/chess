// src/components/GameReview.js
import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLocation, useNavigate } from "react-router-dom";

const GameReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  let gameHistory = location.state?.gameHistory;
  if (!gameHistory) {
    const stored = localStorage.getItem('lastGameHistory');
    gameHistory = stored ? JSON.parse(stored) : { moves: [] };
  }
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const timerRef = useRef(null);
  const boardBoxRef = useRef(null);
  const [boardSize, setBoardSize] = useState(400);

  useEffect(() => {
    // Reset the board to the initial position when the game history is loaded.
    const newGame = new Chess();
    setGame(newGame);
    setCurrentMoveIndex(0);
  }, [gameHistory]);

  useEffect(() => {
    if (!boardBoxRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const vh = window.innerHeight;
      const newSize = Math.floor(Math.min(width, vh - 30, height));
      setBoardSize(newSize);
    });
    ro.observe(boardBoxRef.current);
    return () => ro.disconnect();
  }, []);

  const playMoves = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentMoveIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        // Ensure moves array exists and has the entry
        if (gameHistory && Array.isArray(gameHistory.moves) && nextIndex < gameHistory.moves.length) {
          const moveEntry = gameHistory.moves[nextIndex];
          // Ensure the move object and SAN string exist
          if (moveEntry && moveEntry.move && moveEntry.move.san) {
            const moveSAN = moveEntry.move.san;
            const result = game.move(moveSAN); // Use SAN string
            if (!result) {
              console.error(`Invalid replay move in playMoves (Index ${nextIndex}):`, moveSAN, 'FEN:', game.fen());
              clearInterval(timerRef.current); // Stop on error
              return prevIndex; // Don't advance index on error
            }
            setGame(new Chess(game.fen())); // update board state
            return nextIndex; // Advance index
          } else {
            console.warn(`Skipping malformed move entry at index ${nextIndex} in playMoves`);
            return nextIndex; // Skip malformed entry but continue replay
          }
        } else {
          clearInterval(timerRef.current);
          return prevIndex;
        }
      });
    }, 1000); // Adjust interval as needed
  };

  const pauseMoves = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const stepForward = () => {
    // Ensure moves array exists and we are not at the end
    if (gameHistory && Array.isArray(gameHistory.moves) && currentMoveIndex < gameHistory.moves.length) {
      const nextIndex = currentMoveIndex; // Index of the move TO BE applied
      const moveEntry = gameHistory.moves[nextIndex];
       // Ensure the move object and SAN string exist
      if (moveEntry && moveEntry.move && moveEntry.move.san) {
        const moveSAN = moveEntry.move.san;
        const result = game.move(moveSAN); // Use SAN string
        if (!result) {
          console.error(`Invalid replay move in stepForward (Index ${nextIndex}):`, moveSAN, 'FEN:', game.fen());
          // Don't update state if move failed
        } else {
          setGame(new Chess(game.fen())); // Update board state
          setCurrentMoveIndex(nextIndex + 1); // Advance index only if successful
        }
      } else {
         console.warn(`Skipping malformed move entry at index ${nextIndex} in stepForward`);
         // Optionally advance index even if malformed: setCurrentMoveIndex(nextIndex + 1);
      }
    }
  };

  const stepBackward = () => {
    if (currentMoveIndex <= 0) return; // Cannot go back from the start

    const targetIndex = currentMoveIndex - 1; // The index of the move we want to arrive *at*
    const newGame = new Chess(); // Start from initial position

    // Replay moves from the beginning up to *before* the target index
    // Note: gameHistory[0] is the initial state, actual moves start at index 1
    for (let i = 1; i < targetIndex; i++) {
       const moveEntry = gameHistory.moves[i];
       if (moveEntry && moveEntry.move && moveEntry.move.san) {
           const moveSAN = moveEntry.move.san;
           const result = newGame.move(moveSAN);
           if (!result) {
               console.error(`Invalid replay move during stepBackward reconstruction at index ${i}:`, moveSAN, 'FEN:', newGame.fen());
               // Handle error? Maybe stop reconstruction? For now, just log.
               break; // Stop reconstruction if a move fails
           }
       } else {
            console.warn(`Skipping malformed move entry at index ${i} during stepBackward reconstruction`);
       }
    }
    setGame(newGame); // Set the board to the state *before* the target move
    setCurrentMoveIndex(targetIndex); // Update the index
  };

  return (
    <div className="game-review">
      <h3>Game Replay</h3>
      <div ref={boardBoxRef} className="chessboard-area">
        <Chessboard position={game.fen()} boardWidth={boardSize} />
      </div>
      <div className="review-controls">
        <button onClick={playMoves}>Play</button>
        <button onClick={pauseMoves}>Pause</button>
        <button onClick={stepForward}>Step Forward</button>
        <button onClick={stepBackward}>Step Back</button>
        <button onClick={() => navigate(-1)}>Exit Replay</button>
      </div>
      <div>
        Move: {currentMoveIndex} / {gameHistory.moves.length - 1}
      </div>
    </div>
  );
};

export default GameReview;
