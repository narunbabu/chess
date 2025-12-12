// src/utils/computerMoveUtils.js

import { Chess } from 'chess.js';

const MAX_DEPTH_FOR_DIFFICULTY = 16; // Max difficulty level
const NUM_TOP_MOVES_TO_REQUEST = 10; // How many moves to ask Stockfish for

// Keep time mapping - more time allows Stockfish to rank the top N moves better
const mapDepthToMoveTime = (depth) => {
    const clampedDepth = Math.max(1, Math.min(depth, MAX_DEPTH_FOR_DIFFICULTY));
    switch (clampedDepth) {
        case 1: return 100;  // ~0.1s
        case 2: return 150;
        case 3: return 200;
        case 4: return 250;
        case 5: return 300;
        case 6: return 400;
        case 7: return 500; // 0.5s
        case 8: return 600;
        case 9: return 700;
        case 10: return 800; // 0.8s
        case 11: return 1000; // 1s
        case 12: return 1200; // 1.2s
        case 13: return 1500; // 1.5s
        case 14: return 1800; // 1.8s
        case 15: return 2200; // 2.2s
        case 16: return 2500; // 2.5s - Max time for finding top N
        default: return 600;
    }
};


/**
 * Gets the top N moves from Stockfish using MultiPV.
 * @param {string} fen - The current board position in FEN format.
 * @param {number} numMoves - The number of top moves to request (MultiPV value).
 * @param {number} moveTimeMs - The time budget for Stockfish to search.
 * @returns {Promise<string[]>} A promise that resolves with an array of moves in UCI format, ordered best to worst. Rejects on error or timeout.
 */
