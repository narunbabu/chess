// src/utils/timerOptimizer.js
import { useState, useEffect } from 'react';
import { performanceMonitor } from './performanceMonitor';

/**
 * Client-side timer batching and optimization system
 * Reduces server communication and improves timer performance
 */

class TimerOptimizer {
  constructor(config = {}) {
    this.config = {
      batchInterval: 100, // Send updates every 100ms
      maxBatchSize: 10,   // Maximum updates per batch
      enablePrediction: true, // Predictive timer smoothing
      enableCompression: true, // Compress timer data
      ...config
    };

    // State
    this.isActive = false;
    this.pendingUpdates = [];
    this.lastSentTime = {};
    this.batchTimer = null;
    this.subscribers = new Set();
    this.clientTimers = new Map(); // player -> timer state
  }

  /**
   * Enable timer optimization
   * @param {Object} initialTimers - Initial timer state
   */
  enable(initialTimers = {}) {
    console.log('⏱️ Enabling client-side timer optimization');
    this.isActive = true;
    this.clientTimers.clear();

    // Initialize client-side timers
    Object.entries(initialTimers).forEach(([player, time]) => {
      this.clientTimers.set(player, {
        time,
        lastUpdate: Date.now(),
        isActive: false
      });
    });

    this.startBatching();
    return this;
  }

  /**
   * Disable timer optimization
   */
  disable() {
    console.log('⏱️ Disabling client-side timer optimization');
    this.isActive = false;
    this.stopBatching();
    this.pendingUpdates = [];
    return this;
  }

  /**
   * Start a timer for a player
   * @param {string} player - Player identifier ('w' or 'b')
   */
  startTimer(player) {
    if (!this.isActive) return false;

    const timer = this.clientTimers.get(player);
    if (timer) {
      timer.isActive = true;
      timer.startTime = Date.now();
      this.clientTimers.set(player, timer);

      console.log(`⏱️ Started client timer for ${player}`);
      return true;
    }
    return false;
  }

  /**
   * Stop a timer for a player
   * @param {string} player - Player identifier
   */
  stopTimer(player) {
    if (!this.isActive) return false;

    const timer = this.clientTimers.get(player);
    if (timer) {
      timer.isActive = false;
      if (timer.startTime) {
        // Calculate elapsed time and update the total
        const elapsed = Date.now() - timer.startTime;
        timer.time += elapsed;
        timer.startTime = null;
      }

      console.log(`⏱️ Stopped client timer for ${player}, new time: ${timer.time}ms`);
      return true;
    }
    return false;
  }

  /**
   * Update timer value
   * @param {string} player - Player identifier
   * @param {number} time - New time in milliseconds
   */
  updateTimer(player, time) {
    if (!this.isActive) return false;

    const timer = this.clientTimers.get(player);
    if (timer) {
      const oldTime = timer.time;
      timer.time = time;
      timer.lastUpdate = Date.now();

      // Only queue update if time changed significantly
      if (Math.abs(time - oldTime) > 50) { // 50ms threshold
        this.queueTimerUpdate(player, time);
        performanceMonitor.trackTimerLocalUpdate();
      }
      return true;
    }
    return false;
  }

  /**
   * Get current timer value for player
   * @param {string} player - Player identifier
   * @returns {number} Current time in milliseconds
   */
  getTimer(player) {
    if (!this.isActive) return 0;

    const timer = this.clientTimers.get(player);
    if (!timer) return 0;

    // If timer is active, add elapsed time since last update
    if (timer.isActive && timer.startTime) {
      const currentElapsed = Date.now() - timer.startTime;
      return timer.time + currentElapsed;
    }

    return timer.time;
  }

  /**
   * Queue a timer update for batching
   * @param {string} player - Player identifier
   * @param {number} time - Time in milliseconds
   */
  queueTimerUpdate(player, time) {
    this.pendingUpdates.push({
      player,
      time,
      timestamp: Date.now()
    });

    // Send immediately if batch is full
    if (this.pendingUpdates.length >= this.config.maxBatchSize) {
      this.flushUpdates();
    }
  }

  /**
   * Start the batching timer
   */
  startBatching() {
    this.stopBatching(); // Clear any existing timer
    this.batchTimer = setInterval(() => {
      if (this.pendingUpdates.length > 0) {
        this.flushUpdates();
      }
    }, this.config.batchInterval);
  }

