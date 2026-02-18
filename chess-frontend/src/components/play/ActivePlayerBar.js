// src/components/play/ActivePlayerBar.js
// Professional player bar for above/below the chess board
// Shows: avatar, name, rating, captured pieces, clock

import React, { useMemo } from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';

// Piece values for material calculation
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_UNICODE = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
};
const STARTING_PIECES = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

// Compute captured pieces from current position
const getCapturedPieces = (game, color) => {
  if (!game || typeof game.board !== 'function') return { pieces: [], advantage: 0 };
  const board = game.board();
  const current = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.color === color) {
        current[sq.type] = (current[sq.type] || 0) + 1;
      }
    }
  }

  // Captured = starting - current
  const captured = [];
  for (const piece of ['q', 'r', 'b', 'n', 'p']) {
    const count = STARTING_PIECES[piece] - (current[piece] || 0);
    for (let i = 0; i < count; i++) {
      captured.push(piece);
    }
  }

  // Material advantage = my material - opponent material
  const myMaterial = Object.entries(current).reduce((sum, [p, c]) => sum + (PIECE_VALUES[p] || 0) * c, 0);
  return { pieces: captured, material: myMaterial };
};

const formatTime = (seconds) => {
  if (seconds == null || isNaN(seconds)) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const ActivePlayerBar = ({
  name,
  rating,
  playerData,
  time,          // seconds remaining
  isActive,      // is it this player's turn?
  isWhite,       // is this player white?
  game,          // Chess.js instance (for captured pieces)
  score,         // centipawn score (if available)
  materialAdv,   // material advantage number (positive = this player ahead)
  isTop = false, // opponent bar (above board)
  mode = 'computer',
  isTimerRunning = false,
}) => {
  const avatarUrl = getPlayerAvatar(playerData);
  const initial = (name || '?')[0].toUpperCase();

  // Captured pieces for this bar's opponent (pieces THIS player captured FROM the other side)
  const capturedColor = isWhite ? 'b' : 'w'; // we show pieces captured FROM the opponent
  const capturedInfo = useMemo(() => {
    return getCapturedPieces(game, capturedColor);
  }, [game?.fen?.(), capturedColor]);

  // Material advantage
  const myInfo = useMemo(() => getCapturedPieces(game, isWhite ? 'w' : 'b'), [game?.fen?.(), isWhite]);
  const oppInfo = useMemo(() => getCapturedPieces(game, isWhite ? 'b' : 'w'), [game?.fen?.(), isWhite]);
  const matDiff = (myInfo.material || 0) - (oppInfo.material || 0);

  const isLowTime = time != null && time < 30;
  const isCriticalTime = time != null && time < 10;
  const showPulse = isActive && isTimerRunning;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-300
        ${isActive
          ? 'bg-[#312e2b] border-2 border-[#81b64c]/60 shadow-[0_0_8px_rgba(129,182,76,0.15)]'
          : 'bg-[#262421] border border-[#3d3a37]'
        }
        ${isTop ? 'mb-1' : 'mt-1'}
      `}
    >
      {/* Avatar */}
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#4a4744] flex-shrink-0" />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border flex-shrink-0
          ${isWhite ? 'bg-[#f0d9b5] text-[#4a3728] border-[#d4b896]' : 'bg-[#4a3728] text-[#f0d9b5] border-[#6b5a48]'}`}>
          {initial}
        </div>
      )}

      {/* Name + Rating + Captured pieces */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate max-w-[100px] sm:max-w-[140px] lg:max-w-[180px]
            ${isActive ? 'text-white' : 'text-[#bababa]'}`}>
            {name || 'Player'}
          </span>
          {rating != null && (
            <span className="text-[10px] text-[#8b8987] bg-[#1a1a18] px-1.5 py-0.5 rounded font-mono flex-shrink-0">
              {rating}
            </span>
          )}
        </div>
        {/* Captured pieces row */}
        {capturedInfo.pieces.length > 0 && (
          <div className="flex items-center gap-0 mt-0.5 flex-wrap">
            {capturedInfo.pieces.map((p, i) => (
              <span key={i} className="text-[11px] leading-none opacity-70">
                {PIECE_UNICODE[capturedColor][p]}
              </span>
            ))}
            {matDiff > 0 && (
              <span className="text-[10px] text-[#81b64c] font-semibold ml-1">+{matDiff}</span>
            )}
          </div>
        )}
      </div>

      {/* Clock */}
      <div
        className={`flex-shrink-0 px-3 py-1.5 rounded-md transition-all duration-300
          ${isActive
            ? isCriticalTime
              ? 'bg-[#c33a3a] text-white'
              : isLowTime
                ? 'bg-[#e8a93e]/20 text-[#e8a93e] border border-[#e8a93e]/40'
                : 'bg-[#81b64c]/15 text-white border border-[#81b64c]/40'
            : 'bg-[#1a1a18] text-[#8b8987] border border-[#3d3a37]'
          }
          ${showPulse ? 'animate-[clock-pulse_2s_ease-in-out_infinite]' : ''}
        `}
      >
        <span className="font-mono text-base font-bold tabular-nums tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(time)}
        </span>
      </div>

      {/* Clock pulse animation */}
      <style>{`
        @keyframes clock-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(129, 182, 76, 0); }
          50% { box-shadow: 0 0 8px 2px rgba(129, 182, 76, 0.25); }
        }
      `}</style>
    </div>
  );
};

export default ActivePlayerBar;
