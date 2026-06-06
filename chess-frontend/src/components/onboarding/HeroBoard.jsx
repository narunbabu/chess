import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

/**
 * HeroBoard — a live, playable mini chessboard for the landing hero.
 *
 * A cold visitor can drag a white piece and the board instantly replies with a
 * move, so they experience the product in the first 3 seconds instead of reading
 * about it. This is the hook; the CTAs below carry them into a real game.
 *
 * Self-contained: its own chess.js instance and a lightweight auto-reply
 * (prefers captures, otherwise a random legal move) — no engine/worker needed.
 *
 * @param {() => void} [onFirstMove] - fired once, when the visitor makes their
 *        first move (used for funnel analytics).
 */
const HeroBoard = ({ onFirstMove }) => {
  const gameRef = useRef(new Chess());
  const wrapRef = useRef(null);
  const firedRef = useRef(false);
  const [fen, setFen] = useState(gameRef.current.fen());
  const [boardWidth, setBoardWidth] = useState(360);
  const [hint, setHint] = useState('Your move! Drag a white piece 👉');
  const [thinking, setThinking] = useState(false);

  // Responsive sizing (matches the ResizeObserver approach used elsewhere).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setBoardWidth(Math.min(w, 460));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const makeReply = useCallback(() => {
    const g = gameRef.current;
    if (g.isGameOver()) {
      setHint('Good game! Hit "Login and Play" to play for real.');
      setThinking(false);
      return;
    }
    const moves = g.moves({ verbose: true });
    if (!moves.length) { setThinking(false); return; }
    const captures = moves.filter((m) => m.flags.includes('c'));
    const pool = captures.length ? captures : moves;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    g.move(pick);
    setFen(g.fen());
    setThinking(false);
    setHint('Your turn again — or press Play to start a real game.');
  }, []);

  const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
    const g = gameRef.current;
    // Only let the visitor move white, and only when it's white's turn.
    if (g.turn() !== 'w') return false;
    const piece = g.get(sourceSquare);
    if (!piece || piece.color !== 'w') return false;

    let move;
    try {
      move = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    } catch (e) {
      return false; // illegal move — snap back
    }
    if (!move) return false;

    setFen(g.fen());
    setThinking(true);
    setHint('Nice move! 🎉');

    if (!firedRef.current) {
      firedRef.current = true;
      if (typeof onFirstMove === 'function') onFirstMove();
    }

    window.setTimeout(makeReply, 500);
    return true;
  }, [makeReply, onFirstMove]);

  return (
    <div className="w-full max-w-[460px] mx-auto">
      <div ref={wrapRef} className="w-full">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          boardWidth={boardWidth}
          boardOrientation="white"
          arePiecesDraggable={!thinking}
          customDarkSquareStyle={{ backgroundColor: '#769656' }}
          customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
          customBoardStyle={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.45)' }}
          animationDuration={250}
        />
      </div>
      <p
        className="mt-3 text-center text-sm font-semibold text-[#e8a93e]"
        aria-live="polite"
      >
        {thinking ? 'Thinking…' : hint}
      </p>
    </div>
  );
};

export default HeroBoard;
