/**
 * useGameState Hook
 *
 * Consolidates all game-related state management for PlayMultiplayer component.
 * This hook reduces complexity by grouping related state variables together
 * and providing a single interface for game state operations.
 *
 * @module useGameState
 */

import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { getPreferredGameMode } from '../../../utils/gamePreferences';

/**
 * Custom hook for managing multiplayer game state
 *
 * @param {Object} params - Hook parameters
 * @param {Object} params.user - Current user object from auth context
 * @returns {Object} Game state and state management functions
 */
export const useGameState = ({ user }) => {
  // Core game state
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState(null);
  const [gameInfo, setGameInfo] = useState({
    playerColor: 'white',
    turn: 'white',
    status: 'active',
    opponentName: 'Rival'
  });

  // Game history and UI state
  const [gameHistory, setGameHistory] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [lastMoveHighlights, setLastMoveHighlights] = useState({});

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [opponentOnline, setOpponentOnline] = useState(false);

  // Game completion state
  const [gameComplete, setGameComplete] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [showCheckmate, setShowCheckmate] = useState(false);
  const [checkmateWinner, setCheckmateWinner] = useState(null);
  const [kingInDangerSquare, setKingInDangerSquare] = useState(null);
  const [savedGameHistoryId, setSavedGameHistoryId] = useState(null);

  // Game mode and features
  const [ratedMode, setRatedMode] = useState(() => getPreferredGameMode());
  const [championshipContext, setChampionshipContext] = useState(null);

  // Draw offer state
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [drawOfferedByMe, setDrawOfferedByMe] = useState(false);
  const [drawState, setDrawState] = useState({
    offered: false,
    pending: false,
    byPlayer: null
  });

  // Undo functionality state (for casual mode)
  const [canUndo, setCanUndo] = useState(false);
  const [undoChancesRemaining, setUndoChancesRemaining] = useState(0);
  const [maxUndoChances] = useState(3);
  const [undoRequestPending, setUndoRequestPending] = useState(false);
  const [undoRequestFrom, setUndoRequestFrom] = useState(null);

  // Rated game confirmation
  const [showRatedGameConfirmation, setShowRatedGameConfirmation] = useState(false);
  const [ratedGameConfirmed, setRatedGameConfirmed] = useState(false);
  const [showRatedNavigationWarning, setShowRatedNavigationWarning] = useState(false);
  const [pendingRatedNavigation, setPendingRatedNavigation] = useState(null);

  // Performance and rating tracking
  const [performanceData, setPerformanceData] = useState(null);
  const [ratingChangeData, setRatingChangeData] = useState(null);

  // Score tracking
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState(null);
  const [lastOpponentEvaluation, setLastOpponentEvaluation] = useState(null);

  // Initial timer state
  const [initialTimerState, setInitialTimerState] = useState({
    whiteMs: 10 * 60 * 1000,
    blackMs: 10 * 60 * 1000,
    incrementMs: 0
  });

  // Notifications
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  // New game/rematch request
  const [newGameRequest, setNewGameRequest] = useState(null);

  // Orientation state
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  /**
   * Derive player color from user ID and game data
   * Single source of truth for player color
   */
  const myColor = useMemo(() => {
    if (!user?.id || !gameData) return null;
    const userId = parseInt(user.id);
    const whiteId = parseInt(gameData.white_player_id);
    const blackId = parseInt(gameData.black_player_id);

    if (userId === whiteId) return 'w';
    if (userId === blackId) return 'b';

    console.error('🚨 User ID does not match any player:', { userId, whiteId, blackId });
    return null;
  }, [user?.id, gameData]);

  /**
   * Derive server turn from game info
   */
  const serverTurn = useMemo(() => {
    return gameInfo.turn === 'white' ? 'w' : gameInfo.turn === 'black' ? 'b' : null;
  }, [gameInfo.turn]);

  /**
   * Determine if it's the current player's turn
   */
  const isMyTurn = useMemo(() => {
    return (myColor && serverTurn) ? (myColor === serverTurn) : false;
  }, [myColor, serverTurn]);

  /**
   * Reset all game state (useful for starting a new game)
   */
  const resetGameState = useCallback(() => {
    setGame(new Chess());
    setGameData(null);
    setGameInfo({
      playerColor: 'white',
      turn: 'white',
      status: 'active',
      opponentName: 'Rival'
    });
    setGameHistory([]);
    setSelectedSquare(null);
    setBoardOrientation('white');
    setLastMoveHighlights({});
    setLoading(true);
    setError(null);
    setGameComplete(false);
    setGameResult(null);
    setShowCheckmate(false);
    setCheckmateWinner(null);
    setKingInDangerSquare(null);
    setSavedGameHistoryId(null);
    setDrawOfferPending(false);
    setDrawOfferedByMe(false);
    setDrawState({ offered: false, pending: false, byPlayer: null });
    setCanUndo(false);
    setUndoChancesRemaining(0);
    setUndoRequestPending(false);
    setUndoRequestFrom(null);
    setPerformanceData(null);
    setRatingChangeData(null);
    setPlayerScore(0);
    setOpponentScore(0);
    setLastMoveEvaluation(null);
    setLastOpponentEvaluation(null);
    setNotificationMessage('');
    setShowNotification(false);
    setErrorMessage('');
    setShowError(false);
    setNewGameRequest(null);
  }, []);

  /**
   * Update game info with partial updates
   */
  const updateGameInfo = useCallback((updates) => {
    setGameInfo(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Update scores
   */
  const updateScores = useCallback(({ playerScore: newPlayerScore, opponentScore: newOpponentScore }) => {
    if (newPlayerScore !== undefined) setPlayerScore(newPlayerScore);
    if (newOpponentScore !== undefined) setOpponentScore(newOpponentScore);
  }, []);

  return {
    // Core game state
    game,
    setGame,
    gameData,
    setGameData,
    gameInfo,
    setGameInfo,
    updateGameInfo,

    // Game history and UI
    gameHistory,
    setGameHistory,
    selectedSquare,
    setSelectedSquare,
    boardOrientation,
    setBoardOrientation,
    lastMoveHighlights,
    setLastMoveHighlights,

    // Loading and errors
    loading,
    setLoading,
    error,
    setError,
    connectionStatus,
    setConnectionStatus,
    opponentOnline,
    setOpponentOnline,

    // Game completion
    gameComplete,
    setGameComplete,
    gameResult,
    setGameResult,
    showCheckmate,
    setShowCheckmate,
    checkmateWinner,
    setCheckmateWinner,
    kingInDangerSquare,
    setKingInDangerSquare,
    savedGameHistoryId,
    setSavedGameHistoryId,

    // Game mode and features
    ratedMode,
    setRatedMode,
    championshipContext,
    setChampionshipContext,

    // Draw offers
    drawOfferPending,
    setDrawOfferPending,
    drawOfferedByMe,
    setDrawOfferedByMe,
    drawState,
    setDrawState,

    // Undo functionality
    canUndo,
    setCanUndo,
    undoChancesRemaining,
    setUndoChancesRemaining,
    maxUndoChances,
    undoRequestPending,
    setUndoRequestPending,
    undoRequestFrom,
    setUndoRequestFrom,

    // Rated game confirmation
    showRatedGameConfirmation,
    setShowRatedGameConfirmation,
    ratedGameConfirmed,
    setRatedGameConfirmed,
    showRatedNavigationWarning,
    setShowRatedNavigationWarning,
    pendingRatedNavigation,
    setPendingRatedNavigation,

    // Performance and ratings
    performanceData,
    setPerformanceData,
    ratingChangeData,
    setRatingChangeData,

    // Scores
    playerScore,
    setPlayerScore,
    opponentScore,
    setOpponentScore,
    lastMoveEvaluation,
    setLastMoveEvaluation,
    lastOpponentEvaluation,
    setLastOpponentEvaluation,
    updateScores,

    // Timer state
    initialTimerState,
    setInitialTimerState,

    // Notifications
    notificationMessage,
    setNotificationMessage,
    showNotification,
    setShowNotification,
    errorMessage,
    setErrorMessage,
    showError,
    setShowError,

    // New game request
    newGameRequest,
    setNewGameRequest,

    // Orientation
    isPortrait,
    setIsPortrait,

    // Computed values
    myColor,
    serverTurn,
    isMyTurn,

    // Utility functions
    resetGameState,
  };
};

export default useGameState;
