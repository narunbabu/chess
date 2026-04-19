// src/utils/computerMoveUtils.js

import { Chess } from 'chess.js';
import { COMPUTER_LEVEL_RATINGS } from './eloUtils';

const MAX_DEPTH_FOR_DIFFICULTY = 16;
const NUM_TOP_MOVES_TO_REQUEST = 10;

// Keep time mapping - more time allows Stockfish to rank the top N moves better
export const mapDepthToMoveTime = (depth) => {
    const clampedDepth = Math.max(1, Math.min(depth, MAX_DEPTH_FOR_DIFFICULTY));
    switch (clampedDepth) {
        case 1: return 100;
        case 2: return 150;
        case 3: return 200;
        case 4: return 250;
        case 5: return 300;
        case 6: return 400;
        case 7: return 500;
        case 8: return 600;
        case 9: return 700;
        case 10: return 800;
        case 11: return 1000;
        case 12: return 1200;
        case 13: return 1500;
        case 14: return 1800;
        case 15: return 2200;
        case 16: return 2500;
        default: return 600;
    }
};


/**
 * Gets the top N moves from Stockfish using MultiPV, including centipawn evaluations.
 *
 * @param {string} fen - Current board position in FEN format.
 * @param {number} numMoves - Number of top moves to request (MultiPV value).
 * @param {number} moveTimeMs - Engine search time budget in milliseconds.
 * @returns {Promise<Array<{move: string, cp: number}>>} Resolves with ranked moves and their
 *   centipawn scores (from the side-to-move's perspective, best first). Rejects on error/timeout.
 */
