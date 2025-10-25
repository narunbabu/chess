/**
 * FEN Optimization System
 * Reduces payload size by removing redundant FEN strings that can be reconstructed
 */

import { Chess } from 'chess.js';

export class FENOptimizer {
  constructor() {
    this.gameStateCache = new Map(); // Cache game states by game ID
  }

  /**
   * Remove FEN fields from move payload for optimization
   * @param {Object} moveData - Original move data with FEN fields
   * @param {string} gameId - Game ID for state tracking
   * @returns {Object} Optimized move data without FEN fields
   */
  optimizeMovePayload(moveData, gameId = 'default') {
    if (!moveData || !moveData.from || !moveData.to) {
      throw new Error('Invalid move data for optimization');
    }

    // Store current game state before removing FEN fields
    if (moveData.prev_fen) {
      this.updateGameState(gameId, moveData.prev_fen);
    }

    // Create optimized payload without FEN fields
    const optimized = {
      ...moveData,
      // Remove FEN fields that can be reconstructed
      prev_fen: undefined,
      next_fen: undefined,
    };

    // Clean up undefined fields
    Object.keys(optimized).forEach(key => {
      if (optimized[key] === undefined) {
        delete optimized[key];
      }
    });

    return optimized;
  }

  /**
   * Reconstruct FEN fields on the server side if needed
   * @param {Object} moveData - Move data without FEN fields
   * @param {string} gameId - Game ID for state lookup
   * @returns {Object} Move data with reconstructed FEN fields
   */
  reconstructFENFields(moveData, gameId = 'default') {
    if (!moveData || !moveData.from || !moveData.to) {
      throw new Error('Invalid move data for reconstruction');
    }

    const gameState = this.getGameState(gameId);
    if (!gameState) {
      console.warn('No game state available for FEN reconstruction');
      return moveData;
    }

    try {
      const chess = new Chess(gameState);

      // Apply the move to get next FEN
      const move = {
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion
      };

      const result = chess.move(move);
      if (!result) {
        console.warn('Failed to apply move for FEN reconstruction');
        return moveData;
      }

      // Add reconstructed FEN fields
      const reconstructed = {
        ...moveData,
        prev_fen: gameState,
        next_fen: chess.fen()
      };

      // Update game state for next move
      this.updateGameState(gameId, chess.fen());

      return reconstructed;

    } catch (error) {
      console.error('Error reconstructing FEN fields:', error);
      return moveData;
    }
  }

  /**
   * Update cached game state
   * @param {string} gameId - Game identifier
   * @param {string} fen - Current FEN
   */
  updateGameState(gameId, fen) {
    this.gameStateCache.set(gameId, fen);

    // Limit cache size
    if (this.gameStateCache.size > 100) {
      const firstKey = this.gameStateCache.keys().next().value;
      this.gameStateCache.delete(firstKey);
    }
  }

  /**
   * Get cached game state
   * @param {string} gameId - Game identifier
   * @returns {string|null} Current FEN or null
   */
  getGameState(gameId) {
    return this.gameStateCache.get(gameId) || null;
  }

  /**
   * Initialize game state from history
   * @param {string} gameId - Game identifier
   * @param {Array} moveHistory - Move history array
   * @param {string} initialFen - Initial position FEN
   */
  initializeFromHistory(gameId, moveHistory = [], initialFen = null) {
    try {
      const chess = new Chess(initialFen);

      // Apply all moves to get current state
      moveHistory.forEach(move => {
        try {
          chess.move(move);
        } catch (error) {
          console.warn('Failed to apply move in history:', move, error);
        }
      });

      this.updateGameState(gameId, chess.fen());
      console.log(`🧠 FEN Optimizer: Initialized game ${gameId} with ${moveHistory.length} moves`);

    } catch (error) {
      console.error('Error initializing FEN optimizer from history:', error);
    }
  }

  /**
   * Calculate size savings from FEN optimization
   * @param {Object} originalPayload - Original payload with FEN fields
   * @param {Object} optimizedPayload - Optimized payload without FEN fields
   * @returns {Object} Size comparison and savings
   */
  calculateSavings(originalPayload, optimizedPayload) {
    const originalSize = JSON.stringify(originalPayload).length;
    const optimizedSize = JSON.stringify(optimizedPayload).length;
    const savings = originalSize - optimizedSize;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

    return {
      originalSize,
      optimizedSize,
      savings,
      savingsPercent: `${savingsPercent}%`,
      fenFieldsRemoved: [
        ...(originalPayload.prev_fen ? ['prev_fen'] : []),
        ...(originalPayload.next_fen ? ['next_fen'] : [])
      ]
    };
  }

  /**
   * Clear game state cache
   * @param {string} gameId - Specific game ID to clear, or undefined to clear all
   */
  clearCache(gameId) {
    if (gameId) {
      this.gameStateCache.delete(gameId);
    } else {
      this.gameStateCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.gameStateCache.size,
      games: Array.from(this.gameStateCache.keys())
    };
  }
}

// Singleton instance
export const fenOptimizer = new FENOptimizer();