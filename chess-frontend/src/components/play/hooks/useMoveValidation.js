/**
 * useMoveValidation Hook
 *
 * Handles chess move validation logic for multiplayer games.
 * Provides utilities for validating moves, checking game state,
 * and managing move-related UI feedback.
 *
 * @module useMoveValidation
 */

import { useCallback } from 'react';
import { Chess } from 'chess.js';

/**
 * Custom hook for move validation in multiplayer games
 *
 * @param {Object} params - Hook parameters
 * @param {Object} params.game - Current chess game instance
 * @param {Object} params.gameInfo - Game information (status, turn, playerColor)
 * @param {boolean} params.gameComplete - Whether the game is complete
 * @param {string} params.connectionStatus - WebSocket connection status
 * @param {Object} params.wsService - WebSocket service reference
 * @param {Function} params.findKingSquare - Function to find king square
 * @param {Function} params.setErrorMessage - Set error message
 * @param {Function} params.setShowError - Show error dialog
 * @param {Function} params.setKingInDangerSquare - Highlight king in danger
 * @returns {Object} Move validation functions
 */
export const useMoveValidation = ({
  game,
  gameInfo,
  gameComplete,
  connectionStatus,
  wsService,
  findKingSquare,
  setErrorMessage,
  setShowError,
  setKingInDangerSquare,
}) => {
  /**
   * Validate if a move can be made
   * Returns an object with { valid, reason, move }
   */
  const validateMove = useCallback((source, target) => {
    // Check if game is complete
    if (gameComplete || gameInfo.status === 'finished') {
      return {
        valid: false,
        reason: 'Game is already finished',
        move: null,
      };
    }

    // Check if game is active
    if (gameInfo.status !== 'active') {
      return {
        valid: false,
        reason: `Game is ${gameInfo.status}`,
        move: null,
      };
    }

    // Check if it's the player's turn
    if (gameInfo.turn !== gameInfo.playerColor) {
      return {
        valid: false,
        reason: 'Not your turn',
        move: null,
      };
    }

    // Check WebSocket connection
    const isWsConnected = wsService.current?.isWebSocketConnected?.() || connectionStatus === 'connected';
    if (!isWsConnected) {
      return {
        valid: false,
        reason: 'Not connected to server',
        move: null,
      };
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
        let reason = 'Invalid move';

        // Check if player is in check
        if (previousState.inCheck()) {
          reason = 'You cannot move out of check! Your king is in danger.';

          // Highlight king
          const kingSquare = findKingSquare(previousState, gameInfo.playerColor.charAt(0));
          if (kingSquare) {
            setKingInDangerSquare(kingSquare);
            setTimeout(() => setKingInDangerSquare(null), 3000);
          }
        }

        return {
          valid: false,
          reason,
          move: null,
          previousState,
        };
      }

      // Move is valid
      return {
        valid: true,
        reason: null,
        move,
        previousState,
        gameCopy,
      };
    } catch (error) {
      console.error('Error validating move:', error);
      return {
        valid: false,
        reason: 'Move validation error',
        move: null,
        error,
      };
    }
  }, [
    game,
    gameInfo,
    gameComplete,
    connectionStatus,
    wsService,
    findKingSquare,
    setKingInDangerSquare,
  ]);

  /**
   * Show validation error to user
   */
  const showValidationError = useCallback((reason) => {
    setErrorMessage(reason);
    setShowError(true);

    // Auto-hide after 4 seconds
    setTimeout(() => setShowError(false), 4000);
  }, [setErrorMessage, setShowError]);

  /**
   * Check if a move is legal (quick check without side effects)
   */
  const isMoveLegal = useCallback((source, target) => {
    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from: source, to: target, promotion: 'q' });
      return move !== null;
    } catch (error) {
      return false;
    }
  }, [game]);

  /**
   * Get available moves for a piece at a square
   */
  const getAvailableMoves = useCallback((square) => {
    try {
      return game.moves({ square, verbose: true });
    } catch (error) {
      console.error('Error getting available moves:', error);
      return [];
    }
  }, [game]);

  /**
   * Check if a square can be moved to (for drag-drop validation)
   */
  const canMoveTo = useCallback((source, target) => {
    const validation = validateMove(source, target);
    return validation.valid;
  }, [validateMove]);

  return {
    validateMove,
    showValidationError,
    isMoveLegal,
    getAvailableMoves,
    canMoveTo,
  };
};

export default useMoveValidation;
