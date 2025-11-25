// In src/utils/timerUtils.js

import { useState, useRef, useCallback, useEffect } from "react";

// Multiplayer timer hook - NEW implementation for multiplayer games
export const useMultiplayerTimer = ({
  myColor,
  serverTurn,
  gameStatus,
  onFlag,
  initialMyMs = 600000,
  initialOppMs = 600000,
  incrementMs = 0
}) => {
  const [myMs, setMyMs] = useState(initialMyMs);
  const [oppMs, setOppMs] = useState(initialOppMs);
  const timerRef = useRef(null);
  const lastServerTurnRef = useRef(serverTurn);
  const onFlagRef = useRef(onFlag);
  const currentTurnRef = useRef({ serverTurn, myColor });

  useEffect(() => {
    onFlagRef.current = onFlag;
  }, [onFlag]);

  // Auto-update when initial values change
  useEffect(() => {
    setMyMs(initialMyMs);
    setOppMs(initialOppMs);
  }, [initialMyMs, initialOppMs]);

  // Apply increment when turn changes
  useEffect(() => {
    // If turn just changed from opponent to player, apply increment to player who just moved
    if (lastServerTurnRef.current && lastServerTurnRef.current !== serverTurn && incrementMs > 0) {
      const playerWhoMoved = lastServerTurnRef.current;
      const isPlayerWhoMoved = (myColor === 'w' && playerWhoMoved === 'w') ||
                               (myColor === 'b' && playerWhoMoved === 'b');

      if (isPlayerWhoMoved) {
        setMyMs(prev => prev + incrementMs);
        console.log('[Timer] Applied increment to player:', incrementMs, 'ms');
      } else {
        setOppMs(prev => prev + incrementMs);
        console.log('[Timer] Applied increment to opponent:', incrementMs, 'ms');
      }
    }
    lastServerTurnRef.current = serverTurn;
  }, [serverTurn, myColor, incrementMs]);

  // Timer logic for multiplayer
  useEffect(() => {
    if (gameStatus === 'finished' || gameStatus === 'paused') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Check if turn actually changed to prevent unnecessary timer restarts
    const turnChanged = currentTurnRef.current.serverTurn !== serverTurn ||
                       currentTurnRef.current.myColor !== myColor;

    if (gameStatus === 'active' && serverTurn && turnChanged) {
      // Update turn reference
      currentTurnRef.current = { serverTurn, myColor };

      // Clear existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Start new timer
      timerRef.current = setInterval(() => {
        const isMyTurn = (myColor === 'w' && serverTurn === 'w') ||
                        (myColor === 'b' && serverTurn === 'b');

        if (isMyTurn) {
          setMyMs(prev => {
            const newTime = Math.max(0, prev - 100);
            if (newTime === 0 && onFlagRef.current) {
              onFlagRef.current('player'); // Player's time ran out
            }
            return newTime;
          });
        } else {
          setOppMs(prev => {
            const newTime = Math.max(0, prev - 100);
            if (newTime === 0 && onFlagRef.current) {
              onFlagRef.current('opponent'); // Opponent's time ran out
            }
            return newTime;
          });
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameStatus, serverTurn, myColor]); // Keep dependencies but add logic to prevent unnecessary restarts

  return { myMs, oppMs, setMyMs, setOppMs };
};

// Single-player timer hook - LEGACY implementation for computer games
export const useGameTimer = (playerColor, game, setGameStatus) => {
  const [playerTime, setPlayerTime] = useState(600);
  const [computerTime, setComputerTime] = useState(600);
  const [activeTimer, setActiveTimer] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);
  const activeTimerRef = useRef(activeTimer);

  useEffect(() => {
    activeTimerRef.current = activeTimer;
  }, [activeTimer]);

  const handleTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (game.isGameOver() || game.isDraw()) {
      setIsTimerRunning(false);
      return;
    }
    setIsTimerRunning(true);
    timerRef.current = setInterval(() => {
      if (activeTimerRef.current === playerColor) {
        setPlayerTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            setGameStatus(
              `Time's up! ${playerColor === "w" ? "Black" : "White"} wins!`
            );
            setIsTimerRunning(false);
            return 0;
          }
          return prevTime - 1;
        });
      } else if (activeTimerRef.current === (playerColor === "w" ? "b" : "w")) {
        setComputerTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            setGameStatus(
              `Time's up! ${playerColor === "w" ? "White" : "Black"} wins!`
            );
            setIsTimerRunning(false);
            return 0;
          }
          return prevTime - 1;
        });
      }
    }, 1000);
  }, [game, playerColor, setGameStatus]);

  // New: Implement switchTimer function
  const switchTimer = useCallback((newActiveTimer) => {
    setActiveTimer(newActiveTimer);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);


  // Optionally, implement resetTimer if needed
  const resetTimer = useCallback(() => {
    setPlayerTime(600);
    setComputerTime(600);
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    playerTime,
    computerTime,
    activeTimer,
    isTimerRunning,
    timerRef,
    setPlayerTime,
    setComputerTime,
    setActiveTimer,
    setIsTimerRunning,
    handleTimer, // used to start/resume the timer interval
    pauseTimer,  // newly added for pausing the timer
    switchTimer,
    resetTimer,
  };
};

export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};
