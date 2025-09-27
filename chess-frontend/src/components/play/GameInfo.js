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
}) => {
  const getStatusIcon = () => {
    if (isReplayMode) return "⏯️";
    if (game?.isCheckmate()) return "♔";
    if (game?.isCheck()) return "⚠️";
    if (game?.isStalemate()) return "🤝";
    if (moveCompleted && activeTimer === playerColor && settings?.requireDoneButton) return "✅";
    return "ℹ️";
  };

  const getPlayerColorIcon = () => {
    return playerColor === "w" ? "⚪" : "⚫";
  };

  const getCurrentTurnIcon = () => {
    if (!game) return "❓";
    return game.turn() === "w" ? "⚪" : "⚫";
  };

  return (
    <div className="space-y-3">
      {/* Game Status */}
      {gameStatus && (
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStatusIcon()}</span>
            <span className="text-sm text-white font-medium">{gameStatus}</span>
          </div>
        </div>
      )}

      {/* Player Info & Turn */}
      <div className="bg-white/10 rounded-lg p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getPlayerColorIcon()}</span>
              <span className="text-xs text-white/80">You</span>
            </div>
            <span className="text-sm text-white">{playerColor === "w" ? "White" : "Black"}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getCurrentTurnIcon()}</span>
              <span className="text-xs text-white/80">Turn</span>
            </div>
            <span className="text-sm text-white">{game && game.turn() === "w" ? "White" : "Black"}</span>
          </div>
        </div>
      </div>

      {/* Move Completion Hint */}
      {moveCompleted &&
        activeTimer === playerColor &&
        !isReplayMode &&
        settings?.requireDoneButton && (
          <div className="bg-success/20 border border-success/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="text-xs text-success">Tap timer to confirm</span>
            </div>
          </div>
        )}

      {/* Replay Info */}
      {isReplayMode && (
        <div className="bg-accent/20 border border-accent/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏯️</span>
              <span className="text-xs text-accent">Replay</span>
            </div>
            <span className="text-sm text-white">{currentReplayMove} / {totalMoves}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameInfo;
