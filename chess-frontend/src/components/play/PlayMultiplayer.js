import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import PresenceConfirmationDialogSimple from './PresenceConfirmationDialogSimple';
import { Chessboard } from 'react-chessboard';
import GameInfo from './GameInfo';
import ScoreDisplay from './ScoreDisplay';
import GameCompletionAnimation from '../GameCompletionAnimation';
import CheckmateNotification from '../CheckmateNotification';
import PlayShell from './PlayShell'; // Layout wrapper (Phase 4)
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import WebSocketGameService from '../../services/WebSocketGameService';
import { getEcho } from '../../services/echoSingleton';
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

  // Inactivity detection state
  const [showPresenceDialog, setShowPresenceDialog] = useState(false);
  const [showPausedGame, setShowPausedGame] = useState(false);
  const [_lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [_isPausing, setIsPausing] = useState(false); // Presence lock to prevent dialog re-opening during pause attempts

  // Resume request state
  const [resumeRequestData, setResumeRequestData] = useState(null);
  const [resumeRequestCountdown, setResumeRequestCountdown] = useState(0);
  const [isWaitingForResumeResponse, setIsWaitingForResumeResponse] = useState(false);
  const [isLobbyResume, setIsLobbyResume] = useState(false); // Track if this is a lobby-initiated resume
  const [shouldAutoSendResume, setShouldAutoSendResume] = useState(false); // Trigger auto-send after initialization

  // Refs for stable inactivity detection and timers
  const lastActivityTimeRef = useRef(Date.now());
  const enabledRef = useRef(true);
  const gameActiveRef = useRef(false);
  const showPresenceDialogRef = useRef(false);
  const inactivityTimerRef = useRef(null);
  const isPausingRef = useRef(false);
  const resumeRequestTimer = useRef(null); // Ref for countdown timer
  const hasAutoRequestedResume = useRef(false); // Prevent duplicate auto-requests

  // Score tracking states
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState(null);
  const [lastOpponentEvaluation, setLastOpponentEvaluation] = useState(null);

  const { user } = useAuth();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const wsService = useRef(null);
  const moveStartTimeRef = useRef(null); // Tracks when current turn started for move timing

  // Memoize timer callback to prevent infinite re-renders
  const handleTimerStatusChange = useCallback((status) => {
    setGameInfo(prev => ({ ...prev, status }));
  }, []);

  // Timer hook for multiplayer game - using playerColor and opponentColor instead of computerTime
  const playerColor = gameInfo.playerColor === 'white' ? 'w' : 'b';
  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  const {
    playerTime,
    computerTime: opponentTime, // Rename computerTime to opponentTime for clarity
    activeTimer,
    isTimerRunning,
    setActiveTimer,
    handleTimer: startTimerInterval,
    switchTimer
  } = useGameTimer(
    playerColor,
    game,
    handleTimerStatusChange
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

    // Check if this is a lobby-initiated resume
    const isLobbyResumeInitiated = lastInvitationAction === 'resume_game';
    console.log('🎯 Lobby resume check:', {
      lastInvitationAction,
      isLobbyResumeInitiated,
      gameId: parseInt(gameId)
    });



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

      // Prevent rejoining a finished game (only allow active and waiting statuses, paused is not finished)
      const isGameFinished = data.status === 'finished' || data.status === 'aborted' || data.status === 'resigned';
      if (isGameFinished) {
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
        const lastGameId = sessionStorage.getItem('lastGameId');
        if (lastGameId === gameId.toString()) {
          console.log('✅ Game finished, marked to prevent auto-navigation loop');
        }

        return; // don't call joinGameChannel or initialize WebSocket
      }

      // Handle paused games - don't mark as complete
      if (data.status === 'paused') {
        console.log('⏸️ Game is paused, not finished');
        setGameInfo(prev => ({ ...prev, status: 'paused' }));

        // Check if this is a lobby-initiated resume
        if (isLobbyResumeInitiated) {
          console.log('🎯 Lobby resume detected - will request handshake');
          setIsLobbyResume(true);
          // Show paused overlay but don't show regular resume button
          setShowPausedGame(true);
          // Flag to auto-send resume request after initialization completes
          setShouldAutoSendResume(true);
        }

        // Continue with initialization for paused games
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
        // Note: Lobby resume request is sent after initialization completes, not here
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

      wsService.current.on('gameResumed', (event) => {
        console.log('🎮 Game resumed event received:', event);
        handleGameResumed(event);
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

      // Check if already connected (Echo singleton might be reused)
      if (wsService.current.isConnected) {
        console.log('[PlayMultiplayer] WebSocket already connected after initialization');
        setConnectionStatus('connected');
      }

      setLoading(false);

    } catch (err) {
      console.error('Error initializing game:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [gameId, user]);

  // Handle game activation
  const handleGameActivated = useCallback((event) => {
    setGameInfo(prev => ({
      ...prev,
      status: 'active'
    }));
  }, []);

  // Handle game resumed event
  const handleGameResumed = useCallback((event) => {
    console.log('🎮 Handling game resumed:', event);

    // Update game state to active
    setGameInfo(prev => ({
      ...prev,
      status: 'active',
      white_time_remaining_ms: event.white_time_remaining_ms,
      black_time_remaining_ms: event.black_time_remaining_ms,
      turn: event.turn
    }));

    // Close the presence dialog for both players
    setShowPausedGame(false);
    setShowPresenceDialog(false);
    showPresenceDialogRef.current = false;
    setResumeRequestData(null);
    setIsWaitingForResumeResponse(false);
    setResumeRequestCountdown(0);
    setIsLobbyResume(false);

    // Reset inactivity timer to start fresh from resume
    lastActivityTimeRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    console.log('✅ Game resumed successfully - dialog closed, game state updated, inactivity timer reset');
  }, []);

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

      // Update activity tracking when opponent makes a move
      if (event.user_id !== user?.id) {
        handleMoveActivity();
      }

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
  }, [user?.id, gameData, gameId, checkForCheckmate]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const whiteTimeRemaining = gameInfo.playerColor === 'white' ? playerTime * 1000 : opponentTime * 1000;
      const blackTimeRemaining = gameInfo.playerColor === 'black' ? playerTime * 1000 : opponentTime * 1000;

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
  }, [user?.id, gameId, gameHistory, gameInfo, playerScore, playerTime, opponentTime]);

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

  // Handle user activity - only track actual moves, not mouse hover
  const handleMoveActivity = useCallback(() => {
    const now = Date.now();
    lastActivityTimeRef.current = now;

    if (showPresenceDialogRef.current) {
      setShowPresenceDialog(false);
      showPresenceDialogRef.current = false;
    }

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // Remove mouse-based activity tracking - only track moves
  // The presence detection will now only track actual chess moves

  // Stable inactivity detection effect
  useEffect(() => {
    // Update refs when state changes
    gameActiveRef.current = !gameComplete && gameInfo.status === 'active';
    showPresenceDialogRef.current = showPresenceDialog;
    
    console.log('[InactivityEffect] deps', { 
      gameComplete, 
      gameStatus: gameInfo.status, 
      showPresenceDialog,
      gameActive: gameActiveRef.current 
    });
  }, [gameComplete, gameInfo.status, showPresenceDialog]);

  // Handle presence dialog timeout with guards
  const handlePresenceTimeout = async () => {
    if (isPausingRef.current) return; // Prevent double fire
    isPausingRef.current = true;

    try {
      if (gameInfo.status === 'active') {
        console.log('[Inactivity] Attempting to pause game');
        await wsService.current?.pauseGame();
        // Game will be paused via WebSocket events
      } else {
        console.log('[Inactivity] Game not active, skipping pause attempt');
      }
    } catch (error) {
      // If already paused, ignore "Game is not active" noise
      if (!String(error?.message || '').includes('not active')) {
        console.error('[Inactivity] pauseGame error:', error);
      } else {
        console.log('[Inactivity] Game already paused, ignoring error');
      }
    } finally {
      // Close the dialog and stop inactivity loop
      setShowPresenceDialog(false);
      showPresenceDialogRef.current = false;
      isPausingRef.current = false;
    }
  };

  // Inactivity detection with proper guards
  useEffect(() => {
    // Always clear previous timer
    clearInterval(inactivityTimerRef.current);

    const shouldRun =
      gameActiveRef.current &&
      gameInfo.status === 'active' &&
      !showPresenceDialog &&
      !isWaitingForResumeResponse &&
      !showPausedGame;

    if (!shouldRun) {
      return;
    }

    console.log('Starting inactivity detection - conditions met');

    const checkInactivity = () => {
      if (!enabledRef.current || !gameActiveRef.current) return;
      if (showPresenceDialog || showPausedGame || isWaitingForResumeResponse) return;

      const currentTime = Date.now();
      const inactiveDuration = (currentTime - lastActivityTimeRef.current) / 1000; // in seconds

      // Only log when significant time has passed to reduce spam
      if (inactiveDuration > 55 && inactiveDuration < 61) {
        console.log('[Inactivity] Duration:', inactiveDuration.toFixed(1), 's');
      }

      if (inactiveDuration >= 60 && !showPresenceDialogRef.current && !isPausingRef.current) {
        console.log('[Inactivity] Opening presence dialog after', inactiveDuration.toFixed(1), 's');
        setShowPresenceDialog(true);
        showPresenceDialogRef.current = true;

        // Clear any existing timeout
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }

        // Set timeout for dialog response
        inactivityTimerRef.current = setTimeout(() => {
          if (showPresenceDialogRef.current) {
            console.log('[Inactivity] No response received - attempting to pause game');
            handlePresenceTimeout();
          }
        }, 10000); // 10 seconds
      }
    };

    const interval = setInterval(checkInactivity, 1000);

    return () => {
      clearInterval(interval);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [gameInfo.status, showPresenceDialog, showPausedGame, isWaitingForResumeResponse]); // Proper dependencies

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
  }, [gameId, user?.id, initializeGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up user channel listeners for resume requests
  useEffect(() => {
    if (!user) return;

    const echo = getEcho();
    if (!echo) {
      console.warn('[PlayMultiplayer] Echo not available for resume request listeners');
      return;
    }

    const userChannel = echo.private(`App.Models.User.${user.id}`);

    console.log('[PlayMultiplayer] Setting up resume request listeners for user:', user.id);

    // Listen for resume requests from opponent
    userChannel.listen('.resume.request.sent', (data) => {
      console.log('[PlayMultiplayer] 📨 Resume request received:', data);

      // Check if this is for the current game
      if (data.game_id && parseInt(data.game_id) === parseInt(gameId)) {
        // Show resume request notification in the paused dialog
        setResumeRequestData({
          type: 'received',
          requested_by: data.requesting_user?.id,
          requesting_user: data.requesting_user,
          opponentName: data.requesting_user?.name || 'Opponent',
          expires_at: data.expires_at
        });

        console.log('[PlayMultiplayer] Resume request for current game, showing notification');
      }
    });

    // Listen for resume request responses
    userChannel.listen('.resume.request.response', (data) => {
      console.log('[PlayMultiplayer] 📨 Resume request response received:', data);

      // Check if this is for the current game
      if (data.game_id && parseInt(data.game_id) === parseInt(gameId)) {
        if (data.response === 'accepted') {
          // Game was resumed by opponent
          console.log('[PlayMultiplayer] Resume request accepted, game should resume');
          setShowPausedGame(false); // Close the presence dialog
          setResumeRequestData(null);
          setIsWaitingForResumeResponse(false);
          setResumeRequestCountdown(0);
          setIsLobbyResume(false); // Reset lobby resume flag

          // Clear any countdown timer
          if (resumeRequestTimer.current) {
            clearInterval(resumeRequestTimer.current);
            resumeRequestTimer.current = null;
          }

          // Optionally show a toast message
          // toast.success('Your resume request was accepted!');
        } else if (data.response === 'declined') {
          // Game was not resumed by opponent
          console.log('[PlayMultiplayer] Resume request declined');
          setResumeRequestData(null);
          setIsWaitingForResumeResponse(false);
          setResumeRequestCountdown(0);

          // Clear any countdown timer
          if (resumeRequestTimer.current) {
            clearInterval(resumeRequestTimer.current);
            resumeRequestTimer.current = null;
          }

          // Optionally show a toast message
          // toast.error('Your resume request was declined');
        }
      }
    });

    // Listen for resume request expiration
    userChannel.listen('.resume.request.expired', (data) => {
      console.log('[PlayMultiplayer] 📨 Resume request expired event received:', data);

      // Check if this is for the current game
      if (data.game_id && parseInt(data.game_id) === parseInt(gameId)) {
        console.log('[PlayMultiplayer] Resume request expired for current game');

        // Clear all resume request state
        setResumeRequestData(null);
        setIsWaitingForResumeResponse(false);
        setResumeRequestCountdown(0);

        // Clear any countdown timer
        if (resumeRequestTimer.current) {
          clearInterval(resumeRequestTimer.current);
          resumeRequestTimer.current = null;
        }

        // If we were the ones who sent the request, allow them to try again
        if (isLobbyResume) {
          setIsLobbyResume(false);
        }

        // Optionally show a toast message
        // toast.info('Resume request expired');
      }
    });

    return () => {
      console.log('[PlayMultiplayer] Cleaning up resume request listeners');
      userChannel.stopListening('.resume.request.sent');
      userChannel.stopListening('.resume.request.response');
      userChannel.stopListening('.resume.request.expired');
    };
  }, [user?.id, gameId]);

  // Auto-send resume request for lobby-initiated resumes
  useEffect(() => {
    if (shouldAutoSendResume && connectionStatus === 'connected' && wsService.current && !hasAutoRequestedResume.current) {
      console.log('🎯 Auto-sending lobby resume request after initialization complete');

      // Mark as requested to prevent duplicates
      hasAutoRequestedResume.current = true;

      // Small delay to ensure all states are properly set
      const timer = setTimeout(() => {
        handleRequestResume();
        setShouldAutoSendResume(false); // Reset flag after sending
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [shouldAutoSendResume, connectionStatus]);

  const performMove = (source, target) => {
    if (gameComplete || gameInfo.status === 'finished') return false;

    // Prevent moves if game is not active or paused (wait for resume)
    if (gameInfo.status !== 'active') {
      console.log('Game not active yet, status:', gameInfo.status);
      // Silently prevent move - user will see appropriate status message
      return false;
    }

    if (gameInfo.turn !== gameInfo.playerColor) {
      console.log('Not your turn');
      return false;
    }

    // Check actual WebSocket connection state
    const isWsConnected = wsService.current?.isWebSocketConnected?.() || connectionStatus === 'connected';
    if (!isWsConnected) {
      console.log('WebSocket not connected. Status:', connectionStatus, 'Actual:', wsService.current?.isConnected);
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

    // Update activity tracking for move
    handleMoveActivity();

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
    // Disable drag and drop if game is complete or not active
    if (gameComplete || gameInfo.status === 'finished' || gameInfo.status !== 'active') {
      return false;
    }

    return performMove(sourceSquare, targetSquare);
  };

  const handleSquareClick = (square) => {
    // Disable input if game is complete or not active
    if (gameComplete || gameInfo.status === 'finished' || gameInfo.status !== 'active') {
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
    if (!window.confirm('⚠️ Are you sure you want to forfeit this game? You will LOSE and your opponent will WIN. This action cannot be undone.')) {
      return;
    }

    try {
      // Forfeit the game - player loses, opponent wins
      await wsService.current.updateGameStatus('finished', null, 'forfeit');

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

  // Loading and error states - return early before PlayShell wrapper
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

  // Check feature flag for PlayShell wrapper
  const usePlayShell = process.env.REACT_APP_USE_PLAY_SHELL === 'true';

  // Extract sections for PlayShell slots (COMPOSITION ONLY - no logic changes)
  const headerSection = (
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
          ) : gameInfo.status === 'finished' ? (
            `Game ${gameData?.result?.replace('_', ' ') || 'ended'}`
          ) : (
            `Game ${gameInfo.status}`
          )}
        </div>
      </div>
    </div>
  );

  const boardAreaSection = (
    <div className="board-section">
      {/* Compact Timer Display Above Board */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        gap: '8px',
        fontSize: '14px'
      }}>
        {/* Opponent Timer - Compact */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '6px',
          backgroundColor: activeTimer === opponentColor ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          border: `1px solid ${activeTimer === opponentColor ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
          flex: '1',
          minWidth: '120px'
        }}>
          <span style={{ fontSize: '16px', color: activeTimer === opponentColor ? '#ef4444' : '#ccc' }}>
            {activeTimer === opponentColor && (
              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
            )}
            {gameInfo.opponentName.split(' ')[0]}
          </span>
          <span style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            color: activeTimer === opponentColor ? '#ef4444' : '#ccc',
            marginLeft: 'auto'
          }}>
            {Math.floor(opponentTime / 60).toString().padStart(2, '0')}:{(opponentTime % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {/* VS separator */}
        <div style={{
          fontSize: '12px',
          color: '#666',
          fontWeight: 'bold',
          padding: '0 4px'
        }}>
          VS
        </div>

        {/* Player Timer - Compact */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '6px',
          backgroundColor: activeTimer === playerColor ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          border: `1px solid ${activeTimer === playerColor ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
          flex: '1',
          minWidth: '120px'
        }}>
          <span style={{ fontSize: '16px', color: activeTimer === playerColor ? '#22c55e' : '#ccc' }}>
            {activeTimer === playerColor && (
              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
            )}
            {user.name.split(' ')[0]}
          </span>
          <span style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            color: activeTimer === playerColor ? '#22c55e' : '#ccc',
            marginLeft: 'auto'
          }}>
            {Math.floor(playerTime / 60).toString().padStart(2, '0')}:{(playerTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

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
          {gameInfo.status === 'finished' && (
            <div className="game-ended-controls">
              <button onClick={() => handleNewGame(true)} className="rematch-button">
                Rematch
              </button>
              <button onClick={() => handleNewGame(false)} className="new-game-button">
                New Game
              </button>
            </div>
          )}
          <button onClick={handleKillGame} className="forfeit-game-button" style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px',
            fontSize: '14px'
          }}>
            ⚠️ Forfeit Game
          </button>
        </div>
      </div>
    </div>
  );

  const sidebarSection = (
    <div className="game-sidebar">
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
  );

  const modalsSection = (
    <>
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
    </>
  );

  // Render with PlayShell wrapper if feature flag is enabled
  if (usePlayShell) {
    return (
      <>
        <PlayShell
          header={headerSection}
          boardArea={boardAreaSection}
          sidebar={sidebarSection}
          modals={modalsSection}
          showBoard={true} // Multiplayer always shows board (no pre-game setup)
          mode="multiplayer"
        />

        {/* Presence Confirmation Dialog - OUTSIDE PlayShell to avoid z-index issues */}
        <PresenceConfirmationDialogSimple
          open={showPresenceDialog}
          onConfirm={() => {
            console.log('[PresenceConfirmationDialogSimple] User confirmed presence');
            setShowPresenceDialog(false);
            showPresenceDialogRef.current = false;
            setLastActivityTime(Date.now());
            lastActivityTimeRef.current = Date.now();
          }}
          onCloseTimeout={async () => {
            console.log('[PresenceConfirmationDialogSimple] Timeout - pausing game');

            // Set presence lock to prevent dialog re-opening during pause attempt
            setIsPausing(true);
            isPausingRef.current = true;

            try {
              const pauseResult = await wsService.current?.pauseGame();
              console.log('[PresenceConfirmationDialogSimple] Game paused successfully:', pauseResult);

              // Only close dialog if pause succeeded
              setShowPresenceDialog(false);
              showPresenceDialogRef.current = false;

              // Show paused game UI instead of dialog
              setShowPausedGame(true);

              // Release presence lock after a short delay to prevent immediate re-opening
              setTimeout(() => {
                setIsPausing(false);
                isPausingRef.current = false;
              }, 2000);
            } catch (error) {
              console.error('[PresenceConfirmationDialogSimple] Failed to pause game:', error);
              // If pausing fails, don't close the dialog - let it try again
              setIsPausing(false);
              isPausingRef.current = false;
              return;
            }
          }}
        />
      </>
    );
  }

  // Resume request handlers
  const handleRequestResume = async () => {
    if (!wsService.current) return;

    try {
      setIsWaitingForResumeResponse(true);
      const result = await wsService.current.requestResume();

      console.log('[PlayMultiplayer] Resume request sent:', result);

      // Start countdown timer
      setResumeRequestData({ type: 'sent' });
      setResumeRequestCountdown(10);
      startResumeCountdown(10);

    } catch (error) {
      console.error('[PlayMultiplayer] Failed to send resume request:', error);
      setIsWaitingForResumeResponse(false);

      // Show specific error message to user
      if (error.message && error.message.includes('already pending')) {
        // Resume request already pending - don't show error, just reset state
        setResumeRequestData({ type: 'sent' });
        // Try to get current countdown if we can, otherwise start fresh
        setResumeRequestCountdown(10);
        startResumeCountdown(10);
      } else {
        // Other errors - you could show a toast message here
        // toast.error(error.message || 'Failed to send resume request');
      }
    }
  };

  const handleResumeResponse = async (accepted) => {
    if (!wsService.current) return;

    try {
      await wsService.current.respondToResumeRequest(accepted);

      if (accepted) {
        console.log('[PlayMultiplayer] Resume request accepted - game should resume');
        setShowPausedGame(false);
        setResumeRequestData(null);
        setResumeRequestCountdown(0);
        setIsWaitingForResumeResponse(false);
        setIsLobbyResume(false); // Reset lobby resume flag
        // The game should resume automatically via WebSocket events
      } else {
        console.log('[PlayMultiplayer] Resume request declined');
        setResumeRequestData(null);
        setResumeRequestCountdown(0);
        setIsWaitingForResumeResponse(false);
        // Keep lobby resume flag for declined requests so user can try again
      }

      // Clear countdown timer
      if (resumeRequestTimer.current) {
        clearInterval(resumeRequestTimer.current);
        resumeRequestTimer.current = null;
      }

    } catch (error) {
      console.error('[PlayMultiplayer] Failed to respond to resume request:', error);
    }
  };

  const cancelResumeRequest = () => {
    setResumeRequestData(null);
    setResumeRequestCountdown(0);
    setIsWaitingForResumeResponse(false);

    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
      resumeRequestTimer.current = null;
    }
  };

  const startResumeCountdown = (seconds) => {
    let countdown = seconds;

    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
    }

    const timer = setInterval(() => {
      countdown--;
      setResumeRequestCountdown(countdown);

      if (countdown <= 0) {
        clearInterval(timer);
        resumeRequestTimer.current = null;
        setResumeRequestData(null);
        setIsWaitingForResumeResponse(false);
        console.log('[PlayMultiplayer] Resume request expired - fallback timer');
      }
    }, 1000);

    resumeRequestTimer.current = timer;
  };

  // Fallback to original layout (backward compatibility)
  return (
    <>
      <div className="game-container">
        {/* Paused Game Overlay */}
        {showPausedGame && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              padding: '32px',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'white',
              maxWidth: '450px',
              border: '2px solid #333',
              width: '90%'
            }}>
              <h2 style={{ marginBottom: '16px', color: '#ffd700' }}>
                {isLobbyResume ? '🎯 Resume Game' : '⏸️ Game Paused'}
              </h2>
              <p style={{ marginBottom: '24px', fontSize: '16px' }}>
                {isLobbyResume
                  ? 'Requesting to resume this paused game from the lobby. Waiting for opponent to accept...'
                  : 'Game has been paused due to inactivity.'
                }
              </p>

              {/* Resume Request Section */}
              {!resumeRequestData ? (
                // Request Resume Button or Auto-requesting Message
                <div>
                  {isLobbyResume ? (
                    // Show auto-requesting message for lobby resumes
                    <div>
                      <div style={{
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        padding: '14px 28px',
                        borderRadius: '8px',
                        fontSize: '16px',
                        marginRight: '12px',
                        marginBottom: '12px',
                        display: 'inline-block'
                      }}>
                        📤 Sending resume request...
                      </div>
                      {isWaitingForResumeResponse && resumeRequestCountdown > 0 && (
                        <div style={{
                          fontSize: '14px',
                          color: '#ffd700',
                          marginTop: '8px'
                        }}>
                          Waiting for opponent to accept... {resumeRequestCountdown}s
                        </div>
                      )}
                    </div>
                  ) : (
                    // Regular resume button for inactivity pauses
                    <div>
                      <button
                        onClick={handleRequestResume}
                        disabled={isWaitingForResumeResponse}
                        style={{
                          backgroundColor: isWaitingForResumeResponse ? '#555' : '#4CAF50',
                          color: 'white',
                          border: 'none',
                          padding: '14px 28px',
                          borderRadius: '8px',
                          fontSize: '16px',
                          cursor: isWaitingForResumeResponse ? 'not-allowed' : 'pointer',
                          marginRight: '12px',
                          marginBottom: '12px'
                        }}
                      >
                        {isWaitingForResumeResponse ? 'Requesting...' : 'Request Resume'}
                      </button>
                      {isWaitingForResumeResponse && resumeRequestCountdown > 0 && (
                        <div style={{
                          fontSize: '14px',
                          color: '#ffd700',
                          marginTop: '8px'
                        }}>
                          Waiting for response... {resumeRequestCountdown}s
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Show Resume Request Status
                <div>
                  {resumeRequestData.type === 'sent' ? (
                    <div>
                      <p style={{ color: '#4CAF50', marginBottom: '16px' }}>
                        {isLobbyResume
                          ? '📤 Resume request sent from lobby!'
                          : 'Resume request sent to opponent!'
                        }
                      </p>
                      {resumeRequestCountdown > 0 && (
                        <div style={{
                          fontSize: '14px',
                          color: '#ffd700',
                          marginBottom: '16px'
                        }}>
                          Waiting for opponent to accept... {resumeRequestCountdown}s
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={cancelResumeRequest}
                          style={{
                            backgroundColor: '#ff6b6b',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel Request
                        </button>
                        {isLobbyResume && (
                          <button
                            onClick={() => navigate('/lobby')}
                            style={{
                              backgroundColor: '#666',
                              color: 'white',
                              border: 'none',
                              padding: '10px 20px',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}
                          >
                            Back to Lobby
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: '#ffa726', marginBottom: '16px' }}>
                        {resumeRequestData.opponentName} wants to resume the game!
                      </p>
                      {resumeRequestCountdown > 0 && (
                        <div style={{
                          fontSize: '14px',
                          color: '#ffd700',
                          marginBottom: '16px'
                        }}>
                          Auto-declines in {resumeRequestCountdown}s
                        </div>
                      )}
                      <div>
                        <button
                          onClick={() => handleResumeResponse(true)}
                          style={{
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            marginRight: '12px'
                          }}
                        >
                          ✅ Accept
                        </button>
                        <button
                          onClick={() => handleResumeResponse(false)}
                          style={{
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer'
                          }}
                        >
                          ❌ Decline
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #444' }}>
                <button
                  onClick={() => {
                    setShowPausedGame(false);
                    navigate('/lobby');
                  }}
                  style={{
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Go To Lobby
                </button>
              </div>
            </div>
          </div>
        )}
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
              ) : gameInfo.status === 'finished' ? (
                `Game ${gameData?.result?.replace('_', ' ') || 'ended'}`
              ) : (
                `Game ${gameInfo.status}`
              )}
            </div>
          </div>
        </div>

        <div className="game-layout">
          <div className="board-section">
            {/* Compact Timer Display Above Board */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              gap: '8px',
              fontSize: '14px'
            }}>
              {/* Opponent Timer - Compact */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: activeTimer === opponentColor ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${activeTimer === opponentColor ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
                flex: '1',
                minWidth: '120px'
              }}>
                <span style={{ fontSize: '16px', color: activeTimer === opponentColor ? '#ef4444' : '#ccc' }}>
                  {activeTimer === opponentColor && (
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
                  )}
                  {gameInfo.opponentName.split(' ')[0]}
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: activeTimer === opponentColor ? '#ef4444' : '#ccc',
                  marginLeft: 'auto'
                }}>
                  {Math.floor(opponentTime / 60).toString().padStart(2, '0')}:{(opponentTime % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* VS separator */}
              <div style={{
                fontSize: '12px',
                color: '#666',
                fontWeight: 'bold',
                padding: '0 4px'
              }}>
                VS
              </div>

              {/* Player Timer - Compact */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: activeTimer === playerColor ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${activeTimer === playerColor ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
                flex: '1',
                minWidth: '120px'
              }}>
                <span style={{ fontSize: '16px', color: activeTimer === playerColor ? '#22c55e' : '#ccc' }}>
                  {activeTimer === playerColor && (
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
                  )}
                  {user.name.split(' ')[0]}
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: activeTimer === playerColor ? '#22c55e' : '#ccc',
                  marginLeft: 'auto'
                }}>
                  {Math.floor(playerTime / 60).toString().padStart(2, '0')}:{(playerTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

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
                {gameInfo.status === 'finished' && (
                  <div className="game-ended-controls">
                    <button onClick={() => handleNewGame(true)} className="rematch-button">
                      Rematch
                    </button>
                    <button onClick={() => handleNewGame(false)} className="new-game-button">
                      New Game
                    </button>
                  </div>
                )}
                <button onClick={handleKillGame} className="forfeit-game-button" style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px',
                  fontSize: '14px'
                }}>
                  ⚠️ Forfeit Game
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

      {/* Presence Confirmation Dialog - OUTSIDE game-container to avoid z-index issues */}
      <PresenceConfirmationDialogSimple
        open={showPresenceDialog}
        onConfirm={() => {
          console.log('[PresenceConfirmationDialogSimple] User confirmed presence');
          setShowPresenceDialog(false);
          showPresenceDialogRef.current = false;
          setLastActivityTime(Date.now());
          lastActivityTimeRef.current = Date.now();
        }}
        onCloseTimeout={async () => {
          console.log('[PresenceConfirmationDialogSimple] Timeout - attempting to pause game');

          // Set presence lock to prevent dialog re-opening during pause attempt
          setIsPausing(true);
          isPausingRef.current = true;

          try {
            const pauseResult = await wsService.current?.pauseGame();
            console.log('[PresenceConfirmationDialogSimple] Game paused successfully:', pauseResult);

            // Only close dialog if pause succeeded
            setShowPresenceDialog(false);
            showPresenceDialogRef.current = false;

            // Show paused game UI instead of dialog
            setShowPausedGame(true);

            // Release presence lock after a short delay to prevent immediate re-opening
            setTimeout(() => {
              setIsPausing(false);
              isPausingRef.current = false;
            }, 2000);
          } catch (error) {
            console.error('[PresenceConfirmationDialogSimple] Failed to pause game:', error);
            // If pausing fails, don't close the dialog - let it try again
            setIsPausing(false);
            isPausingRef.current = false;
            return;
          }
        }}
      />
    </>
  );
};

export default PlayMultiplayer;