const getStockfishTopMoves = async (fen, numMoves, moveTimeMs) => {
  try {
    // Create a fresh worker instance for each move to avoid state issues
    const stockfish = new Worker('/workers/stockfish.js');

    return new Promise((resolve, reject) => {
    let bestMoveFromEngine = null;
    const topMoves = new Array(numMoves).fill(null);

    let safetyTimer = null;
    const safetyMargin = 2000;
    const timeoutDuration = moveTimeMs + safetyMargin;

    const cleanup = () => {
        clearTimeout(safetyTimer);
        try {
          stockfish.terminate();
        } catch (e) {
          /* ignore worker already terminated */
        }
    }

    stockfish.onerror = (err) => {
        console.error("Stockfish Worker Error:", err);
        cleanup();
        reject(new Error('Stockfish worker error.'));
    };

    // --- Define Handlers ---

    // Handler for messages AFTER 'readyok' is received
    const mainMessageHandler = (e) => {
        // Define message within this handler's scope
        const message = typeof e.data === 'string' ? e.data : '';

        if (message.startsWith('info') && message.includes(' pv ')) {
            const multipvMatch = message.match(/ multipv (\d+)/);
            const pvMatch = message.match(/ pv (.+)/);

            if (multipvMatch && pvMatch) {
                const rank = parseInt(multipvMatch[1], 10);
                const pv = pvMatch[1].split(' ');
                const move = pv[0];

                if (move && rank > 0 && rank <= numMoves) {
                    const index = rank - 1;
                    if (topMoves[index] === null) {
                         topMoves[index] = move;
                    }
                }
            }
        } else if (message.startsWith('bestmove')) {
            bestMoveFromEngine = message.split(' ')[1];
            clearTimeout(safetyTimer);

            const validMoves = topMoves.filter(move => move !== null);
            if (validMoves.length > 0) {
                 resolve(validMoves);
            } else if (bestMoveFromEngine && bestMoveFromEngine !== '(none)') {
                 console.warn(`Stockfish returned no MultiPV info, falling back to bestmove: ${bestMoveFromEngine}`);
                 resolve([bestMoveFromEngine]);
            } else {
                 if (bestMoveFromEngine && bestMoveFromEngine !== '(none)') {
                     console.warn("Stockfish provided no info lines but gave a bestmove. Using bestmove.");
                     resolve([bestMoveFromEngine]);
                 } else {
                     reject(new Error('Stockfish finished but found no valid moves or info.'));
                 }
            }
             cleanup();
        }
    };

    // Temporary handler specifically waiting for 'readyok'
    const readyHandler = (e) => {
        // Define message within this handler's scope
        const message = typeof e.data === 'string' ? e.data : '';

        if (message === 'readyok') { // Check specifically for 'readyok' string
            // *** FIX: Assign the MAIN handler now ***
            stockfish.onmessage = mainMessageHandler;
            stockfish.postMessage(`position fen ${fen}`);
            
            stockfish.postMessage(`go movetime ${moveTimeMs}`);
            startTimeoutTimer();
        } else if (message.startsWith('bestmove')) { // Handle edge case: bestmove before readyok
             // *** FIX: 'message' is now defined in this scope ***
             console.warn("Received 'bestmove' before 'readyok'. Processing using main handler...");
             mainMessageHandler(e); // Process the bestmove message using the main handler
        }
        // Ignore other messages (like info lines) received before 'readyok'
    };

    // --- Safety Timeout Logic --- (remains the same)
    const startTimeoutTimer = () => {
        clearTimeout(safetyTimer);
        safetyTimer = setTimeout(() => {
            console.warn(`Stockfish safety timeout triggered after ${timeoutDuration}ms (allocated ${moveTimeMs}ms) for MultiPV. Sending 'stop'.`);
            stockfish.postMessage('stop');

            setTimeout(() => {
                const validMoves = topMoves.filter(move => move !== null);
                 if (validMoves.length > 0) {
                     console.warn(`Resolving with ${validMoves.length} moves found before timeout.`);
                     resolve(validMoves);
                 } else if (bestMoveFromEngine && bestMoveFromEngine !== '(none)') {
                     console.warn(`Stockfish timed out, falling back to bestmove: ${bestMoveFromEngine}`);
                     resolve([bestMoveFromEngine]);
                 } else {
                    reject(new Error('Stockfish timed out without finding sufficient move info.'));
                 }
                 cleanup();
            }, 500);

        }, timeoutDuration);
    };

    // --- Initialize Stockfish Communication ---
    stockfish.onmessage = readyHandler; // Start with the temporary ready handler

    // Initialize engine and set options
    stockfish.postMessage('uci');
    stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`setoption name MultiPV value ${numMoves}`);
    stockfish.postMessage('isready'); // This command triggers the 'readyok' response
    });
  } catch (error) {
    console.error('Failed to load Stockfish:', error);
    throw new Error('Stockfish engine not available');
  }
};


// selectMoveFromRankedList remains the same as the corrected version from previous response
/**
 * Selects a move from a ranked list based on difficulty depth,
 * handling cases where fewer moves are available than requested.
 * @param {string[]} rankedMoves - Array of moves (UCI format), index 0 is best.
 * @param {number} depth - Difficulty level (1-16).
 * @returns {string|null} The chosen move in UCI format, or null if selection fails.
 */
