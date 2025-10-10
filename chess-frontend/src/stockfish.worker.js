// If the npm module “stockfish” works in your environment, try:
import stockfish from 'stockfish';

// Create an instance of Stockfish.
const engine = stockfish();

// Relay Stockfish messages to the main thread.
engine.onmessage = (event) => {
  postMessage(event.data);
};

// Relay messages from the main thread to Stockfish.
onmessage = (e) => {
  engine.postMessage(e.data);
};
