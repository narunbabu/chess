import { getEcho, joinChannel, leaveChannel } from './echoSingleton';
import { BACKEND_URL } from '../config';
import { optimizeMovePayload, decodeMovePayload, getPayloadOptimizationStats } from '../utils/websocketPayloadOptimizer';
import { performanceMonitor } from '../utils/performanceMonitor';

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
    this.stopReconnecting = false; // Stop retries when game not joinable
    // Smart polling properties
    this._pollingBusy = false;
    this._pollTimer = null;
    this._lastETag = null;
    this.lastGameState = null;
    this.isPausing = false; // Prevent duplicate pause attempts

    // Payload optimization settings
    this.optimizationEnabled = false;
    this.optimizationStats = {
      originalSize: 0,
      optimizedSize: 0,
      totalMoves: 0,
      totalSavings: 0
    };
  }

  /**
   * Get socket ID as string or undefined (for safe Laravel validation)
   * @returns {string|undefined} Socket ID string or undefined if not available
   */
  getSocketId() {
    const id = this.socketId || this.echo?.socketId();
    // Only return if it's a valid non-empty string
    return (typeof id === 'string' && id.length > 0) ? id : undefined;
  }

  /**
   * Enable/disable payload optimization
   * @param {boolean} enabled - Whether to enable optimization
   */
  enableOptimization(enabled) {
    this.optimizationEnabled = enabled;
    console.log(`🚀 WebSocket payload optimization ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Get optimization statistics
   * @returns {Object} Current optimization stats
   */
  getOptimizationStats() {
    return { ...this.optimizationStats };
  }

  /**
   * Reset optimization statistics
   */
  resetOptimizationStats() {
    this.optimizationStats = {
      originalSize: 0,
      optimizedSize: 0,
      totalMoves: 0,
      totalSavings: 0
    };
  }

  /**
   * Build request body with optional socket_id
   * @param {Object} data - Request data
   * @returns {Object} Request body with socket_id only if valid
   */
  buildRequestBody(data) {
    const socketId = this.getSocketId();
    // Only include socket_id if it's a valid string
    return socketId ? { ...data, socket_id: socketId } : data;
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

      // Use singleton Echo instance
      this.echo = getEcho();
      if (!this.echo) {
        console.warn('[WS] Echo singleton not ready yet - continuing HTTP-only mode');
        this.isConnected = false;
        // Don't throw - allow graceful fallback to polling
        // The lobby polling will use 5s interval since WS is not connected
        return false;
      }
      console.log('[WS] Using Echo singleton');

      // Handle connection events with safety checks
      const echoRef = this.echo; // Capture reference in closure

      this.echo.connector.pusher.connection.bind('connecting', () => {
        console.log('[WS] Attempting to connect...');
      });

      this.echo.connector.pusher.connection.bind('connected', () => {
        // Safety check: ensure echo instance still exists
        if (echoRef && typeof echoRef.socketId === 'function') {
          this.socketId = echoRef.socketId();
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('[WS] ✅ Connected successfully. Socket ID:', this.socketId);
          this.emit('connected', { socketId: this.socketId });
        } else {
          console.warn('[WS] Connected but Echo instance unavailable');
        }
      });

      this.echo.connector.pusher.connection.bind('disconnected', () => {
        this.isConnected = false;
        console.log('[WS] ❌ Disconnected');
        this.emit('disconnected');
        this.handleReconnection();
      });

      this.echo.connector.pusher.connection.bind('failed', () => {
        console.error('[WS] ❌ Connection failed');
        this.emit('error', new Error('WebSocket connection failed'));
      });

      this.echo.connector.pusher.connection.bind('error', (error) => {
        console.error('[WS] ❌ Error:', {
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
      // Join the private game channel using singleton (idempotent)
      const channel = joinChannel(`game.${this.gameId}`, 'private');
      if (!channel) {
        throw new Error('Failed to join game channel');
      }
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
        })
        .listen('.game.resumed', (event) => {
            console.log('Game resumed event received:', event);
            this.emit('gameResumed', event);
        })
        .listen('.game.paused', (event) => {
            console.log('Game paused event received:', event);
            this.emit('gamePaused', event);
        })
        .listen('.opponent.pinged', (event) => {
            console.log('Opponent pinged event received:', event);
            this.emit('opponentPinged', event);
        })
        .listen('GameEndedEvent', (e) => {
           console.log('GameEndedEvent (class) received', e);
           this.emit('gameEnded', e);
        })
        .listen('.game.ended', (event) => {
            console.log('Game ended event received:', event);
            this.emit('gameEnded', event);
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

    // Try to get Echo from singleton first, then fall back to instance echo
    const echo = getEcho() || this.echo;

    // In polling mode, return a mock channel object
    if (!echo) {
      console.log('[WS] No Echo available, creating mock user channel for user', user.id);
      console.log('[WS] Current user stored in service:', this.user?.id);
      return this.createMockChannel(`App.Models.User.${user.id}`);
    }

    try {
      console.log(`[WS] Subscribing to real user channel: App.Models.User.${user.id}`);
      const userChannel = echo.private(`App.Models.User.${user.id}`);
      console.log('[WS] ✅ Real user channel created successfully');
      return userChannel;
    } catch (error) {
      console.error('[WS] Failed to subscribe to user channel:', error);
      throw error;
    }
  }

  /**
   * Wait for WebSocket connection to be established
   */
  waitForConnection(timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if Echo is already connected (singleton might be reused)
      const currentState = this.echo?.connector?.pusher?.connection?.state;
      if (currentState === 'connected') {
        this.isConnected = true;
        this.socketId = this.echo.socketId();
        console.log('[WS] Echo already connected, reusing connection. Socket ID:', this.socketId);
        resolve();
        return;
      }

      if (this.isConnected && this.socketId) {
        resolve();
        return;
      }

      const startTime = Date.now();
      const checkConnection = () => {
        const state = this.echo?.connector?.pusher?.connection?.state;

        // Check actual Pusher connection state
        if (state === 'connected') {
          this.isConnected = true;
          this.socketId = this.echo.socketId();
          console.log('[WS] Connection established successfully. Socket ID:', this.socketId);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          console.error('[WS] Connection timeout after', timeout, 'ms');
          console.error('[WS] Connection state:', {
            isConnected: this.isConnected,
            socketId: this.socketId,
            pusherState: state
          });
          // Don't reject - allow graceful fallback to polling
          console.warn('[WS] Falling back to HTTP polling');
          this.isConnected = false;
          resolve(); // Resolve instead of reject to allow polling fallback
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
        body: JSON.stringify(this.buildRequestBody({
          game_id: this.gameId,
          client_info: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        })),
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

        // Stop retrying if game is not joinable (400 error)
        const msg = data.message || '';
        if (response.status === 400 && msg.toLowerCase().includes('not in a joinable state')) {
          console.warn('[WS] Handshake rejected: game not joinable. Disabling retries.');
          this.stopReconnecting = true;
          return; // Don't throw - prevents retry loop
        }

        throw new Error(data.error || data.message || `Server error (${response.status})`);
      }

      console.log('Handshake completed:', data);

      // Store player color from server for authoritative reference
      if (data.player_color) {
        this.playerColor = data.player_color;
        console.log('Server assigned player color:', data.player_color);
      }

      this.emit('handshakeComplete', data);
      return data;
    } catch (error) {
      console.error('Handshake failed:', error);
      throw error;
    }
  }

  /**
   * Check if WebSocket is currently connected
   */
  isWebSocketConnected() {
    // Check both the instance flag and actual Pusher state
    const pusherState = this.echo?.connector?.pusher?.connection?.state;
    return this.isConnected && pusherState === 'connected';
  }

  
  /**
   * Send a move through WebSocket
   */
  async sendMove(moveData) {
    if (!this.isWebSocketConnected()) {
      throw new Error('WebSocket not connected');
    }

    // Prepare payload outside try block for error logging access
    let payload = this.buildRequestBody({ move: moveData });
    let optimizedMoveData = moveData;

    try {
      // Apply payload optimization if enabled
      if (this.optimizationEnabled) {
        try {
          console.log('🔧 Optimizing move data:', moveData);
          optimizedMoveData = optimizeMovePayload(moveData);
          console.log('✅ Move optimization successful:', optimizedMoveData);

          // Update optimization statistics
          const originalSize = new Blob([JSON.stringify(moveData)]).size;
          const optimizedSize = new Blob([JSON.stringify(optimizedMoveData)]).size;

          this.optimizationStats.originalSize += originalSize;
          this.optimizationStats.optimizedSize += optimizedSize;
          this.optimizationStats.totalMoves += 1;
          this.optimizationStats.totalSavings += (originalSize - optimizedSize);

          // Track compression performance
          performanceMonitor.trackCompression(originalSize, optimizedSize);

          console.log(`🚀 WebSocket move optimized: ${moveData.san}`);
          console.log(`📊 Size reduction: ${originalSize} → ${optimizedSize} bytes (${((originalSize - optimizedSize) / originalSize * 100).toFixed(1)}% reduction)`);
        } catch (optimizationError) {
          console.error('❌ Move optimization failed, using original data:', optimizationError);
          console.error('Move data that failed to optimize:', moveData);

          // Fallback to original move data if optimization fails
          optimizedMoveData = moveData;

          // Auto-disable optimization if it keeps failing
          this.optimizationStats.failureCount = (this.optimizationStats.failureCount || 0) + 1;
          if (this.optimizationStats.failureCount >= 3) {
            console.warn('⚠️ Multiple optimization failures, auto-disabling WebSocket optimization');
            this.optimizationEnabled = false;
            this.optimizationStats.autoDisabled = true;
          }
        }
      }

      const token = localStorage.getItem('auth_token');

      // Track WebSocket message performance
      payload = this.buildRequestBody({
        move: optimizedMoveData,
      });

      // Track compression if optimization is enabled
      if (this.optimizationEnabled) {
        const originalPayload = this.buildRequestBody({ move: moveData });
        const originalSize = new Blob([JSON.stringify(originalPayload)]).size;
        const optimizedSize = new Blob([JSON.stringify(payload)]).size;
        performanceMonitor.trackCompression(originalSize, optimizedSize);
      }

      performanceMonitor.trackWebSocketMessage('sent', payload, this.optimizationEnabled);

      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          // Add optimization flag to request headers
          ...(this.optimizationEnabled && { 'X-Game-Optimized': 'true' })
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('❌ WebSocket Move Failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details || data.message || 'No additional details',
          payload: payload
        });
        throw new Error(data.error || `Server error (${response.status})`);
      }

      console.log('✅ WebSocket move sent successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to send move:', error);
      console.error('📤 Payload that failed:', JSON.stringify(payload, null, 2));
      console.error('🔧 Optimization enabled:', this.optimizationEnabled);
      throw error;
    }
  }

  /**
   * Update game status
   */
  async updateGameStatus(status, result = null, reason = null) {
    if (!this.isWebSocketConnected()) {
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
        body: JSON.stringify(this.buildRequestBody({
          status,
          result,
          reason,
        })),
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
   * Pause the current game
   */
  async pauseGame() {
    console.log('🛑 pauseGame() called - attempting to pause game');

    // Prevent duplicate pause attempts
    if (this.isPausing) {
      console.log('⚠️ pauseGame() - Already pausing, ignoring duplicate call');
      return { success: false, reason: 'already-pausing' };
    }

    if (!this.isWebSocketConnected()) {
      console.warn('⚠️ pauseGame() - WebSocket not connected, but continuing with request');
      // Don't throw - allow the request to proceed even if WebSocket is not connected
    }

    this.isPausing = true;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildRequestBody({})),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Pause failed');
      }

      // Check for backend success flag
      if (data.success === false) {
        throw new Error(data.message || 'Game could not be paused');
      }

      console.log('✅ pauseGame() - Game paused successfully:', data);

      // Emit paused event
      this.emit('gamePaused', data);
      return data;
    } catch (error) {
      console.error('❌ pauseGame() - Failed to pause game:', error);
      // Check if it's a "not active" error and handle gracefully
      if (String(error?.message || '').includes('not active')) {
        console.log('ℹ️ pauseGame() - Game already paused, treating as success');
        this.isPausing = false;
        return { success: true, message: 'already-paused' };
      }
      throw error;
    } finally {
      this.isPausing = false;
    }
  }

  /**
   * Direct game resume (legacy/admin use)
   * NOTE: For normal multiplayer resume with opponent notification,
   * use requestResume() instead which sends a resume request to the opponent.
   */
  async resumeGame(acceptResume = true) {
    if (!this.isWebSocketConnected()) {
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
        body: JSON.stringify(this.buildRequestBody({
          accept_resume: acceptResume,
        })),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Resume failed');
      }

      // Check for backend success flag
      if (data.success === false) {
        throw new Error(data.message || 'Game could not be resumed');
      }

      return data;
    } catch (error) {
      console.error('Failed to resume game:', error);
      throw error;
    }
  }

  /**
   * Request to resume a paused game
   */
  async requestResume() {
    if (!this.isWebSocketConnected()) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/resume-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.getSocketId(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Resume request failed');
      }

      // Check for backend success flag
      if (data.success === false) {
        throw new Error(data.message || 'Resume request could not be sent');
      }

      console.log('✅ requestResume() - Resume request sent successfully:', data);

      // Emit resume request sent event
      this.emit('resumeRequestSent', data);
      return data;
    } catch (error) {
      console.error('Failed to request resume:', error);
      throw error;
    }
  }

  /**
   * Respond to a resume request
   */
  async respondToResumeRequest(accepted) {
    if (!this.isWebSocketConnected()) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/resume-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.getSocketId(),
          response: accepted,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Resume response failed');
      }

      // Check for backend success flag
      if (data.success === false) {
        throw new Error(data.message || 'Resume response could not be sent');
      }

      console.log('✅ respondToResumeRequest() - Resume response sent successfully:', data);

      // Emit resume response sent event
      this.emit('resumeResponseSent', { accepted, ...data });
      return data;
    } catch (error) {
      console.error('Failed to respond to resume request:', error);
      throw error;
    }
  }

  /**
   * Ping opponent to remind them it's their turn
   */
  async pingOpponent() {
    if (!this.isWebSocketConnected()) {
      throw new Error('WebSocket not connected');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/ping-opponent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.getSocketId(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ping failed');
      }

      // Check for backend success flag
      if (data.success === false) {
        throw new Error(data.message || 'Could not ping opponent');
      }

      console.log('✅ pingOpponent() - Opponent pinged successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to ping opponent:', error);
      throw error;
    }
  }

  /**
   * Create new game/rematch
   */
  async createNewGame(isRematch = false) {
    if (!this.isWebSocketConnected()) {
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
          socket_id: this.getSocketId(),
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
          socket_id: this.getSocketId(),
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

    // Don't retry if no active game (prevents infinite 400 errors on lobby/dashboard)
    if (!this.gameId) {
      console.log('[WS] No gameId - stopping reconnection attempts');
      return;
    }

    // Don't retry if explicitly stopped (e.g., game not joinable)
    if (this.stopReconnecting) {
      console.log('[WS] Reconnection disabled - game not in joinable state');
      return;
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

        // Note: Invitation polling removed - LobbyPage handles this via fetchData()
        // Redundant polling was causing duplicate network requests every 3 seconds

        return mockChannel;
      },
      stopListening: (eventName) => {
        console.log(`Mock channel: Stopped listening for ${eventName} on ${channelName}`);
        if (mockChannel.eventListeners[eventName]) {
          delete mockChannel.eventListeners[eventName];
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
   * REMOVED: startInvitationPolling, stopInvitationPolling, pollInvitationStatus
   *
   * These functions were creating redundant network requests (GET /invitations/sent every 3 seconds)
   * that duplicated the polling already done by LobbyPage.fetchData() (every 5-10 seconds).
   *
   * Invitation acceptance is now handled exclusively by LobbyPage polling, which checks:
   * - GET /invitations/pending (incoming)
   * - GET /invitations/sent (outgoing)
   * - GET /invitations/accepted (ready to join)
   *
   * This eliminates 20 requests/minute of duplicate traffic with zero feature impact.
   */

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

  async forfeitGame(reason = 'timeout') {
    if (!this.gameId || !this.user) {
      throw new Error('Game ID or user not set');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/forfeit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to forfeit game');
      }

      console.log('✅ Game forfeited successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to forfeit game:', error);
      throw error;
    }
  }

  /**
   * Offer a draw to the opponent
   */
  async offerDraw() {
    if (!this.gameId || !this.user) {
      throw new Error('Game ID or user not set');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/draw/offer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to offer draw');
      }

      console.log('✅ Draw offer sent successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to offer draw:', error);
      throw error;
    }
  }

  /**
   * Accept a draw offer from the opponent
   */
  async acceptDraw() {
    if (!this.gameId || !this.user) {
      throw new Error('Game ID or user not set');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/draw/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to accept draw');
      }

      console.log('✅ Draw offer accepted successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to accept draw:', error);
      throw error;
    }
  }

  /**
   * Decline a draw offer from the opponent
   */
  async declineDraw() {
    if (!this.gameId || !this.user) {
      throw new Error('Game ID or user not set');
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/websocket/games/${this.gameId}/draw/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to decline draw');
      }

      console.log('✅ Draw offer declined successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to decline draw:', error);
      throw error;
    }
  }

  /**
   * Disconnect and cleanup
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

    // invitationPollingInterval removed - no longer used

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Reset smart polling state
    this._pollingBusy = false;
    this._lastETag = null;

    if (this.gameChannel && this.gameId) {
      this.gameChannel.stopListening('GameConnectionEvent');
      this.gameChannel.stopListening('GameMoveEvent');
      this.gameChannel.stopListening('GameStatusEvent');
      this.gameChannel.stopListening('.game.ended');

      // Leave the channel using singleton
      leaveChannel(`game.${this.gameId}`);
      this.gameChannel = null;
    }

    // Don't disconnect the singleton Echo - other services may use it
    this.echo = null;

    this.isConnected = false;
    this.socketId = null;
    this.listeners = {};
    this.emit('disconnected');

    console.log('WebSocket disconnected and cleaned up');
  }
}

export default WebSocketGameService;
