/**
 * Centralized logging utility for the chess application
 * Provides environment-aware logging to prevent console spam in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebug = process.env.REACT_APP_DEBUG === 'true' || localStorage.getItem('debug') === 'true';

// Log levels for filtering
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level - can be adjusted based on environment
const currentLogLevel = isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

/**
 * Main logging function with level checking
 * @param {number} level - Log level from LOG_LEVELS
 * @param {string} prefix - Log prefix for identification
 * @param {any} data - Data to log
 * @param {Function} consoleMethod - Console method to use (log, warn, error)
 */
function log(level, prefix, data, consoleMethod = console.log) {
  if (level <= currentLogLevel && isDevelopment) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    consoleMethod(`[${timestamp}] ${prefix}:`, data);
  }
}

/**
 * Development-only logging functions
 */
export const logger = {
  error: (prefix, data) => log(LOG_LEVELS.ERROR, prefix, data, console.error),
  warn: (prefix, data) => log(LOG_LEVELS.WARN, prefix, data, console.warn),
  info: (prefix, data) => log(LOG_LEVELS.INFO, prefix, data, console.info),
  debug: (prefix, data) => log(LOG_LEVELS.DEBUG, prefix, data, console.log),

  // Specific methods for common patterns
  context: (contextName, data) => log(LOG_LEVELS.DEBUG, `Context:${contextName}`, data),
  component: (componentName, data) => log(LOG_LEVELS.DEBUG, `Component:${componentName}`, data),
  api: (endpoint, method, data) => log(LOG_LEVELS.DEBUG, `API:${method} ${endpoint}`, data),
  auth: (action, data) => log(LOG_LEVELS.INFO, `Auth:${action}`, data),
  websocket: (event, data) => log(LOG_LEVELS.DEBUG, `WS:${event}`, data),

  // Performance logging
  performance: (operation, startTime) => {
    if (isDevelopment) {
      const duration = performance.now() - startTime;
      log(LOG_LEVELS.INFO, `Performance:${operation}`, `${duration.toFixed(2)}ms`);
    }
  }
};

/**
 * Performance timer utility
 */
export const createTimer = (operation) => {
  const startTime = performance.now();
  return {
    end: () => logger.performance(operation, startTime)
  };
};

/**
 * Debug mode toggle for development
 */
export const toggleDebug = () => {
  const newDebugState = !isDebug;
  if (typeof window !== 'undefined') {
    if (newDebugState) {
      localStorage.setItem('debug', 'true');
    } else {
      localStorage.removeItem('debug');
    }
  }
  return newDebugState;
};

export default logger;