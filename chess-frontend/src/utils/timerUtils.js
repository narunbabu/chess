// In src/utils/timerUtils.js

import { useState, useRef, useCallback, useEffect } from "react";

// Multiplayer timer hook - NEW implementation for multiplayer games
export const useMultiplayerTimer = ({
  myColor,
  serverTurn,
  gameStatus,
  onFlag,
  initialMyMs = 600000,
  initialOppMs = 600000
}) => {
  const [myMs, setMyMs] = useState(initialMyMs);
  const [oppMs, setOppMs] = useState(initialOppMs);
  const timerRef = useRef(null);

  // Auto-update when initial values change
  useEffect(() => {
    setMyMs(initialMyMs);
    setOppMs(initialOppMs);
  }, [initialMyMs, initialOppMs]);

  // Timer logic for multiplayer
  useEffect(() => {
    if (gameStatus === 'finished' || gameStatus === 'paused') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (gameStatus === 'active' && serverTurn) {
      // Clear existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Start new timer
      timerRef.current = setInterval(() => {
        const isMyTurn = (myColor === 'w' && serverTurn === 'white') ||
                        (myColor === 'b' && serverTurn === 'black');

        if (isMyTurn) {
          setMyMs(prev => {
            const newTime = Math.max(0, prev - 100);
            if (newTime === 0 && onFlag) {
              onFlag();
            }
            return newTime;
          });
        } else {
          setOppMs(prev => {
            const newTime = Math.max(0, prev - 100);
            if (newTime === 0 && onFlag) {
              onFlag();
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
  }, [gameStatus, serverTurn, myColor, onFlag]);

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