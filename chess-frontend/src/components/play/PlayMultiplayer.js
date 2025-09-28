import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import WebSocketGameService from '../../services/WebSocketGameService';

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
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [opponentOnline, setOpponentOnline] = useState(false);

  const { user } = useAuth();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const wsService = useRef(null);

  // Initialize WebSocket connection and load game data
  const initializeGame = useCallback(async () => {
    if (!gameId || !user) return;

    try {
      setLoading(true);
      setError(null);

      // First load initial game data
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
      const userColor = data.white_player_id === user?.id ? 'white' : 'black';
      setBoardOrientation(userColor);

      // Set game info
      const opponent = data.white_player_id === user?.id ? data.black_player : data.white_player;
      setGameInfo({
        playerColor: userColor,
        turn: data.turn,
        status: data.status,
        opponentName: opponent.name
      });

      // Set game history from moves
      setGameHistory(data.moves || []);

      // Initialize WebSocket connection
      wsService.current = new WebSocketGameService();

      // Set up WebSocket event listeners
      wsService.current.on('connected', (data) => {
        console.log('WebSocket connected:', data);
        setConnectionStatus('connected');
      });

      wsService.current.on('disconnected', () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
      });

      wsService.current.on('gameMove', (event) => {
        console.log('Received move:', event);
        handleRemoteMove(event);
      });

      wsService.current.on('gameStatus', (event) => {
        console.log('Game status changed:', event);
        handleGameStatusChange(event);
      });

      wsService.current.on('gameConnection', (event) => {
        console.log('Player connection event:', event);
        handlePlayerConnection(event);
      });

      wsService.current.on('error', (error) => {
        console.error('WebSocket error:', error);
        const errorMessage = error?.message || error?.toString() || 'Unknown connection error';
        setError('Connection error: ' + errorMessage);
      });

      // Initialize the WebSocket connection
      await wsService.current.initialize(gameId, user);

      setLoading(false);

    } catch (err) {
      console.error('Error initializing game:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [gameId, user]);

  // Handle incoming moves from other players
  const handleRemoteMove = useCallback((event) => {
    // Don't process moves from ourselves
    if (event.user_id === user?.id) return;

    try {
      const newGame = new Chess();
      newGame.load(event.fen);
      setGame(newGame);

      // Update game history
      setGameHistory(prev => [...prev, {
        from: event.move.from,
        to: event.move.to,
        move: event.move.san || event.move.piece,
        player: event.user_id === gameData.white_player_id ? 'white' : 'black'
      }]);

      // Update turn
      setGameInfo(prev => ({
        ...prev,
        turn: event.turn
      }));

    } catch (err) {
      console.error('Error processing remote move:', err);
    }
  }, [user?.id, gameData]);

  // Handle game status changes
  const handleGameStatusChange = useCallback((event) => {
    setGameInfo(prev => ({
      ...prev,
      status: event.status
    }));

    if (event.result) {
      setGameData(prev => ({
        ...prev,
        result: event.result,
        status: event.status
      }));
    }
  }, []);

  // Handle player connection events
  const handlePlayerConnection = useCallback((event) => {
    const isOpponent = event.user_id !== user?.id;
    if (isOpponent) {
      setOpponentOnline(event.type === 'join' || event.type === 'resume');
    }
  }, [user?.id]);

  useEffect(() => {
    if (!gameId || !user) return;

    initializeGame();

    // Cleanup on unmount
    return () => {
      if (wsService.current) {
        wsService.current.disconnect();
      }
    };
  }, [gameId, user?.id]); // Use gameId and user.id directly instead of initializeGame

  const makeMove = async (sourceSquare, targetSquare) => {
    // Check if WebSocket is connected
    if (connectionStatus !== 'connected') {
      console.log('WebSocket not connected');
      return false;
    }

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

      // Send move through WebSocket
      await wsService.current.sendMove(
        {
          from: sourceSquare,
          to: targetSquare,
          piece: move.piece,
          promotion: move.promotion || null
        },
        gameCopy.fen(),
        gameCopy.turn()
      );

      // Update local game state immediately for responsiveness
      setGame(gameCopy);
      setGameHistory(prev => [...prev, {
        from: sourceSquare,
        to: targetSquare,
        move: move.san,
        player: gameInfo.playerColor
      }]);

      setGameInfo(prev => ({
        ...prev,
        turn: gameCopy.turn() === 'w' ? 'white' : 'black'
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
      const result = gameInfo.playerColor === 'white' ? 'black_wins' : 'white_wins';
      await wsService.current.updateGameStatus('completed', result, 'resignation');
    } catch (err) {
      console.error('Error resigning:', err);
    }
  };

  const handleResumeGame = async () => {
    try {
      await wsService.current.resumeGame(true);
    } catch (err) {
      console.error('Error resuming game:', err);
    }
  };

  const handleNewGame = async (isRematch = false) => {
    try {
      const result = await wsService.current.createNewGame(isRematch);
      if (result.game_id) {
        navigate(`/play/multiplayer/${result.game_id}`);
      }
    } catch (err) {
      console.error('Error creating new game:', err);
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
          <div className="connection-status">
            <span className={`status-indicator ${connectionStatus}`}>
              ● {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
            {opponentOnline && (
              <span className="opponent-status">
                ● {gameInfo.opponentName} online
              </span>
            )}
          </div>
          <div className="turn-status">
            {gameInfo.status === 'active' ? (
              gameInfo.turn === gameInfo.playerColor ?
                "Your turn" :
                `${gameInfo.opponentName}'s turn`
            ) : gameInfo.status === 'completed' ? (
              `Game ${gameData?.result?.replace('_', ' ') || 'ended'}`
            ) : (
              `Game ${gameInfo.status}`
            )}
          </div>
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
            <div className="game-controls">
              {gameInfo.status === 'active' && (
                <button onClick={handleResign} className="resign-button">
                  Resign
                </button>
              )}
              {gameInfo.status === 'paused' && (
                <button onClick={handleResumeGame} className="resume-button">
                  Resume Game
                </button>
              )}
              {gameInfo.status === 'completed' && (
                <div className="game-ended-controls">
                  <button onClick={() => handleNewGame(true)} className="rematch-button">
                    Rematch
                  </button>
                  <button onClick={() => handleNewGame(false)} className="new-game-button">
                    New Game
                  </button>
                </div>
              )}
            </div>
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