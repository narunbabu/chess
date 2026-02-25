// In src/utils/timerUtils.js

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Multiplayer timer hook ────────────────────────────────────────────────
// Uses Date.now()-anchored timing so the timer is immune to browser tab
// throttling. When a tab is hidden browsers throttle setInterval to ≥1 s
// (sometimes ≥1 min). Anchoring to wall-clock time means the correct
// elapsed duration is always subtracted, even after long hidden periods.
export const useMultiplayerTimer = ({
  myColor,
  serverTurn,
  gameStatus,
  onFlag,
  initialMyMs = 600000,
  initialOppMs = 600000,
  incrementMs = 0,
  isRated = false
}) => {
  const [myMs, setMyMs] = useState(initialMyMs);
  const [oppMs, setOppMs] = useState(initialOppMs);
  const timerRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const lastServerTurnRef = useRef(serverTurn);
  const onFlagRef = useRef(onFlag);
  const currentTurnRef = useRef({ serverTurn, myColor });
  const flagFiredRef = useRef(false); // Prevent onFlag from firing more than once

  useEffect(() => { onFlagRef.current = onFlag; }, [onFlag]);

  // Auto-update when initial values change (e.g. game resume)
  useEffect(() => {
    setMyMs(initialMyMs);
    setOppMs(initialOppMs);
  }, [initialMyMs, initialOppMs]);

  // Apply Fischer increment when turn changes
  useEffect(() => {
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

  // Track isRated in a ref so changes don't kill the interval
  const isRatedRef = useRef(isRated);
  useEffect(() => { isRatedRef.current = isRated; }, [isRated]);

  // ── Core countdown with Date.now() anchoring ──
  useEffect(() => {
    // Stop timer when game is finished (both casual and rated)
    if (gameStatus === 'finished') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    // Casual games: also stop when paused (use ref so isRated changes don't kill timer)
    if (!isRatedRef.current && gameStatus === 'paused') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    // Always restart timer when game is active and we know the turn
    if (gameStatus === 'active' && serverTurn) {
      currentTurnRef.current = { serverTurn, myColor };

      if (timerRef.current) clearInterval(timerRef.current);

      // Anchor the wall-clock
      lastTickRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;

        const isMyTurn = (myColor === 'w' && serverTurn === 'w') ||
                        (myColor === 'b' && serverTurn === 'b');

        if (isMyTurn) {
          setMyMs(prev => {
            const t = Math.max(0, prev - elapsed);
            if (t === 0 && onFlagRef.current && !flagFiredRef.current) {
              flagFiredRef.current = true;
              onFlagRef.current('player');
            }
            return t;
          });
        } else {
          setOppMs(prev => {
            const t = Math.max(0, prev - elapsed);
            if (t === 0 && onFlagRef.current && !flagFiredRef.current) {
              flagFiredRef.current = true;
              onFlagRef.current('opponent');
            }
            return t;
          });
        }
      }, 100);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameStatus, serverTurn, myColor]);

  // ── Visibility catch-up (Feature 2) ──
  // When the tab becomes visible after being hidden, the interval may not
  // have fired at all. Force an immediate time correction.
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && lastTickRef.current && gameStatus === 'active' && serverTurn) {
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;

        if (elapsed > 200) { // Only correct if meaningful time passed
          const isMyTurn = (myColor === 'w' && serverTurn === 'w') ||
                          (myColor === 'b' && serverTurn === 'b');
          if (isMyTurn) {
            setMyMs(prev => {
              const t = Math.max(0, prev - elapsed);
              if (t === 0 && onFlagRef.current && !flagFiredRef.current) {
                flagFiredRef.current = true;
                onFlagRef.current('player');
              }
              return t;
            });
          } else {
            setOppMs(prev => {
              const t = Math.max(0, prev - elapsed);
              if (t === 0 && onFlagRef.current && !flagFiredRef.current) {
                flagFiredRef.current = true;
                onFlagRef.current('opponent');
              }
              return t;
            });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [gameStatus, serverTurn, myColor]);

  return { myMs, oppMs, setMyMs, setOppMs };
};


// ─── Single-player (computer) timer hook ───────────────────────────────────
// Accepts configurable initial time (seconds) and Fischer increment.
// Uses Date.now()-anchored timing for tab-throttle immunity.
export const useGameTimer = (playerColor, game, onFlag, initialTimeSec = 600, incrementSec = 0) => {
  const [playerTime, setPlayerTime] = useState(initialTimeSec);
  const [computerTime, setComputerTime] = useState(initialTimeSec);
  const [activeTimer, setActiveTimer] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const activeTimerRef = useRef(activeTimer);
  const onFlagRef = useRef(onFlag);
  // Store initial values in refs so resetTimer always has the right values
  const initialTimeRef = useRef(initialTimeSec);
  const incrementRef = useRef(incrementSec);

  useEffect(() => { activeTimerRef.current = activeTimer; }, [activeTimer]);
  useEffect(() => { onFlagRef.current = onFlag; }, [onFlag]);

  // Sync refs when props change (e.g. game restart with different time)
  useEffect(() => {
    initialTimeRef.current = initialTimeSec;
    incrementRef.current = incrementSec;
  }, [initialTimeSec, incrementSec]);

  // Re-initialize timer values when initialTimeSec changes
  useEffect(() => {
    setPlayerTime(initialTimeSec);
    setComputerTime(initialTimeSec);
  }, [initialTimeSec]);

  const handleTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (game.isGameOver() || game.isDraw()) {
      setIsTimerRunning(false);
      return;
    }
    setIsTimerRunning(true);
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSec = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      if (activeTimerRef.current === playerColor) {
        setPlayerTime(prev => {
          const t = Math.max(0, prev - elapsedSec);
          if (t <= 0) {
            clearInterval(timerRef.current);
            if (onFlagRef.current) onFlagRef.current('player');
            setIsTimerRunning(false);
            return 0;
          }
          return t;
        });
      } else if (activeTimerRef.current === (playerColor === 'w' ? 'b' : 'w')) {
        setComputerTime(prev => {
          const t = Math.max(0, prev - elapsedSec);
          if (t <= 0) {
            clearInterval(timerRef.current);
            if (onFlagRef.current) onFlagRef.current('computer');
            setIsTimerRunning(false);
            return 0;
          }
          return t;
        });
      }
    }, 200); // 200ms ticks for good precision + low overhead
  }, [game, playerColor]);

  // Switch active timer + apply Fischer increment to the player who just moved
  const switchTimer = useCallback((newActiveTimer) => {
    // Apply increment to the player who just finished moving
    if (incrementRef.current > 0 && activeTimerRef.current) {
      if (activeTimerRef.current === playerColor) {
        setPlayerTime(prev => prev + incrementRef.current);
      } else {
        setComputerTime(prev => prev + incrementRef.current);
      }
    }
    setActiveTimer(newActiveTimer);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [playerColor]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setPlayerTime(initialTimeRef.current);
    setComputerTime(initialTimeRef.current);
    setIsTimerRunning(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Visibility catch-up (Feature 2) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isTimerRunning && lastTickRef.current) {
        const now = Date.now();
        const elapsedSec = (now - lastTickRef.current) / 1000;
        lastTickRef.current = now;

        if (elapsedSec > 0.5) { // Meaningful hidden time
          if (activeTimerRef.current === playerColor) {
            setPlayerTime(prev => {
              const t = Math.max(0, prev - elapsedSec);
              if (t <= 0 && onFlagRef.current) onFlagRef.current('player');
              return Math.max(0, t);
            });
          } else {
            setComputerTime(prev => {
              const t = Math.max(0, prev - elapsedSec);
              if (t <= 0 && onFlagRef.current) onFlagRef.current('computer');
              return Math.max(0, t);
            });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTimerRunning, playerColor]);

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
    handleTimer: handleTimer,
    pauseTimer,
    switchTimer,
    resetTimer,
  };
};

export const formatTime = (seconds) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};
