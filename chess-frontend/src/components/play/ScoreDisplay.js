
import React from "react";

const ScoreDisplay = ({ playerScore, lastMoveEvaluation, computerScore, lastComputerEvaluation }) => {
  const formatScore = (score) => {
    return typeof score === "number" ? score.toFixed(1) : "0.0";
  };

  const getMoveClassIcon = (classification) => {
    switch (classification?.toLowerCase()) {
      case "excellent": return "⭐";
      case "great": return "🔥";
      case "good": return "✓";
      case "inaccuracy": return "⚠️";
      case "mistake": return "❌";
      case "blunder": return "💥";
      default: return "•";
    }
  };

  return (
    <div className="space-y-3">
      {/* Player Score */}
      <div className="bg-primary/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <span className="text-sm font-medium text-white">You</span>
          </div>
          <span className="text-lg font-bold text-success">{formatScore(playerScore)}</span>
        </div>
        {lastMoveEvaluation && (
          <div className="flex items-center gap-1 mt-1 text-xs text-white/80">
            <span>{getMoveClassIcon(lastMoveEvaluation.moveClassification)}</span>
            <span>+{formatScore(lastMoveEvaluation.total)}</span>
          </div>
        )}
      </div>

      {/* Computer Score */}
      <div className="bg-secondary/20 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="text-sm font-medium text-white">CPU</span>
          </div>
          <span className="text-lg font-bold text-error">{formatScore(computerScore)}</span>
        </div>
        {lastComputerEvaluation && (
          <div className="flex items-center gap-1 mt-1 text-xs text-white/80">
            <span>{getMoveClassIcon(lastComputerEvaluation.moveClassification)}</span>
            <span>+{formatScore(lastComputerEvaluation.total)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreDisplay;
