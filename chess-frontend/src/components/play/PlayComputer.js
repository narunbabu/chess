// src/components/play/PlayComputer.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import axios from "axios"; // Make sure axios is installed
import { BrowserRouter as Router, Link, useNavigate } from "react-router-dom"; // Use Router if defining routes here, otherwise just Link/useNavigate

// Import Components
import ChessBoard from "./ChessBoard";
import GameControls from "./GameControls";
import GameInfo from "./GameInfo";
import ScoreDisplay from "./ScoreDisplay";
import TimerDisplay from "./TimerDisplay";
import TimerButton from "./TimerButton";
import DifficultyMeter from "./DifficultyMeter";
import Countdown from "../Countdown"; // Adjust path if needed
import GameCompletionAnimation from "../GameCompletionAnimation"; // Adjust path if needed

// Import Utils & Hooks
import { useGameTimer } from "../../utils/timerUtils"; // Adjust path if needed
import { makeComputerMove } from "../../utils/computerMoveUtils"; // Adjust path if needed
import { updateGameStatus, evaluateMove } from "../../utils/gameStateUtils"; // Adjust paths if needed (ensure evaluateMove exists)
import { encodeGameHistory, reconstructGameFromHistory } from "../../utils/gameHistoryStringUtils"; // Adjust paths if needed

// Import Services
import { saveGameHistory, getGameHistories } from "../../services/gameHistoryService"; // Adjust paths if needed

