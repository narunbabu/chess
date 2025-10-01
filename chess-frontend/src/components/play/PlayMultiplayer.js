import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import TimerDisplay from './TimerDisplay';
import TimerButton from './TimerButton';
import GameCompletionAnimation from '../GameCompletionAnimation';
import CheckmateNotification from '../CheckmateNotification';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import WebSocketGameService from '../../services/WebSocketGameService';
import { evaluateMove } from '../../utils/gameStateUtils';
import { encodeGameHistory } from '../../utils/gameHistoryStringUtils';
import { saveGameHistory } from '../../services/gameHistoryService';
import { useGameTimer } from '../../utils/timerUtils';

// Import sounds
import moveSound from '../../assets/sounds/move.mp3';
import checkSound from '../../assets/sounds/check.mp3';
import gameEndSound from '../../assets/sounds/game-end.mp3';

// Create audio objects
const moveSoundEffect = new Audio(moveSound);
const checkSoundEffect = new Audio(checkSound);
const gameEndSoundEffect = new Audio(gameEndSound);

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
  const [showCheckmate, setShowCheckmate] = useState(false);
  const [checkmateWinner, setCheckmateWinner] = useState(null);
  const [kingInDangerSquare, setKingInDangerSquare] = useState(null);

  // Score tracking states
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState(null);
  const [lastOpponentEvaluation, setLastOpponentEvaluation] = useState(null);

  const { user } = useAuth();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const wsService = useRef(null);
  const mateCheckTimer = useRef(null);
  const moveStartTimeRef = useRef(null); // Tracks when current turn started for move timing

  // Timer hook for multiplayer game
  const {
    playerTime,
    computerTime,
    activeTimer,
    isTimerRunning,
    timerRef,
    setPlayerTime,
    setComputerTime,
    setActiveTimer,
    setIsTimerRunning,
    handleTimer: startTimerInterval,
    pauseTimer,
    switchTimer,
    resetTimer
  } = useGameTimer(
    gameInfo.playerColor === 'white' ? 'w' : 'b',
    game,
    (status) => setGameInfo(prev => ({ ...prev, status }))
  );

  // Play sound helper
  const playSound = useCallback((soundEffect) => {
    try {
      soundEffect.currentTime = 0;
      soundEffect.play().catch(err => console.warn('Audio play blocked:', err));
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  }, []);

  // Find king square helper
  const findKingSquare = useCallback((game, color) => {
    const board = game.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === color) {
          const file = String.fromCharCode(97 + col); // a-h
          const rank = 8 - row; // 1-8
          return file + rank;
        }
      }
    }
    return null;
  }, []);

  // Checkmate detection and notification
  const checkForCheckmate = useCallback((gameInstance) => {
    if (gameInstance.isCheckmate()) {
      const loserColor = gameInstance.turn(); // Current turn is the loser
      const winnerColor = loserColor === 'w' ? 'black' : 'white';

      console.log('🏁 CHECKMATE DETECTED!', { loserColor, winnerColor });

      // Find the checkmated king's square
      const kingSquare = findKingSquare(gameInstance, loserColor);
      if (kingSquare) {
        setKingInDangerSquare(kingSquare);
        // Clear the flicker effect after animation completes (3 flickers * 0.5s)
        setTimeout(() => setKingInDangerSquare(null), 1500);
      }

      // Play checkmate sound
      playSound(gameEndSoundEffect);

      // Show notification
      setCheckmateWinner(winnerColor);
      setShowCheckmate(true);

      return true;
    } else if (gameInstance.isCheck()) {
      // Play check sound
      playSound(checkSoundEffect);
    } else {
      // Play regular move sound
      playSound(moveSoundEffect);
    }

    return false;
  }, [findKingSquare, playSound]);

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
      console.log('🎨 MY PLAYER COLOR FROM BACKEND:', data.player_color);
      console.log('🎨 MY USER ID:', user?.id);
      console.log('🎨 WHITE PLAYER ID:', data.white_player_id);
      console.log('🎨 BLACK PLAYER ID:', data.black_player_id);
      setGameData(data);

      // Prevent rejoining a finished game (allow waiting and active statuses)
      if (data.status !== 'active' && data.status !== 'waiting') {
        console.log('🚫 Game is already finished, status:', data.status);
        setGameComplete(true);
        setGameInfo(p => ({...p, status: 'finished', ...data}));
        setLoading(false); // Stop loading if game is already finished

        // Prepare the result data for the end modal
        const resultData = {
          game_over: true,
          result: data.result || 'unknown',
          end_reason: data.end_reason || 'game_ended',
          winner_user_id: data.winner_user_id,
          winner_player: data.winner_player,
          fen_final: data.fen,
          move_count: data.move_count,
          ended_at: data.ended_at,
          white_player: data.whitePlayer,
          black_player: data.blackPlayer,
          isPlayerWin: data.winner_user_id === user?.id,
          isPlayerDraw: !data.winner_user_id && data.result === '1/2-1/2'
        };
        setGameResult(resultData);

        // Mark the game as finished in session storage to prevent re-entry
        sessionStorage.setItem('gameFinished_' + gameId, 'true');

        // Mark related invitation as processed
        const processedInvitationIds = JSON.parse(sessionStorage.getItem('processedInvitationIds') || '[]');
        const lastGameId = sessionStorage.getItem('lastGameId');
        if (lastGameId === gameId.toString()) {
          console.log('✅ Game finished, marked to prevent auto-navigation loop');
        }

        return; // don't call joinGameChannel or initialize WebSocket
      }

      // Set up the chess game from FEN (use starting position if no FEN)
      const fen = data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const newGame = new Chess(fen);
      setGame(newGame);

      // Get user's color from server (authoritative source)
      // Priority: handshake response > game_state data > fallback calculation
      const userColor = data.player_color ||
                       data.game_state?.player_color ||
                       (parseInt(data.white_player_id || data.game_state?.white_player_id) === parseInt(user?.id) ? 'white' : 'black');
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
        serverProvidedColor: data.player_color
      });

      console.log('🔧 About to set board orientation to:', userColor);
      console.log('🔧 Current boardOrientation state:', boardOrientation);
      setBoardOrientation(userColor);
      console.log('✅ setBoardOrientation called with:', userColor);

      // Set game info (use server-provided color to determine opponent)
      const opponent = userColor === 'white' ? data.blackPlayer : data.whitePlayer;
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

      // Initialize move timer if it's player's turn
      if (data.turn === (userColor === 'white' ? 'w' : 'b')) {
        moveStartTimeRef.current = performance.now();
      }

      // Start game timer if game is active
      if (data.status === 'active') {
        const currentTurnColor = data.turn;
        setActiveTimer(currentTurnColor);
        startTimerInterval();
      }

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

      wsService.current.on('gameActivated', (event) => {
        console.log('Game activated event received:', event);
        handleGameActivated(event);
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
        // Use compact string format: "move,time" (e.g., "e4,3.45")
        const moveTime = (event.move.move_time_ms || 0) / 1000; // Convert to seconds
        const compactMove = `${event.move.san || event.move.piece},${moveTime.toFixed(2)}`;
        setGameHistory(prev => [...prev, compactMove]);

        // Calculate points for opponent's move
        if (event.move && event.move.san) {
          try {
            // Reconstruct the move for evaluation
            const previousState = new Chess();
            if (event.move.prev_fen) {
              previousState.load(event.move.prev_fen);
            }

            const opponentMove = {
              from: event.move.from,
              to: event.move.to,
              san: event.move.san,
              promotion: event.move.promotion || null,
              piece: event.move.piece || movePlayer.charAt(0), // 'w' or 'b'
              color: movePlayer === 'white' ? 'w' : 'b',
              captured: event.move.captured || null
            };

            // Evaluate opponent's move
            evaluateMove(
              opponentMove,
              previousState,
              newGame,
              (event.move.move_time_ms || 5000) / 1000, // Convert to seconds
              event.move.player_rating || 1200,
              setLastOpponentEvaluation,
              (scoreToAdd) => {
                setOpponentScore(prev => prev + scoreToAdd);
              },
              1 // Human vs Human
            );
          } catch (evalError) {
            console.warn('Could not evaluate opponent move:', evalError);
          }
        }
      }

      // Always update turn based on server's authoritative state
      const newTurn = event.turn === 'w' ? 'white' : 'black';
      setGameInfo(prev => ({
        ...prev,
        turn: newTurn
      }));

      // Start timing for player's turn
      if (newTurn === gameInfo.playerColor) {
        moveStartTimeRef.current = performance.now();
      }

      // Switch timer to the player whose turn it is
      const newActiveColor = newTurn === 'white' ? 'w' : 'b';
      switchTimer(newActiveColor);
      if (!isTimerRunning && gameInfo.status === 'active') {
        startTimerInterval();
      }

      console.log('Move processed, updated turn to:', newTurn);

      // Check for checkmate/check and play appropriate sound
      checkForCheckmate(newGame);

      // Note: Game completion is handled by WebSocket 'gameEnded' event (line 326)
      // No polling fallback needed - WebSocket is reliable for game state updates

    } catch (err) {
      console.error('Error processing remote move:', err);
    }
  }, [user?.id, gameData, gameId, checkForCheckmate]);

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

  const handleGameActivated = useCallback((event) => {
    setGameInfo(prev => ({
      ...prev,
      status: 'active'
    }));
  }, []);

  // Handle player connection events
  const handlePlayerConnection = useCallback((event) => {
    const isOpponent = event.user_id !== user?.id;
    if (isOpponent) {
      setOpponentOnline(event.type === 'join' || event.type === 'resume');
    }
  }, [user?.id]);

  // Handle game completion
  const handleGameEnd = useCallback(async (event) => {
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

    // Save multiplayer game to history (similar to PlayComputer.js)
    try {
      const now = new Date();
      const formattedDate = now.toISOString().slice(0, 19).replace("T", " ");

      // Determine result text based on who won
      let resultText = 'Draw';
      if (event.winner_user_id === user?.id) {
        resultText = 'won';
      } else if (event.winner_user_id && event.winner_user_id !== user?.id) {
        resultText = 'lost';
      }

      // Fetch fresh game data from server to get authoritative move history
      const token = localStorage.getItem('auth_token');
      let serverMoves = [];
      try {
        const response = await fetch(`${BACKEND_URL}/games/${gameId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const serverGameData = await response.json();
          serverMoves = serverGameData.moves || [];
          console.log('📥 Fetched moves from server:', {
            count: serverMoves.length,
            sample: serverMoves.slice(0, 3)
          });
        }
      } catch (fetchError) {
        console.warn('⚠️ Could not fetch server moves, using local gameHistory:', fetchError);
      }

      // Use server moves if available, otherwise fall back to local gameHistory
      const movesToSave = serverMoves.length > 0 ? serverMoves : gameHistory;
      console.log('📋 Moves to encode:', {
        source: serverMoves.length > 0 ? 'server' : 'local',
        count: movesToSave.length,
        sample: movesToSave.slice(0, 3)
      });

      // Encode game history to string format (same as PlayComputer)
      let conciseGameString = "";
      if (typeof encodeGameHistory === 'function' && movesToSave.length > 0) {
        conciseGameString = encodeGameHistory(movesToSave);
      } else if (movesToSave.length > 0) {
        conciseGameString = JSON.stringify(movesToSave);
      }

      // Validation: Ensure moves string is not empty
      if (!conciseGameString || conciseGameString.length === 0) {
        console.error('❌ Failed to encode moves - string is empty!', {
          movesToSaveCount: movesToSave.length,
          movesToSaveSample: movesToSave.slice(0, 3),
          serverMovesCount: serverMoves.length,
          gameHistoryCount: gameHistory.length
        });
        // Fallback: Use JSON stringify if encoding failed
        conciseGameString = JSON.stringify(movesToSave);
      }

      console.log('🔧 Encoded game string:', {
        length: conciseGameString.length,
        preview: conciseGameString.substring(0, 100),
        type: typeof conciseGameString,
        isValid: conciseGameString.length > 0
      });

      // Calculate final scores (use absolute values)
      const finalPlayerScore = Math.abs(playerScore);

      // Get timer values for persistence
      const whiteTimeRemaining = gameInfo.playerColor === 'white' ? playerTime * 1000 : computerTime * 1000;
      const blackTimeRemaining = gameInfo.playerColor === 'black' ? playerTime * 1000 : computerTime * 1000;

      const gameHistoryData = {
        id: `multiplayer_${gameId}_${Date.now()}`,
        game_id: gameId,
        date: now.toISOString(),
        played_at: now.toISOString(),
        player_color: gameInfo.playerColor === 'white' ? 'w' : 'b',
        computer_level: 0, // Multiplayer game (not vs computer)
        computer_depth: 0, // Alternative field name
        opponent_name: gameInfo.opponentName,
        game_mode: 'multiplayer',
        moves: conciseGameString,
        final_score: finalPlayerScore,
        finalScore: finalPlayerScore, // Alternative field name
        score: finalPlayerScore, // Alternative field name
        result: resultText,
        // Add timer persistence (Phase 2)
        white_time_remaining_ms: whiteTimeRemaining,
        black_time_remaining_ms: blackTimeRemaining,
        last_move_time: Date.now()
      };

      console.log('💾 Saving multiplayer game to history:', {
        ...gameHistoryData,
        movesPreview: gameHistoryData.moves.substring(0, 100)
      });
      console.log('📊 Game history details:', {
        playerScore,
        finalPlayerScore,
        movesLength: movesToSave.length,
        movesType: typeof conciseGameString,
        movesPreview: conciseGameString.substring(0, 100),
        whiteTime: whiteTimeRemaining,
        blackTime: blackTimeRemaining
      });

      if (typeof saveGameHistory === 'function') {
        try {
          await saveGameHistory(gameHistoryData);
          console.log('✅ Multiplayer game history saved successfully');
        } catch (saveError) {
          console.error('❌ Error saving multiplayer game history:', saveError);
        }
      } else {
        console.warn('⚠️ saveGameHistory function not available');
      }

      // Mark this game as finished in session storage to prevent re-entry
      sessionStorage.setItem('gameFinished_' + gameId, 'true');

    } catch (error) {
      console.error('❌ Error saving multiplayer game history:', error);
    }

    console.log('✅ Game completion processed, showing result modal');
  }, [user?.id, gameId, gameHistory, gameInfo, playerScore, playerTime, computerTime]);

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

  // Prevent double initialization in React StrictMode
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!gameId || !user) return;

    if (didInitRef.current) {
      console.log('⚠️ Skipping duplicate initialization (React StrictMode)');
      return;
    }
    didInitRef.current = true;

    console.log('🚀 Initializing game (first time)');
    initializeGame();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleanup: disconnecting WebSocket');
      if (wsService.current) {
        wsService.current.disconnect();
      }
    };
  }, [gameId, user?.id]); // Use gameId and user.id directly instead of initializeGame

  const performMove = (source, target) => {
    if (gameComplete || gameInfo.status === 'finished') return false;

    // Prevent moves if game is not active yet (waiting for opponent to connect)
    if (gameInfo.status !== 'active') {
      console.log('Game not active yet, status:', gameInfo.status);
      // Silently prevent move - user will see "Waiting for opponent" message
      return false;
    }

    if (gameInfo.turn !== gameInfo.playerColor) {
      console.log('Not your turn');
      return false;
    }
    if (connectionStatus !== 'connected') {
      console.log('WebSocket not connected');
      return false;
    }

    // Capture current FEN before move
    const prevFen = game.fen();

    // Create a copy to test the move
    const gameCopy = new Chess(prevFen);

    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (!move) {
        console.log('Invalid move:', { from: source, to: target });
        return false;
      }

    // Capture new FEN after move
    const nextFen = gameCopy.fen();

    // Get UCI notation (e.g., "e2e4")
    const uci = `${source}${target}${move.promotion || ''}`;

    // Calculate move time (time since turn started)
    const moveEndTime = performance.now();
    const moveTime = moveStartTimeRef.current
      ? (moveEndTime - moveStartTimeRef.current) / 1000
      : 0; // Convert to seconds

    // Evaluate the move and update player score
    evaluateMove(
      move,
      game, // previous state
      gameCopy, // new state
      moveTime,
      user?.rating || 1200, // player rating
      setLastMoveEvaluation,
      (scoreToAdd) => {
        setPlayerScore(prev => prev + scoreToAdd);
      },
      1 // Human vs Human
    );

    // Include metrics in the move data
    const moveData = {
      from: source,
      to: target,
      promotion: move.promotion || null,
      san: move.san,
      uci: uci,
      prev_fen: prevFen,
      next_fen: nextFen,
      is_mate_hint: !!(move.san?.includes('#') || gameCopy.isCheckmate()),
      is_check: gameCopy.inCheck(),
      is_stalemate: gameCopy.isStalemate(),
      // Add evaluation metrics
      move_time_ms: moveTime * 1000,
      player_rating: user?.rating || 1200
    };

    wsService.current.sendMove(moveData);

    // Add player's move to history in compact format: "move,time" (e.g., "e4,3.45")
    const compactMove = `${move.san},${moveTime.toFixed(2)}`;
    setGameHistory(prev => [...prev, compactMove]);

    // Update the local game state immediately
    setGame(gameCopy);

    // Update turn to opponent's turn
    setGameInfo(prev => ({
      ...prev,
      turn: gameCopy.turn() === 'w' ? 'white' : 'black'
    }));

    return true;
    } catch (error) {
      console.error('Invalid move error:', error.message);
      // Silently fail - move not allowed
      return false;
    }
  }

  const onDrop = (sourceSquare, targetSquare) => {
    // Disable drag and drop if game is complete
    if (gameComplete || gameInfo.status === 'finished') {
      return false;
    }

    return performMove(sourceSquare, targetSquare);
  };

  const handleSquareClick = (square) => {
    // Disable input if game is complete
    if (gameComplete || gameInfo.status === 'finished') {
      return;
    }

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
      } else {
        performMove(selectedSquare, square);
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
      // First try to resign/end the game with abandoned status
      await wsService.current.updateGameStatus('abandoned', null, 'killed');

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
                },
                ...(kingInDangerSquare && {
                  [kingInDangerSquare]: {
                    animation: 'kingFlicker 0.5s ease-in-out 3',
                    backgroundColor: 'rgba(255, 0, 0, 0.6)'
                  }
                })
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
          {/* Timer Display */}
          <div className="space-y-2" style={{ marginBottom: '20px' }}>
            {/* Opponent Timer */}
            <div className={`rounded-lg p-3 transition-all duration-300 ${
              activeTimer === (gameInfo.playerColor === 'white' ? 'b' : 'w')
                ? "bg-error/30 border border-error/50 shadow-lg scale-105"
                : "bg-white/10 border border-white/20"
            }`} style={{
              backgroundColor: activeTimer === (gameInfo.playerColor === 'white' ? 'b' : 'w') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${activeTimer === (gameInfo.playerColor === 'white' ? 'b' : 'w') ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: '8px',
              padding: '12px',
              transition: 'all 0.3s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>👤</span>
                  <span style={{ fontSize: '14px', color: 'white' }}>{gameInfo.opponentName}</span>
                  {activeTimer === (gameInfo.playerColor === 'white' ? 'b' : 'w') && (
                    <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: activeTimer === (gameInfo.playerColor === 'white' ? 'b' : 'w') ? '#ef4444' : 'white'
                }}>
                  {Math.floor(computerTime / 60).toString().padStart(2, '0')}:{(computerTime % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Player Timer */}
            <div className={`rounded-lg p-3 transition-all duration-300 ${
              activeTimer === (gameInfo.playerColor === 'white' ? 'w' : 'b')
                ? "bg-success/30 border border-success/50 shadow-lg scale-105"
                : "bg-white/10 border border-white/20"
            }`} style={{
              backgroundColor: activeTimer === (gameInfo.playerColor === 'white' ? 'w' : 'b') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${activeTimer === (gameInfo.playerColor === 'white' ? 'w' : 'b') ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: '8px',
              padding: '12px',
              transition: 'all 0.3s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>👤</span>
                  <span style={{ fontSize: '14px', color: 'white' }}>{user.name}</span>
                  {activeTimer === (gameInfo.playerColor === 'white' ? 'w' : 'b') && (
                    <div style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: activeTimer === (gameInfo.playerColor === 'white' ? 'w' : 'b') ? '#22c55e' : 'white'
                }}>
                  {Math.floor(playerTime / 60).toString().padStart(2, '0')}:{(playerTime % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>
          <GameInfo
            game={game}
            gameHistory={gameHistory}
            playerColor={gameInfo.playerColor}
            opponent={gameInfo.opponentName}
            gameStatus={gameInfo.status}
          />
          <ScoreDisplay
            playerScore={playerScore}
            lastMoveEvaluation={lastMoveEvaluation}
            computerScore={opponentScore}
            lastComputerEvaluation={lastOpponentEvaluation}
            isOnlineGame={true}
            players={{
              'w': gameData?.white_player,
              'b': gameData?.black_player
            }}
            playerColor={gameInfo.playerColor === 'white' ? 'w' : 'b'}
          />
        </div>
      </div>

      {/* Checkmate Notification */}
      {showCheckmate && checkmateWinner && (
        <CheckmateNotification
          winner={checkmateWinner}
          onComplete={() => setShowCheckmate(false)}
        />
      )}

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
          onBackToLobby={() => {
            // Clear invitation-related session storage to prevent auto-navigation
            sessionStorage.removeItem('lastInvitationAction');
            sessionStorage.removeItem('lastInvitationTime');
            sessionStorage.removeItem('lastGameId');

            // Set flag to indicate intentional lobby visit
            sessionStorage.setItem('intentionalLobbyVisit', 'true');
            sessionStorage.setItem('intentionalLobbyVisitTime', Date.now().toString());

            navigate('/lobby');
          }}
          isMultiplayer={true}
        />
      )}
    </div>
  );
};

export default PlayMultiplayer;