const selectMoveFromRankedList = (rankedMoves, depth) => {
    // --- Input Validation ---
    if (!rankedMoves || !Array.isArray(rankedMoves) || rankedMoves.length === 0) {
        console.warn("selectMoveFromRankedList called with empty or invalid moves array.");
        return null;
    }

    const numAvailableMoves = rankedMoves.length;

    // --- Handle Trivial Case ---
    if (numAvailableMoves === 1) {
            
        return rankedMoves[0];
    }

    const clampedDepth = Math.max(1, Math.min(depth, MAX_DEPTH_FOR_DIFFICULTY));
    let minRank, maxRank; // 1-based rank

    // --- Define Desired Rank Ranges (TUNE THESE!) ---
    switch (clampedDepth) {
        case 1: [minRank, maxRank] = [5, 8]; break; // Ranks 8-10
        case 2: [minRank, maxRank] = [4, 8]; break; // Ranks 7-10
        case 3: [minRank, maxRank] = [3, 7]; break;  // Ranks 6-9
        case 4: [minRank, maxRank] = [3, 6]; break;  // Ranks 5-8
        case 5: [minRank, maxRank] = [3, 5]; break;  // Ranks 4-7
        case 6: [minRank, maxRank] = [2, 5]; break;  // Ranks 4-6
        case 7: [minRank, maxRank] = [2, 4]; break;  // Ranks 3-6
        case 8: [minRank, maxRank] = [2, 3]; break;  // Ranks 3-5
        case 9: [minRank, maxRank] = [1, 3]; break;  // Ranks 2-5
        case 10: [minRank, maxRank] = [1, 2]; break; // Ranks 2-4
        case 11: [minRank, maxRank] = [1, 1]; break; // Ranks 2-3
        case 12: [minRank, maxRank] = [1, 1]; break; // Ranks 1-3
        case 13: [minRank, maxRank] = [1, 1]; break; // Ranks 1-2
        case 14: [minRank, maxRank] = [1, 1]; break; // Ranks 1-2
        case 15: [minRank, maxRank] = [1, 1]; break; // Rank 1
        case 16: [minRank, maxRank] = [1, 1]; break; // Rank 1
        default: [minRank, maxRank] = [1, numAvailableMoves]; // Should not happen due to clamping
    }

    // --- Calculate Indices ---
    const desiredStartIndex = minRank - 1; // 0-based index
    const desiredEndIndex = maxRank - 1;   // 0-based index
    const maxAvailableIndex = numAvailableMoves - 1;

    let finalStartIndex, finalEndIndex;

    // --- Determine Actual Selection Range ---
    if (desiredStartIndex > maxAvailableIndex) {
        // Case: The entire desired range is impossible
        console.warn(`Depth ${clampedDepth}: Desired rank range [${minRank}-${maxRank}] starts beyond available moves (${numAvailableMoves}). Applying fallback.`);
        if (clampedDepth <= 11) { // Low/Mid difficulty fallback: random among ALL available
            finalStartIndex = 0;
            finalEndIndex = maxAvailableIndex;
            console.log(`Fallback: Selecting randomly from ranks 1-${numAvailableMoves}.`);
        } else { // High difficulty fallback: pick the BEST available move
            finalStartIndex = 0;
            finalEndIndex = 0;
            console.log(`Fallback: Selecting best available (rank 1).`);
        }
    } else {
        // Case: The desired range at least starts within the available moves. Clamp the range.
        finalStartIndex = Math.max(0, desiredStartIndex);
        finalEndIndex = Math.min(desiredEndIndex, maxAvailableIndex);
        if (finalStartIndex > finalEndIndex) { finalStartIndex = finalEndIndex; } // Ensure start <= end
        
    }

    // --- Perform Random Selection ---
    const rangeSize = finalEndIndex - finalStartIndex + 1;
    const randomOffset = Math.floor(Math.random() * rangeSize);
    const randomIndex = finalStartIndex + randomOffset;

    // --- Final Safety Check and Return ---
    if (randomIndex < 0 || randomIndex >= numAvailableMoves) {
        console.error(`CRITICAL ERROR: Calculated randomIndex ${randomIndex} is out of bounds for ${numAvailableMoves} moves. Defaulting to best move.`);
        return rankedMoves[0];
    }

    
    return rankedMoves[randomIndex];
};


// makeComputerMove remains the same as the previous version
/**
 * Uses Stockfish (MultiPV) to find top moves and selects one based on depth/difficulty.
 * Includes fallback logic to random moves.
 * @param {Chess} game - The Chess.js game instance.
 * @param {number} depth - The selected difficulty level (1-16).
 * @param {string} computerColor - The color the computer is playing ('w' or 'b').
 * @param {Function} setTimerButtonColor - Callback to update UI feedback.
 * @returns {Promise<object|null>} An object with new game state, move (SAN), and actual thinking time, or null on failure.
 */