  /**
   * Stop the batching timer
   */
  stopBatching() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Flush pending updates to subscribers
   */
  flushUpdates() {
    if (this.pendingUpdates.length === 0) return;

    // Process updates - keep only latest per player
    const latestUpdates = new Map();
    this.pendingUpdates.forEach(update => {
      const existing = latestUpdates.get(update.player);
      if (!existing || update.timestamp > existing.timestamp) {
        latestUpdates.set(update.player, update);
      }
    });

    // Compress updates
    const compressedUpdates = this.compressUpdates(Array.from(latestUpdates.values()));

    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(compressedUpdates);
      } catch (error) {
        console.error('Timer optimizer subscriber error:', error);
      }
    });

    // Clear pending updates
    this.pendingUpdates = [];

    console.log(`⏱️ Flushed ${latestUpdates.size} timer updates`);
  }

  /**
   * Compress timer updates for efficient transmission
   * @param {Array} updates - Array of timer updates
   * @returns {Array} Compressed updates
   */
  compressUpdates(updates) {
    if (!this.config.enableCompression) return updates;

    // Simple compression: encode times as integers and use arrays
    return updates.map(update => ({
      p: update.player === 'w' ? 1 : 2, // 1=white, 2=black
      t: Math.round(update.time / 100) * 100, // Round to 100ms
      s: Date.now() % 10000 // 10-second cycle for sequencing
    }));
  }

  /**
   * Subscribe to timer update events
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Get optimization statistics
   * @returns {Object} Statistics about timer optimization
   */
  getStats() {
    const activeTimers = Array.from(this.clientTimers.values())
      .filter(timer => timer.isActive).length;

    return {
      isActive: this.isActive,
      pendingUpdates: this.pendingUpdates.length,
      activeTimers,
      totalTimers: this.clientTimers.size,
      batchSize: this.config.maxBatchSize,
      batchInterval: this.config.batchInterval
    };
  }

  /**
   * Sync with server timer state
   * @param {Object} serverTimers - Server timer state
   */
  syncWithServer(serverTimers) {
    if (!this.isActive) return;

    Object.entries(serverTimers).forEach(([player, time]) => {
      const clientTimer = this.clientTimers.get(player);
      if (clientTimer) {
        const diff = Math.abs(clientTimer.time - time);
        if (diff > 1000) { // More than 1 second difference
          console.log(`⏱️ Syncing timer for ${player}: client=${clientTimer.time}ms, server=${time}ms, diff=${diff}ms`);
          clientTimer.time = time;
          clientTimer.lastUpdate = Date.now();
          performanceMonitor.trackTimerServerSync();
        }
      }
    });
  }

  /**
   * Reset all timers
   */
  reset() {
    this.clientTimers.forEach(timer => {
      timer.time = 0;
      timer.isActive = false;
      timer.startTime = null;
      timer.lastUpdate = Date.now();
    });
    this.pendingUpdates = [];
  }
}

/**
 * Global timer optimizer instance
 */
const globalTimerOptimizer = new TimerOptimizer();

/**
 * Enable client-side timer optimization
 * @param {Object} config - Configuration options
 * @returns {TimerOptimizer} Timer optimizer instance
 */
export function enableTimerOptimization(config = {}) {
  return globalTimerOptimizer.enable(config);
}

/**
 * Disable client-side timer optimization
 * @returns {TimerOptimizer} Timer optimizer instance
 */
export function disableTimerOptimization() {
  return globalTimerOptimizer.disable();
}

/**
 * Get the global timer optimizer instance
 * @returns {TimerOptimizer} Global timer optimizer
 */
export function getTimerOptimizer() {
  return globalTimerOptimizer;
}

/**
 * Hook for using timer optimization in React components
 * @param {Object} initialTimers - Initial timer state
 * @returns {Object} Timer optimization functions and state
 */
export function useTimerOptimization(initialTimers = {}) {
  const [isOptimized, setIsOptimized] = useState(false);
  const timerOptimizer = getTimerOptimizer();

  useEffect(() => {
    if (isOptimized) {
      timerOptimizer.enable(initialTimers);
      return () => timerOptimizer.disable();
    }
  }, [isOptimized]);

  return {
    isOptimized,
    setIsOptimized,
    startTimer: (player) => timerOptimizer.startTimer(player),
    stopTimer: (player) => timerOptimizer.stopTimer(player),
    updateTimer: (player, time) => timerOptimizer.updateTimer(player, time),
    getTimer: (player) => timerOptimizer.getTimer(player),
    syncWithServer: (timers) => timerOptimizer.syncWithServer(timers),
    reset: () => timerOptimizer.reset(),
    getStats: () => timerOptimizer.getStats(),
    subscribe: (callback) => timerOptimizer.subscribe(callback)
  };
}

export default TimerOptimizer;