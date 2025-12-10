// presenceService.js - Real-time user presence management
import { getEcho, joinChannel, leaveChannel } from './echoSingleton';
import { BASE_URL } from '../config';

class PresenceService {
  constructor() {
    this.echo = null;
    this.isConnected = false;
    this.currentUser = null;
    this.presenceChannel = null;
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Event handlers
    this.onPresenceUpdate = null;
    this.onConnectionChange = null;
    this.onUserOnline = null;
    this.onUserOffline = null;
  }

  /**
   * Initialize presence service with user authentication
   */
  async initialize(user, authToken) {
    this.currentUser = user;

    try {
      // Use singleton Echo instance
      this.echo = getEcho();
      if (!this.echo) {
        console.error('[Presence] Echo singleton not available');
        return false;
      }

      await this.connect();
      this.setupEventListeners();
      this.startHeartbeat();

      console.log('[Presence] Service initialized successfully');
      return true;
    } catch (error) {
      console.error('[Presence] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Connect to presence channels
   */
  async connect() {
    try {
      // Wait for Echo to be available (with timeout)
      let attempts = 0;
      const maxAttempts = 10;
      while (!this.echo && attempts < maxAttempts) {
        console.log(`[Presence] Waiting for Echo... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        this.echo = getEcho();
        attempts++;
      }

      if (!this.echo) {
        throw new Error('Echo not available after waiting');
      }

      console.log('[Presence] Echo available, connecting to presence channels');

      // Join the general presence channel using singleton (idempotent)
      // Note: Backend defines this as 'presence.online' in channels.php
      this.presenceChannel = joinChannel('presence.online', 'presence');
      if (!this.presenceChannel) {
        throw new Error('Failed to join presence channel');
      }

      this.presenceChannel
        .here((users) => {
          console.log('[Presence] Currently online users:', users);
          this.onUserOnline && this.onUserOnline(users);
        })
        .joining((user) => {
          console.log('[Presence] User joined:', user);
          this.onUserOnline && this.onUserOnline([user]);
        })
        .leaving((user) => {
          console.log('[Presence] User left:', user);
          this.onUserOffline && this.onUserOffline(user);
        })
        .error((error) => {
          console.error('[Presence] Channel error:', error);
          this.handleConnectionError();
        });

      // Listen for presence updates
      this.presenceChannel.listen('.presence.updated', (event) => {
        console.log('[Presence] Updated:', event);
        this.onPresenceUpdate && this.onPresenceUpdate(event);
      });

      // Subscribe to user's private channel for new game requests and other notifications
      if (this.currentUser && this.echo) {
        this.userChannel = this.echo.private(`App.Models.User.${this.currentUser.id}`);
        console.log(`[Presence] Subscribed to user channel: App.Models.User.${this.currentUser.id}`);

        // Listen for new game requests
        this.userChannel.listen('.new_game.request', (event) => {
          console.log('[Presence] New game request received:', event);
          // Store in localStorage for any active game component to pick up
          localStorage.setItem('newGameRequest', JSON.stringify(event));
          // Dispatch a custom event for any listeners
          window.dispatchEvent(new CustomEvent('newGameRequest', { detail: event }));
        });

        // Listen for draw offers
        this.userChannel.listen('.draw.offer.sent', (event) => {
          console.log('[Presence] Draw offer received:', event);
          localStorage.setItem('drawOffer', JSON.stringify(event));
          window.dispatchEvent(new CustomEvent('drawOffer', { detail: event }));
        });
      }

      // Update user presence status
      await this.updatePresence('online', this.echo?.socketId());

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChange && this.onConnectionChange(true);

    } catch (error) {
      console.error('[Presence] Connection failed:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Update user presence status
   * NOTE: Makes one-time API call to update database for stats endpoint.
   * WebSocket presence channels handle real-time presence tracking.
   */
  async updatePresence(status = 'online', socketId = null) {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      console.warn('[Presence] No auth token - cannot update presence');
      return null;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/presence/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          status: status,
          ...(typeof socketId === 'string' && socketId.length > 0 ? { socket_id: socketId } : {}),
          device_info: {
            platform: navigator.platform,
            userAgent: navigator.userAgent
          }
        })
      });

      if (!response.ok) {
        console.warn(`[Presence] Update failed with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      // console.log('[Presence] Status updated successfully:', status);
      return data;
    } catch (error) {
      console.error('[Presence] Failed to update presence:', error.message);
      return null;
    }
  }

  /**
   * Send heartbeat to maintain connection
   * NOTE: Heartbeat is now handled automatically by WebSocket presence channels.
   * Laravel Reverb automatically tracks online/offline status.
   */
  async sendHeartbeat() {
    // WebSocket presence channels handle heartbeat automatically
    // No HTTP polling needed - this saves significant server resources
    return true;
  }

  /**
   * Start heartbeat interval
   * NOTE: Disabled - WebSocket presence channels handle this automatically
   */
  startHeartbeat() {
    // Heartbeat now handled automatically by WebSocket presence channels
    // Laravel Reverb tracks user presence without HTTP polling
    console.log('[Presence] Heartbeat managed by WebSocket presence channels');
    this.heartbeatInterval = null;
  }

  /**
   * Handle connection errors and reconnection
   */
  handleConnectionError() {
    this.isConnected = false;
    this.onConnectionChange && this.onConnectionChange(false);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectDelay);

      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  /**
   * Setup event listeners for connection management
   */
  setupEventListeners() {
    // Ensure document and window are available
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      console.warn('[Presence] Document/window not available, skipping event listeners');
      return;
    }

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.updatePresence('online');
      } else {
        this.updatePresence('away');
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      console.log('[Presence] Network connection restored');
      this.connect();
    });

    window.addEventListener('offline', () => {
      console.log('[Presence] Network connection lost');
      this.isConnected = false;
      this.onConnectionChange && this.onConnectionChange(false);
    });
  }

  /**
   * Get online users
   */
  async getOnlineUsers() {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      return [];
    }

    try {
      const response = await fetch(`${BASE_URL}/api/presence/online/users`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.online_users || [];
    } catch (error) {
      console.error('[Presence] Failed to get online users:', error.message);
      return [];
    }
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats() {
    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      return { online: 0, away: 0, offline: 0 };
    }

    try {
      const response = await fetch(`${BASE_URL}/api/presence/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.stats || { online: 0, away: 0, offline: 0 };
    } catch (error) {
      console.error('[Presence] Failed to get presence stats:', error.message);
      return { online: 0, away: 0, offline: 0 };
    }
  }

  /**
   * Disconnect from presence service
   */
  disconnect() {
    try {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.presenceChannel) {
        leaveChannel('presence.online', 'presence');
        this.presenceChannel = null;
      }

      if (this.userChannel) {
        this.echo.leave(`private-App.Models.User.${this.currentUser.id}`);
        this.userChannel = null;
      }

      // Don't disconnect the singleton Echo - other services may use it
      this.echo = null;

      // Try to update presence to offline, but don't fail if it doesn't work
      if (this.currentUser && localStorage.getItem('auth_token')) {
        this.updatePresence('offline').catch(err => {
          console.warn('[Presence] Could not update to offline status:', err.message);
        });
      }

      this.isConnected = false;
      this.onConnectionChange && this.onConnectionChange(false);
      this.currentUser = null;

      console.log('[Presence] Service disconnected');
    } catch (error) {
      console.error('[Presence] Error during disconnect:', error);
    }
  }

  /**
   * Check if service is connected
   */
  isServiceConnected() {
    return this.isConnected;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers) {
    this.onPresenceUpdate = handlers.onPresenceUpdate;
    this.onConnectionChange = handlers.onConnectionChange;
    this.onUserOnline = handlers.onUserOnline;
    this.onUserOffline = handlers.onUserOffline;
  }
}

// Create and export singleton instance
const presenceService = new PresenceService();
export default presenceService;