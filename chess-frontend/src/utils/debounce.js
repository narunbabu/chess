/**
 * Debouncing utility for API calls and frequent operations
 * Prevents excessive requests that can cause console spam and performance issues
 */

/**
 * Creates a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {string} key - Optional key for tracking
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay, key = 'default') => {
  let timeoutId;
  let lastCall = 0;

  return function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // If called very frequently, batch the calls
    if (timeSinceLastCall < delay / 2) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay);
    } else {
      // Allow immediate execution for less frequent calls
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay / 2);
    }
  };
};

/**
 * Creates a throttled version of a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * API call debouncer with request deduplication
 */
class APIRequestDebouncer {
  constructor() {
    this.pendingRequests = new Map();
    this.requestCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Debounce an API call with deduplication
   * @param {string} key - Unique key for the request
   * @param {Function} apiCall - Function that makes the API call
   * @param {number} delay - Debounce delay in milliseconds
   * @returns {Promise} Promise that resolves with the API response
   */
  async debounceRequest(key, apiCall, delay = 300) {
    // Check cache first
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create new debounced request
    const debouncedPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          const result = await apiCall();

          // Cache the result
          this.requestCache.set(key, {
            data: result,
            timestamp: Date.now()
          });

          // Remove from pending
          this.pendingRequests.delete(key);
          resolve(result);
        } catch (error) {
          this.pendingRequests.delete(key);
          reject(error);
        }
      }, delay);

      // Store the promise with cancel functionality
      this.pendingRequests.set(key, {
        promise: new Promise((res, rej) => {
          setTimeout(() => {
            clearTimeout(timeoutId);
            res(debouncedPromise);
          }, delay);
        }).then(resolve).catch(reject),
        cancel: () => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(key);
        }
      });
    });

    const actualPromise = this.pendingRequests.get(key);
    return actualPromise.promise || actualPromise;
  }

  /**
   * Clear cache for a specific key or all keys
   * @param {string} key - Key to clear (optional)
   */
  clearCache(key = null) {
    if (key) {
      this.requestCache.delete(key);
      if (this.pendingRequests.has(key)) {
        const pending = this.pendingRequests.get(key);
        if (pending.cancel) {
          pending.cancel();
        }
      }
    } else {
      this.requestCache.clear();
      this.pendingRequests.forEach(pending => {
        if (pending.cancel) {
          pending.cancel();
        }
      });
      this.pendingRequests.clear();
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.requestCache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.requestCache.delete(key);
      }
    }
  }
}

// Global debouncer instance
export const apiDebouncer = new APIRequestDebouncer();

// Auto-cleanup cache every 5 minutes
setInterval(() => {
  apiDebouncer.cleanup();
}, 300000);

export default {
  debounce,
  throttle,
  apiDebouncer,
  APIRequestDebouncer
};