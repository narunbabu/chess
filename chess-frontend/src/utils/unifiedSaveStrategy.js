// src/utils/unifiedSaveStrategy.js

/**
 * Unified save strategy that reduces server fetches
 * Implements intelligent caching, deduplication, and batched saves
 */

class UnifiedSaveStrategy {
  constructor(config = {}) {
    this.config = {
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 100, // Maximum games in cache
      batchSize: 5, // Save in batches of 5
      batchInterval: 2000, // Batch every 2 seconds
      enableCompression: true,
      enableDeduplication: true,
      ...config
    };

    this.gameCache = new Map();
    this.pendingSaves = new Map();
    this.batchTimer = null;
    this.saveQueue = [];
    this.subscribers = new Set();
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      serverSaves: 0,
      savedFromCache: 0,
      bytesSaved: 0
    };
  }

  /**
   * Save a game with unified strategy
   * @param {Object} gameData - Game data to save
   * @returns {Promise<Object>} Save result
   */
  async saveGame(gameData) {
    const gameKey = this.generateGameKey(gameData);

    // Check if we have a recent cached version
    if (this.shouldUseCache(gameKey, gameData)) {
      console.log('💾 Using cached game data, skipping server save');
      this.stats.savedFromCache++;
      return this.getCachedGame(gameKey);
    }

    // Queue for batched save
    this.queueSave(gameKey, gameData);

    // Return cached version while save is pending
    return this.getCachedGame(gameKey);
  }

  /**
   * Generate unique key for a game
   * @param {Object} gameData - Game data
   * @returns {string} Game key
   */
  generateGameKey(gameData) {
    // Use multiple fields for uniqueness
    const keyFields = [
      gameData.id || gameData.game_id,
      gameData.date || gameData.played_at,
      gameData.player_color,
      gameData.opponent_name
    ];

    return keyFields.filter(Boolean).join('|');
  }

  /**
   * Check if we should use cached version
   * @param {string} gameKey - Game key
   * @param {Object} gameData - Current game data
   * @returns {boolean} Whether to use cache
   */
  shouldUseCache(gameKey, gameData) {
    if (!this.config.enableDeduplication) return false;

    const cached = this.gameCache.get(gameKey);
    if (!cached) return false;

    // Check if cached version is recent enough
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTimeout) return false;

    // Check if game data is significantly different
    if (this.isGameDataDifferent(cached.data, gameData)) return false;

    return true;
  }

  /**
   * Check if game data is significantly different
   * @param {Object} cachedData - Cached game data
   * @param {Object} newData - New game data
   * @returns {boolean} Whether data is different
   */
  isGameDataDifferent(cachedData, newData) {
    // Check key fields that matter for save operations
    const keyFields = ['final_score', 'result', 'moves', 'date'];

    for (const field of keyFields) {
      const cached = cachedData[field];
      const current = newData[field];

      if (cached !== current) {
        // For scores, allow small differences
        if (field.includes('score')) {
          const cachedNum = parseFloat(cached) || 0;
          const currentNum = parseFloat(current) || 0;
          if (Math.abs(cachedNum - currentNum) < 0.1) continue;
        }

        console.log(`🔍 Game data changed in field '${field}': ${cached} → ${current}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Get cached game
   * @param {string} gameKey - Game key
   * @returns {Object} Cached game data
   */
  getCachedGame(gameKey) {
    return this.gameCache.get(gameKey)?.data || null;
  }

  /**
   * Cache game data
   * @param {string} gameKey - Game key
   * @param {Object} gameData - Game data to cache
   */
  cacheGame(gameKey, gameData) {
    const cacheEntry = {
      data: { ...gameData },
      timestamp: Date.now(),
      key: gameKey
    };

    this.gameCache.set(gameKey, cacheEntry);

    // Maintain cache size
    if (this.gameCache.size > this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
  }

  /**
   * Evict oldest cache entry
   */
  evictOldestCacheEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.gameCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.gameCache.delete(oldestKey);
      console.log(`🗑️ Evicted oldest cache entry: ${oldestKey}`);
    }
  }

  /**
   * Queue game for batched save
   * @param {string} gameKey - Game key
   * @param {Object} gameData - Game data to save
   */
  queueSave(gameKey, gameData) {
    // Check if already pending
    if (this.pendingSaves.has(gameKey)) {
      console.log(`⏳ Game save already pending: ${gameKey}`);
      return;
    }

    this.pendingSaves.set(gameKey, { ...gameData });
    this.saveQueue.push({ gameKey, gameData });

    // Cache immediately for UI responsiveness
    this.cacheGame(gameKey, gameData);

    // Start batch timer if not running
    if (!this.batchTimer) {
      this.startBatchTimer();
    }

    // Flush immediately if queue is full
    if (this.saveQueue.length >= this.config.batchSize) {
      this.flushSaveQueue();
    }
  }

  /**
   * Start batch timer
   */
  startBatchTimer() {
    this.batchTimer = setTimeout(() => {
      this.flushSaveQueue();
    }, this.config.batchInterval);
  }

  /**
   * Flush save queue to server
   */
  async flushSaveQueue() {
    if (this.saveQueue.length === 0) return;

    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const savesToProcess = this.saveQueue.splice(0, this.config.batchSize);
    console.log(`💾 Flushing ${savesToProcess.length} games to server`);

    try {
      await this.saveBatchToServer(savesToProcess);
      this.stats.serverSaves += savesToProcess.length;
    } catch (error) {
      console.error('❌ Failed to save batch to server:', error);

      // Re-queue failed saves
      this.saveQueue.unshift(...savesToProcess);
      this.startBatchTimer(); // Retry after delay
    }

    // Clear pending saves
    savesToProcess.forEach(({ gameKey }) => {
      this.pendingSaves.delete(gameKey);
    });
  }

  /**
   * Save batch to server
   * @param {Array} saves - Array of saves to process
   */
  async saveBatchToServer(saves) {
    // For now, save individually (can be optimized to batch endpoint)
    const savePromises = saves.map(async ({ gameKey, gameData }) => {
      try {
        // This would integrate with your existing saveGameHistory function
        if (typeof window.saveGameHistory === 'function') {
          return await window.saveGameHistory(gameData);
        } else {
          console.warn('saveGameHistory function not available');
          return null;
        }
      } catch (error) {
        console.error(`Failed to save game ${gameKey}:`, error);
        return null;
      }
    });

    await Promise.allSettled(savePromises);
  }

  /**
   * Get optimization statistics
   * @returns {Object} Statistics about optimization
   */
  getStats() {
    const cacheHitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100).toFixed(1)
      : 0;

    return {
      ...this.stats,
      cacheSize: this.gameCache.size,
      pendingSaves: this.pendingSaves.size,
      queueLength: this.saveQueue.length,
      cacheHitRate: `${cacheHitRate}%`
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.gameCache.clear();
    this.pendingSaves.clear();
    this.saveQueue = [];
    console.log('💾 Game cache cleared');
  }

  /**
   * Subscribe to save events
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify subscribers of events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  notify(event, data) {
    this.subscribers.forEach(callback => {
      try {
        callback({ event, data, timestamp: Date.now() });
      } catch (error) {
        console.error('Unified save strategy subscriber error:', error);
      }
    });
  }
}

// Global instance
const globalSaveStrategy = new UnifiedSaveStrategy();

/**
 * Save game using unified strategy
 * @param {Object} gameData - Game data to save
 * @returns {Promise<Object>} Save result
 */
export async function saveGameUnified(gameData) {
  return globalSaveStrategy.saveGame(gameData);
}

/**
 * Get unified save statistics
 * @returns {Object} Optimization statistics
 */
export function getUnifiedSaveStats() {
  return globalSaveStrategy.getStats();
}

/**
 * Clear unified save cache
 */
export function clearUnifiedSaveCache() {
  return globalSaveStrategy.clearCache();
}

export default UnifiedSaveStrategy;