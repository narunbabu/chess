// presenceService.js - Real-time user presence management
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { API_BASE_URL } from '../config';

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
      // Initialize Laravel Echo with Reverb
      this.echo = new Echo({
        broadcaster: 'reverb',
        key: process.env.REACT_APP_REVERB_APP_KEY || 'app-key',
        wsHost: process.env.REACT_APP_REVERB_HOST || '127.0.0.1',
        wsPort: process.env.REACT_APP_REVERB_PORT || 8080,
        wssPort: process.env.REACT_APP_REVERB_PORT || 8080,
        forceTLS: process.env.REACT_APP_REVERB_FORCE_TLS || false,
        enabledTransports: ['ws', 'wss'],
        auth: {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/json',
          },
        },
      });

      await this.connect();
      this.setupEventListeners();
      this.startHeartbeat();

      console.log('Presence service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize presence service:', error);
      return false;
    }
  }

  /**
   * Connect to presence channels
   */
  async connect() {
    try {
      // Join the general presence channel
      this.presenceChannel = this.echo.join('presence')
        .here((users) => {
          console.log('Currently online users:', users);
          this.onUserOnline && this.onUserOnline(users);
        })
        .joining((user) => {
          console.log('User joined:', user);
          this.onUserOnline && this.onUserOnline([user]);
        })
        .leaving((user) => {
          console.log('User left:', user);
          this.onUserOffline && this.onUserOffline(user);
        })
        .error((error) => {
          console.error('Presence channel error:', error);
          this.handleConnectionError();
        });

      // Listen for presence updates
      this.echo.channel('presence')
        .listen('.presence.updated', (event) => {
          console.log('Presence updated:', event);
          this.onPresenceUpdate && this.onPresenceUpdate(event);
        });

      // Update user presence status
      await this.updatePresence('online', this.echo.socketId());

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChange && this.onConnectionChange(true);

    } catch (error) {
      console.error('Connection failed:', error);
      this.handleConnectionError();
    }
  }

  /**
   * Update user presence status
   */
  async updatePresence(status = 'online', socketId = null) {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: {
          width: screen.width,
          height: screen.height
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/presence/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          status,
          socket_id: socketId,
          device_info: deviceInfo
        })
      });

      const data = await response.json();
      console.log('Presence updated:', data);
      return data;
    } catch (error) {
      console.error('Failed to update presence:', error);
      throw error;
    }
  }

  /**
   * Send heartbeat to maintain connection
   */
  async sendHeartbeat() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });

      const data = await response.json();
      return data.status === 'heartbeat_received';
    } catch (error) {
      console.error('Heartbeat failed:', error);
      return false;
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (this.isConnected) {
        const success = await this.sendHeartbeat();
        if (!success) {
          this.handleConnectionError();
        }
      }
    }, 30000); // Every 30 seconds
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
      console.log('Network connection restored');
      this.connect();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this.isConnected = false;
      this.onConnectionChange && this.onConnectionChange(false);
    });
  }

  /**
   * Get online users
   */
  async getOnlineUsers() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/presence/online/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });

      const data = await response.json();
      return data.online_users || [];
    } catch (error) {
      console.error('Failed to get online users:', error);
      return [];
    }
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/presence/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });

      const data = await response.json();
      return data.stats || {};
    } catch (error) {
      console.error('Failed to get presence stats:', error);
      return {};
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
        this.echo.leave('presence');
        this.presenceChannel = null;
      }

      if (this.echo) {
        this.echo.disconnect();
        this.echo = null;
      }

      this.updatePresence('offline');
      this.isConnected = false;
      this.onConnectionChange && this.onConnectionChange(false);

      console.log('Presence service disconnected');
    } catch (error) {
      console.error('Error during disconnect:', error);
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

// Export singleton instance
export default new PresenceService();