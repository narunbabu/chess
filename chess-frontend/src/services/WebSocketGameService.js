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
    // Smart polling properties
    this._pollingBusy = false;
    this._pollTimer = null;
    this._lastETag = null;
    this.lastGameState = null;
  }

  /**
   * Initialize the WebSocket connection
   */
  async initialize(gameId, user) {
    this.gameId = gameId;
    this.user = user;

    // Check if we should use polling fallback FIRST
    const usePolling = process.env.REACT_APP_USE_POLLING_FALLBACK === 'true';
    console.log('Checking polling fallback:', {
      env_var: process.env.REACT_APP_USE_POLLING_FALLBACK,
      should_use_polling: usePolling,
      forcing_polling: false
    });

    if (usePolling) {
      console.log('✅ Using HTTP polling fallback instead of WebSocket');
      try {
        await this.initializePollingMode();
        return true;
      } catch (error) {
        console.error('Failed to initialize polling mode:', error);
        throw error;
      }
    }

    // Only continue with WebSocket if polling is not enabled
    try {
      // Get authentication token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const wsConfig = {
        key: process.env.REACT_APP_REVERB_APP_KEY || 'anrdh24nppf3obfupvqw',
        wsHost: process.env.REACT_APP_REVERB_HOST || 'localhost',
        wsPort: parseInt(process.env.REACT_APP_REVERB_PORT) || 8080,
        scheme: process.env.REACT_APP_REVERB_SCHEME || 'http'
      };

      console.log('WebSocket config:', wsConfig);
      console.log('Attempting to connect to:', `${wsConfig.scheme}://${wsConfig.wsHost}:${wsConfig.wsPort}`);

      // Initialize Laravel Echo
      this.echo = new Echo({
        broadcaster: 'reverb',
        key: wsConfig.key,
        wsHost: wsConfig.wsHost,
        wsPort: wsConfig.wsPort,
        wssPort: wsConfig.wsPort,
        forceTLS: wsConfig.scheme === 'https',
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
                const response = await fetch(`${BACKEND_URL}/broadcasting/auth`, {
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
      this.echo.connector.pusher.connection.bind('connecting', () => {
        console.log('WebSocket attempting to connect...');
      });

      this.echo.connector.pusher.connection.bind('connected', () => {
        this.socketId = this.echo.socketId();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('✅ WebSocket connected successfully:', this.socketId);
        this.emit('connected', { socketId: this.socketId });
      });

      this.echo.connector.pusher.connection.bind('disconnected', () => {
        this.isConnected = false;
        console.log('❌ WebSocket disconnected');
        this.emit('disconnected');
        this.handleReconnection();
      });

      this.echo.connector.pusher.connection.bind('failed', () => {
        console.error('❌ WebSocket connection failed');
        this.emit('error', new Error('WebSocket connection failed'));
      });

      this.echo.connector.pusher.connection.bind('error', (error) => {
        console.error('❌ WebSocket error details:', {
          error,
          type: typeof error,
          message: error?.message,
          code: error?.code,
          data: error?.data,
          connectionState: this.echo?.connector?.pusher?.connection?.state
        });
        this.emit('error', error);
      });

      // Wait for connection to be established before joining channels
      await this.waitForConnection();

      // Join the game channel if a gameId is provided
      if (this.gameId) {
        await this.joinGameChannel();
      }

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
      const channel = this.echo.private(`game.${this.gameId}`);
      this.gameChannel = channel;

      // Add detailed subscription diagnostics
      channel.subscribed(() => {
        console.log('✅ pusher:subscription_succeeded', `game.${this.gameId}`);
      }).error((e) => {
        console.error('❌ pusher:subscription_error', e);
      });

      // Also bind to the low-level Pusher events if pusher-js is used
      if (channel.pusher) {
          channel.pusher.bind('pusher:subscription_error', (status) => {
              console.error('❌ pusher:subscription_error (low-level)', status);
          });
      }

      // Listen for game events
      channel
        .listen('GameConnectionEvent', (event) => {
          console.log('Game connection event:', event);
          this.emit('gameConnection', event);
        })
        .listen('.game.move', (event) => {
          console.log('Received game.move event:', event);
          this.emit('gameMove', event);
        })
        .listen('GameStatusEvent', (event) => {
          console.log('Game status event:', event);
          this.emit('gameStatus', event);
        })
        .listen('.game.activated', (event) => {
            console.log('Game activated event received:', event);
            this.emit('gameActivated', event);
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
   * Subscribe to the user-specific channel for notifications
   */
  subscribeToUserChannel(user) {
    if (!user) {
      throw new Error('No user provided');
    }

    // In polling mode, return a mock channel object
    if (!this.echo) {
      console.log('Polling mode: Creating mock user channel for user', user.id);
      console.log('Current user stored in service:', this.user?.id);
      return this.createMockChannel(`App.Models.User.${user.id}`);
    }

    try {
      const userChannel = this.echo.private(`App.Models.User.${user.id}`);
      return userChannel;
    } catch (error) {
      console.error('Failed to subscribe to user channel:', error);
      throw error;
    }
  }

  /**
   * Wait for WebSocket connection to be established
   */
  waitForConnection(timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.socketId) {
        resolve();
        return;
      }

      const startTime = Date.now();
      const checkConnection = () => {
        if (this.isConnected && this.socketId) {
          console.log('WebSocket connection established successfully');
          resolve();
        } else if (Date.now() - startTime > timeout) {
          console.error('WebSocket connection timeout. Check if Reverb server is running on port 8080');
          console.error('Connection state:', {
            isConnected: this.isConnected,
            socketId: this.socketId,
            echoState: this.echo?.connector?.pusher?.connection?.state
          });
          reject(new Error('WebSocket connection timeout - check if Reverb server is running'));
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
        console.error('WebSocket handshake error response:', data);
        console.error('Response status:', response.status);
        console.error('Full response details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: data
        });
        throw new Error(data.error || data.message || `Server error (${response.status})`);
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
   * Update user's player color for smart polling
   */
  updatePlayerColor(playerColor) {
    if (this.user) {
      this.user.playerColor = playerColor;
      console.log('Updated user playerColor for smart polling:', playerColor);
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

  /**
   * Initialize polling mode as fallback when WebSocket is not available
   */
  async initializePollingMode() {
    console.log('Initializing HTTP polling fallback mode');
    console.log('Current gameId:', this.gameId);
    console.log('Current user:', this.user);

    // Set connection status
    this.isConnected = true;
    this.socketId = 'polling_' + Date.now();

    // In polling mode, skip complex handshake and go straight to polling
    // The room-state endpoint will handle access validation
    if (this.gameId) {
      console.log('Polling mode: Skipping handshake, will validate via room-state');
    } else {
      console.log('Skipping handshake - no gameId provided (lobby mode)');
    }

    // Start polling for game updates
    this.startPolling();

    // Emit connected event
    this.emit('connected', {
      mode: 'polling',
      socketId: this.socketId
    });
  }

  /**
   * Start smart polling for game updates
   */
  startPolling() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
    }

    console.log('Starting smart polling for gameId:', this.gameId);
    this.scheduleNextPoll();
  }

  /**
   * Schedule the next poll with dynamic delay
   */
  scheduleNextPoll() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
    }

    const isHidden = document.hidden;
    const myColor = this.user?.playerColor;
    const turn = this.lastGameState?.turn;
    const isMyTurn = myColor && turn && (
      (myColor === 'white' && turn === 'w') ||
      (myColor === 'black' && turn === 'b')
    );

    // Dynamic cadence: faster on your turn, slower otherwise
    const base = isMyTurn ? 1000 : 3000;
    const delay = isHidden ? Math.max(base, 8000) : base;

    console.log('Scheduling next poll in', delay, 'ms (isMyTurn:', isMyTurn, 'isHidden:', isHidden, ')');

    this._pollTimer = setTimeout(() => this.pollGameState(), delay);
  }

  /**
   * Poll for game state changes with smart caching
   */
  async pollGameState() {
    if (!this.gameId || this._pollingBusy) return;

    this._pollingBusy = true;

    try {
      const token = localStorage.getItem('auth_token');
      const since = this.lastGameState?.move_count ?? (this.lastGameState?.moves?.length ?? -1);

      const url = `${process.env.REACT_APP_BACKEND_URL}/websocket/room-state?game_id=${this.gameId}&compact=1&since_move=${since}`;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Add ETag header if we have one
      if (this._lastETag) {
        headers['If-None-Match'] = this._lastETag;
      }

      const response = await fetch(url, { headers });

      // Handle 304 Not Modified
      if (response.status === 304) {
        console.log('No changes detected (304)');
        return;
      }

      if (response.ok) {
        // Store new ETag
        const etag = response.headers.get('ETag');
        if (etag) {
          this._lastETag = etag;
        }

        const data = await response.json();

        if (data.success) {
          if (data.no_change) {
            console.log('No changes detected (no_change flag)');
            return;
          }

          if (data.data) {
            this.handlePolledCompactState(data.data);
          }
        }
      } else {
        console.error('Failed to poll game state:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error polling game state:', error);
    } finally {
      this._pollingBusy = false;
      this.scheduleNextPoll();
    }
  }

  /**
   * Handle compact polled game state data
   */
  handlePolledCompactState(compactData) {
    // Check if this is a game completion response
    if (compactData.game_over) {
      console.log('🏁 Game ended detected:', compactData);

      this.emit('gameEnded', {
        game_over: true,
        result: compactData.result,
        end_reason: compactData.end_reason,
        winner_user_id: compactData.winner_user_id,
        winner_player: compactData.winner_player,
        fen_final: compactData.fen_final,
        move_count: compactData.move_count,
        ended_at: compactData.ended_at,
        white_player: compactData.white_player,
        black_player: compactData.black_player
      });

      // Stop polling since game is finished
      this.stopPolling();
      return;
    }

    const { fen, turn, move_count, last_move, last_move_by, user_role } = compactData;

    // Initialize state tracking if needed
    if (!this.lastGameState) {
      this.lastGameState = { move_count: 0 };
    }

    const prevMoveCount = this.lastGameState.move_count ?? 0;

    // Emit only on new move
    if (move_count > prevMoveCount && last_move) {
      console.log('New move detected:', last_move);

      this.emit('gameMove', {
        move: last_move,
        fen,
        turn,
        user_id: last_move_by ?? null
      });
    }

    // Keep a slim cached state for next comparison
    this.lastGameState = { fen, turn, move_count, user_role };
  }

  /**
   * Handle polled game state data (legacy full state method)
   */
  handlePolledGameState(gameState) {
    const gameData = gameState.game;

    // Store current state for comparison
    if (!this.lastGameState) {
      this.lastGameState = gameData;
      return;
    }

    // Check for new moves
    const lastMoveCount = this.lastGameState.moves?.length || 0;
    const currentMoveCount = gameData.moves?.length || 0;

    if (currentMoveCount > lastMoveCount) {
      // New move detected
      const latestMove = gameData.moves[currentMoveCount - 1];
      console.log('New move detected:', latestMove);

      // Emit gameMove event
      this.emit('gameMove', {
        move: latestMove,
        fen: gameData.fen,
        turn: gameData.turn,
        user_id: latestMove.user_id || null
      });
    }

    // Check for status changes
    if (this.lastGameState.status !== gameData.status) {
      console.log('Game status changed:', this.lastGameState.status, '->', gameData.status);

      // Emit gameStatus event
      this.emit('gameStatus', {
        status: gameData.status,
        result: gameData.result || null,
        reason: gameData.reason || null
      });
    }

    // Update stored state
    this.lastGameState = gameData;
  }

  /**
   * Create a mock channel object for polling mode
   */
  createMockChannel(channelName) {
    console.log('Creating mock channel:', channelName);
    console.log('Mock channel creation - current user in service:', this.user);
    const mockChannel = {
      eventListeners: {},
      channelName: channelName,
      listen: (eventName, callback) => {
        console.log(`Mock channel: Listening for ${eventName} on ${channelName}`);
        console.log('Current user in service when setting up listener:', this.user?.id);

        // Store the callback for later use
        if (!mockChannel.eventListeners[eventName]) {
          mockChannel.eventListeners[eventName] = [];
        }
        mockChannel.eventListeners[eventName].push(callback);

        // Start polling for specific events
        if (eventName === '.invitation.accepted') {
          console.log('About to start invitation polling...');
          this.startInvitationPolling(callback);
        }

        return mockChannel;
      },
      stopListening: (eventName) => {
        console.log(`Mock channel: Stopped listening for ${eventName} on ${channelName}`);
        if (mockChannel.eventListeners[eventName]) {
          delete mockChannel.eventListeners[eventName];
        }

        // Stop polling for specific events
        if (eventName === '.invitation.accepted') {
          this.stopInvitationPolling();
        }

        return mockChannel;
      },
      whisper: (eventName, data) => {
        console.log(`Mock channel: Would whisper ${eventName} on ${channelName}:`, data);
        return mockChannel;
      },
      // Method to trigger events (for polling simulation)
      triggerEvent: (eventName, data) => {
        if (mockChannel.eventListeners[eventName]) {
          mockChannel.eventListeners[eventName].forEach(callback => {
            callback(data);
          });
        }
      }
    };

    return mockChannel;
  }

  /**
   * Start polling for invitation status changes
   */
  startInvitationPolling(callback) {
    if (this.invitationPollingInterval) {
      clearInterval(this.invitationPollingInterval);
    }

    console.log('Starting invitation polling for user', this.user?.id);

    if (!this.user) {
      console.error('Cannot start invitation polling: no user set in service');
      return;
    }

    // Poll every 3 seconds for invitation updates
    this.invitationPollingInterval = setInterval(async () => {
      try {
        await this.pollInvitationStatus(callback);
      } catch (error) {
        console.error('Invitation polling error:', error);
      }
    }, 3000);
  }

  /**
   * Stop polling for invitation status changes
   */
  stopInvitationPolling() {
    if (this.invitationPollingInterval) {
      clearInterval(this.invitationPollingInterval);
      this.invitationPollingInterval = null;
      console.log('Stopped invitation polling');
    }
  }

  /**
   * Poll for invitation status changes
   */
  async pollInvitationStatus(callback) {
    if (!this.user) return;

    const token = localStorage.getItem('auth_token');

    try {
      // Check for accepted invitations by looking at sent invitations
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/invitations/sent`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const sentInvitations = await response.json();

        // Look for any accepted invitations that we haven't processed yet
        const acceptedInvitations = sentInvitations.filter(invitation =>
          invitation.status === 'accepted' && !this.processedInvitations?.has(invitation.id)
        );

        if (acceptedInvitations.length > 0) {
          // Initialize processed invitations set if it doesn't exist
          if (!this.processedInvitations) {
            this.processedInvitations = new Set();
          }

          // Process each accepted invitation
          acceptedInvitations.forEach(invitation => {
            console.log('Found accepted invitation:', invitation);

            // Mark as processed to avoid duplicate handling
            this.processedInvitations.add(invitation.id);

            // Trigger the callback with the accepted invitation data
            callback({
              game: {
                id: invitation.game_id || invitation.id // Use game_id if available, fallback to invitation id
              },
              invitation: invitation
            });
          });
        }
      }
    } catch (error) {
      console.error('Error polling invitation status:', error);
    }
  }

  /**
   * Stop polling timer
   */
  stopPolling() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
      console.log('🔄 Stopped game state polling');
    }
  }

  /**
   * Send resign request
   */
  async resignGame() {
    if (!this.gameId || !this.user) {
      throw new Error('Game ID or user not set');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/resign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resign game');
      }

      console.log('✅ Game resigned successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to resign game:', error);
      throw error;
    }
  }

  /**
   * Override disconnect to stop polling
   */
  disconnect() {
    // Clear smart polling timer
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }

    // Clear legacy polling interval (fallback)
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.invitationPollingInterval) {
      clearInterval(this.invitationPollingInterval);
      this.invitationPollingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Reset smart polling state
    this._pollingBusy = false;
    this._lastETag = null;

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
    this.emit('disconnected');
  }
}

export default WebSocketGameService;
