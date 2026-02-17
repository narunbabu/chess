// src/components/play/PlayComputer.js

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { useNavigate, useLocation } from "react-router-dom"; // Use Router if defining routes here, otherwise just useNavigate

// Import Components
import ChessBoard from "./ChessBoard";
import DifficultyMeter from "./DifficultyMeter";
import Countdown from "../Countdown"; // Adjust path if needed
import GameCompletionAnimation from "../GameCompletionAnimation"; // Adjust path if needed
import PlayShell from "./PlayShell"; // Layout wrapper (Phase 4)
import GameContainer from "./GameContainer"; // Unified game container
import GameModeSelector from "../game/GameModeSelector"; // Game mode selector

// Import Utils & Hooks
import { useGameTimer } from "../../utils/timerUtils"; // Adjust path if needed
import { makeComputerMove } from "../../utils/computerMoveUtils"; // Adjust path if needed
import { updateGameStatus, evaluateMove } from "../../utils/gameStateUtils"; // Adjust paths if needed (ensure evaluateMove exists)
import { encodeGameHistory, reconstructGameFromHistory } from "../../utils/gameHistoryStringUtils"; // Adjust paths if needed
import { createResultFromComputerGame } from "../../utils/resultStandardization"; // Standardized result format
import { monitorPerformance } from "../../utils/devLogger";
import { getMovePath, createPathHighlights, mergeHighlights } from "../../utils/movePathUtils"; // Move path utilities

// Import Services
import { saveGameHistory, getGameHistories } from "../../services/gameHistoryService"; // Adjust paths if needed
import { saveUnfinishedGame, clearUnfinishedGame, saveCompletedGame } from "../../services/unfinishedGameService"; // For saving, clearing paused games, and saving completed games
import { gameService } from "../../services/gameService"; // Backend game service
import { useAuth } from "../../contexts/AuthContext";
import { useAppData } from "../../contexts/AppDataContext";


// Import sound files (ensure paths are correct)
import moveSound from '../../assets/sounds/move.mp3';
import checkSound from '../../assets/sounds/check.mp3';
import gameEndSound from '../../assets/sounds/game-end.mp3';

// Create audio objects
const moveSoundEffect = new Audio(moveSound);
const checkSoundEffect = new Audio(checkSound);
const gameEndSoundEffect = new Audio(gameEndSound);

// --- Constants ---
const MIN_DEPTH = 1;
const MAX_DEPTH = 16; // Used for DifficultyMeter max
const DEFAULT_DEPTH = 2;
// Minimum duration the computer should *appear* to think (milliseconds)
const MIN_PERCEIVED_COMPUTER_THINK_TIME = 1500; // e.g., 1.5 seconds
const DEFAULT_RATING = 1200;

// --- Utility Functions ---
/**
 * Calculate undo chances based on computer difficulty level
 * Easy (1-4): 5 undos
 * Medium (5-8): 3 undos
 * Hard (9-12): 2 undos
 * Expert (13-16): 1 undo
 * Rated mode: 0 undos (always)
 */
const calculateUndoChances = (depth, isRated) => {
  if (isRated) return 0; // No undos in rated mode

  if (depth <= 4) return 5; // Easy
  if (depth <= 8) return 3; // Medium
  if (depth <= 12) return 2; // Hard
  return 1; // Expert
};

