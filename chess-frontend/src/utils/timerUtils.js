// In src/utils/timerUtils.js

import { useState, useRef, useEffect } from "react";

/**
 * Single-source-of-truth timer hook
 * Drives countdown from the same logic as "Your turn / Opponent's turn"
 *
 * @param {Object} params
 * @param {'w'|'b'|null} params.myColor - Current player's color
 * @param {'w'|'b'|null} params.serverTurn - Current turn from server
 * @param {string} params.gameStatus - 'active' | 'paused' | 'finished'
 * @param {Function} params.onFlag - Callback when timer hits zero
 * @param {number} params.initialMyMs - Initial time for my timer (default: 10 minutes)
 * @param {number} params.initialOppMs - Initial time for opponent timer (default: 10 minutes)
 */
export const useGameTimer = ({
  myColor,
  serverTurn,
  gameStatus,
  onFlag,
  initialMyMs = 10 * 60 * 1000,
  initialOppMs = 10 * 60 * 1000
}) => {
  const [myMs, setMyMs] = useState(initialMyMs);
  const [oppMs, setOppMs] = useState(initialOppMs);

  // Refs to avoid stale closures in interval
  const colorRef = useRef(null);
  const turnRef = useRef(null);
  const lastTick = useRef(null);
  const timerRef = useRef(null);

  // Keep refs fresh for the interval
  useEffect(() => {
    colorRef.current = myColor;
    console.log('[Timer] myColor updated:', myColor);
  }, [myColor]);

  useEffect(() => {
    turnRef.current = serverTurn;
    console.log('[Timer] serverTurn updated:', serverTurn);
  }, [serverTurn]);

  useEffect(() => {
    console.log('[Timer] Effect running:', {
      gameStatus,
      myColor,
      serverTurn,
      hasTimer: !!timerRef.current
    });

    // Stop if not running
    if (gameStatus !== 'active' || !myColor || !serverTurn) {
      console.log('[Timer] Stopping timer:', { gameStatus, myColor, serverTurn });
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      lastTick.current = null;
      return;
    }

    // Always restart timer when turn or color changes
    if (timerRef.current) {
      console.log('[Timer] Restarting timer due to state change');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    console.log('[Timer] Starting timer:', { myColor, serverTurn });
    lastTick.current = performance.now();

    timerRef.current = setInterval(() => {
      if (!lastTick.current) return;

      const now = performance.now();
      const delta = Math.floor(now - lastTick.current); // ms since last tick
      lastTick.current = now;

      const isMyTurn = (turnRef.current === colorRef.current);

      // Debug logging (remove after testing)
      if (Math.random() < 0.05) { // Log ~5% of ticks to avoid spam
        console.log('[Timer] tick:', {
          turn: turnRef.current,
          myColor: colorRef.current,
          isMyTurn,
          delta
        });
      }

      if (isMyTurn) {
        setMyMs(t => {
          const next = Math.max(t - delta, 0);
          if (next === 0 && t > 0) {
            console.log('[Timer] 🚨 My time expired!');
            onFlag?.('me');
          }
          return next;
        });
      } else {
        setOppMs(t => {
          const next = Math.max(t - delta, 0);
          if (next === 0 && t > 0) {
            console.log('[Timer] 🚨 Opponent time expired!');
            onFlag?.('opponent');
          }
          return next;
        });
      }
    }, 200); // Tick ~5x/sec for smoother countdown

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      lastTick.current = null;
    };
  }, [gameStatus, myColor, serverTurn, onFlag]);

  return { myMs, oppMs, setMyMs, setOppMs };
};

/**
 * Format milliseconds as mm:ss
 */
export const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};
