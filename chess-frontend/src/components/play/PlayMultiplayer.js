import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import PresenceConfirmationDialogSimple from './PresenceConfirmationDialogSimple';
import NetworkErrorDialog from './NetworkErrorDialog';
import { Chessboard } from 'react-chessboard';
import GameCompletionAnimation from '../GameCompletionAnimation';
import CheckmateNotification from '../CheckmateNotification';
import NewGameRequestDialog from '../NewGameRequestDialog';
import PlayShell from './PlayShell'; // Layout wrapper (Phase 4)
import GameContainer from './GameContainer'; // Unified game container
import { useAuth } from '../../contexts/AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { useGameNavigation } from '../../contexts/GameNavigationContext';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { BACKEND_URL } from '../../config';
import WebSocketGameService from '../../services/WebSocketGameService';
import { getEcho } from '../../services/echoSingleton';
import { evaluateMove } from '../../utils/gameStateUtils';
import { encodeGameHistory } from '../../utils/gameHistoryStringUtils';
import { saveGameHistory } from '../../services/gameHistoryService';
import { createResultFromMultiplayerGame } from '../../utils/resultStandardization';
import { useMultiplayerTimer } from '../../utils/timerUtils';
import { calculateRemainingTime } from '../../utils/timerCalculator';
import { saveUnfinishedGame } from '../../services/unfinishedGameService';

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
    opponentName: 'Rival'
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
  const [savedGameHistoryId, setSavedGameHistoryId] = useState(null);

  // Inactivity detection state
  const [showPresenceDialog, setShowPresenceDialog] = useState(false);
  const [showPausedGame, setShowPausedGame] = useState(false);
  const [pausedByUserName, setPausedByUserName] = useState(null); // Track who caused the pause

  // Resume request state
  const [resumeRequestData, setResumeRequestData] = useState(null);

  // New game/rematch request state
  const [newGameRequest, setNewGameRequest] = useState(null);
  const [resumeRequestCountdown, setResumeRequestCountdown] = useState(0);
  const [isWaitingForResumeResponse, setIsWaitingForResumeResponse] = useState(false);
  const [isLobbyResume, setIsLobbyResume] = useState(false); // Track if this is a lobby-initiated resume
  const [shouldAutoSendResume, setShouldAutoSendResume] = useState(false); // Trigger auto-send after initialization

  // Notification system
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);

  // Error notification state
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  // Draw offer state
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [drawOfferedByMe, setDrawOfferedByMe] = useState(false);

  // Championship context state
  const [championshipContext, setChampionshipContext] = useState(null);

  // Initial timer state (calculated from move history)
  const [initialTimerState, setInitialTimerState] = useState({
    whiteMs: 10 * 60 * 1000,
    blackMs: 10 * 60 * 1000,
    incrementMs: 0
  });

  // Refs for stable inactivity detection and timers
  const lastActivityTimeRef = useRef(Date.now());
  const enabledRef = useRef(true);
  const gameActiveRef = useRef(false);
  const showPresenceDialogRef = useRef(false);
  const inactivityCheckIntervalRef = useRef(null); // For setInterval (checking every 1s)
  // Note: inactivityTimerRef removed - the PresenceConfirmationDialogSimple component
  // now handles its own countdown timer internally via the onCloseTimeout callback
  const isPausingRef = useRef(false);
  const resumeRequestTimer = useRef(null); // Ref for countdown timer
  const countdownRef = useRef(0); // Precise countdown tracking
  const hasAutoRequestedResume = useRef(false); // Prevent duplicate auto-requests
  const hasReceivedResumeRequest = useRef(false); // Track if we received a resume request from opponent
  const isReadyForAutoSend = useRef(false); // Ensure listeners ready before auto-send

  // Refs to prevent stale closures in inactivity timer
  const turnRef = useRef(gameInfo.turn);
  const myColorRef = useRef(gameInfo.playerColor);

  // Score tracking states
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState(null);
  const [lastOpponentEvaluation, setLastOpponentEvaluation] = useState(null);

  // Track evaluated moves to prevent StrictMode double-evaluation
  const evaluatedMovesRef = useRef(new Set());
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  const { user } = useAuth();
  const { invalidateGameHistory } = useAppData();
  const { registerActiveGame, unregisterActiveGame, updateGameState } = useGameNavigation();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const wsService = useRef(null);
  const moveStartTimeRef = useRef(null); // Tracks when current turn started for move timing
  const gameRegisteredRef = useRef(false); // Track if game is already registered to prevent duplicates

  // Derive player color from IDs (single source of truth)
  // Don't store in state - compute every render to stay in sync
  const myColor = React.useMemo(() => {
    if (!user?.id || !gameData) return null;
    const userId = parseInt(user.id);
    const whiteId = parseInt(gameData.white_player_id);
    const blackId = parseInt(gameData.black_player_id);

    if (userId === whiteId) return 'w';
    if (userId === blackId) return 'b';

    console.error('🚨 User ID does not match any player:', { userId, whiteId, blackId });
    return null;
  }, [user?.id, gameData]);

  // Server turn comes from game state
  const serverTurn = gameInfo.turn === 'white' ? 'w' : gameInfo.turn === 'black' ? 'b' : null;

  // Use the same truth for both UI and timer
  const isMyTurn = (myColor && serverTurn) ? (myColor === serverTurn) : false;

  // Timer flag callback
  const handleTimerFlag = useCallback(async (who) => {
    console.log('[Timer] Flag - time ran out:', who);

    // Immediately update local status to prevent further moves
    setGameInfo(prev => ({
      ...prev,
      status: 'finished'
    }));

    // Call server to forfeit game due to timeout
    try {
      if (wsService.current) {
        console.log('[Timer] Sending forfeit request to server (timeout)...');
        await wsService.current.forfeitGame('timeout');
        console.log('[Timer] ✅ Forfeit request sent successfully');
        // The gameEnd event from server will trigger handleGameEnd and show the modal
      }
    } catch (error) {
      console.error('[Timer] ❌ Failed to send forfeit request:', error);

      // Fallback: Show end modal manually if server call fails
      const isPlayerTimeout = who === 'player';
      const winnerUserId = isPlayerTimeout
        ? (gameData?.white_player_id === user?.id ? gameData?.black_player_id : gameData?.white_player_id)
        : user?.id;

      const resultData = {
        game_over: true,
        result: isPlayerTimeout ? (myColor === 'w' ? '0-1' : '1-0') : (myColor === 'w' ? '1-0' : '0-1'),
        end_reason: 'timeout',
        winner_user_id: winnerUserId,
        winner_player: isPlayerTimeout ? (myColor === 'w' ? 'black' : 'white') : myColor === 'w' ? 'white' : 'black',
        fen_final: game.fen(),
        move_count: game.history().length,
        ended_at: new Date().toISOString(),
        white_player: gameData?.white_player, // ✅ Fixed: Use snake_case from backend
        black_player: gameData?.black_player, // ✅ Fixed: Use snake_case from backend
        white_player_score: 0, // Will be updated by backend
        black_player_score: 0, // Will be updated by backend
        isPlayerWin: !isPlayerTimeout,
        isPlayerDraw: false
      };

      setGameResult(resultData);
      setGameComplete(true);
    }
  }, [wsService, gameData, user, myColor, game]);

  // New simplified timer hook with calculated initial values and increment support
  const { myMs, oppMs, setMyMs, setOppMs } = useMultiplayerTimer({
    myColor,
    serverTurn,
    gameStatus: gameInfo.status,
    onFlag: handleTimerFlag,
    initialMyMs: myColor === 'w' ? initialTimerState.whiteMs : initialTimerState.blackMs,
    initialOppMs: myColor === 'w' ? initialTimerState.blackMs : initialTimerState.whiteMs,
    incrementMs: initialTimerState.incrementMs
  });

  // Helper to get current time data for both players
  const getTimeData = useCallback(() => {
    const whiteTimeMs = myColor === 'w' ? myMs : oppMs;
    const blackTimeMs = myColor === 'b' ? myMs : oppMs;
    return {
      white_time_remaining_ms: whiteTimeMs,
      black_time_remaining_ms: blackTimeMs
    };
  }, [myColor, myMs, oppMs]);

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

  // Fetch championship context (non-intrusive - only activates for championship games)
  const fetchChampionshipContext = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${gameId}/championship-context`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.is_championship) {
          console.log('[Championship] Championship context loaded:', result.data);
          setChampionshipContext(result.data);
          // Persist championship context to sessionStorage for recovery on refresh/navigation
          sessionStorage.setItem(`championship_context_${gameId}`, JSON.stringify(result.data));
        } else {
          // Regular multiplayer game - no championship context
          console.log('[Championship] Regular multiplayer game detected');
          setChampionshipContext(null);
          sessionStorage.removeItem(`championship_context_${gameId}`);
        }
      } else {
        // Failed to fetch - assume it's a regular game
        console.log('[Championship] Could not fetch championship context, assuming regular game');
        setChampionshipContext(null);
        sessionStorage.removeItem(`championship_context_${gameId}`);
      }
    } catch (error) {
      // Error fetching - assume it's a regular game (non-blocking)
      console.log('[Championship] Error fetching championship context, assuming regular game:', error);
      setChampionshipContext(null);
      sessionStorage.removeItem(`championship_context_${gameId}`);
    }
  }, [gameId]);

  // Initialize WebSocket connection and load game data
  const initializeGame = useCallback(async () => {
    if (!gameId || !user) return;

    // Check if user came from proper invitation flow (optional security measure)
    const lastInvitationAction = sessionStorage.getItem('lastInvitationAction');
    const lastInvitationTime = sessionStorage.getItem('lastInvitationTime');

    console.log('Game access check:', {
      gameId,
      userId: user.id,
      lastInvitationAction,
      lastInvitationTime,
      timeSinceInvitation: lastInvitationTime ? Date.now() - parseInt(lastInvitationTime) : 'N/A'
    });

    // Check if user has proper authorization to access this specific game

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

      // Reset registration flag for new game and register it
      gameRegisteredRef.current = false;
      registerActiveGame(data.id, data.status);
      gameRegisteredRef.current = true;
      console.log('[PlayMultiplayer] Game registered with navigation context:', data.id);

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
          // Derive winner_player from winner_user_id for GameCompletionAnimation
          winner_player: data.winner_user_id === data.white_player?.id ? 'white' : (data.winner_user_id === data.black_player?.id ? 'black' : null),
          fen_final: data.fen,
          move_count: data.move_count,
          ended_at: data.ended_at,
          white_player: data.white_player, // ✅ Fixed: Use snake_case from backend
          black_player: data.black_player, // ✅ Fixed: Use snake_case from backend
          white_player_score: data.white_player_score || data.whitePlayerScore || 0,
          black_player_score: data.black_player_score || data.blackPlayerScore || 0,
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

        // Check if this is a lobby-initiated resume
        if (isLobbyResumeInitiated) {
          console.log('🎯 Lobby resume detected - will request handshake');
          setGameInfo(prev => ({ ...prev, status: 'paused' }));
          setIsLobbyResume(true);
          // Show paused overlay but don't show regular resume button
          setShowPausedGame(true);
          // Flag to auto-send resume request after initialization completes
          setShouldAutoSendResume(true);
        } else {
          // Direct navigation to paused game (refresh or direct URL)
          // Redirect to lobby where they can see paused game and request resume
          console.log('⏸️ Paused game accessed directly - redirecting to lobby');
          navigate('/lobby', {
            state: {
              message: 'This game is paused. Request resume from the lobby.',
              pausedGameId: gameId
            }
          });
          return; // Stop initialization
        }

        // Continue with initialization for lobby-initiated paused games only
      }

      // Set up the chess game from FEN (use starting position if no FEN)
      const fen = data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const newGame = new Chess(fen);
      setGame(newGame);

      // Get user's color from server (authoritative source)
      // Priority: handshake response > game_state data > fallback calculation
      console.log('🎨 DEBUG: Player color determination:', {
        'data.player_color': data.player_color,
        'data.game_state?.player_color': data.game_state?.player_color,
        'userId': user?.id,
        'userIdType': typeof user?.id,
        'white_player_id': data.white_player_id,
        'white_player_id_type': typeof data.white_player_id,
        'black_player_id': data.black_player_id,
        'black_player_id_type': typeof data.black_player_id,
        'white_match_strict': data.white_player_id === user?.id,
        'white_match_parsed': parseInt(data.white_player_id) === parseInt(user?.id),
        'fallbackCalculation': (parseInt(data.white_player_id || data.game_state?.white_player_id) === parseInt(user?.id) ? 'white' : 'black')
      });

      // Use server-provided player_color as the authoritative source
      // Fallback to calculation only if server doesn't provide it
      let userColor;
      if (data.player_color) {
        userColor = data.player_color;
        console.log('🎨 Using server-provided player_color:', userColor);
      } else if (data.game_state?.player_color) {
        userColor = data.game_state.player_color;
        console.log('🎨 Using game_state player_color:', userColor);
      } else {
        // Fallback calculation - ensure proper type comparison
        const whiteId = parseInt(data.white_player_id || data.game_state?.white_player_id);
        const blackId = parseInt(data.black_player_id || data.game_state?.black_player_id);
        const myId = parseInt(user?.id);

        // Determine color based on player ID matching
        if (myId === whiteId) {
          userColor = 'white';
        } else if (myId === blackId) {
          userColor = 'black';
        } else {
          console.error('🚨 User ID does not match white or black player!', {
            myId,
            whiteId,
            blackId
          });
          userColor = 'white'; // Default fallback
        }

        console.log('🎨 Using fallback calculation:', {
          myId,
          whiteId,
          blackId,
          result: userColor
        });
      }

      // Restore cumulative scores from database (parse as float to prevent string concatenation)
      const myScore = parseFloat(userColor === 'white'
        ? (data.white_player_score || 0)
        : (data.black_player_score || 0));
      const oppScore = parseFloat(userColor === 'white'
        ? (data.black_player_score || 0)
        : (data.white_player_score || 0));

      console.log('📊 [Restoring Scores from Database]', {
        userColor,
        myScore,
        oppScore,
        whiteScore: data.white_player_score,
        blackScore: data.black_player_score
      });

      setPlayerScore(myScore);
      setOpponentScore(oppScore);

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
      const opponent = userColor === 'white' ? (data.black_player || data.blackPlayer) : (data.white_player || data.whitePlayer);
      console.log('Game info setup:', {
        playerColor: userColor,
        gameTurn: data.turn,
        status: data.status,
        opponentName: opponent?.name || 'Rival'
      });

      setGameInfo({
        playerColor: userColor,
        turn: data.turn,
        status: data.status,
        opponentName: opponent?.name || 'Rival'
      });

      // Update WebSocket service with player color for smart polling
      if (wsService.current) {
        wsService.current.updatePlayerColor(userColor);
      }

      // Set game history from moves
      setGameHistory(data.moves || []);

      // Initialize timer state from database or calculate from move history
      try {
        const timeControlMinutes = data.time_control_minutes || 10;
        const timeControlIncrement = data.time_control_increment || 0; // Backend provides in seconds
        const incrementMs = timeControlIncrement * 1000; // Convert to milliseconds

        // Check if we have stored time values from database (persisted across pauses/moves)
        const storedWhiteMs = data.white_time_paused_ms;
        const storedBlackMs = data.black_time_paused_ms;

        let calculatedWhiteMs, calculatedBlackMs;

        if (storedWhiteMs != null && storedBlackMs != null) {
          // Use stored times from database (includes time from moves + pause persistence)
          calculatedWhiteMs = storedWhiteMs;
          calculatedBlackMs = storedBlackMs;

          console.log('[Timer] Restored from database:', {
            whiteMs: Math.floor(calculatedWhiteMs / 1000) + 's',
            blackMs: Math.floor(calculatedBlackMs / 1000) + 's',
            increment: incrementMs / 1000 + 's',
            source: 'database'
          });
        } else {
          // Fallback: Calculate from move history if database values not available
          const movesResponse = await fetch(`${BACKEND_URL}/websocket/games/${gameId}/moves`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          calculatedWhiteMs = timeControlMinutes * 60 * 1000;
          calculatedBlackMs = timeControlMinutes * 60 * 1000;

          if (movesResponse.ok) {
            const movesData = await movesResponse.json();
            const initialTimeMs = (movesData.time_control_minutes || 10) * 60 * 1000;

            // Calculate remaining time from move history with increment support
            const { whiteMs, blackMs } = calculateRemainingTime(
              movesData.moves || [],
              initialTimeMs,
              incrementMs
            );

            calculatedWhiteMs = whiteMs;
            calculatedBlackMs = blackMs;

            console.log('[Timer] Calculated from move history (fallback):', {
              whiteMs: Math.floor(whiteMs / 1000) + 's',
              blackMs: Math.floor(blackMs / 1000) + 's',
              increment: incrementMs / 1000 + 's',
              totalMoves: movesData.moves?.length || 0,
              source: 'move_history'
            });
          } else {
            console.warn('[Timer] Failed to fetch moves, using default 10min');
          }
        }

        // Store these values to pass to timer hook
        setInitialTimerState({
          whiteMs: calculatedWhiteMs,
          blackMs: calculatedBlackMs,
          incrementMs
        });
      } catch (error) {
        console.error('[Timer] Error fetching move history:', error);
        // Keep default 10min if fetch fails
      }

      // Initialize move timer if it's player's turn
      const isMyTurn = data.turn === (userColor === 'white' ? 'w' : 'b');
      console.log('[MoveTimer] Initial setup:', {
        dataTurn: data.turn,
        userColor,
        expectedTurn: userColor === 'white' ? 'w' : 'b',
        isMyTurn
      });

      if (isMyTurn) {
        moveStartTimeRef.current = performance.now();
        console.log('[MoveTimer] Started tracking time for initial turn');
      }

      // Timer will auto-start based on gameStatus === 'active'
      console.log('[PlayMultiplayer] Initial game setup:', {
        playerColor: userColor,
        serverTurn: data.turn,
        status: data.status
      });

      // Fetch championship context (non-intrusive - only for championship games)
      fetchChampionshipContext();

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

      wsService.current.on('gamePaused', (event) => {
        console.log('⏸️ Game paused event received:', event);
        handleGamePaused(event);
      });

      wsService.current.on('opponentPinged', (event) => {
        console.log('🔔 Opponent pinged event received:', event);
        handleOpponentPing(event);
      });

      wsService.current.on('gameConnection', (event) => {
        console.log('Player connection event:', event);
        handlePlayerConnection(event);
      });

      wsService.current.on('error', (error) => {
        console.error('WebSocket error:', error);

        // Parse error to get a user-friendly message
        let errorMessage = 'Unknown connection error';

        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.message && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if (error?.toString && error.toString() !== '[object Object]') {
          errorMessage = error.toString();
        }

        // Don't add "Connection error:" prefix since NetworkErrorDialog will handle the message formatting
        setError(errorMessage);
      });

      // Draw offer event listeners
      const userChannel = wsService.current.subscribeToUserChannel(user);
      userChannel.listen('.draw.offer.sent', (event) => {
        console.log('🤝 Draw offer received:', event);
        handleDrawOfferReceived(event);
      });

      userChannel.listen('.draw.offer.declined', (event) => {
        console.log('❌ Draw offer declined:', event);
        handleDrawOfferDeclined(event);
      });

      // New game challenge request listener
      userChannel.listen('.new_game.request', (event) => {
        console.log('🎮 New game challenge received:', event);
        setNewGameRequest(event);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user]);
  // Note: Event handlers (handleRemoteMove, handleGameEnd, etc.) and navigate are intentionally excluded
  // to prevent circular dependencies. Event listeners are set up once and handlers are stable useCallback refs.

  // Handle game activation
  const handleGameActivated = useCallback((event) => {
    setGameInfo(prev => ({
      ...prev,
      status: 'active'
    }));
  }, []);

  // Handle game resumed event
  const handleGameResumed = useCallback(async (event) => {
    console.log('🎮 Handling game resumed:', event);

    // Clear any local countdown timer first to prevent race conditions
    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
      resumeRequestTimer.current = null;
    }

    // Re-fetch move history to get accurate timer state
    try {
      const token = localStorage.getItem('auth_token');
      const movesResponse = await fetch(`${BACKEND_URL}/websocket/games/${gameId}/moves`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (movesResponse.ok) {
        const movesData = await movesResponse.json();
        const initialTimeMs = (movesData.time_control_minutes || 10) * 60 * 1000;
        const incrementMs = (movesData.time_control_increment || 0) * 1000; // Convert to ms

        // Calculate base remaining time from move history with increment support
        const { whiteMs, blackMs } = calculateRemainingTime(
          movesData.moves || [],
          initialTimeMs,
          incrementMs
        );

        // Apply grace time from backend (40 seconds bonus)
        const whiteTimeWithGrace = whiteMs + (event.white_grace_time_ms || 0);
        const blackTimeWithGrace = blackMs + (event.black_grace_time_ms || 0);

        console.log('[Timer] Resume calculated:', {
          whiteBase: Math.floor(whiteMs / 1000) + 's',
          blackBase: Math.floor(blackMs / 1000) + 's',
          whiteGrace: (event.white_grace_time_ms || 0) / 1000 + 's',
          blackGrace: (event.black_grace_time_ms || 0) / 1000 + 's',
          whiteFinal: Math.floor(whiteTimeWithGrace / 1000) + 's',
          blackFinal: Math.floor(blackTimeWithGrace / 1000) + 's'
        });

        // Update timers based on player color
        if (myColor === 'w') {
          setMyMs(whiteTimeWithGrace);
          setOppMs(blackTimeWithGrace);
        } else if (myColor === 'b') {
          setMyMs(blackTimeWithGrace);
          setOppMs(whiteTimeWithGrace);
        }
      }
    } catch (error) {
      console.error('[Timer] Failed to recalculate on resume:', error);
    }

    // Update game state to active
    setGameInfo(prev => ({
      ...prev,
      status: 'active',
      turn: event.turn
    }));

    // Clear pending resume request in WebSocket service
    if (wsService.current) {
      wsService.current.clearPendingResumeRequest();
    }

    // Close the presence dialog for both players
    setShowPausedGame(false);
    setPausedByUserName(null); // Clear paused by user name
    setShowPresenceDialog(false);
    showPresenceDialogRef.current = false;
    setResumeRequestData(null);
    setIsWaitingForResumeResponse(false);
    setResumeRequestCountdown(0);
    setIsLobbyResume(false);
    hasReceivedResumeRequest.current = false; // Reset received flag
    hasAutoRequestedResume.current = false; // Reset auto-request flag

    // Reset inactivity timer to start fresh from resume
    lastActivityTimeRef.current = Date.now();

    // CRITICAL: Reset move start time to prevent including pause time in move duration
    // If it's currently our turn, start timing from now
    if (event.turn === myColor) {
      moveStartTimeRef.current = performance.now();
      console.log('[MoveTimer] Reset move timer on resume - it\'s our turn');
    } else {
      moveStartTimeRef.current = null;
      console.log('[MoveTimer] Reset move timer on resume - waiting for opponent');
    }

    console.log('✅ Game resumed successfully - dialog closed, game state updated, timers recalculated, inactivity timer reset, move timer reset');
  }, [gameId, myColor, setMyMs, setOppMs]);

  // Handle game paused event
  const handleGamePaused = useCallback((event) => {
    console.log('⏸️ Handling game paused:', event);

    // Update game state to paused
    setGameInfo(prev => ({
      ...prev,
      status: 'paused'
    }));

    // Set the name of the user who caused the pause
    if (event.paused_by_user_name) {
      setPausedByUserName(event.paused_by_user_name);
    }

    // Show the paused game UI for both players
    setShowPausedGame(true);
    setShowPresenceDialog(false); // Close presence dialog if open
    showPresenceDialogRef.current = false;

    // CRITICAL: Reset move start time when game is paused to prevent stale values
    moveStartTimeRef.current = null;
    console.log('[MoveTimer] Reset move timer on pause to prevent stale values');

    console.log('✅ Game paused - showing paused UI to both players, move timer reset');
  }, []);

  // Handle opponent ping notification
  const handleOpponentPing = useCallback((event) => {
    console.log('🔔 Handling opponent ping:', event);

    // Show a brief notification to the player
    // You can use a toast notification library or a simple alert
    alert(`${event.pinged_by_user_name || 'Your opponent'} is waiting for your move!`);
  }, []);

  // Handle draw offer received from opponent
  const handleDrawOfferReceived = useCallback((event) => {
    console.log('🤝 Handling draw offer received:', event);
    setDrawOfferPending(true);
    setDrawOfferedByMe(false);
  }, []);

  // Handle draw offer declined by opponent
  const handleDrawOfferDeclined = useCallback((event) => {
    console.log('❌ Handling draw offer declined:', event);
    setDrawOfferedByMe(false);
    alert('Your draw offer was declined.');
  }, []);

  // Handle offering a draw
  const handleOfferDraw = useCallback(async () => {
    if (!wsService.current || drawOfferedByMe) return;

    try {
      await wsService.current.offerDraw();
      setDrawOfferedByMe(true);
      console.log('✅ Draw offer sent to opponent');
    } catch (error) {
      console.error('❌ Failed to offer draw:', error);
      alert('Failed to offer draw: ' + error.message);
    }
  }, [drawOfferedByMe]);

  // Handle accepting a draw offer
  const handleAcceptDraw = useCallback(async () => {
    if (!wsService.current) return;

    try {
      await wsService.current.acceptDraw();
      setDrawOfferPending(false);
      console.log('✅ Draw offer accepted, game will end as draw');
      // The gameEnded event will be triggered automatically by the server
    } catch (error) {
      console.error('❌ Failed to accept draw:', error);
      alert('Failed to accept draw: ' + error.message);
    }
  }, []);

  // Handle declining a draw offer
  const handleDeclineDraw = useCallback(async () => {
    if (!wsService.current) return;

    try {
      await wsService.current.declineDraw();
      setDrawOfferPending(false);
      console.log('✅ Draw offer declined');
    } catch (error) {
      console.error('❌ Failed to decline draw:', error);
      alert('Failed to decline draw: ' + error.message);
    }
  }, []);

  // Handle incoming moves (always apply server's authoritative state)
  const handleRemoteMove = useCallback((event) => {
    try {
      console.log('🎮 [handleRemoteMove] Processing move from server:', {
        eventUserId: event.user_id,
        currentUserId: user?.id,
        isMyMove: event.user_id === user?.id,
        eventTurn: event.turn,
        currentPlayerColor: playerColorRef.current
      });

      // Always apply the server's FEN as the source of truth
      const newGame = new Chess();
      newGame.load(event.fen);
      setGame(newGame);

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

            // IMPORTANT: Get the color from the previous game state, not from user mapping
            // The player whose turn it was in the previous state made this move
            const moveColor = previousState.turn(); // 'w' or 'b' - AUTHORITATIVE SOURCE

            const opponentMove = {
              from: event.move.from,
              to: event.move.to,
              san: event.move.san,
              promotion: event.move.promotion || null,
              piece: event.move.piece || moveColor, // Use move color from game state
              color: moveColor, // Use authoritative color from chess.js
              captured: event.move.captured || null
            };

            // Evaluate opponent's move with universal scoring (human vs human)
            // Use engineLevel = 1 to ensure consistent, deterministic evaluation across all clients
            // IMPORTANT: For multiplayer, use fixed DEFAULT_RATING (1200) for both players
            // to ensure consistent scoring across all clients, regardless of individual ratings
            const opponentMoveTime = (event.move.move_time_ms || 0) / 1000; // Use actual time, or 0 if not available
            console.log('🔵 [Evaluating OPPONENT Move]', {
              move: event.move.san,
              piece: event.move.piece,
              captured: event.move.captured,
              color: moveColor,
              opponentName: event.user_name,
              moveTime: opponentMoveTime.toFixed(2) + 's',
              moveTimeMs: event.move.move_time_ms
            });

            // Prevent StrictMode double-evaluation
            const opponentMoveKey = `${event.user_id}_${event.move.san}_${event.fen}`;
            if (!evaluatedMovesRef.current.has(opponentMoveKey)) {
              evaluatedMovesRef.current.add(opponentMoveKey);
              evaluateMove(
                opponentMove,
                previousState,
                newGame,
                opponentMoveTime, // Use consistent move time
                1200, // Fixed rating for consistent cross-client scoring
                setLastOpponentEvaluation,
                setOpponentScore,
                1 // Always 1 for multiplayer - no difficulty scaling
              );
              // Clean up old move keys after 5 seconds to prevent memory leak
              setTimeout(() => evaluatedMovesRef.current.delete(opponentMoveKey), 5000);
            } else {
              console.log('⏭️ [Skipping Duplicate OPPONENT Evaluation]', opponentMoveKey);
            }
          } catch (evalError) {
            console.warn('Could not evaluate opponent move:', evalError);
          }
        }
      }

      // Get turn from server state (already in 'white'/'black' format)
      const serverTurn = event.turn;

      // Update turn based on server's authoritative state
      // Skip update for our own moves (already updated optimistically in performMove)
      // to prevent double updates and turn desynchronization
      if (event.user_id !== user?.id) {
        setGameInfo(prev => ({
          ...prev,
          turn: serverTurn
        }));

        // Update activity tracking when opponent makes a move
        handleMoveActivity();

        // Start timing for player's turn (only after opponent moves)
        if (serverTurn === playerColorRef.current) {
          moveStartTimeRef.current = performance.now();
          console.log('[MoveTimer] Started tracking time after opponent move');
        }
      }

      // Timer will auto-update based on gameInfo.turn change (handled by useGameTimer hook)
      console.log('[PlayMultiplayer] Move processed:', {
        playerColor: playerColorRef.current,
        isMyMove: event.user_id === user?.id,
        serverTurn: serverTurn,
        turnUpdated: event.user_id !== user?.id ? 'yes' : 'skipped (own move)'
      });

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

  // Report result to championship system (non-intrusive - only for championship games)
  const reportChampionshipResult = useCallback(async (endEvent) => {
    if (!championshipContext?.match_id) {
      console.log('[Championship] No championship match ID, skipping result reporting');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');

      // Determine result from user's perspective
      let result;
      if (!endEvent.winner_user_id) {
        result = 'draw';
      } else if (endEvent.winner_user_id === user?.id) {
        result = 'win';
      } else {
        result = 'loss';
      }

      const resultData = {
        result: result,
        opponent_agreed: true // Auto-confirmed since game ended via chess engine
      };

      console.log('[Championship] Reporting result to championship system:', resultData);

      const response = await fetch(`${BACKEND_URL}/championships/${championshipContext.championship_id}/matches/${championshipContext.match_id}/result`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resultData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Championship] Result reported successfully:', result);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Championship] Failed to report result:', errorData.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Championship] Error reporting championship result:', error);
    }
  }, [championshipContext, user?.id]);

  // Handle game completion
  const handleGameEnd = useCallback(async (event) => {
    console.log('🏁 Processing game end event:', event);
    console.log('🏁 About to set gameComplete to true');

    // Update game completion state
    setGameComplete(true);
    setLoading(false); // Ensure loading is false when game ends

    // Auto-report result to championship system (non-intrusive - only for championship games)
    if (championshipContext && championshipContext.match_id) {
      try {
        await reportChampionshipResult(event);
      } catch (error) {
        console.error('[Championship] Failed to report result to championship system:', error);
        // Don't show error to user - this is background functionality
      }
    }

    // Prepare result data for modal
    const resultData = {
      game_over: true,
      result: event.result,
      end_reason: event.end_reason,
      winner_user_id: event.winner_user_id,
      // Derive winner_player from winner_user_id for GameCompletionAnimation
      winner_player: event.winner_user_id === event.white_player?.id ? 'white' : (event.winner_user_id === event.black_player?.id ? 'black' : null),
      fen_final: event.fen_final,
      move_count: event.move_count,
      ended_at: event.ended_at,
      white_player: event.white_player,
      black_player: event.black_player,
      white_player_score: event.white_player_score,
      black_player_score: event.black_player_score,
      // Determine user's result
      isPlayerWin: event.winner_user_id === user?.id,
      isPlayerDraw: !event.winner_user_id && event.result === '1/2-1/2'
    };

    setGameResult(resultData);
    console.log('🎮 Game completed - result set:', { winner: resultData.winner_player, reason: resultData.end_reason });
    console.log('🎮 State after game end:', { gameComplete: true, gameResult: !!resultData });

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

      // Create human-readable result details
      let resultDetails = 'Draw';
      if (event.winner_user_id === user?.id) {
        resultDetails = `You won by ${event.end_reason}!`;
      } else if (event.winner_user_id && event.winner_user_id !== user?.id) {
        const opponentName = event.winner_player === 'white'
          ? event.white_player?.name
          : event.black_player?.name;
        resultDetails = `${opponentName} won by ${event.end_reason}`;
      } else {
        resultDetails = `Draw by ${event.end_reason}`;
      }

      // Create standardized result object
      const standardizedResult = createResultFromMultiplayerGame(
        event.winner_user_id,
        user?.id,
        event.end_reason,
        resultDetails
      );

      console.log('🎯 [PlayMultiplayer] Created standardized result:', standardizedResult);

      // Fetch fresh game data from server to get authoritative move history
      const token = localStorage.getItem('auth_token');
      let serverMoves = [];
      let serverGameData = null;
      try {
        const response = await fetch(`${BACKEND_URL}/games/${gameId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          serverGameData = await response.json();
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

      // Use quality scores from serverGameData (authoritative), fallback to event
      let whiteScore = 0;
      let blackScore = 0;
      if (serverGameData) {
        whiteScore = parseFloat(serverGameData.white_player_score || serverGameData.whitePlayerScore || 0);
        blackScore = parseFloat(serverGameData.black_player_score || serverGameData.blackPlayerScore || 0);
        console.log('📊 Using quality scores from serverGameData:', { whiteScore, blackScore });
      } else {
        whiteScore = parseFloat(event.white_player_score || 0);
        blackScore = parseFloat(event.black_player_score || 0);
        console.log('📊 Using quality scores from backend event (fallback):', { whiteScore, blackScore });
      }

      // Compute authoritative myColor from serverGameData (or fallback to gameData/event)
      const computedMyColor = serverGameData 
        ? (parseInt(serverGameData.white_player_id) === parseInt(user?.id) ? 'w' : 'b')
        : (parseInt(gameData?.white_player_id) === parseInt(user?.id) ? 'w' : 'b');

      // Determine which score belongs to the player based on computed color
      const finalPlayerScore = computedMyColor === 'w' ? whiteScore : blackScore;
      const finalOpponentScore = computedMyColor === 'w' ? blackScore : whiteScore;

      console.log('📊 Score assignment:', {
        computedMyColor,
        whiteScore,
        blackScore,
        finalPlayerScore,
        finalOpponentScore,
        eventScores: {
          white: event.white_player_score,
          black: event.black_player_score
        }
      });

      // Update gameResult with the calculated scores
      setGameResult(prev => ({
        ...prev,
        white_player_score: whiteScore,
        black_player_score: blackScore
      }));
      console.log('🎮 Updated gameResult with scores:', { whiteScore, blackScore });

      // Get timer values for persistence (myMs and oppMs are already in milliseconds)
      const whiteTimeRemaining = computedMyColor === 'w' ? myMs : oppMs;
      const blackTimeRemaining = computedMyColor === 'b' ? myMs : oppMs;

      // Compute opponent name from serverGameData (authoritative)
      const opponentName = computedMyColor === 'w' 
        ? (serverGameData?.black_player?.name || serverGameData?.blackPlayer?.name || gameInfo.opponentName)
        : (serverGameData?.white_player?.name || serverGameData?.whitePlayer?.name || gameInfo.opponentName);

      const gameHistoryData = {
        id: `multiplayer_${gameId}_${Date.now()}`,
        game_id: gameId,
        date: now.toISOString(),
        played_at: now.toISOString(),
        player_color: computedMyColor,
        computer_level: 0, // Multiplayer game (not vs computer)
        computer_depth: 0, // Alternative field name
        opponent_name: opponentName,
        game_mode: 'multiplayer',
        moves: conciseGameString,
        final_score: finalPlayerScore,
        finalScore: finalPlayerScore, // Alternative field name
        score: finalPlayerScore, // Alternative field name
        opponent_score: finalOpponentScore, // Opponent's score
        result: standardizedResult, // Use standardized result object
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
        whiteScore,
        blackScore,
        finalPlayerScore,
        finalOpponentScore,
        movesLength: movesToSave.length,
        movesType: typeof conciseGameString,
        movesPreview: conciseGameString.substring(0, 100),
        whiteTime: whiteTimeRemaining,
        blackTime: blackTimeRemaining
      });

      if (typeof saveGameHistory === 'function') {
        try {
          const savedGame = await saveGameHistory(gameHistoryData);
          console.log('✅ Multiplayer game history saved successfully', savedGame);
          // Store the saved game history ID for preview navigation
          if (savedGame && savedGame.data && savedGame.data.id) {
            setSavedGameHistoryId(savedGame.data.id);
            console.log('📝 Saved game_history ID:', savedGame.data.id);
          }
          // Invalidate cache so Dashboard shows the new game
          if (invalidateGameHistory) {
            invalidateGameHistory();
            console.log('🔄 Game history cache invalidated');
          }
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
  }, [user?.id, gameId, gameHistory, gameInfo, myMs, oppMs, invalidateGameHistory]);

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

  // Effect for handling screen orientation changes and mobile landscape detection
  useLayoutEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth <= 812; // iPhone X width in landscape
      setIsPortrait(!isLandscape);

      // Add mobile-landscape class to both html and body for maximum CSS specificity
      const shouldApply = isLandscape && isMobile;
      document.documentElement.classList.toggle('mobile-landscape', shouldApply);
      document.body.classList.toggle('mobile-landscape', shouldApply);

      // Debug logging
      if (shouldApply) {
        console.log('Mobile Landscape Active:', {
          width: window.innerWidth,
          height: window.innerHeight,
          isLandscape,
          isMobile
        });
      }
    };

    handleOrientationChange(); // Initial check before paint
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      // Clean up classes on unmount
      document.documentElement.classList.remove('mobile-landscape');
      document.body.classList.remove('mobile-landscape');
    };
  }, []); // setIsPortrait is stable

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

  // Keep turn and color refs fresh to prevent stale closures
  const playerColorRef = useRef(gameInfo.playerColor);

  useEffect(() => {
    turnRef.current = gameInfo.turn;
    console.log('[TurnRef] updated to:', gameInfo.turn);
  }, [gameInfo.turn]);

  useEffect(() => {
    myColorRef.current = gameInfo.playerColor;
    playerColorRef.current = gameInfo.playerColor;
    console.log('[ColorRef] updated to:', gameInfo.playerColor);
  }, [gameInfo.playerColor]);

  // Reset baseline when MY turn starts
  useEffect(() => {
    const isMyTurnNow = gameInfo.turn === gameInfo.playerColor;
    if (isMyTurnNow) {
      lastActivityTimeRef.current = Date.now();
      console.log('[Inactivity] Baseline reset - my turn started');
    }
  }, [gameInfo.turn, gameInfo.playerColor]);

  // Handle presence dialog timeout with guards
  // Inactivity detection with proper guards
  useEffect(() => {
    // Always clear previous interval (prevent multiple intervals)
    if (inactivityCheckIntervalRef.current) {
      clearInterval(inactivityCheckIntervalRef.current);
      inactivityCheckIntervalRef.current = null;
      console.log('[InactivityInterval] stopped');
    }

    const shouldRun =
      gameActiveRef.current &&
      gameInfo.status === 'active' &&
      !showPresenceDialog &&
      !isWaitingForResumeResponse &&
      !showPausedGame;

    if (!shouldRun) {
      return;
    }

    console.log('[InactivityInterval] starting - conditions met');

    const checkInactivity = () => {
      if (!enabledRef.current || !gameActiveRef.current) return;
      if (showPresenceDialog || showPausedGame || isWaitingForResumeResponse) return;

      const currentTime = Date.now();
      const inactiveDuration = (currentTime - lastActivityTimeRef.current) / 1000; // in seconds

      // IMPORTANT: Use refs to prevent stale closures
      const isMyTurn = turnRef.current === myColorRef.current;

      // Only log when significant time has passed to reduce spam
      if (inactiveDuration > 55 && inactiveDuration < 61) {
        console.log('[Inactivity] tick', {
          turn: turnRef.current,
          myColor: myColorRef.current,
          isMyTurn,
          inactiveFor: inactiveDuration.toFixed(1),
          dialogOpen: showPresenceDialogRef.current
        });
      }

      if (inactiveDuration >= 60 && !showPresenceDialogRef.current && !isPausingRef.current) {
        console.log('[Inactivity] Opening presence dialog after', inactiveDuration.toFixed(1), 's (turn:', turnRef.current, 'myColor:', myColorRef.current, ')');
        setShowPresenceDialog(true);
        showPresenceDialogRef.current = true;

        // Note: The dialog itself handles the countdown and timeout via onCloseTimeout callback
        // No need for a separate timeout here as it creates a race condition
      }
    };

    // Store interval ref to guarantee single interval
    inactivityCheckIntervalRef.current = setInterval(checkInactivity, 1000);

    return () => {
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
        inactivityCheckIntervalRef.current = null;
        console.log('[InactivityInterval] cleanup');
      }
    };
  }, [gameInfo.status, showPresenceDialog, showPausedGame, isWaitingForResumeResponse]); // Proper dependencies

  // Reset initialization flag and scores when gameId changes (for game navigation)
  useEffect(() => {
    didInitRef.current = false;

    // Reset scores for new game
    console.log('🔄 [Game Reset] Resetting scores for new game:', gameId);
    setPlayerScore(0);
    setOpponentScore(0);
    setLastMoveEvaluation(null);
    setLastOpponentEvaluation(null);

    // Clear evaluated moves cache
    evaluatedMovesRef.current.clear();
  }, [gameId]);

  // Restore championship context from sessionStorage on mount (before initialization)
  useEffect(() => {
    if (!gameId) return;

    try {
      const savedContext = sessionStorage.getItem(`championship_context_${gameId}`);
      if (savedContext) {
        const parsedContext = JSON.parse(savedContext);
        console.log('[Championship] Restored championship context from sessionStorage:', parsedContext);
        setChampionshipContext(parsedContext);
      }
    } catch (error) {
      console.error('[Championship] Error restoring championship context from sessionStorage:', error);
    }
  }, [gameId]);

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
        // Clear any pending resume request before disconnecting
        wsService.current.clearPendingResumeRequest();
        wsService.current.disconnect();
      }
      // Unregister from game navigation context
      if (gameRegisteredRef.current) {
        unregisterActiveGame();
        gameRegisteredRef.current = false;
        console.log('[PlayMultiplayer] Unregistered from navigation guard');
      }
      // Note: We don't clear championship context here to allow it to persist
      // across navigations (e.g., when viewing game preview and coming back)
      // It will only be cleared when explicitly removed or when starting a new game
    };
  }, [gameId, user?.id, initializeGame, unregisterActiveGame]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for pause requests from navigation guard
  useEffect(() => {
    const handlePauseRequest = async (event) => {
      console.log('[PlayMultiplayer] Received pause request:', event.detail);

      try {
        // Trigger pause functionality and wait for it to complete
        if (wsService.current) {
          const timeData = getTimeData();
          const pauseResult = await wsService.current.pauseGame(timeData);
          console.log('[PlayMultiplayer] Game paused successfully for navigation:', pauseResult);
        }

        // Wait a brief moment for the game state to update
        setTimeout(() => {
          if (event.detail.targetPath) {
            navigate(event.detail.targetPath);
          }
        }, 200);
      } catch (error) {
        console.error('[PlayMultiplayer] Failed to pause game for navigation:', error);
        // If pause fails, still allow navigation but log the error
        if (event.detail.targetPath) {
          navigate(event.detail.targetPath);
        }
      }
    };

    window.addEventListener('requestGamePause', handlePauseRequest);

    return () => {
      window.removeEventListener('requestGamePause', handlePauseRequest);
    };
  }, [navigate]);

  // Update game state when status changes
  useEffect(() => {
    if (gameData) {
      updateGameState(gameData.status);
    }
  }, [gameData?.status]); // Remove updateGameState from dependencies

  // Sync timer values when initial timer state is set
  useEffect(() => {
    if (myColor) {
      const myMs = myColor === 'w' ? initialTimerState.whiteMs : initialTimerState.blackMs;
      const oppMs = myColor === 'w' ? initialTimerState.blackMs : initialTimerState.whiteMs;

      setMyMs(myMs);
      setOppMs(oppMs);

      console.log('[Timer] Synced with initial state:', {
        myColor,
        myMs: Math.floor(myMs / 1000) + 's',
        oppMs: Math.floor(oppMs / 1000) + 's'
      });
    }
  }, [initialTimerState, myColor, setMyMs, setOppMs]);

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
        // Mark that we've received a resume request
        hasReceivedResumeRequest.current = true;

        // Show resume request notification in the paused dialog
        setResumeRequestData({
          type: 'received',
          requested_by: data.requesting_user?.id,
          requesting_user: data.requesting_user,
          opponentName: data.requesting_user?.name || 'Rival',
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

          // Clear any countdown timer FIRST to prevent it from firing
          if (resumeRequestTimer.current) {
            clearInterval(resumeRequestTimer.current);
            resumeRequestTimer.current = null;
          }

          // Clear pending resume request in WebSocket service
          if (wsService.current) {
            wsService.current.clearPendingResumeRequest();
          }

          // Then update all states
          setShowPausedGame(false); // Close the presence dialog
          setResumeRequestData(null);
          setIsWaitingForResumeResponse(false);
          setResumeRequestCountdown(0);
          setIsLobbyResume(false); // Reset lobby resume flag
          setShouldAutoSendResume(false); // Also reset auto-send flag
          hasReceivedResumeRequest.current = false; // Reset received flag
          hasAutoRequestedResume.current = false; // Reset auto-request flag

          // Optionally show a toast message
          // toast.success('Your resume request was accepted!');
        } else if (data.response === 'declined') {
          // Game was not resumed by opponent
          console.log('[PlayMultiplayer] Resume request declined');

          // Clear pending resume request in WebSocket service
          if (wsService.current) {
            wsService.current.clearPendingResumeRequest();
          }

          // Clear countdown timer
          if (resumeRequestTimer.current) {
            clearInterval(resumeRequestTimer.current);
            resumeRequestTimer.current = null;
          }

          setResumeRequestData(null);
          setIsWaitingForResumeResponse(false);
          setResumeRequestCountdown(0);
          hasReceivedResumeRequest.current = false; // Reset received flag
          hasAutoRequestedResume.current = false; // Reset auto-request flag

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

        // Clear pending resume request in WebSocket service
        if (wsService.current) {
          wsService.current.clearPendingResumeRequest();
        }

        // Clear all resume request state
        setResumeRequestData(null);
        setIsWaitingForResumeResponse(false);
        setResumeRequestCountdown(0);

        // Clear any countdown timer
        if (resumeRequestTimer.current) {
          clearInterval(resumeRequestTimer.current);
          resumeRequestTimer.current = null;
        }

        // Reset auto-send flag to prevent re-trigger
        setShouldAutoSendResume(false);
        hasAutoRequestedResume.current = false;
        hasReceivedResumeRequest.current = false; // Reset received flag

        // For lobby resume, navigate back to lobby after expiration to prevent stuck state
        if (isLobbyResume) {
          console.log('[PlayMultiplayer] Lobby resume expired - navigating to lobby');
          setIsLobbyResume(false);
          // Clear invitation session storage to prevent re-entry loop
          sessionStorage.removeItem('lastInvitationAction');
          sessionStorage.removeItem('lastInvitationTime');
          sessionStorage.removeItem('lastGameId');
          // Navigate to lobby
          navigate('/lobby', {
            state: {
              message: 'Resume request expired. You can try again from the lobby.',
              pausedGameId: gameId
            }
          });
        }

        // Optionally show a toast message
        // toast.info('Resume request expired');
      }
    });

    // Mark listeners as ready for auto-send
    isReadyForAutoSend.current = true;
    console.log('[PlayMultiplayer] Resume listeners ready for auto-send');

    return () => {
      console.log('[PlayMultiplayer] Cleaning up resume request listeners');
      userChannel.stopListening('.resume.request.sent');
      userChannel.stopListening('.resume.request.response');
      userChannel.stopListening('.resume.request.expired');
    };
  }, [user, gameId, isLobbyResume]);

  // Listen for global new game requests from presence service
  useEffect(() => {
    const handleNewGameRequest = (event) => {
      console.log('🎮 Global new game request received:', event.detail);
      setNewGameRequest(event.detail);
    };

    const handleDrawOffer = (event) => {
      console.log('🤝 Global draw offer received:', event.detail);
      handleDrawOfferReceived(event.detail);
    };

    // Add event listeners
    window.addEventListener('newGameRequest', handleNewGameRequest);
    window.addEventListener('drawOffer', handleDrawOffer);

    // Check for any pending requests in localStorage
    const pendingNewGameRequest = localStorage.getItem('newGameRequest');
    if (pendingNewGameRequest) {
      try {
        const request = JSON.parse(pendingNewGameRequest);
        console.log('🎮 Found pending new game request in localStorage:', request);
        setNewGameRequest(request);
        localStorage.removeItem('newGameRequest');
      } catch (error) {
        console.error('Failed to parse pending new game request:', error);
        localStorage.removeItem('newGameRequest');
      }
    }

    const pendingDrawOffer = localStorage.getItem('drawOffer');
    if (pendingDrawOffer) {
      try {
        const offer = JSON.parse(pendingDrawOffer);
        console.log('🤝 Found pending draw offer in localStorage:', offer);
        handleDrawOfferReceived(offer);
        localStorage.removeItem('drawOffer');
      } catch (error) {
        console.error('Failed to parse pending draw offer:', error);
        localStorage.removeItem('drawOffer');
      }
    }

    // Cleanup event listeners
    return () => {
      window.removeEventListener('newGameRequest', handleNewGameRequest);
      window.removeEventListener('drawOffer', handleDrawOffer);
    };
  }, [handleDrawOfferReceived]);

  // Debug GameCompletionAnimation rendering
  useEffect(() => {
    console.log('🎮 GameCompletionAnimation state check:', {
      gameComplete,
      gameResult: !!gameResult,
      gameResultData: gameResult,
      renderCondition: gameComplete && gameResult
    });
    if (gameComplete && gameResult) {
      console.log('🎮 GameCompletionAnimation should render:', {
        gameComplete,
        hasResult: !!gameResult,
        winner: gameResult.winner_player,
        reason: gameResult.end_reason,
        whiteScore: gameResult.white_player_score,
        blackScore: gameResult.black_player_score
      });
    }
  }, [gameComplete, gameResult]);

  // Resume request handlers - wrapped in useCallback for stability
  const startResumeCountdown = useCallback((seconds) => {
    countdownRef.current = seconds;

    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
    }

    // Initial state set (async, but ref is sync)
    setResumeRequestCountdown(seconds);

    const timer = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1);
      setResumeRequestCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        clearInterval(timer);
        resumeRequestTimer.current = null;
        // Only update states if the paused dialog is still showing
        // This prevents re-showing the dialog after successful resume
        setResumeRequestData(prev => {
          // If prev is null, it means the request was already handled (accepted/declined)
          if (prev === null) return null;
          console.log('[PlayMultiplayer] Resume request expired - fallback timer');
          return null;
        });
        setIsWaitingForResumeResponse(false);
      }
    }, 1000);

    resumeRequestTimer.current = timer;

    // Cleanup on unmount or reset
    return () => {
      if (resumeRequestTimer.current) {
        clearInterval(resumeRequestTimer.current);
        resumeRequestTimer.current = null;
      }
    };
  }, [setResumeRequestCountdown, setResumeRequestData, setIsWaitingForResumeResponse]);

  const cancelResumeRequest = useCallback(() => {
    setResumeRequestData(null);
    setResumeRequestCountdown(0);
    setIsWaitingForResumeResponse(false);

    if (resumeRequestTimer.current) {
      clearInterval(resumeRequestTimer.current);
      resumeRequestTimer.current = null;
    }
  }, [setResumeRequestData, setResumeRequestCountdown, setIsWaitingForResumeResponse]);

  const handleResumeResponse = useCallback(async (accepted) => {
    if (!wsService.current) return;

    try {
      // Clear countdown timer FIRST to prevent race conditions
      if (resumeRequestTimer.current) {
        clearInterval(resumeRequestTimer.current);
        resumeRequestTimer.current = null;
      }

      await wsService.current.respondToResumeRequest(accepted);

      if (accepted) {
        console.log('[PlayMultiplayer] Resume request accepted - game should resume');
        setShowPausedGame(false);
        setResumeRequestData(null);
        setResumeRequestCountdown(0);
        setIsWaitingForResumeResponse(false);
        setIsLobbyResume(false); // Reset lobby resume flag
        setShouldAutoSendResume(false); // Reset auto-send flag
        hasReceivedResumeRequest.current = false; // Reset received flag
        // The game should resume automatically via WebSocket events
      } else {
        console.log('[PlayMultiplayer] Resume request declined');
        setResumeRequestData(null);
        setResumeRequestCountdown(0);
        setIsWaitingForResumeResponse(false);
        // Keep lobby resume flag for declined requests so user can try again
      }

    } catch (error) {
      console.error('[PlayMultiplayer] Failed to respond to resume request:', error);
    }
  }, [wsService, setShowPausedGame, setResumeRequestData, setResumeRequestCountdown, setIsWaitingForResumeResponse, setIsLobbyResume]);

  const handleRequestResume = useCallback(async () => {
    if (!wsService.current) return;

    try {
      setIsWaitingForResumeResponse(true);
      const result = await wsService.current.requestResume();

      console.log('[PlayMultiplayer] Resume request sent:', result);

      // Start countdown timer
      setResumeRequestData({ type: 'sent' });
      const expiresIn = Math.floor((new Date(result.resume_request_expires_at) - Date.now()) / 1000);
      setResumeRequestCountdown(expiresIn || 10);
      startResumeCountdown(expiresIn || 10);

    } catch (error) {
      console.error('[PlayMultiplayer] Failed to send resume request:', error);
      setIsWaitingForResumeResponse(false);

      // Show specific error message to user
      if (error.message && error.message.includes('already pending')) {
        // Resume request already pending - check status and show appropriate UI
        try {
          const token = localStorage.getItem('auth_token');
          const statusResponse = await fetch(`${BACKEND_URL}/websocket/games/${gameId}/resume-status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.pending && status.type === 'received') {
              // Opponent sent first - show received UI
              hasReceivedResumeRequest.current = true;
              setResumeRequestData({
                type: 'received',
                requested_by: status.requested_by_id,
                requesting_user: status.requesting_user,
                opponentName: status.opponent_name || 'Rival',
                expires_at: status.expires_at
              });
              const remaining = Math.max(0, Math.ceil((new Date(status.expires_at) - Date.now()) / 1000));
              setResumeRequestCountdown(remaining);
              startResumeCountdown(remaining);
              console.log('🎯 Detected opponent request after our failed send');
              return;
            }
          }
        } catch (statusError) {
          console.warn('Status check after pending error failed:', statusError);
        }

        // Fallback: start timer as if sent
        setResumeRequestData({ type: 'sent' });
        setResumeRequestCountdown(10);
        startResumeCountdown(10);
      } else {
        // Other errors - you could show a toast message here
        // toast.error(error.message || 'Failed to send resume request');
      }
    }
  }, [wsService, setIsWaitingForResumeResponse, setResumeRequestData, setResumeRequestCountdown, startResumeCountdown, gameId]);

  // Auto-send resume request for lobby-initiated resumes
  useEffect(() => {
    if (shouldAutoSendResume && connectionStatus === 'connected' && wsService.current && !hasAutoRequestedResume.current) {
      console.log('🎯 Auto-sending lobby resume request after initialization complete');

      // Mark as requested to prevent duplicates
      hasAutoRequestedResume.current = true;

      // Function to attempt resume request with retries
      const attemptResumeRequest = async (retryCount = 0) => {
        const maxRetries = 3;
        const delay = Math.min(1000 + (retryCount * 1000), 3000); // 1s, 2s, 3s

        try {
          console.log(`🎯 Resume request attempt ${retryCount + 1}/${maxRetries}`);

          // Early state validation to prevent race conditions
          if (hasReceivedResumeRequest.current) {
            console.log('🎯 Already received resume request from opponent, skipping auto-send');
            setShouldAutoSendResume(false);
            return true;
          }

          // Check if WebSocket service already has a pending request
          if (wsService.current && wsService.current.hasPendingResumeRequest()) {
            console.log('🎯 WebSocket service already has pending request, skipping auto-send');
            setShouldAutoSendResume(false);
            return true;
          }

          // Pre-check server status to prevent duplicate sends
          const token = localStorage.getItem('auth_token');
          const statusResponse = await fetch(`${BACKEND_URL}/websocket/games/${gameId}/resume-status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('[Resume] Pre-send status check:', status);

            if (status.pending && status.type === 'received') {
              // Opponent already sent - treat as received
              hasReceivedResumeRequest.current = true;
              setResumeRequestData({
                type: 'received',
                requested_by: status.requested_by_id,
                requesting_user: status.requesting_user,
                opponentName: status.opponent_name || 'Rival',
                expires_at: status.expires_at
              });
              setResumeRequestCountdown(Math.max(0, Math.ceil((new Date(status.expires_at) - Date.now()) / 1000)));
              console.log('🎯 Skipping auto-send: detected opponent request via status check');
              setShouldAutoSendResume(false);
              return true;
            } else if (status.pending && status.type === 'sent') {
              // Our own pending - just wait
              console.log('🎯 Skipping auto-send: our own request already pending');
              setShouldAutoSendResume(false);
              return true;
            }
          } else {
            console.warn('[Resume] Status check failed, proceeding with send');
          }

          // Check if WebSocket service is ready and has no pending request
          if (wsService.current && !wsService.current.hasPendingResumeRequest()) {
            console.log('🎯 All checks passed, sending resume request');
            await handleRequestResume();
            setShouldAutoSendResume(false);
            return true;
          } else {
            console.log('🎯 WebSocket service not ready or has pending request');
          }

        } catch (error) {
          console.error(`🎯 Resume request attempt ${retryCount + 1} failed:`, error);
        }

        // Retry if we haven't exhausted attempts
        if (retryCount < maxRetries - 1) {
          console.log(`🎯 Retrying resume request in ${delay}ms`);
          setTimeout(() => attemptResumeRequest(retryCount + 1), delay);
        } else {
          console.error('🎯 All resume request attempts failed');
          // Reset state so user can try manually
          setIsWaitingForResumeResponse(false);
          setShouldAutoSendResume(false);
          hasAutoRequestedResume.current = false;

          // Show error to user
          setErrorMessage('Failed to send resume request automatically. Please try manually.');
          setShowError(true);
        }
        return false;
      };

      // Start with a small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        attemptResumeRequest();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [shouldAutoSendResume, connectionStatus, handleRequestResume, gameId]);

  // Proactive check warning when it's my turn and king is in check
  useEffect(() => {
    if (isMyTurn && game.inCheck() && myColor) {
      const kingSquare = findKingSquare(game, myColor);
      if (kingSquare) {
        setKingInDangerSquare(kingSquare);
        setTimeout(() => setKingInDangerSquare(null), 3000);
      }
      setErrorMessage('Your king is in check! Make a valid move to escape.');
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
    }
  }, [isMyTurn, game.fen(), myColor, game]);

  // Auto-save unfinished game on navigation/page close
  useEffect(() => {
    const handleBeforeUnload = async (event) => {
      // Only save if game is active or paused (not finished)
      if (gameComplete || gameInfo.status === 'finished') {
        console.log('[BeforeUnload] Game already finished, skipping save');
        return;
      }

      // Only save if game data is loaded
      if (!gameData || !game) {
        console.log('[BeforeUnload] Game not initialized, skipping save');
        return;
      }

      console.log('[BeforeUnload] Saving unfinished game...');

      // Get current timer state
      const currentTimerState = {
        whiteMs: myMs || initialTimerState.whiteMs,
        blackMs: oppMs || initialTimerState.blackMs,
        incrementMs: initialTimerState.incrementMs
      };

      // Prepare game state
      const gameState = {
        fen: game.fen(),
        pgn: game.pgn(),
        moves: game.history({ verbose: true }),
        playerColor: myColor === 'w' ? 'white' : 'black',
        opponentName: gameInfo.opponentName,
        gameMode: 'multiplayer',
        timerState: currentTimerState,
        turn: game.turn(),
        savedReason: 'beforeunload'
      };

      try {
        // Save synchronously (beforeunload requires synchronous operations)
        const isAuthenticated = !!user && !!localStorage.getItem('auth_token');
        await saveUnfinishedGame(gameState, isAuthenticated, gameData.id);
        console.log('[BeforeUnload] ✅ Unfinished game saved successfully');
      } catch (error) {
        console.error('[BeforeUnload] ❌ Failed to save unfinished game:', error);
      }

      // Show browser confirmation dialog
      event.preventDefault();
      event.returnValue = ''; // Required for Chrome
    };

    // Add event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameComplete, gameInfo.status, gameData, game, myColor, gameInfo.opponentName, myMs, oppMs, initialTimerState, user]);

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

    // Create ISOLATED previous state instance to avoid reference issues
    const previousState = new Chess();
    previousState.load(prevFen);

    // Create a copy to test the move
    const gameCopy = new Chess(prevFen);

    try {
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      if (!move) {
        let reason = 'Invalid move.';
        if (previousState.inCheck()) {
          reason = 'You cannot move out of check! Your king is in danger.';
          // Highlight king
          const kingSquare = findKingSquare(previousState, gameInfo.playerColor.charAt(0));
          if (kingSquare) {
            setKingInDangerSquare(kingSquare);
            setTimeout(() => setKingInDangerSquare(null), 3000);
          }
        }
        setErrorMessage(reason);
        setShowError(true);
        // Auto-hide after 4s
        setTimeout(() => setShowError(false), 4000);
        console.log('Invalid move:', { from: source, to: target, reason });
        return false;
      }

    // Capture new FEN after move
    const nextFen = gameCopy.fen();

    // Create ISOLATED new state instance
    const newState = new Chess();
    newState.load(nextFen);

    // Get UCI notation (e.g., "e2e4")
    const uci = `${source}${target}${move.promotion || ''}`;

    // Calculate move time (time since turn started)
    const moveEndTime = performance.now();
    const moveTime = moveStartTimeRef.current
      ? (moveEndTime - moveStartTimeRef.current) / 1000
      : 0; // Convert to seconds

    console.log('[MoveTimer] Move time calculation:', {
      moveStartTime: moveStartTimeRef.current,
      moveEndTime,
      moveTimeSeconds: moveTime,
      moveTimeMs: moveTime * 1000
    });

    // Update activity tracking for move
    handleMoveActivity();

    // Evaluate the move and update player score with universal scoring (human vs human)
    // Use engineLevel = 1 to ensure consistent, deterministic evaluation across all clients
    // IMPORTANT: For multiplayer, use fixed DEFAULT_RATING (1200) for both players
    // to ensure consistent scoring across all clients, regardless of individual ratings
    // FIXED: Use isolated previousState and newState instances to ensure clean before/after comparison
    console.log('🟢 [Evaluating MY Move]', {
      move: move.san,
      piece: move.piece,
      captured: move.captured,
      color: move.color,
      playerName: user?.name || 'Player',
      moveTime: moveTime.toFixed(2) + 's',
      prevFEN: prevFen.substring(0, 30) + '...',
      nextFEN: nextFen.substring(0, 30) + '...'
    });

    // Prevent StrictMode double-evaluation and calculate new cumulative score
    const moveKey = `${user?.id}_${move.san}_${nextFen}`;
    let newCumulativeScore = parseFloat(playerScore) || 0; // Default to current score, ensure numeric

    if (!evaluatedMovesRef.current.has(moveKey)) {
      evaluatedMovesRef.current.add(moveKey);
      const evaluation = evaluateMove(
        move,
        previousState, // FIXED: isolated previous state
        newState, // FIXED: isolated new state
        moveTime,
        1200, // Fixed rating for consistent cross-client scoring
        setLastMoveEvaluation,
        setPlayerScore,
        1 // Always 1 for multiplayer - no difficulty scaling
      );
      // Calculate new cumulative score for database (ensure numeric addition)
      const currentScore = parseFloat(playerScore) || 0;
      const moveScore = parseFloat(evaluation?.total) || 0;
      newCumulativeScore = currentScore + moveScore;
      // Clean up old move keys after 5 seconds to prevent memory leak
      setTimeout(() => evaluatedMovesRef.current.delete(moveKey), 5000);

      console.log('💾 [Score for Database]', {
        previousScore: currentScore,
        moveScore: moveScore,
        newCumulativeScore: newCumulativeScore,
        types: {
          previousScore: typeof currentScore,
          moveScore: typeof moveScore,
          newCumulativeScore: typeof newCumulativeScore
        }
      });
    } else {
      console.log('⏭️ [Skipping Duplicate Evaluation]', moveKey);
    }

    // Include metrics in the move data
    // IMPORTANT: Send BOTH players' scores so server can update both columns
    const white_player_score = myColor === 'w' ? newCumulativeScore : parseFloat(opponentScore) || 0;
    const black_player_score = myColor === 'b' ? newCumulativeScore : parseFloat(opponentScore) || 0;

    // Calculate remaining times for both players
    const whiteTimeRemainingMs = myColor === 'w' ? myMs : oppMs;
    const blackTimeRemainingMs = myColor === 'b' ? myMs : oppMs;

    const moveData = {
      from: source,
      to: target,
      promotion: move.promotion || null,
      san: move.san,
      uci: uci,
      piece: move.piece || null, // Which piece moved (e.g., 'q', 'r', 'n')
      color: move.color || null, // Color of player who moved ('w' or 'b')
      captured: move.captured || null, // Which piece was captured (if any)
      flags: move.flags || null, // Move flags (e.g., 'k'=kingside castle, 'q'=queenside castle, 'e'=en passant)
      prev_fen: prevFen,
      next_fen: nextFen,
      is_mate_hint: !!(move.san?.includes('#') || gameCopy.isCheckmate()),
      is_check: gameCopy.inCheck(),
      is_stalemate: gameCopy.isStalemate(),
      // Add evaluation metrics
      move_time_ms: moveTime * 1000,
      player_rating: user?.rating || 1200,
      // Send BOTH players' cumulative scores to preserve scoring across moves
      white_player_score: white_player_score,
      black_player_score: black_player_score,
      // Send remaining clock times for both players to persist across moves
      white_time_remaining_ms: whiteTimeRemainingMs,
      black_time_remaining_ms: blackTimeRemainingMs
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
  // handleResumeGame removed - paused overlay uses handleRequestResume instead

  const handleNewGame = async (colorPreference = 'random') => {
    try {
      console.log('🎮 Creating new game challenge...', { colorPreference, gameId, wsServiceExists: !!wsService.current });

      // Make direct HTTP call since WebSocket might be disconnected after game ends
      const token = localStorage.getItem('auth_token');
      if (!token) {
        alert('Authentication required. Please login again.');
        navigate('/login');
        return;
      }

      // Get socket_id from Echo if available
      let socketId = undefined;
      try {
        const echo = getEcho();
        if (echo && typeof echo.socketId === 'function') {
          socketId = echo.socketId();
          console.log('🔌 Retrieved socket ID from Echo:', socketId);
        } else {
          console.warn('Echo instance available but no socketId method');
        }
      } catch (error) {
        console.warn('Could not get socket ID from Echo:', error);
        // Continue without socket_id - backend should handle this case
      }

      console.log('📡 Making HTTP request to create new game challenge...', { socketId, colorPreference });

      // Build request body, only include socket_id if it's a valid string
      const requestBody = { color_preference: colorPreference };
      if (typeof socketId === 'string' && socketId.length > 0) {
        requestBody.socket_id = socketId;
      }

      const response = await fetch(`${BACKEND_URL}/websocket/games/${gameId}/new-game`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create game');
      }

      const result = await response.json();
      console.log('✅ New game challenge created:', result);

      if (result.game_id) {
        const colorText = colorPreference === 'random'
          ? 'random colors'
          : `playing as ${colorPreference}`;
        console.log(`📤 New game challenge sent to opponent with ${colorText}`);

        // Show a professional notification instead of alert
        setNotificationMessage(`Challenge sent! (You requested ${colorText})`);
        setShowNotification(true);

        // Auto-hide notification after 4 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 4000);

        // Store the game_id in case opponent accepts
        sessionStorage.setItem('pendingNewGameId', result.game_id);

        // Subscribe to the new game's channel to detect when opponent joins
        const echo = getEcho();
        const newGameChannel = echo.private(`game.${result.game_id}`);

        console.log(`👂 Listening for game activation on game.${result.game_id}`);

        // Track if we've already navigated to prevent double navigation
        let hasNavigated = false;
        let pollInterval = null;

        const navigateToNewGame = () => {
          if (hasNavigated) return;
          hasNavigated = true;

          console.log('✅ New game activated! Opponent has joined');

          // Clean up
          sessionStorage.removeItem('pendingNewGameId');
          newGameChannel.stopListening('.game.activated');
          if (pollInterval) clearInterval(pollInterval);

          // Close all modals
          setGameComplete(false);
          setGameResult(null);

          // Disconnect from current game
          if (wsService.current) {
            wsService.current.disconnect();
          }

          // Navigate to the new game
          console.log(`🎯 Navigating to activated game: ${result.game_id}`);
          navigate(`/play/multiplayer/${result.game_id}`);
        };

        newGameChannel.listen('.game.activated', (event) => {
          console.log('📡 Received game.activated event via WebSocket:', event);
          navigateToNewGame();
        });

        // FALLBACK: Poll game status in case WebSocket event is missed (race condition fix)
        console.log('⏱️ Starting polling fallback for game activation...');
        pollInterval = setInterval(async () => {
          try {
            const response = await fetch(`${BACKEND_URL}/websocket/games/${result.game_id}/state`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const gameData = await response.json();
              console.log('🔄 Polling game status:', gameData.status);

              if (gameData.status === 'active') {
                console.log('✅ Game became active (detected via polling)');
                navigateToNewGame();
              }
            }
          } catch (err) {
            console.error('❌ Error polling game status:', err);
          }
        }, 1000); // Poll every 1 second

        // Stop polling after 30 seconds
        setTimeout(() => {
          if (pollInterval) {
            clearInterval(pollInterval);
            console.log('⏱️ Stopped polling after 30 seconds');
          }
        }, 30000);

        // Don't navigate yet - wait for opponent to accept
        // The opponent will receive a WebSocket event and can accept/decline
      } else {
        console.error('❌ No game_id in result:', result);
        alert('Failed to create game. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error creating new game challenge:', err);
      alert(`Failed to create game: ${err.message || 'Unknown error'}`);
    }
  };

  // REMOVED: handleKillGame (Forfeit Game button)
  // Reason: Forfeit should only happen automatically on timeout, not as a user action
  // Users can use Resign button instead to admit defeat

  
  const handleAcceptNewGameRequest = () => {
    if (!newGameRequest) return;

    console.log('✅ Accepting new game request:', newGameRequest);

    // Store the new game ID
    const newGameId = newGameRequest.new_game_id;

    // Close all modals and dialogs
    setNewGameRequest(null);
    setGameComplete(false);
    setGameResult(null);
    setShowPresenceDialog(false);
    setShowPausedGame(false);

    // Disconnect current WebSocket
    if (wsService.current) {
      console.log('🔌 Disconnecting from current game before navigating...');
      wsService.current.disconnect();
    }

    // Navigate to the new game
    console.log(`🎯 Navigating to new game: ${newGameId}`);
    navigate(`/play/multiplayer/${newGameId}`);
  };

  const handleDeclineNewGameRequest = () => {
    if (!newGameRequest) return;

    console.log('❌ Declining new game request:', newGameRequest);

    // TODO: Notify the requester that request was declined
    // For now, just close the dialog
    setNewGameRequest(null);
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
    const handleRetry = async () => {
      setError(null);
      setLoading(true);
      try {
        // Re-initialize the game
        await initializeGame();
      } catch (err) {
        console.error('Retry failed:', err);
        setError(err.message || 'Failed to reconnect');
      }
    };

    const handleGoBack = () => {
      navigate('/lobby');
    };

    const handleDismiss = () => {
      setError(null);
    };

    return (
      <NetworkErrorDialog
        error={error}
        onRetry={handleRetry}
        onGoBack={handleGoBack}
        onDismiss={handleDismiss}
      />
    );
  }

  // Check feature flag for PlayShell wrapper
  const usePlayShell = process.env.REACT_APP_USE_PLAY_SHELL === 'true';

  // Extract sections for PlayShell slots (COMPOSITION ONLY - no logic changes)
  const headerSection = (
    <div className={`game-header ${championshipContext ? 'championship-mode' : ''}`}>
      <h2>Multiplayer Chess</h2>

      {/* Championship Context Banner - Only shown for championship games */}
      {championshipContext && (
        <div className="championship-banner">
          <div className="championship-badge">🏆</div>
          <div className="championship-info">
            <div className="championship-name" title={championshipContext.championship?.title}>
              {championshipContext.championship?.title && championshipContext.championship.title.length > 20
                ? championshipContext.championship.title.substring(0, 20) + '...'
                : championshipContext.championship?.title}
            </div>
            <div className="championship-details">
              Round {championshipContext.round_number} • Board {championshipContext.board_number}
            </div>
          </div>
        </div>
      )}

      {gameData && (
        <div className="time-control-display">
          Time Control: {gameData.time_control_minutes || 10}min
          {gameData.time_control_increment > 0 && ` +${gameData.time_control_increment}s`}
          {championshipContext && ' • Tournament'}
        </div>
      )}
      <div className="game-status">
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus}`} title={connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}>
            ●
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

  const gameContainerSection = (
    <GameContainer
      mode="multiplayer"
      header={headerSection}
      timerData={{
        myMs,
        oppMs,
        isMyTurn,
        opponentName: gameInfo.opponentName,
        playerScore,
        computerScore: opponentScore,
        showScores: false,
        // Handle both naming conventions: whitePlayer/blackPlayer (camelCase) and white_player/black_player (snake_case)
        playerData: gameInfo.playerColor === 'white'
          ? (gameData?.whitePlayer || gameData?.white_player)
          : (gameData?.blackPlayer || gameData?.black_player),
        opponentData: gameInfo.playerColor === 'white'
          ? (gameData?.blackPlayer || gameData?.black_player)
          : (gameData?.whitePlayer || gameData?.white_player)
      }}
      gameData={{
        game,
        gameHistory,
        gameStatus: gameInfo.status,
        playerColor: gameInfo.playerColor,
        isOnlineGame: true,
        gameDataObj: gameData
      }}
      sidebarData={{
        lastMoveEvaluation,
        lastOpponentEvaluation,
        opponent: gameInfo.opponentName,
        isPortrait
      }}
    >
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

      <div className="game-controls" style={{ marginTop: '12px' }}>
        {gameInfo.status === 'active' && (
          <>
            <button onClick={handleResign} className="resign-button">
              Resign
            </button>
            <button
              onClick={handleOfferDraw}
              className="draw-button"
              disabled={drawOfferedByMe}
              style={{ marginLeft: '8px' }}
            >
              {drawOfferedByMe ? 'Draw Offered' : 'Offer Draw'}
            </button>
          </>
        )}
        {/* Resume button removed - paused overlay handles resume requests */}
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
      </div>
    </GameContainer>
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

      {/* Draw Offer Notification */}
      {drawOfferPending && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#2a2a2a',
            color: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
            minWidth: '300px',
            maxWidth: '400px'
          }}>
            <h3 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: '600' }}>
              Draw Offer
            </h3>
            <p style={{ marginBottom: '24px', fontSize: '16px', color: '#ccc' }}>
              Your opponent offers a draw
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleAcceptDraw}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Accept Draw
              </button>
              <button
                onClick={handleDeclineDraw}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Completion Modal */}
      {gameComplete && gameResult && (
        <GameCompletionAnimation
          result={gameResult}
          score={Math.abs(parseFloat(
            gameInfo.playerColor === 'white'
              ? gameResult.white_player_score
              : gameResult.black_player_score
          ) || 0)}
          opponentScore={Math.abs(parseFloat(
            gameInfo.playerColor === 'white'
              ? gameResult.black_player_score
              : gameResult.white_player_score
          ) || 0)}
          playerColor={gameInfo.playerColor}
          isMultiplayer={true}
          opponentRating={
            gameInfo.playerColor === 'white'
              ? gameResult.black_player?.rating
              : gameResult.white_player?.rating
          }
          opponentId={
            gameInfo.playerColor === 'white'
              ? gameResult.black_player?.id
              : gameResult.white_player?.id
          }
          gameId={gameId}
          championshipData={championshipContext ? {
            tournamentName: championshipContext.championship?.name || 'Championship',
            round: championshipContext.round_number,
            matchId: championshipContext.match_id,
            championshipId: championshipContext.championship_id
          } : null}
          onClose={() => {
            // X button should navigate to lobby
            sessionStorage.removeItem('lastInvitationAction');
            sessionStorage.removeItem('lastInvitationTime');
            sessionStorage.removeItem('lastGameId');
            sessionStorage.setItem('intentionalLobbyVisit', 'true');
            sessionStorage.setItem('intentionalLobbyVisitTime', Date.now().toString());
            navigate('/lobby');
          }}
          onNewGame={handleNewGame}
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
          onPreview={() => {
            // Navigate to game review using game ID with multiplayer mode for correct score display
            console.log('🎬 Preview button: navigating to /play/review/' + gameId + '?mode=multiplayer');
            navigate(`/play/review/${gameId}?mode=multiplayer`);
          }}
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
          boardArea={gameContainerSection}
          sidebar={null}
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
            lastActivityTimeRef.current = Date.now();
            lastActivityTimeRef.current = Date.now();
          }}
          onCloseTimeout={async () => {
            console.log('[PresenceConfirmationDialogSimple] Timeout - pausing game');

            // Set presence lock to prevent dialog re-opening during pause attempt
            isPausingRef.current = true;
            isPausingRef.current = true;

            try {
              const timeData = getTimeData();
              const pauseResult = await wsService.current?.pauseGame(timeData);
              console.log('[PresenceConfirmationDialogSimple] Game paused successfully:', pauseResult);

              // Only close dialog if pause succeeded
              setShowPresenceDialog(false);
              showPresenceDialogRef.current = false;

              // Show paused game UI instead of dialog
              setShowPausedGame(true);

              // Release presence lock after a short delay to prevent immediate re-opening
              setTimeout(() => {
                isPausingRef.current = false;
                isPausingRef.current = false;
              }, 2000);
            } catch (error) {
              console.error('[PresenceConfirmationDialogSimple] Failed to pause game:', error);
              // If pausing fails, don't close the dialog - let it try again
              isPausingRef.current = false;
              isPausingRef.current = false;
              return;
            }
          }}
        />
      </>
    );
  }

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
                  : pausedByUserName
                    ? `Game has been paused due to inactivity of ${pausedByUserName}.`
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
                        backgroundColor: isWaitingForResumeResponse ? '#2196F3' : '#ff9800',
                        color: 'white',
                        border: 'none',
                        padding: '14px 28px',
                        borderRadius: '8px',
                        fontSize: '16px',
                        marginRight: '12px',
                        marginBottom: '12px',
                        display: 'inline-block'
                      }}>
                        {isWaitingForResumeResponse ? '📤 Sending resume request...' : '⚠️ Auto-resume may have failed'}
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
                      {!isWaitingForResumeResponse && (
                        <div>
                          <div style={{
                            fontSize: '12px',
                            color: '#ff9800',
                            marginTop: '8px',
                            marginBottom: '12px'
                          }}>
                            Please try clicking the manual resume button below.
                          </div>
                          <button
                            onClick={handleRequestResume}
                            disabled={isWaitingForResumeResponse}
                            style={{
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              padding: '14px 28px',
                              borderRadius: '8px',
                              fontSize: '16px',
                              cursor: 'pointer',
                              marginRight: '12px'
                            }}
                          >
                            🔄 Manual Resume Request
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Regular resume button for inactivity pauses OR lobby resume fallback
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
                        {isWaitingForResumeResponse ? 'Requesting...' :
                         isLobbyResume ? 'Retry Resume Request' : 'Request Resume'}
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
                      {isLobbyResume && !isWaitingForResumeResponse && (
                        <div style={{
                          fontSize: '12px',
                          color: '#ff9800',
                          marginTop: '8px'
                        }}>
                          Auto-resume may have failed. Click to try manually.
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

        {gameContainerSection}

        {/* Checkmate Notification */}
        {showCheckmate && checkmateWinner && (
          <CheckmateNotification
            winner={checkmateWinner}
            onComplete={() => setShowCheckmate(false)}
          />
        )}
      </div>

      {/* Game Completion Modal */}
      {gameComplete && gameResult && (
        <GameCompletionAnimation
          result={gameResult}
          score={Math.abs(parseFloat(
            gameInfo.playerColor === 'white'
              ? gameResult.white_player_score
              : gameResult.black_player_score
          ) || 0)}
          opponentScore={Math.abs(parseFloat(
            gameInfo.playerColor === 'white'
              ? gameResult.black_player_score
              : gameResult.white_player_score
          ) || 0)}
          playerColor={gameInfo.playerColor}
          isMultiplayer={true}
          opponentRating={
            gameInfo.playerColor === 'white'
              ? gameResult.black_player?.rating
              : gameResult.white_player?.rating
          }
          opponentId={
            gameInfo.playerColor === 'white'
              ? gameResult.black_player?.id
              : gameResult.white_player?.id
          }
          gameId={gameId}
          championshipData={championshipContext ? {
            tournamentName: championshipContext.championship?.name || 'Championship',
            round: championshipContext.round_number,
            matchId: championshipContext.match_id,
            championshipId: championshipContext.championship_id
          } : null}
          onClose={() => {
            // X button should navigate to lobby
            sessionStorage.removeItem('lastInvitationAction');
            sessionStorage.removeItem('lastInvitationTime');
            sessionStorage.removeItem('lastGameId');
            sessionStorage.setItem('intentionalLobbyVisit', 'true');
            sessionStorage.setItem('intentionalLobbyVisitTime', Date.now().toString());
            navigate('/lobby');
          }}
          onNewGame={handleNewGame}
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
          onPreview={() => {
            // Navigate to game review/preview page using saved game_history ID
            const reviewId = savedGameHistoryId || gameId;
            console.log('🎬 Preview button: navigating to /play/review/' + reviewId);
            navigate(`/play/review/${reviewId}`);
          }}
        />
      )}

      {/* New Game Request Dialog */}
      {newGameRequest && (
        <NewGameRequestDialog
          request={newGameRequest}
          onAccept={handleAcceptNewGameRequest}
          onDecline={handleDeclineNewGameRequest}
        />
      )}

      {/* Toast Notification */}
      {showNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          fontSize: '14px',
          fontWeight: '500',
          maxWidth: '300px',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          {notificationMessage}
        </div>
      )}

      {/* Error Notification */}
      {showError && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#f44336',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          fontSize: '14px',
          fontWeight: '500',
          maxWidth: '300px',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          {errorMessage}
        </div>
      )}

      {/* Presence Confirmation Dialog - OUTSIDE game-container to avoid z-index issues */}
      <PresenceConfirmationDialogSimple
        open={showPresenceDialog}
        onConfirm={() => {
          console.log('[PresenceConfirmationDialogSimple] User confirmed presence');
          setShowPresenceDialog(false);
          showPresenceDialogRef.current = false;
          lastActivityTimeRef.current = Date.now();
          lastActivityTimeRef.current = Date.now();
        }}
        onCloseTimeout={async () => {
          console.log('[PresenceConfirmationDialogSimple] Timeout - attempting to pause game');

          // Set presence lock to prevent dialog re-opening during pause attempt
          isPausingRef.current = true;
          isPausingRef.current = true;

          try {
            const timeData = getTimeData();
            const pauseResult = await wsService.current?.pauseGame(timeData);
            console.log('[PresenceConfirmationDialogSimple] Game paused successfully:', pauseResult);

            // Only close dialog if pause succeeded
            setShowPresenceDialog(false);
            showPresenceDialogRef.current = false;

            // Show paused game UI instead of dialog
            setShowPausedGame(true);

            // Release presence lock after a short delay to prevent immediate re-opening
            setTimeout(() => {
              isPausingRef.current = false;
              isPausingRef.current = false;
            }, 2000);
          } catch (error) {
            console.error('[PresenceConfirmationDialogSimple] Failed to pause game:', error);
            // If pausing fails, don't close the dialog - let it try again
            isPausingRef.current = false;
            isPausingRef.current = false;
            return;
          }
        }}
      />
    </>
  );
};


export default PlayMultiplayer;
