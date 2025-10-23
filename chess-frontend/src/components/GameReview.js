
import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getGameHistoryById } from "../services/gameHistoryService";

const GameReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: gameId } = useParams();
  const [gameHistory, setGameHistory] = useState({ moves: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const timerRef = useRef(null);
  const boardBoxRef = useRef(null);
  const [boardSize, setBoardSize] = useState(400);

  // Load game data when component mounts or gameId changes
  useEffect(() => {
    const loadGameData = async () => {
      if (!gameId) {
        // If no gameId, try to get from location state or localStorage as fallback
        let history = location.state?.gameHistory;
        if (!history) {
          const stored = localStorage.getItem('lastGameHistory');
          history = stored ? JSON.parse(stored) : { moves: [] };
        }
        setGameHistory(history);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const gameData = await getGameHistoryById(gameId);

        if (!gameData) {
          setError('Game not found');
          setGameHistory({ moves: [] });
          return;
        }

        // Convert the game data to the expected format for the review component
        const formattedGameHistory = {
          ...gameData,
          moves: Array.isArray(gameData.moves) ? gameData.moves : []
        };

        // If moves are in the format [{notation: "e4", time: 3.24}],
        // convert to the expected format with SAN moves
        if (formattedGameHistory.moves.length > 0 && formattedGameHistory.moves[0].notation) {
          // Convert from API format to GameReview format
          const tempGame = new Chess();
          const convertedMoves = [{ move: { san: 'Start' }, fen: tempGame.fen() }]; // Initial position

          formattedGameHistory.moves.forEach(moveData => {
            try {
              const move = tempGame.move(moveData.notation);
              if (move) {
                convertedMoves.push({
                  move: { san: move.san },
                  fen: tempGame.fen(),
                  time: moveData.time
                });
              }
            } catch (moveError) {
              console.error('Error processing move:', moveData.notation, moveError);
            }
          });

          formattedGameHistory.moves = convertedMoves;
        }

        setGameHistory(formattedGameHistory);
      } catch (err) {
        console.error('Error loading game data:', err);
        setError('Failed to load game data');
        setGameHistory({ moves: [] });
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, location.state]);

  useEffect(() => {
    // Reset the board to the initial position when the game history is loaded.
    const newGame = new Chess();
    setGame(newGame);
    setCurrentMoveIndex(0);
  }, [gameHistory]); // Reset when gameHistory changes

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
          // Create a fresh game and replay all moves up to nextIndex
          const newGame = new Chess();

          // Replay all moves from index 1 (skip initial position at index 0) up to nextIndex
          for (let i = 1; i <= nextIndex; i++) {
            const moveEntry = gameHistory.moves[i];
            if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
              const result = newGame.move(moveEntry.move.san);
              if (!result) {
                console.error(`Invalid replay move in playMoves (Index ${i}):`, moveEntry.move.san, 'FEN:', newGame.fen());
                clearInterval(timerRef.current);
                return prevIndex;
              }
            }
          }

          setGame(newGame);
          return nextIndex;
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
    if (gameHistory && Array.isArray(gameHistory.moves) && currentMoveIndex < gameHistory.moves.length - 1) {
      const nextIndex = currentMoveIndex + 1;

      // Create a fresh game and replay all moves up to nextIndex
      const newGame = new Chess();

      // Replay all moves from index 1 (skip initial position at index 0) up to nextIndex
      for (let i = 1; i <= nextIndex; i++) {
        const moveEntry = gameHistory.moves[i];
        if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
          const result = newGame.move(moveEntry.move.san);
          if (!result) {
            console.error(`Invalid replay move in stepForward (Index ${i}):`, moveEntry.move.san, 'FEN:', newGame.fen());
            return; // Don't update state if move failed
          }
        }
      }

      setGame(newGame);
      setCurrentMoveIndex(nextIndex);
    }
  };

  const stepBackward = () => {
    if (currentMoveIndex <= 0) return; // Cannot go back from the start

    const targetIndex = currentMoveIndex - 1;
    const newGame = new Chess(); // Start from initial position

    // Replay moves from index 1 up to targetIndex (not including it)
    for (let i = 1; i <= targetIndex; i++) {
      const moveEntry = gameHistory.moves[i];
      if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
        const result = newGame.move(moveEntry.move.san);
        if (!result) {
          console.error(`Invalid replay move during stepBackward reconstruction at index ${i}:`, moveEntry.move.san, 'FEN:', newGame.fen());
          return; // Stop reconstruction if a move fails
        }
      }
    }

    setGame(newGame);
    setCurrentMoveIndex(targetIndex);
  };

  if (loading) {
    return (
      <div className="game-review p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <h3 className="text-2xl font-bold mb-4 text-vivid-yellow">Loading Game...</h3>
        <div className="loading-message">Please wait while we load your game data.</div>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-violet hover:bg-picton-blue rounded-lg">Back</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-review p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <h3 className="text-2xl font-bold mb-4 text-red-500">Error Loading Game</h3>
        <div className="error-message">{error}</div>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-violet hover:bg-picton-blue rounded-lg">Back</button>
      </div>
    );
  }

  return (
    <div className="game-review p-4 sm:p-6 md:p-8 min-h-screen text-white">
      <h3 className="text-3xl font-bold text-center mb-6 text-vivid-yellow">Game Replay</h3>
      <div className="game-info bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-4 mb-6 text-center">
        <p><strong>Game ID:</strong> {gameHistory.id || 'Unknown'}</p>
        <p><strong>Date:</strong> {gameHistory.played_at ? new Date(gameHistory.played_at).toLocaleDateString() : 'Unknown'}</p>
        <p><strong>Result:</strong> {typeof gameHistory.result === 'object' ? (gameHistory.result?.text || gameHistory.result?.outcome || 'Unknown') : (gameHistory.result || 'Unknown')}</p>
        <p><strong>Score:</strong> {gameHistory.finalScore || gameHistory.final_score || 'N/A'}</p>
      </div>
      <div ref={boardBoxRef} className="chessboard-area max-w-full mx-auto mb-6">
        <Chessboard position={game.fen()} boardWidth={boardSize} />
      </div>
      <div className="review-controls flex justify-center items-center gap-2 p-2 bg-gray-900/50 rounded-lg">
        <button onClick={playMoves} disabled={!gameHistory.moves || gameHistory.moves.length <= 1} className="control-button bg-ufo-green hover:bg-vivid-yellow text-white font-bold py-2 px-4 rounded-lg">▶ Play</button>
        <button onClick={pauseMoves} className="control-button bg-ryb-orange hover:bg-vivid-yellow text-white font-bold py-2 px-4 rounded-lg">❚❚ Pause</button>
        <button onClick={stepBackward} disabled={currentMoveIndex <= 0} className="control-button bg-picton-blue hover:bg-blue-violet text-white font-bold py-2 px-4 rounded-lg">⏪ Back</button>
        <button onClick={stepForward} disabled={!gameHistory.moves || currentMoveIndex >= gameHistory.moves.length - 1} className="control-button bg-picton-blue hover:bg-blue-violet text-white font-bold py-2 px-4 rounded-lg">Forward ⏩</button>
        <button onClick={() => navigate(-1)} className="control-button bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Exit</button>
      </div>
      <div className="text-center mt-4">
        Move: {currentMoveIndex} / {gameHistory.moves && gameHistory.moves.length > 0 ? gameHistory.moves.length - 1 : 0}
      </div>
      <div className="moves-debug mt-4">
        <details>
          <summary className="cursor-pointer">Debug Info</summary>
          <pre className="bg-gray-900/50 p-2 rounded-lg mt-2 text-xs">{JSON.stringify(gameHistory.moves?.slice(0, 3), null, 2)}</pre>
        </details>
      </div>
    </div>
  );
};

export default GameReview;