// Import Config (ensure this file exists and exports BACKEND_URL)
import { BACKEND_URL } from "../../config"; // Adjust path if needed

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
  const [gameStarted, setGameStarted] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [moveCompleted, setMoveCompleted] = useState(false); // Tracks if player has dropped a piece this turn
  const [computerMoveInProgress, setComputerMoveInProgress] = useState(false);
  const [showGameCompletion, setShowGameCompletion] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerScore, setPlayerScore] = useState(0);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState(null); // Stores result from evaluateMove
  const moveStartTimeRef = useRef(null); // Tracks when player's turn started for move timing
  const previousGameStateRef = useRef(null); // Stores previous FEN for evaluation/history
  const [gameHistory, setGameHistory] = useState([]); // Stores move history [{ fen, move, playerColor, timeSpent, evaluation }]
  const [savedGames, setSavedGames] = useState([]); // List of games loaded for replay
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayPaused, setReplayPaused] = useState(true);
  const replayTimerRef = useRef(null); // Interval timer for replay
  const [currentReplayMove, setCurrentReplayMove] = useState(0); // Index for replay
  const [settings, setSettings] = useState({ requireDoneButton: false }); // Game settings
  const [moveCount, setMoveCount] = useState(0); // Simple move counter
  const [timerButtonColor, setTimerButtonColor] = useState("grey"); // Color of the TimerButton
  const [timerButtonText, setTimerButtonText] = useState("Your Turn"); // Text of the TimerButton
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth); // For layout adjustments
  const navigate = useNavigate(); // For navigation buttons

  // --- Custom timer hook ---
  const {
    playerTime, computerTime, activeTimer, isTimerRunning, timerRef,
    setPlayerTime, setComputerTime, setActiveTimer, setIsTimerRunning,
    handleTimer: startTimerInterval, pauseTimer, switchTimer, resetTimer
  } = useGameTimer(playerColor, game, setGameStatus, () => setGameOver(true)); // Pass callbacks

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
   const handleGameComplete = useCallback(async (finalHistory, status) => {
        // Prepare result text and positive score
        const resultText = status.text || "unknown";
        const positiveScore = Math.abs(playerScore);

        // Stops timers, sets game over state, saves game locally and potentially online
        if (timerRef.current) clearInterval(timerRef.current);
        setIsTimerRunning(false);
        setActiveTimer(null);
        setGameOver(true);
        setShowGameCompletion(true); // Show completion modal
        const authToken = localStorage.getItem("auth_token");
        const now = new Date();
        const formattedDate = now.toISOString().slice(0, 19).replace("T", " ");

        // Ensure encodeGameHistory exists and is used, otherwise stringify
        const conciseGameString = typeof encodeGameHistory === 'function'
            ? encodeGameHistory(finalHistory)
            : JSON.stringify(finalHistory);

        const payload = {
            played_at: formattedDate,
            player_color: playerColor,
            computer_depth: computerDepth,
            moves: conciseGameString,
            final_score: positiveScore,
            result: resultText,
        };


        // Local Save (using service if available)
        const localSaveData = {
            id: `local_${Date.now()}`, date: now.toISOString(), played_at: formattedDate,
            player_color: playerColor, computer_depth: computerDepth, moves: conciseGameString,
            final_score: positiveScore, result: resultText,
        };
        if (typeof saveGameHistory === 'function') {
            saveGameHistory(localSaveData);
        } else {
            console.warn("saveGameHistory function not available for local save.");
        }

        // Online Save (if configured and authenticated)
        if (authToken && typeof axios === 'function' && BACKEND_URL) {
            try {
                await axios.post(`${BACKEND_URL}/game-history`, payload, { headers: { Authorization: `Bearer ${authToken}` } });
            } catch (error) {
                console.error("Error saving game history online", error);
                if (error.response) console.error("Response data:", error.response.data);
            }
        } else {
            // console.log("Skipping online save (no token, axios, or backend URL)"); // Less console noise
        }

        playSound(gameEndSoundEffect); // Play end sound

        // Store the saved game ID for history navigation
        const savedGameId = localSaveData?.id;
        if (savedGameId) {
            localStorage.setItem('lastGameId', savedGameId);
        } else {
            console.warn("Could not get saved game ID");
        }

   }, [ // Dependencies for handleGameComplete
     playerColor, computerDepth, playerScore, navigate, // State variables read + navigate
     setActiveTimer, setIsTimerRunning, // State setters (stable)
     playSound, // Stable callback
     // External functions/objects (assume stable refs unless they change based on props/state)
     encodeGameHistory, saveGameHistory, timerRef // Added timerRef
     // Note: axios, BACKEND_URL, gameEndSoundEffect are constants/imports, typically stable
   ]);

  // --- Effects ---

  // Effect for handling screen orientation changes
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, []); // setIsPortrait is stable

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
  }, [getGameHistories]); // Depend on the imported function reference

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
          const result = await makeComputerMove(
            game,             // Current game state
            computerDepth,    // Difficulty level (used for time mapping)
            computerColor,    // Computer's color
            setTimerButtonColor // Pass setter for internal feedback (optional usage)
          );

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
              // Get the most recent game history before calling complete
              // Note: history state might not include the *very last* computer move info yet
              // handleGameComplete should ideally work with the final `newGame` state if needed
              await handleGameComplete(gameHistory, status);
            } else {
              // Game continues: Switch turn back to the player
              setMoveCompleted(false); // Player hasn't made their move yet
              switchTimer(playerColor); // Switch active timer to player
              startTimerInterval(); // Start player's clock
              moveStartTimeRef.current = Date.now(); // Record start of player's thinking time

              // Evaluate computer's move
              const prev = previousGameStateRef.current;
              const compEval = typeof evaluateMove === 'function'
                ? evaluateMove(result.newGame.history().slice(-1)[0], prev, newGame, (thinkingTime/1000), DEFAULT_RATING, setLastComputerEvaluation, setComputerScore, computerDepth) // Use slice(-1)[0] for safety
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
                  setGameHistory(prevHistory => [...prevHistory, computerHistoryEntry]);
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
                  await handleGameComplete(gameHistory, currentStatus);
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
                 await handleGameComplete(gameHistory, currentStatus);
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
      !computerMoveInProgress && // Ensure previous move isn't still processing
      game.turn() === computerColor &&
      activeTimer === computerColor // Ensure the computer's timer is active
    ) {
      performComputerTurn(); // Execute the computer's turn logic
    }

    // No cleanup function needed here because the async function checks state flags internally

  }, [ // Dependencies for the computer turn useEffect
    gameStarted, gameOver, isReplayMode, computerMoveInProgress, activeTimer, playerColor,
    game, computerDepth, gameHistory, // State values read or passed along
    handleGameComplete, playSound, switchTimer, startTimerInterval, // Stable Callbacks/Timer functions
    setGame, setGameStatus, setMoveCount, setMoveCompleted, setComputerMoveInProgress, setTimerButtonColor, // Stable Setters
    makeComputerMove, updateGameStatus, evaluateMove, DEFAULT_RATING, setLastComputerEvaluation, setComputerScore // Stable imported functions
  ]);


  // --- Player Move Logic (onDrop on ChessBoard) ---
   const onDrop = useCallback((sourceSquare, targetSquare) => {
        // Prevent move if game over, replay mode, not player's turn, or computer is thinking
        if (
            gameOver || isReplayMode || game.turn() !== playerColor ||
            activeTimer !== playerColor || computerMoveInProgress
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
            // console.log(`Invalid move format caught: ${sourceSquare}->${targetSquare}`, error);
            setMoveFrom(""); // Clear selection state
            setMoveSquares({});
            return false; // Indicate move failed
        }

        // Check if the move was legal (chess.js returns null for illegal moves)
        if (!moveResult) {
            // console.log(`Illegal move: ${sourceSquare}->${targetSquare}`);
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
        const evaluationResult = typeof evaluateMove === 'function'
            ? evaluateMove(moveResult, previousState, gameCopy, moveTimeInSeconds, DEFAULT_RATING, setLastMoveEvaluation, setPlayerScore, computerDepth)
            : null; // Provides feedback/scoring

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

        // Update the main game state
        setGame(gameCopy);
        setMoveFrom(""); // Clear selection state
        setMoveSquares({});

        // Check game status after the move
        const status = typeof updateGameStatus === 'function'
            ? updateGameStatus(gameCopy, setGameStatus)
            : { gameOver: gameCopy.isGameOver(), statusText: gameCopy.isGameOver() ? 'Game Over' : '' };

        if (status.gameOver) {
            // Game ended by player's move
            handleGameComplete(updatedHistory, status); // Pass the *final* history
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
        game, gameOver, isReplayMode, activeTimer, playerColor, computerMoveInProgress,
        gameHistory, settings.requireDoneButton, // State reads
        playSound, handleGameComplete, switchTimer, startTimerInterval, // Stable callbacks/timer fns
        setIsTimerRunning, setLastMoveEvaluation, setPlayerScore, setGameHistory, // Stable setters
        setMoveCount, setGame, setMoveFrom, setMoveSquares, setGameStatus, setMoveCompleted, // Stable setters
        timerRef, // Ref accessed
        updateGameStatus, evaluateMove, DEFAULT_RATING // Stable imported functions
    ]);

  // --- Game Start/Reset/Load/Replay Logic Callbacks ---

   const startGame = useCallback(() => {
        // Starts the countdown if game not already started
        if (!gameStarted && !countdownActive) setCountdownActive(true);
    }, [gameStarted, countdownActive]); // Correct dependencies

   const onCountdownFinish = useCallback(() => {
        setCountdownActive(false);
        setGameStarted(true);
        setMoveCount(0);
        const initialActivePlayer = playerColor;
        setActiveTimer(initialActivePlayer);
        startTimerInterval();
        moveStartTimeRef.current = Date.now();
        console.log("Game started!");
    }, [playerColor, startTimerInterval]);

   const handleStartGame = useCallback(() => {
        if (!gameStarted && !countdownActive) {
            setCountdownActive(true);
        }
    }, [gameStarted, countdownActive]);

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
        // Note: Does not reset playerColor or computerDepth, keeping user selections
    }, [resetTimer, timerRef, replayTimerRef]); // Dependencies: stable hook fn and refs accessed

     const resetCurrentGameSetup = useCallback(() => {
         // Prompts user before resetting an ongoing game
        if (gameStarted && moveCount > 0 && !gameOver && !isReplayMode) {
            if (window.confirm("Reset the current game? Your progress will be lost.")) {
                resetGame();
            }
        } else {
            // If game hasn't started or is over/replay, reset without confirmation
            resetGame();
        }
    }, [gameStarted, moveCount, gameOver, isReplayMode, resetGame]); // Correct dependencies

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
    }, [resetGame, reconstructGameFromHistory]); // Dependencies: stable callback and imported fn

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
                                return; // Exit early on error
                            }
                            moveApplied = true; // Move was successfully applied
                        });

                        if (moveApplied) {
                            playSound(moveSoundEffect); // Play sound for each replayed move
                            return nextIndex + 1; // Advance to next move for the next interval
                        } else {
                            clearInterval(replayTimerRef.current); // Stop on error
                            setReplayPaused(true);
                            return prevIndex; // Don't advance index on error
                        }
                    } else {
                        console.warn(`Move entry at index ${nextIndex} is missing move data:`, moveEntry);
                        return nextIndex + 1; // Skip this entry and advance
                    }
                } else {
                    // Reached end of replay
                    clearInterval(replayTimerRef.current);
                    setReplayPaused(true);
                    console.log("Replay finished.");
                    return prevIndex; // Stay at current index
                }
            });
        }, 1500); // 1.5 second interval between moves
    }, [isReplayMode, gameHistory, replayPaused, currentReplayMove, playSound, safeGameMutate]); // Dependencies

     const pauseReplay = useCallback(() => {
        // Pauses the automatic replay
        if (replayTimerRef.current) {
            clearInterval(replayTimerRef.current);
            replayTimerRef.current = null;
        }
        setReplayPaused(true);
        console.log("Replay paused.");
    }, []); // No dependencies needed

  // --- Event handlers for difficulty and color changes ---
  const handleDifficultyChange = useCallback((newDepth) => {
    setComputerDepth(newDepth);
    localStorage.setItem('computerDepth', newDepth.toString());
  }, []); // No external dependencies

  const handleColorChange = useCallback((newColor) => {
    setPlayerColor(newColor);
    setBoardOrientation(newColor === 'w' ? 'white' : 'black');
    localStorage.setItem('playerColor', newColor);
  }, []); // No external dependencies

  // Modern inline styles
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  };

  const gameAreaStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.08)',
    padding: '2rem',
    maxWidth: isPortrait ? '100%' : '1400px',
    width: '100%',
    display: 'grid',
    gridTemplateColumns: isPortrait ? '1fr' : '1fr 400px 1fr',
    gridTemplateRows: isPortrait ? 'auto auto auto auto' : 'auto 1fr auto',
    gap: '2rem',
    minHeight: isPortrait ? 'auto' : '80vh'
  };

  const headerStyle = {
    gridColumn: isPortrait ? '1' : '1 / -1',
    textAlign: 'center',
    borderBottom: '2px solid #f0f2ff',
    paddingBottom: '1rem',
    marginBottom: '1rem'
  };

  const titleStyle = {
    fontSize: '2.5rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem'
  };

  const subtitleStyle = {
    color: '#6b7280',
    fontSize: '1.1rem',
    fontWeight: '500'
  };

  const leftPanelStyle = {
    gridColumn: isPortrait ? '1' : '1',
    gridRow: isPortrait ? '2' : '2',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  };

  const centerPanelStyle = {
    gridColumn: isPortrait ? '1' : '2',
    gridRow: isPortrait ? '3' : '2',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem'
  };

  const rightPanelStyle = {
    gridColumn: isPortrait ? '1' : '3',
    gridRow: isPortrait ? '4' : '2',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  };

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    border: '1px solid #f3f4f6'
  };

  const cardTitleStyle = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const setupCardStyle = {
    ...cardStyle,
    background: gameStarted ? '#f9fafb' : '#ffffff',
    border: gameStarted ? '1px solid #e5e7eb' : '1px solid #3b82f6',
    transition: 'all 0.3s ease'
  };

  const difficultyContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem'
  };

  const statusCardStyle = {
    ...cardStyle,
    background: gameOver ? '#fef2f2' : gameStarted ? '#f0fdf4' : '#fefce8',
    border: gameOver ? '1px solid #fecaca' : gameStarted ? '1px solid #bbf7d0' : '1px solid #fde047'
  };

  const statusTextStyle = {
    fontSize: '1rem',
    fontWeight: '500',
    color: gameOver ? '#dc2626' : gameStarted ? '#059669' : '#d97706',
    textAlign: 'center'
  };

  const timerContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem'
  };

  const actionButtonStyle = {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
  };

  const secondaryButtonStyle = {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  };

  return (
    <div style={containerStyle}>
      <div style={gameAreaStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>Chess vs Computer</h1>
          <p style={subtitleStyle}>Test your skills against our AI opponent</p>
        </div>

        {/* Left Panel - Game Setup & Controls */}
        <div style={leftPanelStyle}>
          {/* Game Setup */}
          <div style={setupCardStyle}>
            <h3 style={cardTitleStyle}>
              <span>⚙️</span>
              Game Setup
            </h3>

            {!gameStarted && !isReplayMode && (
              <div style={difficultyContainerStyle}>
                <div style={{marginBottom: '1rem', width: '100%'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#6b7280'}}>
                    Difficulty Level: {computerDepth}
                  </label>
                  <DifficultyMeter
                    value={computerDepth}
                    onChange={handleDifficultyChange}
                    min={MIN_DEPTH}
                    max={MAX_DEPTH}
                    width={200}
                    height={120}
                    disabled={gameStarted}
                  />
                </div>
              </div>
            )}

            <GameControls
              gameStarted={gameStarted}
              countdownActive={countdownActive}
              isTimerRunning={isTimerRunning}
              resetGame={resetCurrentGameSetup}
              startGame={startGame}
              handleTimer={startTimerInterval}
              setIsTimerRunning={setIsTimerRunning}
              pauseTimer={pauseTimer}
              isReplayMode={isReplayMode}
              replayPaused={replayPaused}
              startReplay={startReplay}
              pauseReplay={pauseReplay}
              savedGames={savedGames}
              loadGame={loadGame}
              playerColor={playerColor}
              onColorChange={handleColorChange}
            />
          </div>

          {/* Game Status */}
          <div style={statusCardStyle}>
            <h3 style={cardTitleStyle}>
              <span>📊</span>
              Game Status
            </h3>
            <div style={statusTextStyle}>{gameStatus}</div>
          </div>

          {/* Timer Display */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <span>⏱️</span>
              Timer
            </h3>
            <div style={timerContainerStyle}>
              <TimerDisplay
                playerTime={playerTime}
                computerTime={computerTime}
                activeTimer={activeTimer}
                playerColor={playerColor}
                isTimerRunning={isTimerRunning}
              />
            </div>
            <div style={{marginTop: '1rem'}}>
              <TimerButton
                color={timerButtonColor}
                text={timerButtonText}
                onClick={handleTimerButtonPress}
                disabled={!gameStarted || gameOver}
              />
            </div>
          </div>
        </div>

        {/* Center Panel - Chess Board */}
        <div style={centerPanelStyle}>
          {countdownActive && (
            <div style={{marginBottom: '1rem'}}>
              <Countdown onFinish={onCountdownFinish} />
            </div>
          )}

          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '1rem',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
            border: '2px solid #f0f2ff'
          }}>
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
              playerColor={playerColor}
              isReplayMode={isReplayMode}
            />
          </div>
        </div>

        {/* Right Panel - Game Info & Scores */}
        <div style={rightPanelStyle}>
          {/* Game Information */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <span>ℹ️</span>
              Game Info
            </h3>
            <GameInfo
              gameStatus={gameStatus}
              playerColor={playerColor}
              game={game}
              moveCompleted={moveCompleted}
              activeTimer={activeTimer}
              isReplayMode={isReplayMode}
              currentReplayMove={currentReplayMove}
              totalMoves={gameHistory.length}
              settings={settings}
            />
          </div>

          {/* Score Display */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <span>🏆</span>
              Score
            </h3>
            <ScoreDisplay
              playerScore={playerScore}
              computerScore={computerScore}
              lastMoveEvaluation={lastMoveEvaluation}
              lastComputerEvaluation={lastComputerEvaluation}
            />
          </div>

          {/* Game Actions */}
          {gameStarted && !isReplayMode && (
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>
                <span>🎮</span>
                Actions
              </h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                <button 
                  style={secondaryButtonStyle}
                  onClick={resetCurrentGameSetup}
                  onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
                  onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}
                >
                  Reset Game
                </button>
                <button 
                  style={secondaryButtonStyle}
                  onClick={() => navigate('/history')}
                  onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
                  onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}
                >
                  View History
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game Completion Modal */}
      {showGameCompletion && (
        <GameCompletionAnimation
          isVisible={showGameCompletion}
          result={gameStatus}
          score={playerScore}
          onClose={() => setShowGameCompletion(false)}
        />
      )}
    </div>
  );
};

export default PlayComputer;