const PlayComputer = () => {
  // --- State variables ---
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState(() => {
    const saved = localStorage.getItem('playerColor') || 'w';
    return saved === 'w' ? 'white' : 'black';
  });
  const [playerColor, setPlayerColor] = useState(() => localStorage.getItem('playerColor') || 'w');
  const [computerDepth, setComputerDepth] = useState(() => {
    const saved = localStorage.getItem('computerDepth');
    return saved ? parseInt(saved, 10) : DEFAULT_DEPTH;
  });
  const [computerScore, setComputerScore] = useState(0);
  const [lastComputerEvaluation, setLastComputerEvaluation] = useState(null);
  const [gameStatus, setGameStatus] = useState("Setup your game and press Start.");
  const [moveFrom, setMoveFrom] = useState("");
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [moveSquares, setMoveSquares] = useState({});
  const [lastMoveHighlights, setLastMoveHighlights] = useState({});
  const [gameStarted, setGameStarted] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [moveCompleted, setMoveCompleted] = useState(false); // Tracks if player has dropped a piece this turn
  const [computerMoveInProgress, setComputerMoveInProgress] = useState(false);
  const [showGameCompletion, setShowGameCompletion] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); // Stores standardized result object
  const [playerScore, setPlayerScore] = useState(0);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState(null); // Stores result from evaluateMove
  const moveStartTimeRef = useRef(null); // Tracks when player's turn started for move timing
  const previousGameStateRef = useRef(null); // Stores previous FEN for evaluation/history
  const [gameHistory, setGameHistory] = useState([]); // Stores move history [{ fen, move, playerColor, timeSpent, evaluation }]
  const [encodedMoves, setEncodedMoves] = useState(''); // Stores encoded moves string for Login to Save
  const [savedGames, setSavedGames] = useState([]); // List of games loaded for replay
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayPaused, setReplayPaused] = useState(true);
  const replayTimerRef = useRef(null); // Interval timer for replay
  const [currentReplayMove, setCurrentReplayMove] = useState(0); // Index for replay
  const [settings] = useState({ requireDoneButton: false }); // Game settings
  const [moveCount, setMoveCount] = useState(0); // Simple move counter
  const [timerButtonColor, setTimerButtonColor] = useState("grey"); // Color of the TimerButton
  const [timerButtonText, setTimerButtonText] = useState("Your Turn"); // Text of the TimerButton
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth); // For layout adjustments
  const navigate = useNavigate(); // For navigation buttons
  const location = useLocation();
  const { user } = useAuth(); // Get user for rating
  const { invalidateGameHistory } = useAppData(); // Get cache invalidation
  const [isOnlineGame, setIsOnlineGame] = useState(false);
  const [players, setPlayers] = useState(null);
  const [gameMode, setGameMode] = useState('computer'); // Default to computer mode for /play route
  const [ratedMode, setRatedMode] = useState('casual'); // 'casual' or 'rated'

  const [currentGameId, setCurrentGameId] = useState(null);
  const [backendGame, setBackendGame] = useState(null); // Store backend game data
  const [canUndo, setCanUndo] = useState(false); // Track if undo is available
  const [undoChancesRemaining, setUndoChancesRemaining] = useState(0); // Track remaining undo chances
  const [pendingNavigation, setPendingNavigation] = useState(null); // Store navigation path when blocked
  const [showNavigationWarning, setShowNavigationWarning] = useState(false); // Show navigation warning modal
  const [syntheticOpponent, setSyntheticOpponent] = useState(
    location.state?.gameMode === 'synthetic' ? location.state.syntheticPlayer : null
  ); // Synthetic bot identity from lobby matchmaking

  // --- Custom timer hook ---
  const {
    playerTime, computerTime, activeTimer, isTimerRunning, timerRef,
    setActiveTimer, setIsTimerRunning, setPlayerTime, setComputerTime,
    handleTimer: startTimerInterval, pauseTimer, switchTimer, resetTimer
  } = useGameTimer(playerColor, game, setGameStatus); // Pass callbacks

  // --- Enhanced pause handler with game saving ---
  const handlePauseWithSave = useCallback(async () => {
    console.log('[PlayComputer] ⏸️ Pause clicked - saving game state');

    // First pause the timer
    pauseTimer();

    // Save current game state as unfinished game
    if (gameStarted && !gameOver && gameHistory.length > 0) {
      try {
        const gameState = {
          fen: game.fen(),
          pgn: game.pgn(),
          moves: gameHistory,
          playerColor: playerColor,
          opponentName: syntheticOpponent?.name || 'Computer',
          gameMode: 'computer',
          computerLevel: computerDepth,
          timerState: {
            whiteTime: playerColor === 'w' ? playerTime : computerTime,
            blackTime: playerColor === 'b' ? playerTime : computerTime,
            whiteMs: playerColor === 'w' ? playerTime * 1000 : computerTime * 1000,
            blackMs: playerColor === 'b' ? playerTime * 1000 : computerTime * 1000
          },
          turn: game.turn(),
          savedReason: 'pause'
        };

        let saveGameId = null;
        if (!user) {
          if (!currentGameId) {
            saveGameId = `local_${Date.now()}`;
            setCurrentGameId(saveGameId);
          } else {
            saveGameId = currentGameId;
          }
        }

        const result = await saveUnfinishedGame(gameState, !!user, saveGameId, null);
        console.log('[PlayComputer] 💾 Game saved on pause:', result, { saveGameId });

        // Show brief confirmation to user
        setGameStatus(prev => prev + ' (Game saved - can resume from landing page)');

        // Invalidate game history cache to refresh unfinished games
        if (invalidateGameHistory) {
          invalidateGameHistory();
        }
      } catch (error) {
        console.error('[PlayComputer] ❌ Failed to save game on pause:', error);
        setGameStatus(prev => prev + ' (Error saving game)');
      }
    }
  }, [gameStarted, gameOver, gameHistory, playerColor, computerDepth, playerTime, computerTime, game, pauseTimer, user, invalidateGameHistory, currentGameId, setCurrentGameId]);

  // --- Utility Callbacks ---
   const safeGameMutate = useCallback((modify) => {
        // Provides a safe way to update the Chess.js instance state
        setGame((g) => {
            // Create a new Chess instance from the current FEN to avoid mutation issues
            const gameCopy = new Chess(g.fen());
            modify(gameCopy); // Apply modifications to the copy
            return gameCopy; // Return the new instance
        });
    }, []); // No external dependencies needed

   const playSound = useCallback((soundEffect) => {
        // Play audio, catch errors if blocked by browser
        soundEffect.play().catch(e => console.log("Audio play prevented:", e));
    }, []); // No external dependencies needed

  // --- Game Completion Callback ---
   const handleGameComplete = useCallback(async (finalHistory, status, finalPlayerScore = null, finalComputerScore = null) => {
        // Prepare result text and positive score
        let resultText = status.text || "unknown";
        if (isOnlineGame && players) {
            if (resultText.includes("White wins")) {
                resultText = `${players['w'].name} wins!`;
            } else if (resultText.includes("Black wins")) {
                resultText = `${players['b'].name} wins!`;
            }
        }

        // Use captured final scores if provided, otherwise use current state
        const capturedPlayerScore = finalPlayerScore !== null ? finalPlayerScore : playerScore;
        const capturedComputerScore = finalComputerScore !== null ? finalComputerScore : computerScore;

        const positiveScore = Math.abs(capturedPlayerScore);

        // Stops timers, sets game over state, saves game locally and potentially online
        if (timerRef.current) clearInterval(timerRef.current);
        setIsTimerRunning(false);
        setActiveTimer(null);
        setGameOver(true);
        setShowGameCompletion(true); // Show completion modal
        setCanUndo(false); // Disable undo after game ends
        const now = new Date();

        // Ensure encodeGameHistory exists and is used, otherwise stringify
        console.log('[PlayComputer] 🎯 Encoding game history:', {
            finalHistory_type: typeof finalHistory,
            finalHistory_is_array: Array.isArray(finalHistory),
            finalHistory_length: finalHistory?.length || 0,
            finalHistory_sample: finalHistory?.[0],
            encodeGameHistory_available: typeof encodeGameHistory === 'function'
        });

        const conciseGameString = typeof encodeGameHistory === 'function'
            ? encodeGameHistory(finalHistory)
            : JSON.stringify(finalHistory);

        console.log('[PlayComputer] ✅ Encoded moves:', {
            conciseGameString_type: typeof conciseGameString,
            conciseGameString_length: conciseGameString?.length || 0,
            conciseGameString_sample: conciseGameString?.substring?.(0, 100) || 'NO_STRING'
        });

        // Store encoded moves in state for GameCompletionAnimation (Login to Save)
        setEncodedMoves(conciseGameString);

        // Create standardized result object
        const standardizedResult = createResultFromComputerGame(
            resultText,
            playerColor,
            {
                in_checkmate: status.reason === 'checkmate',
                in_stalemate: status.reason === 'stalemate',
                in_draw: status.outcome === 'draw'
            }
        );

        // Attach synthetic opponent data so GameEndCard can display name/avatar
        if (syntheticOpponent) {
            standardizedResult.opponent_name = syntheticOpponent.name;
            standardizedResult.opponent_avatar_url = syntheticOpponent.avatar_url;
            standardizedResult.opponent_rating = syntheticOpponent.rating;
        }

        console.log('🎯 [PlayComputer] Created standardized result:', standardizedResult);

        // Store the standardized result for GameCompletionAnimation
        setGameResult(standardizedResult);

        // Remove current game from unfinished storage (completed games are stored separately)
        if (!user && gameHistory.length > 0) {
            try {
                const currentGameId = `local_${gameHistory[0]?.timestamp || Date.now()}`;
                clearUnfinishedGame(currentGameId);
                console.log('[PlayComputer] 🗑️ Removed current game from unfinished storage:', currentGameId);
            } catch (error) {
                console.error('[PlayComputer] ❌ Failed to clear unfinished game:', error);
            }
        }

        // Save game history (handles both local and online save)
        const gameHistoryData = {
            id: `local_${Date.now()}`,
            date: now.toISOString(),
            played_at: now.toISOString(),
            player_color: playerColor,
            computer_depth: computerDepth,
            moves: conciseGameString,
            final_score: positiveScore,
            opponent_score: Math.abs(capturedComputerScore), // Save computer score as positive
            result: standardizedResult, // Use standardized result object
        };

        // Save completed game to the correct storage location
        if (!user) {
            // Guest user: Save to localStorage completed games
            try {
                const completedGameData = {
                    ...gameHistoryData,
                    fen: game?.fen() || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    pgn: game?.pgn() || '',
                    moves: gameHistory || [],
                    computerLevel: computerDepth,
                    startTime: gameHistory.length > 0 ? gameHistory[0]?.timestamp || Date.now() : Date.now(),
                    endTime: Date.now(),
                    result: standardizedResult,
                    playerScore: capturedPlayerScore,
                    opponentScore: capturedComputerScore,
                    completed: true
                };

                const saveResult = await saveCompletedGame(completedGameData, false, standardizedResult);
                console.log("[PlayComputer] Game saved to completed games:", saveResult);
            } catch (error) {
                console.error("[PlayComputer] Error saving completed game:", error);
                // Fallback to regular saveGameHistory
                if (typeof saveGameHistory === 'function') {
                    try {
                        await saveGameHistory(gameHistoryData);
                        console.log("Game history saved successfully (fallback)");
                    } catch (fallbackError) {
                        console.error("Error in fallback save:", fallbackError);
                    }
                }
            }
        } else {
            // Authenticated user: Use backend saveGameHistory
            if (typeof saveGameHistory === 'function') {
                try {
                    await saveGameHistory(gameHistoryData);
                    console.log("Game history saved successfully (backend)");
                    // Invalidate cache so Dashboard shows the new game
                    if (invalidateGameHistory) {
                        invalidateGameHistory();
                        console.log('🔄 Game history cache invalidated');
                    }
                } catch (error) {
                    console.error("Error saving game history:", error);
                }
            } else {
                console.warn("saveGameHistory function not available.");
            }
        }

        playSound(gameEndSoundEffect); // Play end sound

        // Store the saved game ID for history navigation
        const savedGameId = gameHistoryData?.id;
        if (savedGameId) {
            localStorage.setItem('lastGameId', savedGameId);
        } else {
            console.warn("Could not get saved game ID");
        }

   }, [ // Dependencies for handleGameComplete
     playerColor, computerDepth, playerScore, computerScore, isOnlineGame, players, // State variables read
     setActiveTimer, setIsTimerRunning, // State setters (stable)
     playSound, // Stable callback
     timerRef, // Timer ref
     invalidateGameHistory, // Query invalidation
     // Note: gameEndSoundEffect are constants/imports, typically stable
   ]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Effects ---

  // Effect for handling screen orientation changes and mobile landscape detection
  useLayoutEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth <= 812; // iPhone X width in landscape
      setIsPortrait(!isLandscape);

      // Add mobile-landscape class to both html and body for maximum CSS specificity
      const shouldApply = isLandscape && isMobile;
      document.documentElement.classList.toggle('mobile-landscape', shouldApply);
      document.body.classList.toggle('mobile-landscape', shouldApply);

      // Debug logging
      if (shouldApply) {
        console.log('Mobile Landscape Active:', {
          width: window.innerWidth,
          height: window.innerHeight,
          isLandscape,
          isMobile
        });
      }
    };

    handleOrientationChange(); // Initial check before paint
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      // Clean up classes on unmount
      document.documentElement.classList.remove('mobile-landscape');
      document.body.classList.remove('mobile-landscape');
    };
  }, []); // setIsPortrait is stable

  // Effect to highlight last two moves with full path visualization
  useEffect(() => {
    // Clear highlights if no history or game is over/in replay
    if (gameHistory.length === 0 || gameOver || isReplayMode) {
      setLastMoveHighlights({});
      return;
    }

    let highlights = {};

    // Previous move (pink) - second to last move
    if (gameHistory.length >= 2) {
      const prevMove = gameHistory[gameHistory.length - 2].move;
      if (prevMove && prevMove.from && prevMove.to) {
        // Get the full path for the previous move
        const prevPath = getMovePath(prevMove);
        const prevHighlights = createPathHighlights(
          prevPath,
          'rgba(225, 26, 236, 0.5)' // Pink with 50% opacity
        );
        highlights = mergeHighlights(highlights, prevHighlights);
      }
    }

    // Last move (green) - most recent move (overwrites yellow if same square)
    if (gameHistory.length >= 1) {
      const lastMove = gameHistory[gameHistory.length - 1].move;
      if (lastMove && lastMove.from && lastMove.to) {
        // Get the full path for the last move
        const lastPath = getMovePath(lastMove);
        const lastHighlights = createPathHighlights(
          lastPath,
          'rgba(0, 255, 0, 0.4)' // Green with 40% opacity
        );
        highlights = mergeHighlights(highlights, lastHighlights);
      }
    }

    setLastMoveHighlights(highlights);
  }, [gameHistory, gameOver, isReplayMode]);

  // Effect for auto-saving game on page navigation/unload
  useEffect(() => {
    const handleBeforeUnload = async (event) => {
      // Only save if game is active and has history
      if (gameStarted && !gameOver && gameHistory.length > 0) {
        try {
          // RATED GAME: Auto-resign if user tries to close browser
          if (ratedMode === 'rated') {
            console.log('[PlayComputer] 🚨 RATED GAME FORFEITED - Browser close/refresh detected');

            // Auto-resign the game (this will be processed even if page unloads)
            if (backendGame && user) {
              try {
                gameService.resign(backendGame.id);
                console.log('[PlayComputer] 🏳️ Auto-resigned from backend game:', backendGame.id);
              } catch (error) {
                console.error('[PlayComputer] ❌ Failed to auto-resign from backend:', error);
              }
            }

            // Show warning message
            event.preventDefault();
            event.returnValue = '⚠️ RATED GAME FORFEITED!\n\nYou have forfeited this rated game by closing/leaving.\nThis counts as a LOSS and will affect your rating.';
            return event.returnValue;
          }

          // CASUAL GAME: Save for later resumption
          const gameState = {
            fen: game.fen(),
            pgn: game.pgn(),
            moves: gameHistory,
            playerColor: playerColor,
            opponentName: syntheticOpponent?.name || 'Computer',
            gameMode: 'computer',
            computerLevel: computerDepth,
            timerState: {
              whiteTime: playerColor === 'w' ? playerTime : computerTime,
              blackTime: playerColor === 'b' ? playerTime : computerTime,
              whiteMs: playerColor === 'w' ? playerTime * 1000 : computerTime * 1000,
              blackMs: playerColor === 'b' ? playerTime * 1000 : computerTime * 1000
            },
            turn: game.turn(),
            savedReason: 'navigation'
          };

          // For guest users, use the tracked game ID
          let saveGameId = null;
          if (!user) {
            saveGameId = currentGameId || `local_${Date.now()}`;
          }

          // Save to localStorage synchronously for beforeunload (can't use async)
          const result = saveUnfinishedGame(gameState, !!user, saveGameId, null);
          console.log('[PlayComputer] 📂 Auto-saving on navigation:', result);

          // Show user a brief message (though might not be visible due to page unload)
          event.returnValue = 'Your game will be saved and can be resumed later.';
          return event.returnValue;
        } catch (error) {
          console.error('[PlayComputer] ❌ Failed to auto-save on navigation:', error);
        }
      }
    };

    const handleVisibilityChange = async () => {
      // Save when page becomes hidden (user switches tabs, minimizes browser)
      if (document.hidden && gameStarted && !gameOver && gameHistory.length > 0) {
        try {
          const gameState = {
            fen: game.fen(),
            pgn: game.pgn(),
            moves: gameHistory,
            playerColor: playerColor,
            opponentName: syntheticOpponent?.name || 'Computer',
            gameMode: 'computer',
            computerLevel: computerDepth,
            timerState: {
              whiteTime: playerColor === 'w' ? playerTime : computerTime,
              blackTime: playerColor === 'b' ? playerTime : computerTime,
              whiteMs: playerColor === 'w' ? playerTime * 1000 : computerTime * 1000,
              blackMs: playerColor === 'b' ? playerTime * 1000 : computerTime * 1000
            },
            turn: game.turn(),
            savedReason: 'visibility_change'
          };

          // For guest users, use the tracked game ID
          let saveGameId = null;
          if (!user) {
            saveGameId = currentGameId || `local_${Date.now()}`;
          }

          const result = await saveUnfinishedGame(gameState, !!user, saveGameId, null);
            console.log('[PlayComputer] 👁 Auto-saving on visibility change:', result);

          // Invalidate cache to refresh unfinished games
          if (invalidateGameHistory) {
            invalidateGameHistory();
          }
        } catch (error) {
          console.error('[PlayComputer] ❌ Failed to auto-save on visibility change:', error);
        }
      }
    };

    // Add event listeners for auto-save functionality
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameStarted, gameOver, gameHistory, playerColor, computerDepth, playerTime, computerTime, game, saveUnfinishedGame, user, invalidateGameHistory, currentGameId, ratedMode, backendGame]); // Dependencies for auto-save

  // Effect for in-app navigation protection (rated games only)
  useEffect(() => {
    const handleNavigationClick = (event) => {
      // Only block navigation for rated games that are in progress
      if (ratedMode !== 'rated' || !gameStarted || gameOver || isReplayMode) {
        return; // Allow navigation for casual games or when game is over
      }

      // Check if the click target or any parent is a navigation link
      let target = event.target;
      let isNavigationClick = false;
      let navigationPath = null;

      // Traverse up the DOM tree to find navigation elements
      while (target && target !== document.documentElement) {
        // Check for navigation buttons, links, or elements with navigation keywords
        const elementText = target.textContent?.toLowerCase() || '';
        const className = target.className?.toLowerCase() || '';
        const href = target.href || target.getAttribute('href') || '';

        // Navigation patterns to detect
        const navPatterns = [
          'dashboard', 'lobby', 'learn', 'championship', 'profile',
          'settings', 'history', 'home', 'leaderboard'
        ];

        const isNavElement = navPatterns.some(pattern =>
          elementText.includes(pattern) ||
          className.includes(pattern) ||
          href.includes(pattern)
        );

        if (isNavElement || target.tagName === 'A' || target.role === 'button') {
          isNavigationClick = true;
          navigationPath = href || elementText || 'page';
          break;
        }

        target = target.parentElement;
      }

      if (isNavigationClick) {
        console.log('[PlayComputer] 🚫 Navigation blocked for rated game:', navigationPath);
        event.preventDefault();
        event.stopPropagation();

        // Store the navigation path and show warning modal
        setPendingNavigation(navigationPath);
        setShowNavigationWarning(true);
      }
    };

    // Add event listener in capture phase to intercept before React Router
    if (ratedMode === 'rated' && gameStarted && !gameOver && !isReplayMode) {
      document.addEventListener('click', handleNavigationClick, true);
      console.log('[PlayComputer] 🔒 Navigation protection enabled for rated game');
    }

    return () => {
      document.removeEventListener('click', handleNavigationClick, true);
    };
  }, [ratedMode, gameStarted, gameOver, isReplayMode]);

  useEffect(() => {
    if (location.state?.gameMode === 'online') {
      const { player1, player2 } = location.state;
      setIsOnlineGame(true);

      // Randomly assign colors
      const colors = ['w', 'b'];
      const userColor = colors.splice(Math.floor(Math.random() * colors.length), 1)[0];
      const opponentColor = colors[0];

      setPlayerColor(userColor);
      setBoardOrientation(userColor === 'w' ? 'white' : 'black');

      setPlayers({
        [userColor]: player1,
        [opponentColor]: player2,
      });

      startGame();
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle synthetic player mode (from lobby challenge or matchmaking)
  useEffect(() => {
    if (location.state?.gameMode === 'synthetic' && location.state?.syntheticPlayer) {
      const bot = location.state.syntheticPlayer;
      console.log('[PlayComputer] Setting up synthetic opponent:', bot.name, 'level:', bot.computer_level);

      setSyntheticOpponent(bot);

      // Set difficulty to the bot's level
      if (bot.computer_level) {
        setComputerDepth(bot.computer_level);
        localStorage.setItem('computerDepth', bot.computer_level.toString());
      }

      // Apply preferred color from lobby color selection
      if (location.state.preferredColor) {
        const color = location.state.preferredColor === 'black' ? 'b' : 'w';
        setPlayerColor(color);
        localStorage.setItem('playerColor', color);
      }

      // If a backend game was already created by matchmaking, use its ID
      if (location.state.backendGameId) {
        setCurrentGameId(location.state.backendGameId);
      }

      // Skip countdown — go straight into the game
      onCountdownFinish();
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle resuming unfinished games
  useEffect(() => {
    console.log('[PlayComputer] 🔍 Resume check triggered, location.state:', location.state);
    const gameState = location.state?.gameState;

    if (!gameState?.isResume) {
      console.log('[PlayComputer] No resume state found or not isResume');
      return;
    }

    console.log('[PlayComputer] 📂 Resuming unfinished game:', gameState);

    try {
      // Restore game state from FEN
      const restoredGame = new Chess(gameState.fen);
      setGame(restoredGame);

      // Restore player color and board orientation
      // Normalize playerColor to chess notation ('w' or 'b')
      const normalizedPlayerColor = gameState.playerColor === 'white' || gameState.playerColor === 'w' ? 'w' : 'b';
      setPlayerColor(normalizedPlayerColor);
      setBoardOrientation(normalizedPlayerColor === 'w' ? 'white' : 'black');

      // Restore computer difficulty
      setComputerDepth(gameState.computerLevel || DEFAULT_DEPTH);

      // Restore game history
      if (gameState.moves && Array.isArray(gameState.moves)) {
        setGameHistory(gameState.moves);
        setMoveCount(gameState.moves.length);
      }

      // Restore scores (if saved, though currently not)
      if (gameState.playerScore !== undefined) {
        setPlayerScore(gameState.playerScore);
      }
      if (gameState.opponentScore !== undefined) {
        setComputerScore(gameState.opponentScore);
      }

      // Restore timers
      const restoredTimerState = gameState.timerState;
      if (restoredTimerState) {
        const whiteTime = restoredTimerState.whiteMs / 1000;
        const blackTime = restoredTimerState.blackMs / 1000;
        if (normalizedPlayerColor === 'w') {
          setPlayerTime(whiteTime);
          setComputerTime(blackTime);
        } else {
          setPlayerTime(blackTime);
          setComputerTime(whiteTime);
        }
      }

      // Restore game ID to prevent creating a new ID when pausing again
      if (gameState.id) {
        setCurrentGameId(gameState.id);
      }

      // Start the game
      setGameStarted(true);
      setGameStatus("Game resumed!");
      // Start timer for appropriate side
      const currentTurn = restoredGame.turn();
      const playerColorChess = normalizedPlayerColor;
      const computerColor = playerColorChess === 'w' ? 'b' : 'w';

      if (currentTurn === playerColorChess) {
        // Player's turn
        setActiveTimer(playerColorChess);
        setIsTimerRunning(true);
        startTimerInterval();
        moveStartTimeRef.current = performance.now();
      } else {
        // Computer's turn - trigger computer move
        setActiveTimer(computerColor);
        setIsTimerRunning(true);
        startTimerInterval();
        // Trigger computer move after a short delay
        setTimeout(() => {
          setComputerMoveInProgress(true);
        }, 500);
      }

        } catch (error) {
      console.error('[PlayComputer] ❌ Error resuming game:', error);
      setGameStatus("Error resuming game. Please start a new game.");
    }

    // Clear the resume state to prevent re-triggering
    window.history.replaceState({}, document.title);
    console.log('[PlayComputer] 🧹 Cleared resume state from history');
  }, [location.state?.gameState?.isResume, location.state?.gameState?.fen, location.pathname]); // More specific dependencies

  // Effect for loading saved game histories on component mount
  useEffect(() => {
    const loadSavedGames = async () => {
        if (typeof getGameHistories !== 'function') {
             console.warn("getGameHistories function not available.");
             return;
        }
        try {
            const games = await getGameHistories();
            // Ensure games is an array before sorting
            if(Array.isArray(games)) {
                 const sortedGames = games.sort(
                    (a, b) => new Date(b.played_at || b.date || 0) - new Date(a.played_at || a.date || 0) // Handle potentially missing dates
                );
                setSavedGames(sortedGames); // setSavedGames is stable
            } else {
                console.warn("getGameHistories did not return an array.");
                setSavedGames([]);
            }
        } catch(error) {
            console.error("Error loading game histories:", error);
            setSavedGames([]);
        }
    };
    loadSavedGames();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect for updating the TimerButton's appearance based on game state
  useEffect(() => {
    if (gameOver) {
        setTimerButtonText("Game Over");
        setTimerButtonColor("grey");
    } else if (!gameStarted) {
        setTimerButtonText("Start Game");
        setTimerButtonColor("green");
    } else if (isReplayMode) {
        setTimerButtonText(replayPaused ? "Replay Paused" : "Replaying...");
        setTimerButtonColor("blue"); // Or another appropriate color for replay
    } else if (activeTimer === playerColor) {
        // Player's turn
        if (settings.requireDoneButton) {
            setTimerButtonText(moveCompleted ? "Done" : "Your Move");
            setTimerButtonColor(moveCompleted ? "green" : "grey");
        } else {
             setTimerButtonText("Your Move"); // No button press needed
             setTimerButtonColor("blue"); // Or grey
        }
    } else if (activeTimer === (playerColor === "w" ? "b" : "w")) {
        // Computer's turn
        setTimerButtonText("Computer's Turn");
        setTimerButtonColor(computerMoveInProgress ? "yellow" : "red"); // Yellow while thinking, Red while waiting?
    } else {
        // Initial state or between turns briefly
        setTimerButtonText("...");
        setTimerButtonColor("grey");
    }
  }, [activeTimer, playerColor, moveCompleted, computerMoveInProgress, gameStarted, gameOver, isReplayMode, replayPaused, settings.requireDoneButton]);

  // --- Timer Button Press / Auto-Confirm (if requireDoneButton setting is enabled) ---
   const handleTimerButtonPress = useCallback(() => {
    // Only acts if the setting requires it, it's player's turn, and move is made
    if (
      gameStarted &&
      !gameOver &&
      activeTimer === playerColor &&
      moveCompleted &&
      settings.requireDoneButton
    ) {
      console.log("Player confirms move via Done button.");
      const computerColor = playerColor === "w" ? "b" : "w";
      switchTimer(computerColor); // Switch timer to computer
      startTimerInterval(); // Start computer's timer
      setMoveCompleted(false); // Reset move completed flag for next player turn
    } else {
      // console.log("Timer button pressed but conditions not met/setting disabled");
    }
   }, [ // Dependencies for handleTimerButtonPress
     gameStarted, gameOver, activeTimer, playerColor, moveCompleted,
     settings.requireDoneButton, // Read from settings state
     switchTimer, startTimerInterval, // Stable timer functions
     setMoveCompleted // Stable state setter
   ]);

   // Effect for auto-confirming move after a delay if requireDoneButton is on
   useEffect(() => {
    let autoConfirmTimeout = null;
    if (settings.requireDoneButton && moveCompleted && activeTimer === playerColor && !gameOver) {
      // console.log("Starting auto-confirm timeout...");
      autoConfirmTimeout = setTimeout(() => {
        // console.log("Auto-confirm triggered.");
        // Check conditions again in case state changed during timeout
        if (moveCompleted && activeTimer === playerColor && !gameOver) {
          handleTimerButtonPress();
        }
      }, 3000); // 3 second auto-confirm delay
    }
    // Cleanup function to clear timeout if dependencies change or component unmounts
    return () => {
        if(autoConfirmTimeout) {
            // console.log("Clearing auto-confirm timeout.");
            clearTimeout(autoConfirmTimeout);
        }
    };
   }, [moveCompleted, settings.requireDoneButton, activeTimer, playerColor, gameOver, handleTimerButtonPress]);

  // --- Player Move Timing ---
  useEffect(() => {
    // Record the start time when it becomes the player's turn to move
    if (gameStarted && !gameOver && activeTimer === playerColor && !moveCompleted) {
      moveStartTimeRef.current = Date.now();
    }
  }, [gameStarted, gameOver, activeTimer, playerColor, moveCompleted]);


  // --- Computer Turn Logic ---
  useEffect(() => {
    const computerColor = playerColor === 'w' ? 'b' : 'w';

    // Define the async function inside useEffect to perform the computer's turn
    const performComputerTurn = async () => {
        setComputerMoveInProgress(true); // Indicate computer is "thinking" (calculation + potential delay)
        // TimerButton useEffect will set color to yellow based on this flag

        try {
          

          // Call the utility function to get Stockfish's move based on time control
          // This function now handles the engine interaction and returns actual thinking time
          const result = await monitorPerformance('Computer Move Calculation', async () => {
            return await makeComputerMove(
              game,             // Current game state
              computerDepth,    // Difficulty level (used for time mapping)
              computerColor,    // Computer's color
              setTimerButtonColor // Pass setter for internal feedback (optional usage)
            );
          });

           // Double-check game state *after* the async calculation returns
           // In case the game was reset, ended, or switched to replay while waiting
           if (gameOver || !gameStarted || isReplayMode) {
                
                setComputerMoveInProgress(false);
                return; // Exit early
            }

          if (result) {
            // Move calculation was successful (or fallback occurred)
            const { newGame, thinkingTime } = result; // Get the new game state and actual engine time

            // *** Artificial Delay Logic ***
            // Calculate if an extra delay is needed to meet the minimum perceived time
            const delayNeeded = Math.max(0, MIN_PERCEIVED_COMPUTER_THINK_TIME - thinkingTime);

            if (delayNeeded > 0) {
              
              // Wait for the calculated delay duration
              await new Promise((res) => setTimeout(res, delayNeeded));

               // Check state *again* after the artificial delay
               if (gameOver || !gameStarted || isReplayMode) {
                    
                    setComputerMoveInProgress(false);
                    return; // Exit early
               }
            } else {
                // console.log(`No artificial delay needed (Actual: ${thinkingTime}ms >= MinPerceived: ${MIN_PERCEIVED_COMPUTER_THINK_TIME}ms)`);
            }

            // --- Apply the move and update game state ---
            setGame(newGame); // Update the board state
            playSound(moveSoundEffect); // Play move sound
            if (newGame.isCheck()) {
              playSound(checkSoundEffect); // Play check sound if applicable
            }

            // Update game status message and check for game over
            const status = typeof updateGameStatus === 'function'
                ? updateGameStatus(newGame, setGameStatus)
                : { gameOver: newGame.isGameOver(), statusText: newGame.isGameOver() ? 'Game Over' : '' }; // Basic fallback

            setMoveCount((prev) => prev + 1); // Increment move count

            // Check if the computer's move ended the game
            if (status.gameOver) {
              // Evaluate the computer's final move before ending the game
              const prev = previousGameStateRef.current;
              const compEval = typeof evaluateMove === 'function'
                ? evaluateMove(result.newGame.history().slice(-1)[0], prev, newGame, (thinkingTime/1000), user?.rating || DEFAULT_RATING, setLastComputerEvaluation, setComputerScore, computerDepth)
                : null;

              // Calculate final computer score synchronously (state updates are async)
              const finalComputerScore = computerScore + (compEval?.total || 0);

              // Get the most recent game history before calling complete
              await handleGameComplete(gameHistory, status, playerScore, finalComputerScore);
            } else {
              // Game continues: Switch turn back to the player
              setMoveCompleted(false); // Player hasn't made their move yet
              switchTimer(playerColor); // Switch active timer to player
              startTimerInterval(); // Start player's clock
              moveStartTimeRef.current = Date.now(); // Record start of player's thinking time

              // Evaluate computer's move
              const prev = previousGameStateRef.current;
              const compEval = typeof evaluateMove === 'function'
                ? evaluateMove(result.newGame.history().slice(-1)[0], prev, newGame, (thinkingTime/1000), user?.rating || DEFAULT_RATING, setLastComputerEvaluation, setComputerScore, computerDepth) // Use slice(-1)[0] for safety
                : null;

              // *** Add computer's move to gameHistory state ***
              const computerMoveResult = result.newGame.history({ verbose: true }).slice(-1)[0]; // Get the last move object
              if (computerMoveResult) {
                  const computerHistoryEntry = {
                      moveNumber: Math.floor(gameHistory.length / 2) + 1, // Calculate move number based on current history length
                      fen: prev ? prev.fen() : game.fen(), // FEN before computer's move
                      move: computerMoveResult, // The move object from chess.js
                      playerColor: computerColor, // Computer's color
                      timeSpent: thinkingTime / 1000, // Actual thinking time in seconds
                      evaluation: compEval, // Store evaluation result
                  };
                  // Use functional update to ensure we're using the latest history state
                  setGameHistory(prevHistory => {
                      const newHistory = [...prevHistory, computerHistoryEntry];
                      // Update undo availability - can undo after complete turns
                      const newCanUndo = newHistory.length >= 2;
                      console.log('[PlayComputer] 🔄 Computer move completed, updating canUndo:', {
                          newHistoryLength: newHistory.length,
                          newCanUndo
                      });
                      setCanUndo(newCanUndo);
                      return newHistory;
                  });
              } else {
                  console.warn("Could not retrieve computer's move object from history to save.");
              }
            }

          } else {
            // makeComputerMove returned null (e.g., error with no fallback possible)
            console.error("makeComputerMove failed to return a valid result or fallback.");
            // Attempt to recover gracefully - maybe just switch back to player?
             const currentStatus = typeof updateGameStatus === 'function' ? updateGameStatus(game, setGameStatus) : { gameOver: game.isGameOver() };
              if (!currentStatus.gameOver) {
                   setMoveCompleted(false);
                   switchTimer(playerColor);
                   startTimerInterval();
                   moveStartTimeRef.current = Date.now();
              } else {
                  // If game somehow ended during the failed move attempt
                  await handleGameComplete(gameHistory, currentStatus, playerScore, computerScore);
              }
          }
        } catch (error) {
          // Catch unexpected errors during the whole process
          console.error("Unexpected error during computer turn execution in PlayComputer:", error);
           const currentStatus = typeof updateGameStatus === 'function' ? updateGameStatus(game, setGameStatus) : { gameOver: game.isGameOver() };
            if (!currentStatus.gameOver) {
                setMoveCompleted(false);
                switchTimer(playerColor);
                startTimerInterval();
                moveStartTimeRef.current = Date.now();
            } else {
                 await handleGameComplete(gameHistory, currentStatus, playerScore, computerScore);
            }
        } finally {
          // This block always runs, ensuring we reset the progress flag
          setComputerMoveInProgress(false);
          // The TimerButton useEffect will update color/text based on the new state
        }
      }; // End of performComputerTurn async function definition

    // --- Trigger Condition ---
    // Check if it's the computer's turn and ready to move
    if (
      gameStarted &&
      !gameOver &&
      !isReplayMode &&
      !isOnlineGame &&
      !computerMoveInProgress && // Ensure previous move isn't still processing
      game.turn() === computerColor &&
      activeTimer === computerColor // Ensure the computer's timer is active
    ) {
      performComputerTurn(); // Execute the computer's turn logic
    }

    // No cleanup function needed here because the async function checks state flags internally

  }, [ // Dependencies for the computer turn useEffect
    gameStarted, gameOver, isReplayMode, computerMoveInProgress, activeTimer, playerColor, isOnlineGame,
    game, computerDepth, gameHistory, computerScore, playerScore, user?.rating, // State values read or passed along
    handleGameComplete, playSound, switchTimer, startTimerInterval, // Stable Callbacks/Timer functions
    setGame, setGameStatus, setMoveCount, setMoveCompleted, setComputerMoveInProgress, setTimerButtonColor, // Stable Setters
    setLastComputerEvaluation, setComputerScore // Stable Setters
    // Note: makeComputerMove, updateGameStatus, evaluateMove, DEFAULT_RATING are imports/constants (stable)
  ]);


  // --- Player Move Logic (onDrop on ChessBoard) ---
   const onDrop = useCallback((sourceSquare, targetSquare) => {
        // Convert playerColor to chess.js format for comparison
        // playerColor might already be in chess.js format ('w' or 'b') or full format ('white' or 'black')
        const playerColorChess = playerColor === 'white' || playerColor === 'w' ? 'w' : 'b';

  
        // Fix for timer not being initialized - ensure activeTimer is set if game started
        if (gameStarted && !activeTimer && !gameOver && !isReplayMode) {
            console.log('🔧 [PlayComputer] Fixing uninitialized timer - setting to', playerColorChess);
            setActiveTimer(playerColorChess);
            startTimerInterval();
        }

        // Prevent move if game over, replay mode, not player's turn, or computer is thinking
        // Allow moves if game is started but timer hasn't been set yet (fallback for timer issues)
        const isTimerIssue = !activeTimer && gameStarted;
        // Simplified condition: check turn, game state, and timer issues
        if (
            gameOver ||
            isReplayMode ||
            game.turn() !== playerColorChess ||
            computerMoveInProgress ||
            (!isTimerIssue && activeTimer && activeTimer !== playerColorChess)
        ) {
            return false; // Indicate move was not accepted
        }

        // Record state before the move for history/evaluation
        const previousState = new Chess(game.fen());
        previousGameStateRef.current = previousState; // Store for potential evaluation use

        // Create a copy to try the move on
        const gameCopy = new Chess(game.fen());
        let moveResult = null; // Will hold the move object from chess.js if valid

        try {
            // Attempt the move
            moveResult = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q", // Automatically promote to queen for simplicity
            });
        } catch (error) {
            // chess.js throws error for completely invalid format, but returns null for illegal moves
            console.error('❌ [PlayComputer] Chess.js move error:', error);
            setMoveFrom(""); // Clear selection state
            setMoveSquares({});
            return false; // Indicate move failed
        }

        // Check if the move was legal (chess.js returns null for illegal moves)
        if (!moveResult) {
            setMoveFrom(""); // Clear selection state
            setMoveSquares({});
            return false; // Indicate move failed
        }

        // --- Move is Legal ---
        if (timerRef.current) clearInterval(timerRef.current); // Stop player's timer immediately
        setIsTimerRunning(false);

        playSound(moveSoundEffect); // Play move sound
        if (gameCopy.isCheck()) {
             playSound(checkSoundEffect); // Play check sound
        }

        // Calculate time taken for the move
        const moveEndTime = Date.now();
        const moveTimeInSeconds = moveStartTimeRef.current
            ? (moveEndTime - moveStartTimeRef.current) / 1000
            : 0;

        // Evaluate the move (if evaluateMove function is available)
        const evaluationResult = monitorPerformance('Move Evaluation', () => {
            return typeof evaluateMove === 'function'
                ? evaluateMove(moveResult, previousState, gameCopy, moveTimeInSeconds, user?.rating || DEFAULT_RATING, setLastMoveEvaluation, setPlayerScore, computerDepth)
                : null; // Provides feedback/scoring
        });

        // Add move to game history
        const newHistoryEntry = {
            moveNumber: Math.floor(gameHistory.length / 2) + 1,
            fen: previousState.fen(), // State *before* the move
            move: moveResult, // The move object from chess.js { san, lan, piece, captured, etc. }
            playerColor: playerColor,
            timeSpent: moveTimeInSeconds,
            evaluation: evaluationResult, // Store evaluation result
        };
        // Use functional update for history state if issues arise, otherwise direct update is fine
        const updatedHistory = [...gameHistory, newHistoryEntry];
        setGameHistory(updatedHistory);
        setMoveCount((prev) => prev + 1); // Increment move count

        // Update undo availability - don't enable until after computer responds
        // This prevents confusing UX where button is enabled but undo fails
        setCanUndo(false);

        // Update the main game state
        setGame(gameCopy);
        setMoveFrom(""); // Clear selection state
        setMoveSquares({});

        // *** AUTO-SAVE AFTER EACH MOVE ***
        const autoSaveAfterMove = async () => {
            try {
                const gameState = {
                    fen: gameCopy.fen(),
                    pgn: gameCopy.pgn(),
                    moves: [...gameHistory, newHistoryEntry],
                    playerColor: playerColor,
                    opponentName: syntheticOpponent?.name || 'Computer',
                    gameMode: 'computer',
                    computerLevel: computerDepth,
                    timerState: {
                        whiteTime: playerColor === 'w' ? playerTime : computerTime,
                        blackTime: playerColor === 'b' ? playerTime : computerTime,
                        whiteMs: playerColor === 'w' ? playerTime * 1000 : computerTime * 1000,
                        blackMs: playerColor === 'b' ? playerTime * 1000 : computerTime * 1000
                    },
                    turn: gameCopy.turn(),
                    savedReason: 'after_move'
                };

                // For guest users, update existing game with its ID
                let saveGameId = null;
                if (!user) {
                  if (!currentGameId) {
                    saveGameId = `local_${Date.now()}`;
                    setCurrentGameId(saveGameId);
                  } else {
                    saveGameId = currentGameId;
                  }
                }

                const result = await saveUnfinishedGame(gameState, !!user, saveGameId, null);
                console.log('[PlayComputer] 💾 Auto-saved after move:', result, { saveGameId });
            } catch (error) {
                console.error('[PlayComputer] ❌ Failed to auto-save after move:', error);
            }
        };

        // Execute auto-save asynchronously (don't block game flow)
        autoSaveAfterMove();

        // Check game status after the move
        const status = typeof updateGameStatus === 'function'
            ? updateGameStatus(gameCopy, setGameStatus)
            : { gameOver: gameCopy.isGameOver(), statusText: gameCopy.isGameOver() ? 'Game Over' : '' };

        if (status.gameOver) {
            // Game ended by player's move - calculate final score synchronously
            // Note: setPlayerScore was called in evaluateMove, but state updates are async
            // So we need to calculate the final score here to ensure accuracy
            const finalPlayerScore = playerScore + (evaluationResult?.total || 0);
            handleGameComplete(updatedHistory, status, finalPlayerScore, computerScore); // Pass the *final* history and current scores
        } else {
            // Game continues, prepare for computer's turn (or wait for 'Done' button)
            setMoveCompleted(true); // Mark player's move as completed for this turn
            if (!settings.requireDoneButton) {
                // If no 'Done' button needed, immediately switch to computer
                const computerColor = playerColor === "w" ? "b" : "w";
                switchTimer(computerColor);
                startTimerInterval();
                setMoveCompleted(false); // Reset for the next player move cycle
            }
            // If requireDoneButton is true, the TimerButton useEffect/handleTimerButtonPress will handle switching
        }
        return true; // Indicate move was successful
    }, [ // Dependencies for onDrop useCallback
        game, gameOver, isReplayMode, activeTimer, playerColor, computerMoveInProgress, computerDepth,
        gameHistory, settings.requireDoneButton, computerScore, playerScore, user?.rating, currentGameId, setCurrentGameId, // State reads
        playSound, handleGameComplete, switchTimer, startTimerInterval, // Stable callbacks/timer fns
        setIsTimerRunning, setLastMoveEvaluation, setPlayerScore, setGameHistory, // Stable setters
        setMoveCount, setGame, setMoveFrom, setMoveSquares, setGameStatus, setMoveCompleted, // Stable setters
        saveUnfinishedGame, user, // Auto-save dependencies
        timerRef // Ref accessed
        // Note: updateGameStatus, evaluateMove, DEFAULT_RATING are imports/constants (stable)
    ]);

  // --- Game Start/Reset/Load/Replay Logic Callbacks ---

   const startGame = useCallback(() => {
        // Show pre-game confirmation for rated mode
        if (ratedMode === 'rated') {
          const confirmed = window.confirm(
            '⚠️ RATED GAME RULES\n\n' +
            '1. You CANNOT pause the game\n' +
            '2. You CANNOT undo moves\n' +
            '3. Closing the browser will FORFEIT the game\n' +
            '4. This game will affect your rating\n\n' +
            'Do you want to start this rated game?'
          );

          if (!confirmed) {
            console.log('[PlayComputer] 🚫 User canceled rated game start');
            return; // User canceled, don't start the game
          }
        }

        // Starts the countdown if game not already started
        if (!gameStarted && !countdownActive) setCountdownActive(true);
    }, [gameStarted, countdownActive, ratedMode]); // Correct dependencies

   const onCountdownFinish = useCallback(async () => {
        // Initializes game state when countdown finishes
        console.log("Starting game...");
        setCountdownActive(false);

        // For authenticated users, create a backend game
        if (user) {
          try {
            setGameStatus("Creating game on server...");
            const gameData = {
              player_color: playerColor === 'w' ? 'white' : 'black',
              computer_level: computerDepth,
              time_control: 10, // Default 10 minutes
              increment: 0 // No increment by default
            };

            const response = await gameService.createComputerGame(gameData);
            console.log('[PlayComputer] 🎮 Backend game created:', response);

            setBackendGame(response.game);
            setCurrentGameId(response.game.id);
            setGameStatus(`Game created! Playing vs ${response.computer_opponent.name}`);
          } catch (error) {
            console.error('[PlayComputer] ❌ Failed to create backend game:', error);
            setGameStatus("Failed to create game. Playing offline...");
            // Continue with offline game if backend fails
          }
        }

        setGameStarted(true);
        previousGameStateRef.current = new Chess(); // Initial state for history
        setGameHistory([]);
        setMoveCount(0);
        setGameOver(false);
        setPlayerScore(0);
        setLastMoveEvaluation(null);
        setGame(new Chess()); // Reset board to starting position
        resetTimer(); // Reset timer values (ensure useGameTimer provides initial values)

        // Initialize undo chances based on difficulty and mode
        const initialUndoChances = calculateUndoChances(computerDepth, ratedMode === 'rated');
        setUndoChancesRemaining(initialUndoChances);
        console.log(`[PlayComputer] 🎮 Game started - Mode: ${ratedMode}, Difficulty: ${computerDepth}, Undo chances: ${initialUndoChances}`);

        // White always starts in chess, so set active timer to white
        setActiveTimer("w"); // White always starts
        startTimerInterval(); // Start the first timer (White's timer)
        if (playerColor === "w") {
            // If player is White, record their move start time immediately
            moveStartTimeRef.current = Date.now();
        }
        setMoveCompleted(false); // No move made yet

        // If player is black, computer (white) should move immediately
        // The computer turn useEffect will handle this automatically since:
        // - gameStarted will be true
        // - game.turn() will be 'w' (computer's color when player is black)
        // - activeTimer will be 'w'

    }, [ // Dependencies for onCountdownFinish
        playerColor, computerDepth, user, ratedMode, // Read
        setActiveTimer, startTimerInterval, resetTimer, // Stable from hook
        setGameStarted, setCountdownActive, setGameHistory, setMoveCount, setGameOver, // Stable setters
        setPlayerScore, setLastMoveEvaluation, setGame, setMoveCompleted, setGameStatus, // Stable setters
        setCurrentGameId, setBackendGame, setUndoChancesRemaining // Stable setters
    ]);

    const resetGame = useCallback(() => {
        // Resets the entire game state back to the pre-game setup screen
        console.log("Resetting game...");
        if (timerRef.current) clearInterval(timerRef.current);
        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        setGame(new Chess());
        setGameStatus("Choose difficulty and color, then press Start.");
        setMoveFrom("");
        setRightClickedSquares({});
        setMoveSquares({});
        resetTimer(); // Reset timer values and state
        setGameStarted(false);
        setCountdownActive(false);
        setMoveCompleted(false);
        setComputerMoveInProgress(false);
        setPlayerScore(0);
        setLastMoveEvaluation(null);
        moveStartTimeRef.current = null;
        previousGameStateRef.current = null;
        setGameHistory([]);
        setIsReplayMode(false);
        setReplayPaused(true);
        setCurrentReplayMove(0);
        setMoveCount(0);
        setGameOver(false);
        setShowGameCompletion(false);
        setGameResult(null); // Reset standardized result
        setBackendGame(null); // Reset backend game
        setCurrentGameId(null); // Reset current game ID
        setCanUndo(false); // Reset undo availability
        setUndoChancesRemaining(0); // Reset undo chances
        // Note: Does not reset playerColor, computerDepth, or ratedMode, keeping user selections
    }, [resetTimer, timerRef, replayTimerRef]); // Dependencies: stable hook fn and refs accessed

    const handleResign = useCallback(async () => {
        // Handle player resignation
        if (gameOver || !gameStarted || isReplayMode) {
            return; // Can't resign if game is over, not started, or in replay mode
        }

        const confirmed = window.confirm('Are you sure you want to resign?');
        if (!confirmed) {
            return;
        }

        // Stop timers
        if (timerRef.current) clearInterval(timerRef.current);
        setIsTimerRunning(false);
        setActiveTimer(null);
        setGameOver(true);
        setShowGameCompletion(true);
        setCanUndo(false); // Disable undo after resignation

        // Resign from backend game if we have one
        if (backendGame && user) {
          try {
            await gameService.resign(backendGame.id);
            console.log('[PlayComputer] 🏳️ Resigned from backend game:', backendGame.id);
          } catch (error) {
            console.error('[PlayComputer] ❌ Failed to resign from backend game:', error);
            // Continue with local resignation even if backend fails
          }
        }

        const now = new Date();

        // Encode game history
        const conciseGameString = typeof encodeGameHistory === 'function'
            ? encodeGameHistory(gameHistory)
            : JSON.stringify(gameHistory.map(h => h.move));

        // Create standardized result for resignation (player loses)
        // The winner text must match "White wins" or "Black wins" pattern for
        // createResultFromComputerGame to correctly identify win/loss status.
        const winnerColor = playerColor === 'w' ? 'Black' : 'White';
        const standardizedResult = createResultFromComputerGame(
            `${winnerColor} wins by resignation`,
            playerColor,
            { in_checkmate: false, in_stalemate: false, in_draw: false }
        );
        standardizedResult.end_reason = 'resignation';

        // Attach synthetic opponent data so GameEndCard can display name/avatar
        if (syntheticOpponent) {
            standardizedResult.opponent_name = syntheticOpponent.name;
            standardizedResult.opponent_avatar_url = syntheticOpponent.avatar_url;
            standardizedResult.opponent_rating = syntheticOpponent.rating;
        }

        console.log('🏳️ [PlayComputer] Player resigned, result:', standardizedResult);

        // Store the standardized result for GameCompletionAnimation
        setGameResult(standardizedResult);

        // Save game history
        const gameHistoryData = {
            id: `local_${Date.now()}`,
            date: now.toISOString(),
            moves: gameHistory,
            conciseGameString,
            result: standardizedResult,
            finalScore: playerScore || 0,
            computerDepth,
            playerColor,
        };

        saveGameHistory(gameHistoryData);
        invalidateGameHistory(); // Invalidate cache so dashboard shows updated games
        setGameStatus('You resigned. Game over.');
    }, [
        gameOver, gameStarted, isReplayMode, timerRef, gameHistory, playerColor,
        playerScore, computerScore, computerDepth, user?.rating, invalidateGameHistory,
        backendGame, user, syntheticOpponent
    ]);

     const resetCurrentGameSetup = useCallback(() => {
         // Prompts user before resetting an ongoing game
        if (gameStarted && moveCount > 0 && !gameOver && !isReplayMode) {
            if (window.confirm("Reset the current game? Your progress will be lost.")) {
                resetGame();
            }
        } else {
            // If game hasn't started or is over/replay, reset without confirmation
            // For guest users, this should NOT clear unfinished games - just create a fresh game
            if (!user) {
                console.log('[PlayComputer] 🆕 Starting new game for guest - NOT clearing unfinished games');
            }
            resetGame();
        }
    }, [gameStarted, moveCount, gameOver, isReplayMode, resetGame, user]); // Added user dependency

    const loadGame = useCallback((savedGameData) => {
        // Loads a previously saved game for replay
        resetGame(); // Start with a clean state
        if (!savedGameData || typeof savedGameData.moves !== "string" || typeof reconstructGameFromHistory !== 'function') {
            console.error("Invalid saved game data, missing moves string, or missing reconstruct function:", savedGameData);
            alert("Failed to load game: Invalid data format or missing utility.");
            resetGame(); // Go back to setup
            return;
        }
        console.log("Loading game for replay:", savedGameData.id || 'local game');

        setIsReplayMode(true);
        setReplayPaused(true); // Start paused
        const loadedPlayerColor = savedGameData.player_color || "w";
        setPlayerColor(loadedPlayerColor);
        setBoardOrientation(loadedPlayerColor === "w" ? "white" : "black");
        setComputerDepth(savedGameData.computer_depth || DEFAULT_DEPTH); // Restore difficulty setting

        try {
            // Reconstruct the detailed history from the concise string
            const reconstructed = reconstructGameFromHistory(savedGameData.moves);
            if (!reconstructed || !Array.isArray(reconstructed) || reconstructed.length === 0) {
                throw new Error("Reconstruction resulted in empty or invalid history");
            }
            setGameHistory(reconstructed);
            setCurrentReplayMove(0); // Start replay from the beginning index
            setGame(new Chess()); // Set board to initial state (startReplay will apply moves)
            setGameStatus(
                `Replaying game vs Level ${savedGameData.computer_depth || '?'} from ${new Date(savedGameData.played_at || savedGameData.date || Date.now()).toLocaleString()}`
            );
            // Stop any active game timer
            if (timerRef.current) clearInterval(timerRef.current);
            setIsTimerRunning(false);
            setActiveTimer(null);

        } catch (error) {
            console.error("Error reconstructing game history:", error);
            alert(`Failed to load game: ${error.message || 'Could not reconstruct moves.'}`);
            resetGame(); // Reset back to clean state on failure
        }
    }, [resetGame, setActiveTimer, setIsTimerRunning, timerRef]); // Dependencies: stable callback and imported fn

    // --- Undo Functionality ---
    const handleUndo = useCallback(() => {
        console.log('[PlayComputer] 🔧 Undo attempted:', {
            gameStarted,
            gameOver,
            isReplayMode,
            gameHistoryLength: gameHistory.length,
            canUndo,
            gameTurn: game.turn(),
            playerColor,
            computerMoveInProgress,
            undoChancesRemaining,
            ratedMode
        });

        // Undo the last move if game is active and not in replay mode
        if (!gameStarted || gameOver || isReplayMode || gameHistory.length < 2) {
            console.log('[PlayComputer] ❌ Undo blocked by initial checks');
            return; // Can't undo if game hasn't started, is over, in replay, or not enough moves
        }

        // Check if undo is allowed in rated mode
        if (ratedMode === 'rated') {
            console.log('[PlayComputer] ❌ Undo blocked - rated game');
            setGameStatus("Cannot undo in rated games!");
            return;
        }

        // Check if player has undo chances remaining
        if (undoChancesRemaining <= 0) {
            console.log('[PlayComputer] ❌ Undo blocked - no chances remaining');
            setGameStatus("No undo chances remaining!");
            return;
        }

        // Can only undo if it's the player's turn and the computer hasn't moved yet
        const playerColorChess = playerColor; // playerColor is already 'w' or 'b'

        if (game.turn() !== playerColorChess) {
            console.log('[PlayComputer] ❌ Undo blocked - not player turn');
            setGameStatus("Can only undo on your turn!");
            return;
        }

        if (computerMoveInProgress) {
            console.log('[PlayComputer] ❌ Undo blocked - computer thinking');
            setGameStatus("Cannot undo while computer is thinking...");
            return;
        }

        try {
            console.log('[PlayComputer] 🎯 Starting undo process...');

            // Reconstruct the game from the full history to ensure we have proper move history
            const gameCopy = new Chess();

            // Replay all moves except the last two (player + computer) to get the proper game state
            const movesToKeep = gameHistory.slice(0, -2); // Remove last 2 moves
            console.log('[PlayComputer] 📝 Reconstructing game with moves:', {
                totalHistory: gameHistory.length,
                movesToKeep: movesToKeep.length,
                movesToUndo: 2
            });

            // Apply all moves we want to keep
            for (const historyEntry of movesToKeep) {
                if (historyEntry.move && historyEntry.move.san) {
                    try {
                        gameCopy.move(historyEntry.move.san);
                    } catch (moveError) {
                        console.warn('[PlayComputer] ⚠️ Failed to apply move during reconstruction:', historyEntry.move.san, moveError);
                    }
                }
            }

            console.log('[PlayComputer] 📋 Game reconstructed:', {
                fen: gameCopy.fen(),
                historyLength: gameCopy.history().length,
                turn: gameCopy.turn()
            });

            // Get the last computer move and player move from history
            const lastComputerMove = gameHistory[gameHistory.length - 1];
            const lastPlayerMove = gameHistory[gameHistory.length - 2];

            console.log('[PlayComputer] 🔍 History analysis:', {
                gameHistoryLength: gameHistory.length,
                lastComputerMove: lastComputerMove ? {
                    playerColor: lastComputerMove.playerColor,
                    move: lastComputerMove.move?.san
                } : null,
                lastPlayerMove: lastPlayerMove ? {
                    playerColor: lastPlayerMove.playerColor,
                    move: lastPlayerMove.move?.san
                } : null,
                playerColorChess
            });

            if (!lastComputerMove || !lastPlayerMove || lastComputerMove.playerColor === playerColorChess) {
                console.log('[PlayComputer] ❌ Undo blocked - invalid history structure');
                setGameStatus("Cannot undo - no complete turn to undo!");
                return;
            }

            // Remove last 2 moves from history (player + computer)
            const newHistory = gameHistory.slice(0, -2);
            setGameHistory(newHistory);
            setMoveCount(Math.max(0, moveCount - 2));

            // Reset scores by removing the last evaluations
            if (lastPlayerMove.evaluation?.total) {
                setPlayerScore(prev => Math.max(0, prev - lastPlayerMove.evaluation.total));
            }
            if (lastComputerMove.evaluation?.total) {
                setComputerScore(prev => Math.max(0, prev - lastComputerMove.evaluation.total));
            }

            // Clear last move evaluations
            setLastMoveEvaluation(null);
            setLastComputerEvaluation(null);

            // Update the main game state with the reconstructed game
            console.log('[PlayComputer] ♻️ Updating game state with undone position');
            setGame(gameCopy);

            // Switch timer back to player
            setActiveTimer(playerColorChess);
            setIsTimerRunning(true);
            startTimerInterval();
            moveStartTimeRef.current = Date.now();

            setMoveCompleted(false);

            // Decrement undo chances
            const newUndoChances = undoChancesRemaining - 1;
            setUndoChancesRemaining(newUndoChances);
            console.log(`[PlayComputer] 📉 Undo chances remaining: ${newUndoChances}`);

            setGameStatus(`Last turn undone - your turn! (${newUndoChances} undo${newUndoChances !== 1 ? 's' : ''} remaining)`);
            playSound(moveSoundEffect); // Play a sound to indicate undo

            // Update undo availability
            setCanUndo(newHistory.length >= 2 && newUndoChances > 0);

            console.log('[PlayComputer] ✅ Undo completed successfully');

        } catch (error) {
            console.error('[PlayComputer] ❌ Error during undo:', error);
            setGameStatus("Failed to undo move. Please try again.");
        }
    }, [
        gameStarted, gameOver, isReplayMode, gameHistory, game, moveCount, playerColor,
        computerMoveInProgress, activeTimer, playerScore, computerScore, undoChancesRemaining, ratedMode,
        setActiveTimer, setIsTimerRunning, startTimerInterval, setGame,
        setGameHistory, setMoveCount, setMoveCompleted, setGameStatus,
        setLastMoveEvaluation, setLastComputerEvaluation, setPlayerScore,
        setComputerScore, setCanUndo, setUndoChancesRemaining, playSound
    ]);

    // --- Replay Controls ---
     const startReplay = useCallback(() => {
        // Starts or resumes the automatic replay of the loaded game
        if (!isReplayMode || !gameHistory || gameHistory.length === 0 || !replayPaused) return;
        console.log("Starting replay...");

        // Ensure board is set to the state *before* the current replay move index
        let startingFen = new Chess().fen(); // Default start
        if(currentReplayMove > 0 && gameHistory[currentReplayMove -1]) {
            // If resuming, try to get FEN after the previous move
             const tempGame = new Chess(gameHistory[0]?.fen || new Chess().fen());
             for(let i = 0; i < currentReplayMove; i++){
                 if(gameHistory[i]?.move) {
                     tempGame.move(gameHistory[i].move);
                 }
             }
             startingFen = tempGame.fen();
        } else if (gameHistory[0]?.fen) {
            // If starting from beginning, use the FEN stored before the first move
            startingFen = gameHistory[0].fen;
        }

        safeGameMutate(gameCopy => {
            gameCopy.load(startingFen); // Load the correct starting FEN
        });

        setReplayPaused(false);
        if (replayTimerRef.current) clearInterval(replayTimerRef.current); // Clear any existing interval

        // Interval to apply next move
        replayTimerRef.current = setInterval(() => {
            setCurrentReplayMove((prevIndex) => {
                const nextIndex = prevIndex; // Index of the move TO BE applied
                if (nextIndex < gameHistory.length) {
                    const moveEntry = gameHistory[nextIndex];
                    if (moveEntry && moveEntry.move) {
                        let moveApplied = false;
                        safeGameMutate((gameCopy) => {
                            // Use the move object stored in history (contains SAN, etc.)
                            const result = gameCopy.move(moveEntry.move);
                            if (!result) {
                                console.error(`Invalid move during replay at index ${nextIndex}:`, moveEntry.move);
                                clearInterval(replayTimerRef.current); // Stop replay on error
                                setReplayPaused(true);
                                setGameStatus(`Replay failed at move ${nextIndex + 1}: Invalid move.`);
                            } else {
                                moveApplied = true;
                            }
                        });

                        if (!moveApplied) {
                            return prevIndex; // Stop incrementing index if move failed
                        }

                        // Update score/evaluation display if available in history
                        if (moveEntry.evaluation) {
                           setLastMoveEvaluation(moveEntry.evaluation);
                        } else {
                           setLastMoveEvaluation(null); // Clear if no eval stored
                        }

                        setGameStatus(`Replay: Move ${nextIndex + 1}/${gameHistory.length} (${moveEntry.move.san})`);
                        return nextIndex + 1; // Move to the next index for the next interval
                    } else {
                        // Skip invalid history entry
                        console.warn(`Skipping invalid history entry during replay at index ${nextIndex}:`, moveEntry);
                        return nextIndex + 1;
                    }
                } else {
                    // Reached end of history
                    clearInterval(replayTimerRef.current);
                    setReplayPaused(true);
                    setGameStatus("Replay finished");
                    // Optionally show final score from saved game data
                    return prevIndex; // Keep index at the end
                }
            });
        }, 1000); // Replay speed: 1 move per second (adjust as needed)
    }, [isReplayMode, gameHistory, safeGameMutate, replayPaused, currentReplayMove]); // Dependencies

    const pauseReplay = useCallback(() => {
        // Pauses the automatic replay
        if(isReplayMode) {
            console.log("Pausing replay...");
            setReplayPaused(true);
            if (replayTimerRef.current) clearInterval(replayTimerRef.current);
        }
    }, [isReplayMode, replayTimerRef]); // Dependencies

  // --- UI Callbacks ---
   const handleColorToggle = useCallback(() => {
        // Toggles player color selection in pre-game setup
        if (gameStarted || isReplayMode || countdownActive) return; // Prevent change during game/countdown/replay
        const newColor = playerColor === 'w' ? 'b' : 'w';
        setPlayerColor(newColor);
        localStorage.setItem('playerColor', newColor);
        setBoardOrientation(newColor === 'w' ? "white" : "black");
    }, [gameStarted, isReplayMode, countdownActive, playerColor]); // Correct dependencies

   const handleDifficultyChange = useCallback((val) => {
        setComputerDepth(val);
        localStorage.setItem('computerDepth', val);
    }, []);

   const handleModeChange = useCallback((mode) => {
        console.log(`[PlayComputer] 🎮 Game mode changed to: ${mode}`);
        setRatedMode(mode);
        localStorage.setItem('gameRatedMode', mode);
    }, []);

   // --- Draw Handlers (Placeholder for future implementation) ---
   const handleDrawOffer = useCallback(() => {
        console.log('[PlayComputer] 🤝 Draw offer not yet implemented for computer games');
   }, []);

   const handleDrawAccept = useCallback(() => {
        console.log('[PlayComputer] ✅ Draw accept not yet implemented');
   }, []);

   const handleDrawDecline = useCallback(() => {
        console.log('[PlayComputer] ❌ Draw decline not yet implemented');
   }, []);

   const handleDrawCancel = useCallback(() => {
        console.log('[PlayComputer] 🚫 Draw cancel not yet implemented');
   }, []);

   const [drawState, setDrawState] = useState(null);

   // --- Navigation Protection Handlers ---
   const handleNavigationConfirm = useCallback(async () => {
        console.log('[PlayComputer] 🏳️ User confirmed navigation - forfeiting rated game');

        // Close the warning modal
        setShowNavigationWarning(false);

        // Resign the game
        await handleResign();

        // Navigation will proceed after game completion modal is dismissed
        // The actual navigation happens in the game completion onClose handler
   }, [handleResign]);

   const handleNavigationCancel = useCallback(() => {
        console.log('[PlayComputer] ✋ User canceled navigation - staying in game');
        setShowNavigationWarning(false);
        setPendingNavigation(null);
   }, []);

  // --- RENDER ---
  // Check feature flag for PlayShell wrapper
  const usePlayShell = process.env.REACT_APP_USE_PLAY_SHELL === 'true';

  
  const preGameSetupSection = syntheticOpponent ? null : (
    <>
      {/* Game Mode Selection */}
      {gameMode === null && (
        <div className="pre-game-setup bg-surface-card backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center">
          <h2 className="text-3xl font-bold mb-6 text-gold">Choose Your Game Mode</h2>
          <div className="flex flex-col gap-4">
            <button className="start-button large green bg-chess-green hover:bg-chess-hover text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300" onClick={() => setGameMode('computer')}>
              Play Against Computer
            </button>
            <button className="start-button large blue bg-gold hover:bg-gold-hover text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300" onClick={() => navigate('/lobby')}>
              Play Against a Friend
            </button>
          </div>
        </div>
      )}

      {/* Difficulty and Color Selection */}
      {gameMode === 'computer' && (
        <div className="pre-game-setup bg-surface-card backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center">
          <h2 className="text-3xl font-bold mb-2 text-gold">Play Against Computer</h2>

          {/* Game Mode Selector */}
          <div className="mode-selection mb-4">
            <GameModeSelector
              selectedMode={ratedMode}
              onModeChange={handleModeChange}
              disabled={countdownActive}
            />
          </div>

          <div className="difficulty-selection mb-2">
            <DifficultyMeter
              value={computerDepth}
              onChange={handleDifficultyChange}
              min={MIN_DEPTH}
              max={MAX_DEPTH}
              disabled={countdownActive}
            />
          </div>
          <div className="color-selection mb-2">
            <h3 className="text-xl font-semibold mb-2">Select Your Color:</h3>
            <label className="color-toggle-container inline-flex items-center cursor-pointer" htmlFor="color-toggle">
              <span className="mr-3">White</span>
              <div className="relative">
                <input type="checkbox" id="color-toggle" className="sr-only"
                  checked={playerColor === 'b'}
                  onChange={handleColorToggle}
                  disabled={countdownActive} />
                <div className="w-14 h-8 bg-surface-elevated rounded-full"></div>
                <div className={`dot absolute top-1 bg-white w-6 h-6 rounded-full transition ${playerColor === 'b' ? 'left-7' : 'left-1'}`}></div>
              </div>
              <span className="ml-3">Black</span>
            </label>
          </div>
          {!countdownActive && (
            <button className="start-button large green bg-chess-green hover:bg-chess-hover text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300" onClick={startGame} disabled={countdownActive}>
              Start Game
            </button>
          )}
          {countdownActive && (
            <div className="countdown-in-setup">
              <p className="text-xl mb-2">Starting in...</p>
              <Countdown startValue={3} onCountdownFinish={onCountdownFinish} />
            </div>
          )}
        </div>
      )}
    </>
  );

  const gameContainerSection = (
    <GameContainer
      mode="computer"
      timerData={{
        playerTime,
        computerTime,
        activeTimer,
        playerColor,
        isTimerRunning,
        playerScore,
        computerScore,
        showScores: true,
        playerData: user ? {
          name: user.name || user.username || 'You',
          avatar_url: user.avatar_url || user.avatar
        } : null,
        opponentData: syntheticOpponent
          ? {
              name: syntheticOpponent.name,
              avatar_url: syntheticOpponent.avatar_url,
              rating: syntheticOpponent.rating,
              personality: syntheticOpponent.personality,
            }
          : {
              name: 'Computer',
              avatar_url: null // Computer uses emoji 🤖 instead
            }
      }}
      gameData={{
        game,
        gameHistory,
        gameStatus,
        moveCompleted,
        isReplayMode,
        currentReplayMove,
        settings,
        isOnlineGame,
        players
      }}
      sidebarData={{
        lastMoveEvaluation,
        lastComputerEvaluation
      }}
      controlsData={{
        gameStarted,
        countdownActive,
        resetGame: resetCurrentGameSetup,
        startGame,
        handleTimer: startTimerInterval,
        pauseTimer: handlePauseWithSave, // Enhanced pause with auto-save
        handleResign,
        handleUndo,
        canUndo,
        undoChancesRemaining,
        handleDrawOffer,
        handleDrawAccept,
        handleDrawDecline,
        handleDrawCancel,
        drawState,
        ratedMode,
        currentGameId,
        replayPaused,
        startReplay,
        pauseReplay,
        savedGames,
        loadGame,
        moveCount,
        playerColor,
        onColorChange: handleColorToggle,
        replayTimerRef,
        timerButtonColor,
        timerButtonText,
        handleTimerButtonPress,
        gameOver,
        isPortrait
      }}
    >
      <ChessBoard
        game={game}
        boardOrientation={boardOrientation}
        onDrop={onDrop}
        moveFrom={moveFrom}
        setMoveFrom={setMoveFrom}
        rightClickedSquares={rightClickedSquares}
        setRightClickedSquares={setRightClickedSquares}
        moveSquares={moveSquares}
        setMoveSquares={setMoveSquares}
        lastMoveHighlights={lastMoveHighlights}
        playerColor={playerColor}
        isReplayMode={isReplayMode}
      />
    </GameContainer>
  );

  // const controlsSection = (
  //   {/* Compact Timer Display Above Board */}
  //   <>
  //               <div style={{
  //                 display: 'flex',
  //                 flexDirection: 'column',
  //                 marginBottom: '12px',
  //                 gap: '8px',
  //                 fontSize: '14px'
  //               }}>
  //                 {/* Player Info Row: You are & Turn */}
  //                 <div style={{
  //                   display: 'flex',
  //                   justifyContent: 'space-between',
  //                   alignItems: 'center',
  //                   padding: '4px 8px',
  //                   backgroundColor: 'rgba(255, 255, 255, 0.05)',
  //                   borderRadius: '4px',
  //                   fontSize: '12px',
  //                   color: '#ccc'
  //                 }}>
  //                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  //                     <span>{playerColor === 'w' ? '⚪' : '⚫'}</span>
  //                     <span>You are {playerColor === 'w' ? 'White' : 'Black'}</span>
  //                   </div>
  //                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  //                     <span>Turn:</span>
  //                     <span>{game?.turn() === 'w' ? '⚪ White' : '⚫ Black'}</span>
  //                   </div>
  //                 </div>

  //                 {/* Timer Row */}
  //                 <div style={{
  //                   display: 'flex',
  //                   justifyContent: 'space-between',
  //                   alignItems: 'center',
  //                   gap: '8px'
  //                 }}>
  //                   {/* Computer Timer - Compact */}
  //                   <div style={{
  //                     display: 'flex',
  //                     alignItems: 'center',
  //                     gap: '6px',
  //                     padding: '6px 10px',
  //                     borderRadius: '6px',
  //                     backgroundColor: activeTimer === (playerColor === 'w' ? 'b' : 'w') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  //                     border: `1px solid ${activeTimer === (playerColor === 'w' ? 'b' : 'w') ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
  //                     flex: '1',
  //                     minWidth: '120px'
  //                   }}>
  //                     <span style={{ fontSize: '16px', color: activeTimer === (playerColor === 'w' ? 'b' : 'w') ? '#ef4444' : '#ccc' }}>
  //                       {activeTimer === (playerColor === 'w' ? 'b' : 'w') && (
  //                         <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
  //                       )}
  //                       🤖
  //                     </span>
  //                     <span style={{
  //                       fontFamily: 'monospace',
  //                       fontSize: '14px',
  //                       fontWeight: 'bold',
  //                       color: activeTimer === (playerColor === 'w' ? 'b' : 'w') ? '#ef4444' : '#ccc',
  //                       marginLeft: 'auto'
  //                     }}>
  //                       {formatTime(computerTime)}
  //                     </span>
  //                   </div>

  //                   {/* VS separator */}
  //                   <div style={{
  //                     fontSize: '12px',
  //                     color: '#666',
  //                     fontWeight: 'bold',
  //                     padding: '0 4px'
  //                   }}>
  //                     VS
  //                   </div>

  //                   {/* Player Timer - Compact */}
  //                   <div style={{
  //                     display: 'flex',
  //                     alignItems: 'center',
  //                     gap: '6px',
  //                     padding: '6px 10px',
  //                     borderRadius: '6px',
  //                     backgroundColor: activeTimer === playerColor ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  //                     border: `1px solid ${activeTimer === playerColor ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
  //                     flex: '1',
  //                     minWidth: '120px'
  //                   }}>
  //                     <span style={{ fontSize: '16px', color: activeTimer === playerColor ? '#22c55e' : '#ccc' }}>
  //                       {activeTimer === playerColor && (
  //                         <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
  //                       )}
  //                       👤
  //                     </span>
  //                     <span style={{
  //                       fontFamily: 'monospace',
  //                       fontSize: '14px',
  //                       fontWeight: 'bold',
  //                       color: activeTimer === playerColor ? '#22c55e' : '#ccc',
  //                       marginLeft: 'auto'
  //                     }}>
  //                       {formatTime(playerTime)}
  //                     </span>
  //                   </div>
                    
  //                 </div>
  //                 <ScoreDisplay playerScore={playerScore} lastMoveEvaluation={lastMoveEvaluation} computerScore={computerScore} lastComputerEvaluation={lastComputerEvaluation} isOnlineGame={isOnlineGame} players={players} playerColor={playerColor} />
              
  //               </div>
          
  //               <div style={{
  //                 display: 'flex',
  //                 justifyContent: 'center',
  //                 alignItems: 'center',
  //                 marginTop: '12px',
  //                 gap: '10px',
  //                 flexWrap: 'wrap'
  //               }}>
  //                 {/* Pause/Resume Button (In-Game) */}
  //                 {!isReplayMode && gameStarted && (
  //                   <button
  //                     onClick={() => {
  //                       if (isTimerRunning) {
  //                         pauseTimer();
  //                       } else {
  //                         startTimerInterval();
  //                       }
  //                     }}
  //                     style={{
  //                       padding: '8px 16px',
  //                       fontSize: '14px',
  //                       fontWeight: '500',
  //                       borderRadius: '6px',
  //                       border: '1px solid rgba(255, 255, 255, 0.3)',
  //                       backgroundColor: isTimerRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
  //                       color: isTimerRunning ? '#ef4444' : '#22c55e',
  //                       cursor: 'pointer',
  //                       transition: 'all 0.2s'
  //                     }}
  //                   >
  //                     {isTimerRunning ? '⏸️ Pause' : '▶️ Resume'}
  //                   </button>
  //                 )}

  //                 {/* Replay Controls */}
  //                 {isReplayMode && (
  //                   <>
  //                     <button
  //                       onClick={() => {
  //                         replayPaused ? startReplay() : pauseReplay();
  //                       }}
  //                       style={{
  //                         padding: '8px 16px',
  //                         fontSize: '14px',
  //                         fontWeight: '500',
  //                         borderRadius: '6px',
  //                         border: '1px solid rgba(255, 255, 255, 0.3)',
  //                         backgroundColor: replayPaused ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
  //                         color: replayPaused ? '#22c55e' : '#ef4444',
  //                         cursor: 'pointer',
  //                         transition: 'all 0.2s'
  //                       }}
  //                     >
  //                       {replayPaused ? '▶️ Continue' : '⏸️ Pause'}
  //                     </button>
  //                     <button
  //                       onClick={resetCurrentGameSetup}
  //                       style={{
  //                         padding: '8px 16px',
  //                         fontSize: '14px',
  //                         fontWeight: '500',
  //                         borderRadius: '6px',
  //                         border: '1px solid rgba(255, 255, 255, 0.3)',
  //                         backgroundColor: 'rgba(239, 68, 68, 0.2)',
  //                         color: '#ef4444',
  //                         cursor: 'pointer',
  //                         transition: 'all 0.2s'
  //                       }}
  //                     >
  //                       🚪 Exit Replay
  //                     </button>
  //                   </>
  //                 )}
  //               </div>
  //   </>
  // );
    

  const modalsSection = (
    <>
        {/* Navigation Warning Modal - Rated Game */}
        {showNavigationWarning && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}
            onClick={(e) => {
              // Close modal if clicking outside the content
              if (e.target === e.currentTarget) {
                handleNavigationCancel();
              }
            }}
          >
            <div
              style={{
                backgroundColor: '#312e2b',
                borderRadius: window.innerWidth <= 480 ? '12px' : '16px',
                padding: window.innerWidth <= 480 ? '20px' : '32px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                border: '2px solid #e8a93e'
              }}
            >
              {/* Warning Icon */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: window.innerWidth <= 480 ? '16px' : '24px'
              }}>
                <div style={{
                  width: window.innerWidth <= 480 ? '56px' : '80px',
                  height: window.innerWidth <= 480 ? '56px' : '80px',
                  borderRadius: '50%',
                  backgroundColor: '#3d3a37',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: window.innerWidth <= 480 ? '32px' : '48px'
                }}>
                  ⚠️
                </div>
              </div>

              {/* Title */}
              <h2 style={{
                color: '#e8a93e',
                fontSize: window.innerWidth <= 480 ? '22px' : '28px',
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                Leave Rated Game?
              </h2>

              {/* Warning Message */}
              <div style={{
                backgroundColor: '#3d3a37',
                borderLeft: '4px solid #e8a93e',
                padding: window.innerWidth <= 480 ? '12px' : '16px',
                borderRadius: '8px',
                marginBottom: window.innerWidth <= 480 ? '16px' : '24px'
              }}>
                <p style={{
                  color: '#e8a93e',
                  fontSize: window.innerWidth <= 480 ? '14px' : '16px',
                  fontWeight: '600',
                  marginBottom: '12px'
                }}>
                  If you leave this rated game now:
                </p>
                <ul style={{
                  color: '#bababa',
                  fontSize: window.innerWidth <= 480 ? '13px' : '14px',
                  paddingLeft: '20px',
                  margin: 0
                }}>
                  <li style={{ marginBottom: '6px' }}>The game will be marked as RESIGNED</li>
                  <li style={{ marginBottom: '6px' }}>This will count as a LOSS</li>
                  <li style={{ marginBottom: '6px' }}>Your rating will DECREASE</li>
                  <li>The game cannot be resumed later</li>
                </ul>
              </div>

              {/* Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexDirection: window.innerWidth <= 480 ? 'column' : 'row'
              }}>
                {/* Stay in Game Button */}
                <button
                  onClick={handleNavigationCancel}
                  style={{
                    flex: 1,
                    padding: window.innerWidth <= 480 ? '12px 20px' : '14px 24px',
                    fontSize: window.innerWidth <= 480 ? '14px' : '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#81b64c',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(129, 182, 76, 0.3)',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#4e7837';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#81b64c';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  Stay in Game
                </button>

                {/* Forfeit & Leave Button */}
                <button
                  onClick={handleNavigationConfirm}
                  style={{
                    flex: 1,
                    padding: window.innerWidth <= 480 ? '12px 20px' : '14px 24px',
                    fontSize: window.innerWidth <= 480 ? '14px' : '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)',
                    minHeight: '44px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#fa6a5b';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#e74c3c';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  Forfeit & Leave
                </button>
              </div>
            </div>
          </div>
        )}

        {showGameCompletion && (
          <GameCompletionAnimation
            result={gameResult || gameStatus} // Use standardized result object if available, fallback to text
            score={typeof playerScore === 'number' && !isNaN(playerScore) ? playerScore : 0}
            opponentScore={typeof computerScore === 'number' && !isNaN(computerScore) ? computerScore : 0}
            playerColor={playerColor}
            computerLevel={computerDepth} // Pass computer difficulty level for rating calculation
            moves={encodedMoves} // Pass encoded moves string for Login to Save functionality
            gameHistory={gameHistory} // Pass full history array for pending construction
            isMultiplayer={false} // This is computer mode
            onClose={() => {
              setShowGameCompletion(false);

              // If there's a pending navigation (user tried to leave during rated game),
              // execute it now after showing the game result
              if (pendingNavigation) {
                console.log('[PlayComputer] 🚀 Executing pending navigation after game completion:', pendingNavigation);

                // Extract path from navigation string if it's a URL
                let navPath = pendingNavigation;
                if (navPath.includes('dashboard')) navPath = '/dashboard';
                else if (navPath.includes('lobby')) navPath = '/lobby';
                else if (navPath.includes('learn')) navPath = '/learn';
                else if (navPath.includes('championship')) navPath = '/championships';
                else if (navPath.includes('profile')) navPath = '/profile';

                // Clear pending navigation
                setPendingNavigation(null);

                // Navigate to the intended destination
                setTimeout(() => {
                  navigate(navPath);
                }, 100);
              } else {
                // Navigate to lobby after game ends
                navigate('/lobby');
              }
            }}
          />
        )}
    </>
  );

  // Render with PlayShell wrapper if feature flag is enabled
  if (usePlayShell) {
    return (
      <PlayShell
        header={null}          // use the global site header only
        preGameSetup={preGameSetupSection}
        boardArea={gameContainerSection}
        sidebar={null}
        timerScore={null}
        modals={modalsSection}
        showBoard={!isOnlineGame && (gameStarted || isReplayMode)}
        mode="computer"
      />
    );
  }

  // Fallback to original layout (backward compatibility)
  return (
    <>
      <div className="chess-game-container text-white pt-4 md:pt-6">

        {/* Pre-Game Setup Screen */}
        {!gameStarted && !isReplayMode && !isOnlineGame && !syntheticOpponent && gameMode === null && (
          <div className="pre-game-setup bg-surface-card backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center">
            <h2 className="text-3xl font-bold mb-6 text-gold">Choose Your Game Mode</h2>
            <div className="flex flex-col gap-4">
              <button className="start-button large green bg-chess-green hover:bg-chess-hover text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300" onClick={() => setGameMode('computer')}>
                Play Against Computer
              </button>
              <button className="start-button large blue bg-gold hover:bg-gold-hover text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300" onClick={() => navigate('/lobby')}>
                Play Against a Friend
              </button>
            </div>
          </div>
        )}

        {/* Pre-Game Setup Screen (skip for synthetic opponents from lobby) */}
        {!gameStarted && !isReplayMode && !isOnlineGame && !syntheticOpponent && gameMode === 'computer' && (
          <div className="pre-game-setup bg-surface-card backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center">

            {/* Game Mode Selector */}
            <div className="mode-selection mb-4">
              <GameModeSelector
                selectedMode={ratedMode}
                onModeChange={handleModeChange}
                disabled={countdownActive}
              />
            </div>

            <div className="difficulty-selection mb-2">
              <DifficultyMeter
                value={computerDepth}
                onChange={handleDifficultyChange}
                min={MIN_DEPTH}
                max={MAX_DEPTH}
                disabled={countdownActive}
              />
            </div>
            <div className="color-selection mb-2">
              <h3 className="text-xl font-semibold mb-2">Select Your Color:</h3>
              <label className="color-toggle-container inline-flex items-center cursor-pointer" htmlFor="color-toggle">
                <span className="mr-3">White</span>
                <div className="relative">
                  <input type="checkbox" id="color-toggle" className="sr-only"
                    checked={playerColor === 'b'}
                    onChange={handleColorToggle} // Stable callback
                    disabled={countdownActive} />
                  <div className="w-14 h-8 bg-surface-elevated rounded-full"></div>
                  <div className={`dot absolute top-1 bg-white w-6 h-6 rounded-full transition ${playerColor === 'b' ? 'left-7' : 'left-1'}`}></div>
                </div>
                <span className="ml-3">Black</span>
              </label>
            </div>
            {!countdownActive && (
              <button className="start-button large green bg-chess-green hover:bg-chess-hover text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300" onClick={startGame} disabled={countdownActive}>
                Start Game
              </button>
            )}
            {countdownActive && (
              <div className="countdown-in-setup">
                <p className="text-xl mb-2">Starting in...</p>
                <Countdown startValue={3} onCountdownFinish={onCountdownFinish} />
              </div>
            )}
          </div>
        )}

        {/* Main Game/Replay Screen Layout */}
        {(gameStarted || isReplayMode) && gameContainerSection}

        {/* Game Completion Modal/Animation */}
        {showGameCompletion && (
          <GameCompletionAnimation
            result={gameResult || gameStatus} // Use standardized result object if available, fallback to text
            score={typeof playerScore === 'number' && !isNaN(playerScore) ? playerScore : 0}
            opponentScore={typeof computerScore === 'number' && !isNaN(computerScore) ? computerScore : 0}
            playerColor={playerColor}
            computerLevel={computerDepth} // Pass computer difficulty level for rating calculation
            moves={encodedMoves} // Pass encoded moves string for Login to Save functionality
            gameHistory={gameHistory} // Pass full history array for pending construction
            isMultiplayer={false} // This is computer mode
            onClose={() => {
              setShowGameCompletion(false); // Hide the animation

              // If there's a pending navigation (user tried to leave during rated game),
              // execute it now after showing the game result
              if (pendingNavigation) {
                console.log('[PlayComputer] 🚀 Executing pending navigation after game completion:', pendingNavigation);

                // Extract path from navigation string if it's a URL
                let navPath = pendingNavigation;
                if (navPath.includes('dashboard')) navPath = '/dashboard';
                else if (navPath.includes('lobby')) navPath = '/lobby';
                else if (navPath.includes('learn')) navPath = '/learn';
                else if (navPath.includes('championship')) navPath = '/championships';
                else if (navPath.includes('profile')) navPath = '/profile';

                // Clear pending navigation
                setPendingNavigation(null);

                // Navigate to the intended destination
                setTimeout(() => {
                  navigate(navPath);
                }, 100);
              } else {
                // Navigate to lobby after game ends
                navigate('/lobby');
              }
            }}
          />
        )}
      </div>
    </>
  );
};

export default PlayComputer;
