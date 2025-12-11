// src/utils/lazyStockfishLoader.js

/**
 * Lazy Stockfish loader - loads Stockfish only when needed
 * Prevents loading 1.5MB stockfish.js on app initialization
 */

let stockfishPromise = null;
let isStockfishLoaded = false;

/**
 * Load Stockfish worker dynamically
 * @returns {Promise<Worker>} Stockfish worker instance
 */
export const loadStockfish = async () => {
  // Return cached promise if already loading/loaded
  if (stockfishPromise) {
    return stockfishPromise;
  }

  stockfishPromise = new Promise((resolve, reject) => {
    console.log('🏃‍♂️ Loading Stockfish engine on-demand...');

    // Create worker from the stockfish.js file in workers folder
    const stockfish = new Worker('/workers/stockfish.js');

    let isReady = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    // Timeout after 10 seconds
    timeoutId = setTimeout(() => {
      if (!isReady) {
        stockfish.terminate();
        reject(new Error('Stockfish loading timeout'));
      }
    }, 10000);

    stockfish.onerror = (error) => {
      cleanup();
      console.error('❌ Stockfish worker error:', error);
      reject(new Error('Failed to load Stockfish worker'));
    };

    stockfish.onmessage = (event) => {
      const message = typeof event.data === 'string' ? event.data : '';

      if (message === 'readyok') {
        cleanup();
        isReady = true;
        isStockfishLoaded = true;
        console.log('✅ Stockfish engine loaded successfully');
        resolve(stockfish);
      }
    };

    // Initialize Stockfish
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
  });

  return stockfishPromise;
};

/**
 * Check if Stockfish is currently loaded
 * @returns {boolean} True if Stockfish is loaded
 */
export const isStockfishReady = () => isStockfishLoaded;

/**
 * Preload Stockfish in background (optional - for better UX when user likely to play)
 * Call this when user navigates to play page or shows intent to play computer
 */
export const preloadStockfish = () => {
  if (!stockfishPromise) {
    // Load silently in background without blocking
    loadStockfish().catch(error => {
      console.warn('⚠️ Stockfish preload failed:', error);
    });
  }
};