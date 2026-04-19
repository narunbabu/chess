// src/components/game/CompanionControls.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getStockfishTopMoves, mapDepthToMoveTime } from '../../utils/computerMoveUtils';

/**
 * CompanionControls Component
 * Lets the player ask an AI companion to play moves on their behalf.
 *
 * @param {Object}   props.companion   - Selected companion { name, computer_level, rating, ... }
 * @param {Object}   props.game        - chess.js game instance
 * @param {Function} props.onMove      - Called with { from, to, promotion } when companion plays
 * @param {Function} props.onDismiss   - Called when user releases the companion
 * @param {boolean}  props.isMyTurn    - Whether it's the player's turn right now
 * @param {boolean}  props.disabled    - Disable all controls (game not started / game over)
 */
const CompanionControls = ({ companion, game, onMove, onDismiss, isMyTurn, disabled = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [error, setError] = useState(null);

  // Use a ref for continuous-play so the value is always current inside async callbacks
  const continuousRef = useRef(false);
  const [continuousPlay, setContinuousPlay] = useState(false);
  const setContinuous = (val) => {
    continuousRef.current = val;
    setContinuousPlay(val);
  };

  /** Ask the local Stockfish worker for the best move at the companion's level */
  const getMove = useCallback(async () => {
    if (!game || isLoading) return null;
    const fen = game.fen();
    const level = companion?.computer_level || 6;
    const timeMs = mapDepthToMoveTime(level);

    setIsLoading(true);
    setError(null);
    try {
      const moves = await getStockfishTopMoves(fen, 1, timeMs);
      if (!moves || moves.length === 0) throw new Error('No moves returned');

      // getStockfishTopMoves returns [{move, cp}]; extract the UCI string.
      // String() guard: move could theoretically be non-string in edge cases.
      const uci = String(moves[0]?.move ?? '');
      if (uci.length < 4) throw new Error(`Invalid UCI move from Stockfish: "${uci}"`);
      return {
        from: uci.substring(0, 2),
        to: uci.substring(2, 4),
        // Only include promotion key when it's an actual promotion move (5-char UCI like "e7e8q").
        // Omitting the key entirely (vs passing undefined) prevents chess.js from receiving
        // promotion:undefined for normal moves, which can cause confusion in some edge cases.
        ...(uci.length > 4 && { promotion: uci[4] }),
      };
    } catch (err) {
      console.error('[CompanionControls] Failed to get move:', err);
      setError('Could not calculate move — try again');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [game, companion, isLoading]);

  /** Play exactly one move on behalf of the player */
  const handlePlayOne = useCallback(async () => {
    const move = await getMove();
    if (move) {
      setMoveCount(c => c + 1);
      onMove?.(move);
    }
  }, [getMove, onMove]);

  /** Toggle continuous play */
  const handleToggleContinuous = useCallback(async () => {
    if (continuousRef.current) {
      setContinuous(false);
      return;
    }
    setContinuous(true);
    // Play the first move immediately (subsequent moves fire via the useEffect below)
    const move = await getMove();
    if (move && continuousRef.current) {
      setMoveCount(c => c + 1);
      onMove?.(move);
    } else {
      setContinuous(false);
    }
  }, [getMove, onMove]);

  // When it becomes the player's turn AND continuous play is active, play the next move
  useEffect(() => {
    if (!continuousRef.current || !isMyTurn || isLoading || disabled) return;
    // Small delay so the board visually settles after the opponent's move
    const timer = setTimeout(async () => {
      if (!continuousRef.current || !isMyTurn) return;
      const move = await getMove();
      if (move && continuousRef.current) {
        setMoveCount(c => c + 1);
        onMove?.(move);
      } else {
        setContinuous(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn]);

  // Stop continuous play when game ends or companion is disabled
  useEffect(() => {
    if (disabled && continuousRef.current) setContinuous(false);
  }, [disabled]);

  if (!companion) return null;

  const canAct = !disabled && isMyTurn && !isLoading;

  return (
    <div style={{
      background: '#f5f0ff',
      border: '1px solid #d8b4fe',
      borderRadius: '8px',
      padding: '12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'bold', fontSize: '14px', flexShrink: 0,
          }}>
            {companion.name?.charAt(0) || 'A'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>{companion.name}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              Playing on your behalf · Rated {companion.rating}
            </div>
          </div>
        </div>
        {moveCount > 0 && (
          <div style={{
            fontSize: '11px', color: '#7c3aed',
            background: '#ede9fe', borderRadius: '12px',
            padding: '2px 8px', whiteSpace: 'nowrap',
          }}>
            {moveCount} move{moveCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        {/* Play One Move */}
        <button
          onClick={handlePlayOne}
          disabled={!canAct || continuousPlay}
          style={{
            flex: 1, padding: '7px 6px', borderRadius: '6px',
            fontSize: '12px', fontWeight: '500', cursor: canAct && !continuousPlay ? 'pointer' : 'not-allowed',
            border: '1px solid #c4b5fd',
            background: canAct && !continuousPlay ? '#fff' : '#f3f4f6',
            color: canAct && !continuousPlay ? '#7c3aed' : '#9ca3af',
            transition: 'all 0.15s',
          }}
        >
          {isLoading && !continuousPlay ? '⏳ Thinking…' : '▶ Play One Move'}
        </button>

        {/* Play Until Stopped / Stop */}
        <button
          onClick={handleToggleContinuous}
          disabled={!canAct && !continuousPlay}
          style={{
            flex: 1, padding: '7px 6px', borderRadius: '6px',
            fontSize: '12px', fontWeight: '500',
            cursor: (canAct || continuousPlay) ? 'pointer' : 'not-allowed',
            border: 'none',
            background: continuousPlay ? '#ef4444' : canAct ? '#a855f7' : '#e5e7eb',
            color: continuousPlay ? '#fff' : canAct ? '#fff' : '#9ca3af',
            transition: 'all 0.15s',
          }}
        >
          {continuousPlay
            ? (isLoading ? '⏳ Thinking…' : '⏹ Stop')
            : '⏩ Play Until Stopped'}
        </button>
      </div>

      {/* Status */}
      {error && (
        <div style={{ fontSize: '11px', color: '#dc2626', textAlign: 'center', marginBottom: '4px' }}>
          {error}
        </div>
      )}
      {!isMyTurn && !disabled && (
        <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
          {continuousPlay ? '⏳ Waiting for opponent…' : 'Waiting for your turn'}
        </div>
      )}

      {/* Release */}
      {onDismiss && (
        <button
          onClick={() => { setContinuous(false); onDismiss(); }}
          style={{
            marginTop: '8px', width: '100%', background: 'none', border: 'none',
            fontSize: '11px', color: '#9ca3af', cursor: 'pointer', padding: '2px 0',
            textDecoration: 'underline',
          }}
        >
          Release companion
        </button>
      )}
    </div>
  );
};

export default CompanionControls;
