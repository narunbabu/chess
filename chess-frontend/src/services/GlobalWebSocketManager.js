/**
 * Global WebSocket Manager
 *
 * This service manages WebSocket connections that survive component unmounts.
 * It ensures resume requests are received even when the user navigates away from the game page.
 */

import { getEcho } from './echoSingleton';
import api from './api';

class GlobalWebSocketManager {
  constructor() {
    this.connections = new Map(); // gameId -> connection info
    this.pausedGames = new Set(); // Set of paused game IDs
    this.listeners = new Map(); // event -> Set of callbacks
    this.timeoutHandlers = new Map(); // gameId -> timeout ID
  }

  /**
   * Mark a game as paused and keep its WebSocket alive
   * @param {string} gameId - Game ID
   * @param {number} delayMs - How long to keep connection alive (default: 2 minutes)
   */
  keepGameAlive(gameId, delayMs = 2 * 60 * 1000) {
    console.log(`[GlobalWebSocket] 🔄 Keeping game ${gameId} alive for ${delayMs / 1000} seconds`);
    console.log(`[GlobalWebSocket] 📊 Current alive games before:`, Array.from(this.pausedGames));

    this.pausedGames.add(gameId);

    // Clear any existing timeout
    if (this.timeoutHandlers.has(gameId)) {
      clearTimeout(this.timeoutHandlers.get(gameId));
      console.log(`[GlobalWebSocket] 🔄 Cleared existing timeout for game ${gameId}`);
    }

    // Set timeout to disconnect
    const timeoutId = setTimeout(() => {
      console.log(`[GlobalWebSocket] ⏱️ Timeout reached for game ${gameId} - cleaning up`);
      this.cleanupGame(gameId);
    }, delayMs);

    this.timeoutHandlers.set(gameId, timeoutId);

    // Ensure we're subscribed to resume request events
    this.subscribeToResumeRequests(gameId);

    console.log(`[GlobalWebSocket] 📊 Current alive games after:`, Array.from(this.pausedGames));
    console.log(`[GlobalWebSocket] ✅ Game ${gameId} is now alive for ${delayMs / 1000} seconds`);
  }

  /**
   * Subscribe to game events to keep the connection alive
   * Note: Resume requests are handled by GlobalInvitationContext via the user channel
   * @param {string} gameId - Game ID
   */
  subscribeToResumeRequests(gameId) {
    const echo = getEcho();
    if (!echo) {
      console.warn('[GlobalWebSocket] Echo not available');
      return;
    }

    const channelName = `private-game.${gameId}`;

    // Leave any existing subscription first
    echo.leave(channelName);

    // Join the game channel privately to keep connection alive
    const channel = echo.private(channelName);

    // Listen for game status changes
    channel.listen('.GameStatusChanged', (event) => {
      console.log('[GlobalWebSocket] 📢 Game status changed:', event);
      this.emit('gameStatusChanged', event);

      // If game is no longer paused, clean up
      if (event.status !== 'paused') {
        this.cleanupGame(gameId);
      }
    });

    this.connections.set(gameId, {
      channel,
      subscribedAt: Date.now()
    });

    console.log(`[GlobalWebSocket] ✅ Subscribed to game channel: ${channelName}`);
    console.log(`[GlobalWebSocket] ℹ️ Resume requests are handled by GlobalInvitationContext`);
  }

  /**
   * Clean up a game's connection
   * @param {string} gameId - Game ID
   */
  cleanupGame(gameId) {
    console.log(`[GlobalWebSocket] 🧹 Cleaning up game ${gameId}`);
    console.log(`[GlobalWebSocket] 📊 Alive games before cleanup:`, Array.from(this.pausedGames));

    // Clear timeout
    if (this.timeoutHandlers.has(gameId)) {
      clearTimeout(this.timeoutHandlers.get(gameId));
      this.timeoutHandlers.delete(gameId);
      console.log(`[GlobalWebSocket] ⏰ Cleared timeout for game ${gameId}`);
    }

    // Leave channel
    const connection = this.connections.get(gameId);
    if (connection) {
      const echo = getEcho();
      if (echo) {
        echo.leave(`private-game.${gameId}`);
        console.log(`[GlobalWebSocket] 📡 Left channel: private-game.${gameId}`);
      }
      this.connections.delete(gameId);
    }

    // Remove from paused games
    const wasAlive = this.pausedGames.has(gameId);
    this.pausedGames.delete(gameId);

    console.log(`[GlobalWebSocket] 📊 Alive games after cleanup:`, Array.from(this.pausedGames));
    console.log(`[GlobalWebSocket] ✅ Game ${gameId} cleanup complete (was alive: ${wasAlive})`);
  }

  /**
   * Cancel the keep-alive for a game (e.g., when user returns)
   * @param {string} gameId - Game ID
   */
  cancelKeepAlive(gameId) {
    console.log(`[GlobalWebSocket] ❌ Canceling keep-alive for game ${gameId}`);
    this.cleanupGame(gameId);
  }

  /**
   * Check if a game is being kept alive
   * @param {string} gameId - Game ID
   * @returns {boolean}
   */
  isGameAlive(gameId) {
    return this.pausedGames.has(gameId);
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[GlobalWebSocket] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   * @returns {Object}
   */
  getStatus() {
    return {
      pausedGames: Array.from(this.pausedGames),
      activeConnections: this.connections.size,
      activeListeners: Array.from(this.listeners.keys())
    };
  }

  /**
   * Clean up all connections
   */
  cleanup() {
    console.log('[GlobalWebSocket] 🧹 Cleaning up all connections');

    // Clear all timeouts
    this.timeoutHandlers.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeoutHandlers.clear();

    // Leave all channels
    const echo = getEcho();
    if (echo) {
      this.connections.forEach((connection, gameId) => {
        echo.leave(`game.${gameId}`);
      });
    }

    this.connections.clear();
    this.pausedGames.clear();
    this.listeners.clear();
  }
}

// Create singleton instance
const globalWebSocketManager = new GlobalWebSocketManager();

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    globalWebSocketManager.cleanup();
  });
}

export default globalWebSocketManager;