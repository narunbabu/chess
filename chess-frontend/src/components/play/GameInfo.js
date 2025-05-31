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
  settings, // Added settings prop
}) => {
  return (
    <div className="game-info" style={{ marginTop: "15px" }}>
      {gameStatus && (
        <div className="game-status" style={{ fontWeight: "bold" }}>
          {gameStatus}
        </div>
      )}

      <div className="player-info">
        Your Color: {playerColor === "w" ? "White" : "Black"}
      </div>

      <div className="turn-info">
        {/* Check if game object exists before calling turn() */}
        Turn: {game && game.turn() === "w" ? "White" : "Black"}
      </div>

      {/* Show hint only if button is required, player's turn, and move is completed */}
      {moveCompleted &&
        activeTimer === playerColor &&
        !isReplayMode &&
        settings?.requireDoneButton && ( // Check if settings exist and button is required
          <div
            className="move-hint"
          >
            Move completed! Click the timer button to end your turn.
          </div>
        )}

      {isReplayMode && (
        <div className="replay-info" style={{ marginTop: "10px" }}>
          <div>Replaying saved game</div>
          <div>
            {/* Adjust move display for 0-based index */}
            Move: {currentReplayMove} / {totalMoves}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameInfo;
