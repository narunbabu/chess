// src/components/play/ActivePlayerBar.js
// Premium player bar: avatar · name · rating · captured pieces · clock

import React, { useMemo } from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_UNICODE = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
};
const STARTING_PIECES = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

const getCapturedPieces = (game, color) => {
  if (!game || typeof game.board !== 'function') return { pieces: [], material: 0 };
  const board = game.board();
  const current = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.color === color) current[sq.type] = (current[sq.type] || 0) + 1;
    }
  }
  const captured = [];
  for (const piece of ['q', 'r', 'b', 'n', 'p']) {
    const count = STARTING_PIECES[piece] - (current[piece] || 0);
    for (let i = 0; i < count; i++) captured.push(piece);
  }
  const myMaterial = Object.entries(current).reduce((sum, [p, c]) => sum + (PIECE_VALUES[p] || 0) * c, 0);
  return { pieces: captured, material: myMaterial };
};

const formatTime = (seconds) => {
  if (seconds == null || isNaN(seconds)) return '--:--';
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
};

const ActivePlayerBar = ({
  name, rating, playerData, time, isActive, isWhite,
  game, isTop = false, mode = 'computer', isTimerRunning = false,
}) => {
  const avatarUrl = getPlayerAvatar(playerData);
  const initial = (name || '?')[0].toUpperCase();

  const capturedColor = isWhite ? 'b' : 'w';
  const capturedInfo = useMemo(() => getCapturedPieces(game, capturedColor), [game?.fen?.(), capturedColor]);
  const myInfo = useMemo(() => getCapturedPieces(game, isWhite ? 'w' : 'b'), [game?.fen?.(), isWhite]);
  const oppInfo = useMemo(() => getCapturedPieces(game, isWhite ? 'b' : 'w'), [game?.fen?.(), isWhite]);
  const matDiff = (myInfo.material || 0) - (oppInfo.material || 0);

  const isLow = time != null && time < 30;
  const isCritical = time != null && time < 10;
  const showPulse = isActive && isTimerRunning;

  return (
    <div className={`apb ${isActive ? 'apb-active' : 'apb-idle'} ${isTop ? 'apb-top' : 'apb-bottom'}`}>
      {/* Avatar */}
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="apb-avatar" />
      ) : (
        <div className={`apb-avatar apb-avatar-fallback ${isWhite ? 'apb-avatar-white' : 'apb-avatar-black'}`}>
          {initial}
        </div>
      )}

      {/* Name + Rating + Captures */}
      <div className="apb-info">
        <div className="apb-name-row">
          <span className={`apb-name ${isActive ? 'apb-name-active' : ''}`}>{name || 'Player'}</span>
          {rating != null && <span className="apb-rating">{rating}</span>}
        </div>
        {capturedInfo.pieces.length > 0 && (
          <div className="apb-captures">
            {capturedInfo.pieces.map((p, i) => (
              <span key={i} className="apb-capture-piece">{PIECE_UNICODE[capturedColor][p]}</span>
            ))}
            {matDiff > 0 && <span className="apb-mat-adv">+{matDiff}</span>}
          </div>
        )}
      </div>

      {/* Clock */}
      <div className={`apb-clock ${isActive ? (isCritical ? 'apb-clock-critical' : isLow ? 'apb-clock-low' : 'apb-clock-active') : 'apb-clock-idle'} ${showPulse && !isCritical ? 'apb-clock-pulse' : ''}`}>
        <span className="apb-clock-digits">{formatTime(time)}</span>
      </div>
    </div>
  );
};

export default ActivePlayerBar;