export const makeComputerMove = async (
  game, depth, computerColor, setTimerButtonColor
) => {
  console.log('🎯 makeComputerMove called', {
    turn: game.turn(),
    computerColor,
    depth,
    gameOver: game.isGameOver(),
    isDraw: game.isDraw()
  });

  if (game.isGameOver() || game.isDraw() || game.turn() !== computerColor) return null;

  const allocatedTimeMs = mapDepthToMoveTime(depth);

  setTimerButtonColor("yellow");
  const fen = game.fen();
  let rankedMoves = [];
  const thinkingStartTime = Date.now();
  let actualThinkingTime = 0;
  let chosenMoveUci = null;

  try {
    console.log('🔍 Calling getStockfishTopMoves...');
    rankedMoves = await getStockfishTopMoves(fen, NUM_TOP_MOVES_TO_REQUEST, allocatedTimeMs);
    actualThinkingTime = Date.now() - thinkingStartTime;
    console.log('✅ Stockfish response received:', { movesCount: rankedMoves?.length, thinkingTime: actualThinkingTime });
    

    chosenMoveUci = selectMoveFromRankedList(rankedMoves, depth);

    if (!chosenMoveUci) {
        throw new Error("Failed to get or select a move from Stockfish MultiPV results (selectMoveFromRankedList returned null).");
    }

  } catch (error) {
    actualThinkingTime = Date.now() - thinkingStartTime;
    console.error(`Error getting/selecting Stockfish move (level ${depth}, budget ${allocatedTimeMs}ms):`, error);
    console.warn(`Falling back to random move.`);

    const possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) {
      console.error("No legal moves available for fallback.");
      setTimerButtonColor(null);
      return null;
    }
    const randomIdx = Math.floor(Math.random() * possibleMoves.length);
    const fallbackMove = possibleMoves[randomIdx];
    console.log(`Applying random fallback move: ${fallbackMove.san} (${fallbackMove.from}${fallbackMove.to})`);

    const gameCopyFallback = new Chess(game.fen());
    const moveResultFallback = gameCopyFallback.move(fallbackMove.san);
    setTimerButtonColor(null);
    return {
        newGame: gameCopyFallback,
        move: moveResultFallback ? moveResultFallback.san : fallbackMove.san,
        thinkingTime: actualThinkingTime
    };
  }

  // --- Apply the Stockfish-selected move ---
  const gameCopy = new Chess(game.fen());
  let moveResult = null;
  try {
    moveResult = gameCopy.move(chosenMoveUci);
    if (!moveResult) {
      throw new Error(`Invalid move returned/rejected by chess.js: ${chosenMoveUci}`);
    }
    
  } catch (e) {
    // --- Critical Fallback: Applying selected move failed ---
    actualThinkingTime = Date.now() - thinkingStartTime;
    console.error(`CRITICAL ERROR applying Stockfish move '${chosenMoveUci}'. Error:`, e);
    console.warn('Falling back to random move after failed application.');

    const fallbackMoves = game.moves({ verbose: true });
    if (fallbackMoves.length === 0) {
       console.error("No legal moves available for critical fallback.");
       setTimerButtonColor(null);
       return null;
    }
    const randomMoveData = fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)];
    const fallbackMoveSan = randomMoveData.san;
    console.warn(`Applying critical random fallback move (SAN): ${fallbackMoveSan}`);

    const gameCopyCriticalFallback = new Chess(game.fen());
    moveResult = gameCopyCriticalFallback.move(fallbackMoveSan);
    setTimerButtonColor(null);
    return {
        newGame: gameCopyCriticalFallback,
        move: moveResult ? moveResult.san : fallbackMoveSan,
        thinkingTime: actualThinkingTime
    };
  }

  // --- Success Case ---
  setTimerButtonColor(null);
  return {
    newGame: gameCopy,
    move: moveResult.san,
    thinkingTime: actualThinkingTime,
  };
};
