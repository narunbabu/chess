// userStatusService.js - Database-backed user online status tracking
import api from './api';
import { logger } from '../utils/logger';

/**
 * UserStatusService
 *
 * Provides reliable, database-backed online/offline status tracking.
 * Features:
 * - Automatic heartbeat with exponential backoff
 * - Batch status checking for efficiency
 * - Local caching with TTL
 * - Graceful degradation on errors
 * - No WebSocket dependency
 */
class UserStatusService {
  constructor() {
    // Prevent direct instantiation - use getInstance() instead
    if (UserStatusService.instance) {
      return UserStatusService.instance;
    }

    this.heartbeatInterval = null;
    this.heartbeatIntervalMs = 60000; // 1 minute default
    this.statusCache = new Map();
    this.cacheTTL = 30000; // 30 seconds
    this.isActive = false;
    this.consecutiveFailures = 0;
    this.maxFailures = 3;
    this.backoffMultiplier = 1.5;
    this.maxBackoffMs = 300000; // 5 minutes
    this.eventHandlers = {
      onStatusChange: null,
      onHeartbeatFail: null,
      onConnectionRestore: null
    };

    // Bind methods
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    // Store the instance
    UserStatusService.instance = this;

    // Initialization tracking
    this.initializing = false;
    this.initializingPromise = null;
  }

  static getInstance() {
    if (!UserStatusService.instance) {
      UserStatusService.instance = new UserStatusService();
    }
    return UserStatusService.instance;
  }

  /**
   * Initialize the service and start heartbeat
   */
  async initialize() {
    logger.info('UserStatus', 'Initializing status service');

    if (this.isActive) {
      console.log('⚠️ [UserStatus] Service already active, skipping initialization');
      return true;
    }

    // Prevent concurrent initialization attempts
    if (this.initializing) {
      console.log('⏳ [UserStatus] Initialization already in progress, waiting...');
      return this.initializingPromise;
    }

    this.initializing = true;
    this.initializingPromise = this._doInitialize();

    try {
      await this.initializingPromise;
      return true;
    } catch (error) {
      this.initializing = false;
      this.initializingPromise = null;
      throw error;
    }
  }

