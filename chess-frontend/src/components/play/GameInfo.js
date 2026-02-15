/*
 * File: src/components/play/GameInfo.js
 * Modifications:
 * - Added `settings` to props.
 * - Conditionally rendered the "Move completed!" hint based on `settings.requireDoneButton`.
 */
import React from "react";

const GameInfo = ({
  gameStatus,
  playerColor,
  game,
  moveCompleted,
  activeTimer,
  isReplayMode,
  currentReplayMove,
  totalMoves,
  settings,
  isOnlineGame,
  players,
}) => {
  const getStatusIcon = () => {
    if (isReplayMode) return "⏯️";
    if (game?.isCheckmate()) return "♔";
    if (game?.isCheck()) return "⚠️";
    if (game?.isStalemate()) return "🤝";
    if (moveCompleted && activeTimer === playerColor && settings?.requireDoneButton) return "✅";
    return "ℹ️";
  };

  // Filter out redundant turn status since it's shown in timer section
  const shouldShowStatus = () => {
    if (!gameStatus) return false;

    // Don't show basic turn status like "White's turn" or "Black's turn"
    if (gameStatus.match(/^(White|Black)'s turn$/i)) return false;

    // Show important game states
    return true;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Important Game Status Only - not basic turn info */}
      {shouldShowStatus() && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '0.375rem',
          fontSize: '0.875rem'
        }}>
          <span style={{ fontSize: '1rem' }}>{getStatusIcon()}</span>
          <span style={{ color: '#bababa', fontWeight: '500' }}>{gameStatus}</span>
        </div>
      )}

      {/* Move Completion Hint */}
      {moveCompleted &&
        activeTimer === playerColor &&
        !isReplayMode &&
        settings?.requireDoneButton && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
            backgroundColor: 'rgba(129, 182, 76, 0.15)',
            border: '1px solid rgba(129, 182, 76, 0.4)',
            borderRadius: '0.375rem',
            fontSize: '0.75rem'
          }}>
            <span style={{ fontSize: '1rem' }}>✅</span>
            <span style={{ color: '#81b64c' }}>Tap timer to confirm</span>
          </div>
        )}

      {/* Replay Info */}
      {isReplayMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'rgba(232, 169, 62, 0.15)',
          border: '1px solid rgba(232, 169, 62, 0.4)',
          borderRadius: '0.375rem',
          fontSize: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>⏯️</span>
            <span style={{ color: '#e8a93e' }}>Replay</span>
          </div>
          <span style={{ color: '#fff', fontSize: '0.875rem' }}>
            {currentReplayMove} / {totalMoves}
          </span>
        </div>
      )}
    </div>
  );
};

export default GameInfo;
