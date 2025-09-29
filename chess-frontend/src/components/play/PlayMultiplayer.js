import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import GameCompletionAnimation from '../GameCompletionAnimation';
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
  const [gameComplete, setGameComplete] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  const { user } = useAuth();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const wsService = useRef(null);

  // Initialize WebSocket connection and load game data
  const initializeGame = useCallback(async () => {
    if (!gameId || !user) return;

    // Check if user came from proper invitation flow (optional security measure)
    const lastInvitationAction = sessionStorage.getItem('lastInvitationAction');
    const lastInvitationTime = sessionStorage.getItem('lastInvitationTime');
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

    console.log('Game access check:', {
      gameId,
      userId: user.id,
      lastInvitationAction,
      lastInvitationTime,
      timeSinceInvitation: lastInvitationTime ? Date.now() - parseInt(lastInvitationTime) : 'N/A'
    });

    // Check if user has proper authorization to access this specific game
    const lastGameId = sessionStorage.getItem('lastGameId');
    const hasRecentInvitationActivity = lastInvitationTime && (Date.now() - parseInt(lastInvitationTime)) < fiveMinutesAgo * 2; // 10 minutes



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
        if (response.status === 403) {
          // User is not authorized to access this game
          console.log('Unauthorized game access, redirecting to lobby');
          navigate('/lobby');
          return;
        }
        throw new Error('Failed to load game');
      }

      const data = await response.json();
      console.log('Raw game data from backend:', data);
      setGameData(data);

      // Set up the chess game from FEN (use starting position if no FEN)
      const fen = data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const newGame = new Chess(fen);
      setGame(newGame);

      // Determine user's color and set board orientation (handle type conversion)
      const userId = parseInt(user?.id);
      const whitePlayerId = parseInt(data.white_player_id);
      const blackPlayerId = parseInt(data.black_player_id);
      const userColor = whitePlayerId === userId ? 'white' : 'black';
      console.log('Board orientation setup:', {
        userId: user?.id,
        userIdType: typeof user?.id,
        whitePlayerId: data.white_player_id,
        whitePlayerIdType: typeof data.white_player_id,
        blackPlayerId: data.black_player_id,
        blackPlayerIdType: typeof data.black_player_id,
        userColor: userColor,
        boardOrientation: userColor,
        whitePlayerMatch: data.white_player_id === user?.id,
        blackPlayerMatch: data.black_player_id === user?.id,
        convertedUserId: userId,
        convertedWhiteId: whitePlayerId,
        convertedBlackId: blackPlayerId,
        isWhitePlayer: whitePlayerId === userId,
        isBlackPlayer: blackPlayerId === userId
      });

      console.log('Setting board orientation to:', userColor);
      setBoardOrientation(userColor);

      // Set game info (use consistent type conversion)
      const opponent = whitePlayerId === userId ? data.blackPlayer : data.whitePlayer;
      console.log('Game info setup:', {
        playerColor: userColor,
        gameTurn: data.turn,
        status: data.status,
        opponentName: opponent?.name || 'Opponent'
      });

      setGameInfo({
        playerColor: userColor,
        turn: data.turn,
        status: data.status,
        opponentName: opponent?.name || 'Opponent'
      });

      // Update WebSocket service with player color for smart polling
      if (wsService.current) {
        wsService.current.updatePlayerColor(userColor);
      }

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

      wsService.current.on('gameEnded', (event) => {
        console.log('🏁 Game ended event received:', event);
        handleGameEnd(event);
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

  // Handle incoming moves (always apply server's authoritative state)
  const handleRemoteMove = useCallback((event) => {
    try {
      console.log('Processing move from server (authoritative):', event);

      // Always apply the server's FEN as the source of truth
      const newGame = new Chess();
      newGame.load(event.fen);
      setGame(newGame);

      // Determine the player color who made this move
      const movePlayer = event.user_id === gameData?.white_player?.id ? 'white' : 'black';

      // Only add to history if this is a move from another player
      // (our own moves are already in history from makeMove)
      if (event.user_id !== user?.id) {
        setGameHistory(prev => [...prev, {
          from: event.move.from,
          to: event.move.to,
          move: event.move.san || event.move.piece,
          player: movePlayer
        }]);
      }

      // Always update turn based on server's authoritative state
      const newTurn = event.turn === 'w' ? 'white' : 'black';
      setGameInfo(prev => ({
        ...prev,
        turn: newTurn
      }));

      console.log('Move processed, updated turn to:', newTurn);

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

  // Handle game completion
  const handleGameEnd = useCallback((event) => {
    console.log('🏁 Processing game end event:', event);

    // Update game completion state
    setGameComplete(true);

    // Prepare result data for modal
    const resultData = {
      game_over: true,
      result: event.result,
      end_reason: event.end_reason,
      winner_user_id: event.winner_user_id,
      winner_player: event.winner_player,
      fen_final: event.fen_final,
      move_count: event.move_count,
      ended_at: event.ended_at,
      white_player: event.white_player,
      black_player: event.black_player,
      // Determine user's result
      isPlayerWin: event.winner_user_id === user?.id,
      isPlayerDraw: !event.winner_user_id && event.result === '1/2-1/2'
    };

    setGameResult(resultData);

    // Update game info status
    setGameInfo(prev => ({
      ...prev,
      status: 'finished'
    }));

    // Apply final board state
    if (event.fen_final) {
      try {
        const finalGame = new Chess();
        finalGame.load(event.fen_final);
        setGame(finalGame);
      } catch (err) {
        console.error('Error loading final FEN:', err);
      }
    }

    console.log('✅ Game completion processed, showing result modal');
  }, [user?.id]);

  // Handle resign
  const handleResign = useCallback(async () => {
    if (!wsService.current || gameComplete) {
      return;
    }

    const confirmed = window.confirm('Are you sure you want to resign?');
    if (!confirmed) {
      return;
    }

    try {
      console.log('🏳️ Resigning game...');
      await wsService.current.resignGame();
      console.log('✅ Resignation successful');
    } catch (error) {
      console.error('❌ Failed to resign:', error);
      setError('Failed to resign: ' + error.message);
    }
  }, [gameComplete]);

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
    console.log('Turn validation:', {
      gameTurn: gameInfo.turn,
      playerColor: gameInfo.playerColor,
      isYourTurn: gameInfo.turn === gameInfo.playerColor
    });

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

      const newTurn = gameCopy.turn() === 'w' ? 'white' : 'black';
      console.log('Updating turn after move:', {
        chessJsTurn: gameCopy.turn(),
        convertedTurn: newTurn
      });

      setGameInfo(prev => ({
        ...prev,
        turn: newTurn
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

  // Use the resign handler from above (already defined)

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

  const handleKillGame = async () => {
    if (!window.confirm('Are you sure you want to kill this game? This will permanently delete the game and return you to the lobby.')) {
      return;
    }

    try {
      // First try to resign/end the game
      await wsService.current.updateGameStatus('completed', 'abandoned', 'killed');

      // Disconnect WebSocket service
      if (wsService.current) {
        wsService.current.disconnect();
      }

      // Clear session storage to prevent stale game access
      sessionStorage.removeItem('lastInvitationAction');
      sessionStorage.removeItem('lastInvitationTime');
      sessionStorage.removeItem('lastGameId');

      // Navigate back to lobby
      navigate('/lobby');
    } catch (err) {
      console.error('Error killing game:', err);

      // Clear session storage even if backend call fails
      sessionStorage.removeItem('lastInvitationAction');
      sessionStorage.removeItem('lastInvitationTime');
      sessionStorage.removeItem('lastGameId');

      // Even if backend call fails, still navigate back
      navigate('/lobby');
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

  // Debug: Log board orientation at render time
  console.log('Rendering with board orientation:', boardOrientation, 'playerColor:', gameInfo.playerColor);

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
              <button onClick={handleKillGame} className="kill-game-button" style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '10px',
                fontSize: '14px'
              }}>
                🗑️ Kill Game
              </button>
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

      {/* Game Completion Modal */}
      {gameComplete && gameResult && (
        <GameCompletionAnimation
          result={gameResult}
          playerColor={gameInfo.playerColor}
          onClose={() => {
            setGameComplete(false);
            setGameResult(null);
          }}
          onRematch={() => handleNewGame(true)}
          onNewGame={() => handleNewGame(false)}
          onBackToLobby={() => navigate('/lobby')}
          isMultiplayer={true}
        />
      )}
    </div>
  );
};

export default PlayMultiplayer;