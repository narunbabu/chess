import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../config';

const PlayMultiplayer = () => {
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState(null);
  const [gameInfo, setGameInfo] = useState({
    playerColor: 'white',
    turn: 'white',
    status: 'active',
    opponentName: 'Opponent'
  });
  const [gameHistory, setGameHistory] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user } = useAuth();
  const { gameId } = useParams();
  const navigate = useNavigate();

  // Load game data
  const loadGame = useCallback(async () => {
    if (!gameId) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/games/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load game');
      }

      const data = await response.json();
      setGameData(data);

      // Set up the chess game from FEN
      const newGame = new Chess(data.fen);
      setGame(newGame);

      // Determine user's color and set board orientation
      const userColor = data.white_player_id === user.id ? 'white' : 'black';
      setBoardOrientation(userColor);

      // Set game info
      const opponent = data.white_player_id === user.id ? data.black_player : data.white_player;
      setGameInfo({
        playerColor: userColor,
        turn: data.turn,
        status: data.status,
        opponentName: opponent.name
      });

      // Set game history from moves
      setGameHistory(data.moves || []);
      setLoading(false);

    } catch (err) {
      console.error('Error loading game:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [gameId, user]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Poll for game updates every 2 seconds
  useEffect(() => {
    if (!gameId || loading || error) return;

    const pollInterval = setInterval(() => {
      loadGame();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [gameId, loading, error, loadGame]);

  const makeMove = async (sourceSquare, targetSquare) => {
    // Check if it's the user's turn
    if (gameInfo.turn !== gameInfo.playerColor) {
      console.log('Not your turn');
      return false;
    }

    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      });

      if (move === null) {
        console.log('Invalid move');
        return false;
      }

      // Send move to server
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/games/${gameId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: sourceSquare,
          to: targetSquare,
          fen: gameCopy.fen(),
          move: move.san
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to make move');
      }

      // Update local game state
      setGame(gameCopy);
      setGameHistory(prev => [...prev, {
        from: sourceSquare,
        to: targetSquare,
        move: move.san,
        player: gameInfo.playerColor
      }]);

      setGameInfo(prev => ({
        ...prev,
        turn: prev.turn === 'white' ? 'black' : 'white'
      }));

      return true;

    } catch (err) {
      console.error('Error making move:', err);
      return false;
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    return makeMove(sourceSquare, targetSquare);
  };

  const handleSquareClick = (square) => {
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
      } else {
        makeMove(selectedSquare, square);
        setSelectedSquare(null);
      }
    } else {
      const piece = game.get(square);
      if (piece && piece.color === gameInfo.playerColor.charAt(0)) {
        setSelectedSquare(square);
      }
    }
  };

  const handleResign = async () => {
    if (!window.confirm('Are you sure you want to resign?')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${BACKEND_URL}/games/${gameId}/resign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Refresh game data
      loadGame();
    } catch (err) {
      console.error('Error resigning:', err);
    }
  };

  if (loading) {
    return (
      <div className="game-container">
        <div className="loading-message">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-container">
        <div className="error-message">Error: {error}</div>
        <button onClick={() => navigate('/lobby')} className="back-button">
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Multiplayer Chess</h2>
        <div className="game-status">
          {gameInfo.status === 'active' ? (
            gameInfo.turn === gameInfo.playerColor ?
              "Your turn" :
              `${gameInfo.opponentName}'s turn`
          ) : (
            `Game ${gameData.result.replace('_', ' ')}`
          )}
        </div>
      </div>

      <div className="game-layout">
        <div className="board-section">
          <div className="player-info opponent">
            <span className="player-name">
              {gameInfo.opponentName} ({gameInfo.playerColor === 'white' ? 'Black' : 'White'})
            </span>
          </div>

          <div className="chessboard-wrapper">
            <Chessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              onSquareClick={handleSquareClick}
              boardOrientation={boardOrientation}
              areArrowsAllowed={false}
              customSquareStyles={{
                [selectedSquare]: {
                  backgroundColor: 'rgba(255, 255, 0, 0.4)'
                }
              }}
            />
          </div>

          <div className="player-info current-player">
            <span className="player-name">
              {user.name} ({gameInfo.playerColor === 'white' ? 'White' : 'Black'})
            </span>
            {gameInfo.status === 'active' && (
              <button onClick={handleResign} className="resign-button">
                Resign
              </button>
            )}
          </div>
        </div>

        <div className="game-sidebar">
          <GameInfo
            game={game}
            gameHistory={gameHistory}
            playerColor={gameInfo.playerColor}
            opponent={gameInfo.opponentName}
            gameStatus={gameInfo.status}
          />
          <ScoreDisplay game={game} />
        </div>
      </div>
    </div>
  );
};

export default PlayMultiplayer;