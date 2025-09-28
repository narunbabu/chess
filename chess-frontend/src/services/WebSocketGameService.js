import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BACKEND_URL } from '../config';

// Make Pusher available globally for Laravel Echo
window.Pusher = Pusher;

class WebSocketGameService {
  constructor() {
    this.echo = null;
    this.gameChannel = null;
    this.isConnected = false;
    this.socketId = null;
    this.gameId = null;
    this.user = null;
    this.listeners = {};
    this.reconnectTimeout = null;
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = 0;
  }

  /**
   * Initialize the WebSocket connection
   */
  async initialize(gameId, user) {
    this.gameId = gameId;
    this.user = user;

    try {
      // Get authentication token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('WebSocket config:', {
        key: process.env.REACT_APP_REVERB_APP_KEY,
        wsHost: process.env.REACT_APP_REVERB_HOST,
        wsPort: process.env.REACT_APP_REVERB_PORT,
        scheme: process.env.REACT_APP_REVERB_SCHEME
      });

      // Initialize Laravel Echo
      this.echo = new Echo({
        broadcaster: 'reverb',
        key: process.env.REACT_APP_REVERB_APP_KEY || 'anrdh24nppf3obfupvqw',
        wsHost: process.env.REACT_APP_REVERB_HOST || 'localhost',
        wsPort: process.env.REACT_APP_REVERB_PORT || 8080,
        wssPort: process.env.REACT_APP_REVERB_PORT || 8080,
        forceTLS: process.env.REACT_APP_REVERB_SCHEME === 'https',
        enabledTransports: ['ws', 'wss'],
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        // Authorize channel access
        authorizer: (channel, options) => {
          return {
            authorize: async (socketId, callback) => {
              try {
                const response = await fetch(`${BACKEND_URL}/websocket/authenticate`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    socket_id: socketId,
                    channel_name: channel.name,
                  }),
                });

                const data = await response.json();
                if (response.ok) {
                  callback(null, data);
                } else {
                  callback(new Error(data.error || 'Authentication failed'), null);
                }
              } catch (error) {
                callback(error, null);
              }
            },
          };
        },
      });

      // Handle connection events
      this.echo.connector.pusher.connection.bind('connected', () => {
        this.socketId = this.echo.socketId();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('WebSocket connected:', this.socketId);
        this.emit('connected', { socketId: this.socketId });
      });

      this.echo.connector.pusher.connection.bind('disconnected', () => {
        this.isConnected = false;
        console.log('WebSocket disconnected');
        this.emit('disconnected');
        this.handleReconnection();
      });

      this.echo.connector.pusher.connection.bind('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

      // Join the game channel
      await this.joinGameChannel();

      return true;
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      throw error;
    }
  }

  /**
   * Join the game-specific channel
   */
  async joinGameChannel() {
    if (!this.echo || !this.gameId) {
      throw new Error('WebSocket not initialized or no game ID');
    }

    try {
      // Join the private game channel
      this.gameChannel = this.echo.private(`game.${this.gameId}`);

      // Listen for game events
      this.gameChannel
        .listen('GameConnectionEvent', (event) => {
          console.log('Game connection event:', event);
          this.emit('gameConnection', event);
        })
        .listen('GameMoveEvent', (event) => {
          console.log('Game move event:', event);
          this.emit('gameMove', event);
        })
        .listen('GameStatusEvent', (event) => {
          console.log('Game status event:', event);
          this.emit('gameStatus', event);
        });

      // Wait for connection
      await this.waitForConnection();

      // Complete handshake with backend
      await this.completeHandshake();

      console.log('Successfully joined game channel:', this.gameId);
    } catch (error) {
      console.error('Failed to join game channel:', error);
      throw error;
    }
  }

  /**
   * Wait for WebSocket connection to be established
   */
  waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.socketId) {
        resolve();
        return;
      }

      const startTime = Date.now();
      const checkConnection = () => {
        if (this.isConnected && this.socketId) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('WebSocket connection timeout'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Complete handshake with backend
   */
  async completeHandshake() {
    if (!this.socketId) {
      throw new Error('No socket ID available for handshake');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/handshake`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_id: this.gameId,
          socket_id: this.socketId,
          client_info: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Handshake failed');
      }

      console.log('Handshake completed:', data);
      this.emit('handshakeComplete', data);
      return data;
    } catch (error) {
      console.error('Handshake failed:', error);
      throw error;
    }
  }

  /**
   * Send a move through WebSocket
   */
  async sendMove(move, fen, turn) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          move,
          fen,
          turn,
          socket_id: this.socketId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Move failed');
      }

      return data;
    } catch (error) {
      console.error('Failed to send move:', error);
      throw error;
    }
  }

  /**
   * Update game status
   */
  async updateGameStatus(status, result = null, reason = null) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          result,
          reason,
          socket_id: this.socketId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Status update failed');
      }

      return data;
    } catch (error) {
      console.error('Failed to update game status:', error);
      throw error;
    }
  }

  /**
   * Request game resume
   */
  async resumeGame(acceptResume = true) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.socketId,
          accept_resume: acceptResume,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Resume failed');
      }

      return data;
    } catch (error) {
      console.error('Failed to resume game:', error);
      throw error;
    }
  }

  /**
   * Create new game/rematch
   */
  async createNewGame(isRematch = false) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/new-game`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.socketId,
          is_rematch: isRematch,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'New game creation failed');
      }

      return data;
    } catch (error) {
      console.error('Failed to create new game:', error);
      throw error;
    }
  }

  /**
   * Send heartbeat to maintain connection
   */
  async sendHeartbeat() {
    if (!this.isConnected || !this.socketId) {
      return false;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/heartbeat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_id: this.gameId,
          socket_id: this.socketId,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Heartbeat failed:', error);
      return false;
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.initialize(this.gameId, this.user);
        console.log('Reconnection successful');
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.handleReconnection();
      }
    }, delay);
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.gameChannel) {
      this.gameChannel.stopListening('GameConnectionEvent');
      this.gameChannel.stopListening('GameMoveEvent');
      this.gameChannel.stopListening('GameStatusEvent');
    }

    if (this.echo) {
      this.echo.disconnect();
    }

    this.isConnected = false;
    this.socketId = null;
    this.gameChannel = null;
    this.listeners = {};

    console.log('WebSocket disconnected and cleaned up');
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socketId,
      gameId: this.gameId,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export default WebSocketGameService;