export const getStockfishTopMoves = async (fen, numMoves, moveTimeMs) => {
  const workerId = `stockfish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const stockfish = new Worker('/workers/stockfish.js', { name: workerId });

    return new Promise((resolve, reject) => {
      let bestMoveFromEngine = null;
      // Each slot: {move: string, cp: number} or null
      const topMoves = new Array(numMoves).fill(null);

      let safetyTimer = null;
      const safetyMargin = 2000;
      const timeoutDuration = moveTimeMs + safetyMargin;

      const cleanup = () => {
        clearTimeout(safetyTimer);
        try { stockfish.terminate(); } catch (_) {}
      };

      stockfish.onerror = (err) => {
        console.error('Stockfish Worker Error:', err);
        cleanup();
        reject(new Error('Stockfish worker error.'));
      };

      const resolveWithResults = () => {
        const validMoves = topMoves.filter(m => m !== null);
        if (validMoves.length > 0) {
          resolve(validMoves);
        } else if (bestMoveFromEngine && bestMoveFromEngine !== '(none)') {
          console.warn(`Stockfish returned no MultiPV info, falling back to bestmove: ${bestMoveFromEngine}`);
          resolve([{ move: bestMoveFromEngine, cp: 0 }]);
        } else {
          reject(new Error('Stockfish finished but found no valid moves or info.'));
        }
      };

      const mainMessageHandler = (e) => {
        const message = typeof e.data === 'string' ? e.data : '';

        if (message.startsWith('info') && message.includes(' pv ')) {
          const multipvMatch = message.match(/ multipv (\d+)/);
          const pvMatch = message.match(/ pv (.+)/);
          const cpMatch = message.match(/ score cp (-?\d+)/);
          const mateMatch = message.match(/ score mate (-?\d+)/);

          if (multipvMatch && pvMatch) {
            const rank = parseInt(multipvMatch[1], 10);
            const move = pvMatch[1].split(' ')[0];

            // Convert mate scores to large centipawn equivalents so cp arithmetic
            // still works (mate-in-1 beats mate-in-3 etc.).
            let cp = 0;
            if (cpMatch) {
              cp = parseInt(cpMatch[1], 10);
            } else if (mateMatch) {
              const n = parseInt(mateMatch[1], 10);
              cp = n > 0 ? 9999 - n : -9999 - n;
            }

            if (move && rank > 0 && rank <= numMoves) {
              // Always overwrite — the last info line for each multipv rank is the
              // deepest/most accurate evaluation from the search.
              topMoves[rank - 1] = { move, cp };
            }
          }
        } else if (message.startsWith('bestmove')) {
          bestMoveFromEngine = message.split(' ')[1];
          clearTimeout(safetyTimer);
          resolveWithResults();
          cleanup();
        }
      };

      const readyHandler = (e) => {
        const message = typeof e.data === 'string' ? e.data : '';
        if (message === 'readyok') {
          stockfish.onmessage = mainMessageHandler;
          stockfish.postMessage(`position fen ${fen}`);
          stockfish.postMessage(`go movetime ${moveTimeMs}`);
          startTimeoutTimer();
        } else if (message.startsWith('bestmove')) {
          console.warn("Received 'bestmove' before 'readyok'. Processing...");
          mainMessageHandler(e);
        }
      };

      const startTimeoutTimer = () => {
        clearTimeout(safetyTimer);
        safetyTimer = setTimeout(() => {
          console.warn(`Stockfish safety timeout after ${timeoutDuration}ms. Sending 'stop'.`);
          stockfish.postMessage('stop');
          setTimeout(() => {
            resolveWithResults();
            cleanup();
          }, 500);
        }, timeoutDuration);
      };

      stockfish.onmessage = readyHandler;
      stockfish.postMessage('uci');
      setTimeout(() => {
        stockfish.postMessage('ucinewgame');
        setTimeout(() => {
          stockfish.postMessage(`setoption name MultiPV value ${numMoves}`);
          stockfish.postMessage('isready');
        }, 50);
      }, 50);
    });
  } catch (error) {
    console.error('Failed to load Stockfish:', error);
    throw new Error('Stockfish engine not available');
  }
};


/**
 * Personality-based think-time profiles.
 */
const PERSONALITY_PROFILES = {
  aggressive:  { min: 500,  max: 3000 },
  defensive:   { min: 2000, max: 8000 },
  balanced:    { min: 1000, max: 5000 },
  tactical:    { min: 1500, max: 6000 },
  positional:  { min: 2000, max: 7000 },
};

const getEloThinkMultiplier = (rating) => {
  if (!rating || rating <= 0) return 1.0;
  const elo = Math.max(800, Math.min(2800, rating));
  return Math.max(0.4, Math.min(1.8, 1.0 + ((elo - 1800) / 600) * 0.5));
};

/**
 * Calculate a human-like perceived thinking time.
 */
export const calculatePerceivedThinkTime = (fen, moveNumber, move, depth, personality = null, rating = null) => {
  const key = personality?.toLowerCase();
  const profile = PERSONALITY_PROFILES[key] || PERSONALITY_PROFILES.balanced;
  let baseMin = profile.min;
  let baseMax = profile.max;

  const eloMultiplier = getEloThinkMultiplier(rating);
  baseMin *= eloMultiplier;
  baseMax *= eloMultiplier;

  const piecePart = fen ? fen.split(' ')[0] : '';
  const pieceCount = (piecePart.match(/[rnbqkpRNBQKP]/g) || []).length;
  const fullMoveNum = Math.floor(moveNumber / 2) + 1;

  let phaseMultiplier;
  if (fullMoveNum <= 10) {
    phaseMultiplier = 0.5;
  } else if (fullMoveNum <= 30) {
    phaseMultiplier = 1.0;
  } else {
    phaseMultiplier = pieceCount > 12 ? 1.2 : 0.8;
  }

  baseMin *= phaseMultiplier;
  baseMax *= phaseMultiplier;

  const rand = (Math.random() + Math.random()) / 2;
  let time = baseMin + rand * (baseMax - baseMin);

  if (move?.captured) time += 500 + Math.random() * 1000;
  if (move?.san?.includes('+')) time += 300 + Math.random() * 500;
  if (move?.san?.includes('=')) time += 1000 + Math.random() * 1000;

  if (fen) {
    try {
      const preMove = new Chess(fen);
      if (preMove.isCheck()) time += 1000 + Math.random() * 2000;
    } catch (_) {}
  }

  const clampedDepth = Math.max(1, Math.min(depth, 16));
  time *= 0.7 + (clampedDepth / 16) * 0.6;

  let jitterHalf;
  if (rating && rating > 0) {
    const elo = Math.max(800, Math.min(2800, rating));
    jitterHalf = 0.30 - ((elo - 800) / 2000) * 0.20;
  } else {
    jitterHalf = 0.20;
  }
  time *= (1.0 - jitterHalf) + Math.random() * (2 * jitterHalf);

  return Math.round(Math.max(300, Math.min(10000, time)));
};

/**
 * Returns a Promise that resolves after a human-like think delay.
 */
export const waitForPerceivedThinkTime = (fen, moveNumber, move, depth, personality, rating = null, actualEngineMs = 0) => {
  const perceived = calculatePerceivedThinkTime(fen, moveNumber, move, depth, personality, rating);
  const delay = Math.max(0, perceived - actualEngineMs);
  return new Promise(resolve => setTimeout(() => resolve(perceived), delay));
};


// ─── Move Selection ────────────────────────────────────────────────────────────

/**
 * Selects a move using centipawn-loss budget + blunder injection.
 *
 * Normal play (softmax weighting):
 *   Each ELO has a cp budget (maxCpLoss) AND a temperature that controls how spread
 *   the selection is. 1/(cpLoss+1) was replaced with exp(-cpLoss/temperature) because
 *   the old formula assigned rank-1 a 92%+ probability in practice — effectively
 *   always playing the best move regardless of ELO.
 *
 *   temperature = (3000 - elo) / 80, clamped to [5, ∞]:
 *     1200→22.5, 1800→15, 1900→13.75, 2200→10, 2400→7.5
 *   Lower temp = more concentrated on best move (high ELO). Higher temp = more spread.
 *
 *   maxCpLoss = (3500 - elo) / 16, clamped [5, 250]:
 *     1200→144cp, 1800→106cp, 1900→100cp, 2200→81cp, 2400→69cp
 *
 * Blunder injection:
 *   baseBlunderP = (2800 - elo) / 12000:
 *     2400→3.3%, 2200→5%, 1900→7.5%, 1800→8.3%, 1500→10.8%
 *   Protected during the first 6 moves; ramps to full probability by move 18.
 *   minBlunderCp lowered from 60 → 30 so inaccuracies (not just big blunders) qualify.
 *   Higher ELO = smaller maxBlunderCp (makes smaller mistakes when they err).
 *
 * @param {Array<{move: string, cp: number}>} movesWithEval - Stockfish MultiPV results.
 * @param {number} targetElo - Bot's target ELO rating.
 * @param {number} halfMoveCount - game.history().length (half-moves played so far).
 * @returns {string|null} Chosen UCI move, or null if no candidates.
 */
const selectMoveWithCpBudget = (movesWithEval, targetElo, halfMoveCount) => {
  if (!movesWithEval || movesWithEval.length === 0) return null;
  if (movesWithEval.length === 1) return movesWithEval[0].move;

  const bestCp = movesWithEval[0].cp;

  // Normalize: cpLoss = how much worse than the best move (always >= 0).
  const moves = movesWithEval.map(({ move, cp }) => ({
    move,
    cpLoss: Math.max(0, bestCp - cp),
  }));

  // ── Normal play budget & temperature ──────────────────────────────────────
  const maxCpLoss = Math.max(5, Math.min(250, (3500 - targetElo) / 16));
  // Softmax temperature: lower = more concentrated on best move (high ELO).
  const temperature = Math.max(5, (3000 - targetElo) / 80);

  // ── Blunder injection ──────────────────────────────────────────────────────
  const baseBlunderP = Math.max(0, (2800 - targetElo) / 12000);

  const fullMoveNum = Math.floor(halfMoveCount / 2) + 1;
  // Opening protected until move 6; ramps to full probability by move 18.
  const phase = Math.max(0, Math.min(1.0, (fullMoveNum - 6) / 12));
  const blunderP = baseBlunderP * (0.05 + 0.95 * phase);

  // Severity: higher ELO makes smaller mistakes when they err.
  // 2400→120cp, 2000→208cp, 1600→296cp, 1200→350cp (clamped).
  const maxBlunderCp = Math.max(100, Math.min(350, 120 + (2400 - targetElo) * 0.22));
  // Lowered from 60 → 30 so inaccuracies also qualify as blunder candidates.
  const minBlunderCp = 30;

  if (Math.random() < blunderP) {
    const blunderCandidates = moves.filter(m => m.cpLoss >= minBlunderCp && m.cpLoss <= maxBlunderCp);
    if (blunderCandidates.length > 0) {
      const chosen = blunderCandidates[Math.floor(Math.random() * blunderCandidates.length)];
      console.log(`🎲 [ELO ${targetElo}] move ${fullMoveNum}: suboptimal play (p=${(blunderP*100).toFixed(1)}%) → cpLoss ${chosen.cpLoss}`);
      return chosen.move;
    }
    // No suitable candidate in range → fall through to normal play.
  }

  // ── Normal play: softmax weighted selection ────────────────────────────────
  const normalCandidates = moves.filter(m => m.cpLoss <= maxCpLoss);
  if (normalCandidates.length === 0) {
    // Forced/critical position — all alternatives lose heavily. Play best.
    return moves[0].move;
  }

  // exp(-cpLoss/temperature): best move strongly favored but not forced.
  // Example at 1900 ELO (temp=13.75): cpLoss 0→1.0, 20→0.24, 40→0.056
  // → P(rank-1) ≈ 77% vs 92%+ with old 1/(cpLoss+1) formula.
  const weights = normalCandidates.map(c => Math.exp(-c.cpLoss / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < normalCandidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return normalCandidates[i].move;
  }
  return normalCandidates[normalCandidates.length - 1].move;
};


/**
 * Uses Stockfish (MultiPV) to find top moves and selects one based on depth/difficulty.
 *
 * @param {Chess} game - The Chess.js game instance.
 * @param {number} depth - Difficulty level (1-16).
 * @param {string} computerColor - Computer's color ('w' or 'b').
 * @param {Function} setTimerButtonColor - Callback for UI feedback.
 * @param {string|null} personality - Bot personality key for think-time shaping.
 * @param {number|null} rating - Explicit ELO rating; falls back to COMPUTER_LEVEL_RATINGS[depth].
 * @returns {Promise<{newGame: Chess, move: string, thinkingTime: number}|null>}
 */
export const makeComputerMove = async (
  game, depth, computerColor, setTimerButtonColor, personality = null, rating = null
) => {
  console.log('🎯 makeComputerMove called', {
    turn: game.turn(),
    computerColor,
    depth,
    gameOver: game.isGameOver(),
    isDraw: game.isDraw()
  });

  if (game.isGameOver() || game.isDraw() || game.turn() !== computerColor) return null;

  // Derive target ELO: explicit rating wins; otherwise map from difficulty level.
  const targetElo = (rating && rating > 0)
    ? rating
    : (COMPUTER_LEVEL_RATINGS[depth] ?? 1500);

  const halfMoveCount = game.history().length;
  const allocatedTimeMs = mapDepthToMoveTime(depth);

  setTimerButtonColor('yellow');
  const fen = game.fen();
  let movesWithEval = [];
  const thinkingStartTime = Date.now();
  let actualThinkingTime = 0;
  let chosenMoveUci = null;

  try {
    console.log('🔍 Calling getStockfishTopMoves...');
    movesWithEval = await getStockfishTopMoves(fen, NUM_TOP_MOVES_TO_REQUEST, allocatedTimeMs);
    actualThinkingTime = Date.now() - thinkingStartTime;
    console.log('✅ Stockfish response:', { movesCount: movesWithEval?.length, thinkingTime: actualThinkingTime, targetElo });

    chosenMoveUci = selectMoveWithCpBudget(movesWithEval, targetElo, halfMoveCount);

    if (!chosenMoveUci) {
      throw new Error('selectMoveWithCpBudget returned null.');
    }

  } catch (error) {
    actualThinkingTime = Date.now() - thinkingStartTime;
    console.error(`Error getting/selecting Stockfish move (level ${depth}, budget ${allocatedTimeMs}ms):`, error);
    console.warn('Falling back to random move.');

    const possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) {
      setTimerButtonColor(null);
      return null;
    }
    const fallbackMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    const gameCopyFallback = new Chess(game.fen());
    const moveResultFallback = gameCopyFallback.move(fallbackMove.san);
    setTimerButtonColor(null);
    return {
      newGame: gameCopyFallback,
      move: moveResultFallback ? moveResultFallback.san : fallbackMove.san,
      thinkingTime: actualThinkingTime,
    };
  }

  // ── Apply the chosen move ──────────────────────────────────────────────────
  const gameCopy = new Chess(game.fen());
  let moveResult = null;
  try {
    moveResult = gameCopy.move(chosenMoveUci);
    if (!moveResult) throw new Error(`chess.js rejected move: ${chosenMoveUci}`);
  } catch (e) {
    actualThinkingTime = Date.now() - thinkingStartTime;
    console.error(`CRITICAL ERROR applying move '${chosenMoveUci}':`, e);
    const fallbackMoves = game.moves({ verbose: true });
    if (fallbackMoves.length === 0) {
      setTimerButtonColor(null);
      return null;
    }
    const randomMove = fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)];
    const gameCopyCritical = new Chess(game.fen());
    moveResult = gameCopyCritical.move(randomMove.san);
    setTimerButtonColor(null);
    return {
      newGame: gameCopyCritical,
      move: moveResult ? moveResult.san : randomMove.san,
      thinkingTime: actualThinkingTime,
    };
  }

  setTimerButtonColor(null);
  return {
    newGame: gameCopy,
    move: moveResult.san,
    thinkingTime: actualThinkingTime,
  };
};
