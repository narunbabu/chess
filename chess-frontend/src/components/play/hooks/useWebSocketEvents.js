/**
 * useWebSocketEvents Hook
 *
 * Manages WebSocket event listeners and handlers for multiplayer games.
 * Centralizes all WebSocket event setup and handling logic.
 *
 * @module useWebSocketEvents
 */

import { useCallback, useRef } from 'react';

/**
 * Custom hook for managing WebSocket events in multiplayer games
 *
 * @param {Object} params - Hook parameters
 * @param {Object} params.wsService - WebSocket service reference
 * @param {Object} params.user - Current user object
 * @param {Function} params.setConnectionStatus - Update connection status
 * @param {Function} params.setNewGameRequest - Set new game request
 * @returns {Object} WebSocket event handlers and setup functions
 */
export const useWebSocketEvents = ({
  wsService,
  user,
  setConnectionStatus,
  setNewGameRequest,
}) => {
  // Store user channel ref
  const userChannelRef = useRef(null);

  /**
   * Setup all WebSocket event listeners
   * This should be called once during component initialization
   */
  const setupWebSocketListeners = useCallback((
    handlers
  ) => {
    if (!wsService.current) {
      console.error('[WS Events] WebSocket service not available');
      return;
    }

    const {
      onRemoteMove,
      onGameStatusChange,
      onGameEnd,
      onGameActivated,
      onGameResumed,
      onGamePaused,
      onOpponentPing,
      onUndoRequest,
      onUndoAccepted,
      onUndoDeclined,
      onPlayerConnection,
      onDrawOfferReceived,
      onDrawOfferDeclined,
      onError,
    } = handlers;

    // Core game events
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
      if (onRemoteMove) onRemoteMove(event);
    });

    wsService.current.on('gameStatus', (event) => {
      console.log('Game status changed:', event);
      if (onGameStatusChange) onGameStatusChange(event);
    });

    wsService.current.on('gameEnded', (event) => {
      console.log('🏁 Game ended event received:', event);
      if (onGameEnd) onGameEnd(event);
    });

    wsService.current.on('gameActivated', (event) => {
      console.log('Game activated event received:', event);
      if (onGameActivated) onGameActivated(event);
    });

    wsService.current.on('gameResumed', (event) => {
      console.log('🎮 Game resumed event received:', event);
      if (onGameResumed) onGameResumed(event);
    });

    wsService.current.on('gamePaused', (event) => {
      console.log('⏸️ Game paused event received:', event);
      if (onGamePaused) onGamePaused(event);
    });

    wsService.current.on('opponentPinged', (event) => {
      console.log('🔔 Opponent pinged event received:', event);
      if (onOpponentPing) onOpponentPing(event);
    });

    // Undo events
    wsService.current.on('undoRequest', (event) => {
      console.log('↶ Undo request event received:', event);
      if (onUndoRequest) onUndoRequest(event);
    });

    wsService.current.on('undoAccepted', (event) => {
      console.log('✅ Undo accepted event received:', event);
      if (onUndoAccepted) onUndoAccepted(event);
    });

    wsService.current.on('undoDeclined', (event) => {
      console.log('❌ Undo declined event received:', event);
      if (onUndoDeclined) onUndoDeclined(event);
    });

    // Player connection events
    wsService.current.on('gameConnection', (event) => {
      console.log('Player connection event:', event);
      if (onPlayerConnection) onPlayerConnection(event);
    });

    // Error events
    wsService.current.on('error', (error) => {
      console.error('WebSocket error:', error);

      let errorMessage = 'Unknown connection error';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error?.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      }

      if (onError) onError(errorMessage);
    });

    // Setup user channel listeners (draw offers, new game requests)
    if (user) {
      userChannelRef.current = wsService.current.subscribeToUserChannel(user);

      userChannelRef.current.listen('.draw.offer.sent', (event) => {
        console.log('🤝 Draw offer received:', event);
        if (onDrawOfferReceived) onDrawOfferReceived(event);
      });

      userChannelRef.current.listen('.draw.offer.declined', (event) => {
        console.log('❌ Draw offer declined:', event);
        if (onDrawOfferDeclined) onDrawOfferDeclined(event);
      });

      userChannelRef.current.listen('.new_game.request', (event) => {
        console.log('🎮 New game challenge received:', event);
        setNewGameRequest(event);
      });
    }

    console.log('[WS Events] All WebSocket event listeners setup complete');
  }, [wsService, user, setConnectionStatus, setNewGameRequest]);

  /**
   * Cleanup WebSocket listeners
   */
  const cleanupWebSocketListeners = useCallback(() => {
    if (wsService.current) {
      // Remove all listeners (if WebSocketGameService supports removeAllListeners)
      if (typeof wsService.current.removeAllListeners === 'function') {
        wsService.current.removeAllListeners();
      }
    }

    userChannelRef.current = null;
    console.log('[WS Events] WebSocket listeners cleaned up');
  }, [wsService]);

  /**
   * Check if WebSocket is connected
   */
  const isWebSocketConnected = useCallback(() => {
    if (!wsService.current) return false;

    if (typeof wsService.current.isWebSocketConnected === 'function') {
      return wsService.current.isWebSocketConnected();
    }

    return wsService.current.isConnected || false;
  }, [wsService]);

  return {
    setupWebSocketListeners,
    cleanupWebSocketListeners,
    isWebSocketConnected,
    userChannelRef,
  };
};

export default useWebSocketEvents;