  async _doInitialize() {
    try {
      // Send initial heartbeat
      console.log('📡 [UserStatus] Sending initial heartbeat...');
      const result = await this.sendHeartbeat();
      console.log('📡 [UserStatus] Initial heartbeat result:', result);

      // Start periodic heartbeat
      console.log('⏰ [UserStatus] Starting periodic heartbeat...');
      this.startHeartbeat();

      // Listen for visibility changes to pause/resume heartbeat
      document.addEventListener('visibilitychange', this.handleVisibilityChange);

      // Listen for beforeunload to mark user as going offline
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

      this.isActive = true;
      this.initializing = false;
      this.initializingPromise = null;

      // Store global reference for cleanup
      window.userStatusService = this;

      console.log('✅ [UserStatus] Service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ [UserStatus] Initialization failed:', error);
      console.error('❌ [UserStatus] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      this.initializing = false;
      this.initializingPromise = null;
      return false;
    }
  }

  /**
   * Start sending periodic heartbeats
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log(`⏰ [UserStatus] Starting heartbeat (interval: ${this.heartbeatIntervalMs}ms)`);

    this.heartbeatInterval = setInterval(
      this.sendHeartbeat,
      this.heartbeatIntervalMs
    );
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('⏸️ [UserStatus] Heartbeat stopped');
    }
  }

  /**
   * Send heartbeat to update last_activity_at
   */
  async sendHeartbeat() {
    try {
      const response = await api.post('/status/heartbeat');

      if (response.data.success) {
        // Reset failure counter on success
        if (this.consecutiveFailures > 0) {
          console.log('✅ [UserStatus] Connection restored');
          this.consecutiveFailures = 0;
          this.heartbeatIntervalMs = 60000; // Reset to 1 minute
          this.startHeartbeat(); // Restart with normal interval

          if (this.eventHandlers.onConnectionRestore) {
            this.eventHandlers.onConnectionRestore();
          }
        }

                return true;
      }

    } catch (error) {
      this.consecutiveFailures++;
      console.error(`❌ [UserStatus] Heartbeat failed (${this.consecutiveFailures}/${this.maxFailures}):`, error.message);

      // Apply exponential backoff
      if (this.consecutiveFailures >= this.maxFailures) {
        this.heartbeatIntervalMs = Math.min(
          this.heartbeatIntervalMs * this.backoffMultiplier,
          this.maxBackoffMs
        );
        console.log(`⏰ [UserStatus] Applying backoff, new interval: ${this.heartbeatIntervalMs}ms`);
        this.startHeartbeat(); // Restart with new interval
      }

      if (this.eventHandlers.onHeartbeatFail) {
        this.eventHandlers.onHeartbeatFail(error);
      }

      return false;
    }
  }

  /**
   * Check if a specific user is online
   * @param {number} userId - User ID to check
   * @returns {Promise<boolean>}
   */
  async isUserOnline(userId) {
    if (!userId) {
      console.warn('⚠️ [UserStatus] No userId provided');
      return false;
    }

    // Check cache first
    const cached = this.getCachedStatus(userId);
    if (cached !== null) {
            return cached;
    }

    try {
      const response = await api.get(`/status/check/${userId}`);

      if (response.data.success) {
        const isOnline = response.data.data.is_online;

        // Cache the result
        this.cacheStatus(userId, isOnline);

                return isOnline;
      }

      return false;

    } catch (error) {
      console.error(`❌ [UserStatus] Failed to check status for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Check online status for multiple users in one request
   * @param {number[]} userIds - Array of user IDs
   * @returns {Promise<Map<number, boolean>>}
   */
  async batchCheckStatus(userIds) {
    if (!userIds || userIds.length === 0) {
      return new Map();
    }

    // Filter out cached statuses
    const uncachedIds = userIds.filter(id => this.getCachedStatus(id) === null);
    const statusMap = new Map();

    // Add cached statuses to result
    userIds.forEach(id => {
      const cached = this.getCachedStatus(id);
      if (cached !== null) {
        statusMap.set(id, cached);
      }
    });

    // Fetch uncached statuses
    if (uncachedIds.length > 0) {
      try {
        const response = await api.post('/status/batch-check', {
          user_ids: uncachedIds
        });

        if (response.data.success) {
          response.data.data.statuses.forEach(status => {
            const isOnline = status.is_online;
            statusMap.set(status.user_id, isOnline);

            // Cache the result
            this.cacheStatus(status.user_id, isOnline);
          });

          console.log(`🔍 [UserStatus] Batch check: ${response.data.data.online_count}/${response.data.data.total_count} users online`);
        }

      } catch (error) {
        console.error('❌ [UserStatus] Batch check failed:', error.message);
      }
    }

    return statusMap;
  }

  /**
   * Get all currently online users
   * @returns {Promise<Array>}
   */
  async getOnlineUsers() {
    try {
      const response = await api.get('/status/online-users');

      if (response.data.success) {
        logger.debug('UserStatus', `${response.data.data.count} users online`);
        return response.data.data.users;
      }

      return [];

    } catch (error) {
      console.error('❌ [UserStatus] Failed to get online users:', error.message);
      return [];
    }
  }

  /**
   * Cache a user's online status
   */
  cacheStatus(userId, isOnline) {
    this.statusCache.set(userId, {
      status: isOnline,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached status if still valid
   */
  getCachedStatus(userId) {
    const cached = this.statusCache.get(userId);

    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL) {
      this.statusCache.delete(userId);
      return null;
    }

    return cached.status;
  }

  /**
   * Clear cached status for a user
   */
  clearCache(userId = null) {
    if (userId) {
      this.statusCache.delete(userId);
    } else {
      this.statusCache.clear();
    }
  }

  /**
   * Handle browser visibility changes
   */
  handleVisibilityChange() {
    if (document.hidden) {
      console.log('👋 [UserStatus] Page hidden, pausing heartbeat');
      this.stopHeartbeat();
    } else {
      console.log('👀 [UserStatus] Page visible, resuming heartbeat');
      this.sendHeartbeat(); // Send immediate heartbeat
      this.startHeartbeat();
    }
  }

  /**
   * Handle before unload (user closing tab/window)
   */
  handleBeforeUnload() {
    // Note: We rely on the server-side timeout to mark user as offline
    // Cannot make reliable async calls in beforeunload
    console.log('👋 [UserStatus] Page unloading');
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Cleanup and stop the service
   */
  destroy() {
    console.log('🛑 [UserStatus] Destroying service');

    this.stopHeartbeat();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    this.statusCache.clear();
    this.isActive = false;
  }
}

// Export singleton instance
const userStatusService = new UserStatusService();
export default userStatusService;
