import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

let echo = null;
const subscribed = new Set();

/**
 * Initialize the singleton Echo instance (call once at app bootstrap)
 * @param {Object} config - Configuration object
 * @param {string} config.token - Authentication token
 * @param {Object} config.wsConfig - WebSocket configuration
 * @returns {Echo} The Echo instance
 */
export function initEcho({ token, wsConfig }) {
  if (echo) {
    console.log('[Echo] Singleton already initialized');
    return echo;
  }

  if (!token) {
    console.error('[Echo] Cannot initialize without token');
    return null;
  }

  // Use provided wsConfig or fall back to env vars
  const config = wsConfig || {
    key: process.env.REACT_APP_REVERB_APP_KEY || 'anrdh24nppf3obfupvqw',
    wsHost: process.env.REACT_APP_REVERB_HOST || 'localhost',
    wsPort: parseInt(process.env.REACT_APP_REVERB_PORT) || 8080,
    scheme: process.env.REACT_APP_REVERB_SCHEME || 'http',
  };

  // Get API base URL with safe fallback (extract base URL from REACT_APP_BACKEND_URL)
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api';
  const apiBaseUrl = backendUrl.replace(/\/api$/, ''); // Remove trailing /api if present

  try {
    echo = new Echo({
      broadcaster: 'reverb',
      key: config.key,
      wsHost: config.wsHost,
      wsPort: config.wsPort,
      wssPort: config.wsPort,
      forceTLS: config.scheme === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${apiBaseUrl}/api/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      // Keep connection alive
      activityTimeout: 120000, // 120 seconds
      pongTimeout: 30000, // 30 seconds
    });

    console.log('[Echo] Singleton initialized with config:', {
      wsHost: config.wsHost,
      wsPort: config.wsPort,
      scheme: config.scheme,
      authEndpoint: `${apiBaseUrl}/api/broadcasting/auth`,
    });

    // Bind connection events after Echo instance is created
    if (echo && echo.connector && echo.connector.pusher) {
      const echoInstance = echo; // Capture echo in closure to avoid null reference

      echo.connector.pusher.connection.bind('connecting', () => {
        console.log('[Echo] Connecting to WebSocket...');
      });

      echo.connector.pusher.connection.bind('connected', () => {
        // Use the captured instance and add null checks
        const socketId = echoInstance && typeof echoInstance.socketId === 'function'
          ? echoInstance.socketId()
          : 'unknown';
        console.log('[Echo] Successfully connected. Socket ID:', socketId);
      });

      echo.connector.pusher.connection.bind('unavailable', () => {
        console.warn('[Echo] WebSocket unavailable - falling back to polling');
      });

      echo.connector.pusher.connection.bind('failed', () => {
        console.error('[Echo] Connection failed - check if Reverb is running on port', config.wsPort);
      });

      echo.connector.pusher.connection.bind('error', (err) => {
        console.error('[Echo] Connection Error:', err);
        if (err.error?.data?.code === 401) {
          console.error('[Echo] Authentication failed. Please check your token.');
        }
      });

      echo.connector.pusher.connection.bind('disconnected', () => {
        console.warn('[Echo] Disconnected from WebSocket');
      });
    }

    return echo;
  } catch (error) {
    console.error('[Echo] Failed to initialize:', error);
    echo = null;
    return null;
  }
}

/**
 * Get the singleton Echo instance (returns null if not initialized)
 * @returns {Echo|null} The Echo instance or null
 */
export function getEcho() {
  return echo;
}

/**
 * Join a channel idempotently (only subscribes once)
 * @param {string} name - Channel name (e.g., 'game.123' or 'presence')
 * @param {string} type - Channel type: 'private', 'presence', or 'channel'
 * @returns {object} The channel object
 */
export function joinChannel(name, type = 'private') {
  const e = getEcho();
  if (!e) {
    console.warn(`[Echo] Cannot join ${name}: Echo not initialized`);
    return null;
  }

  // Create unique key with type to track subscriptions properly
  const key = `${type}:${name}`;

  if (subscribed.has(key)) {
    console.log(`[Echo] Already subscribed to ${name} (${type}), reusing channel`);
    // Return existing channel reference
    switch (type) {
      case 'private':
        return e.private(name);
      case 'presence':
        return e.join(name);
      case 'channel':
        return e.channel(name);
      default:
        return e.private(name);
    }
  }

  console.log(`[Echo] Subscribing to ${name} (${type})`);
  subscribed.add(key);

  switch (type) {
    case 'private':
      return e.private(name);
    case 'presence':
      return e.join(name);
    case 'channel':
      return e.channel(name);
    default:
      return e.private(name);
  }
}

/**
 * Leave a channel idempotently
 * @param {string} name - Channel name to leave
 * @param {string} type - Channel type (must match what was used in joinChannel)
 */
export function leaveChannel(name, type = 'private') {
  const key = `${type}:${name}`;

  if (!subscribed.has(key)) {
    console.log(`[Echo] Not subscribed to ${name} (${type}), nothing to leave`);
    return;
  }

  const e = getEcho();
  if (e) {
    console.log(`[Echo] Leaving channel ${name} (${type})`);
    // Laravel Echo expects the full channel name for leave()
    const fullName = type === 'private' ? `private-${name}` : name;
    e.leave(fullName);
  }
  subscribed.delete(key);
}

/**
 * Disconnect Echo and clean up all subscriptions
 */
export function disconnectEcho() {
  if (!echo) return;

  console.log(`[Echo] Disconnecting and cleaning up ${subscribed.size} channels`);
  subscribed.forEach(ch => {
    try {
      echo.leave(ch);
    } catch (err) {
      console.warn(`[Echo] Error leaving ${ch}:`, err);
    }
  });
  subscribed.clear();

  try {
    echo.disconnect();
  } catch (err) {
    console.warn('[Echo] Error during disconnect:', err);
  }

  echo = null;
  console.log('[Echo] Singleton disconnected');
}

/**
 * Get list of currently subscribed channels
 * @returns {string[]} Array of channel names
 */
export function getSubscribedChannels() {
  return Array.from(subscribed);
}

/**
 * Check if currently subscribed to a channel
 * @param {string} name - Channel name
 * @returns {boolean}
 */
export function isSubscribed(name) {
  return subscribed.has(name);
}
