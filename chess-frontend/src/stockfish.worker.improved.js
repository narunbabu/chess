// Improved Stockfish Worker with clean state initialization
// If the npm module "stockfish" works in your environment, try:
import stockfish from 'stockfish';

// Create a fresh instance of Stockfish for each worker
const engine = stockfish();

// Track engine state
let isReady = false;
let pendingCommands = [];

// Set up message handlers
const setupEngine = () => {
  // Clear any pending commands from previous initialization
  pendingCommands = [];

  // Relay Stockfish messages to the main thread
  engine.onmessage = (event) => {
    const data = event.data;

    // Track ready state
    if (data === 'readyok') {
      isReady = true;
      // Process any pending commands
      pendingCommands.forEach(cmd => engine.postMessage(cmd));
      pendingCommands = [];
    }

    postMessage(data);
  };

  // Handle engine errors
  engine.onerror = (error) => {
    console.error('Stockfish engine error:', error);
    postMessage({ error: error.message });
  };

  // Initialize engine with clean state
  engine.postMessage('uci');
  engine.postMessage('ucinewgame'); // Ensure clean game state
  engine.postMessage('isready');
};

// Relay messages from the main thread to Stockfish
onmessage = (e) => {
  const data = e.data;

  // Handle special case for engine restart
  if (data === 'restart') {
    setupEngine();
    return;
  }

  // Queue commands until engine is ready
  if (!isReady && data !== 'uci' && data !== 'isready') {
    pendingCommands.push(data);
    return;
  }

  // Send command to engine
  engine.postMessage(data);
};

// Initialize the engine
setupEngine();