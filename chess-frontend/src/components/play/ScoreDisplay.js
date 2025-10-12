
import React from "react";

const ScoreDisplay = ({ playerScore, lastMoveEvaluation, computerScore, lastComputerEvaluation, isOnlineGame, players, playerColor }) => {
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

  const playerName = isOnlineGame && players ? players[playerColor]?.name : "You";
  const opponentName = isOnlineGame && players ? players[playerColor === 'w' ? 'b' : 'w']?.name : "CPU";

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px'
    }}>
      {/* Computer Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '6px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        flex: '1'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '500' }}>
            {isOnlineGame ? '👤' : '🤖'} {opponentName}
          </span>
          {lastComputerEvaluation && (
            <span style={{ fontSize: '12px', color: '#ef4444' }}>
              {getMoveClassIcon(lastComputerEvaluation.moveClassification)}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#ef4444',
          marginLeft: 'auto'
        }}>
          {formatScore(computerScore)}
        </span>
      </div>

      {/* VS separator */}
      <div style={{
        fontSize: '12px',
        color: '#666',
        fontWeight: 'bold',
        padding: '0 4px'
      }}>
        VS
      </div>

      {/* Player Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '6px',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        flex: '1'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: '500' }}>
            👤 {playerName}
          </span>
          {lastMoveEvaluation && (
            <span style={{ fontSize: '12px', color: '#22c55e' }}>
              {getMoveClassIcon(lastMoveEvaluation.moveClassification)}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#22c55e',
          marginLeft: 'auto'
        }}>
          {formatScore(playerScore)}
        </span>
      </div>
    </div>
  );
};

export default ScoreDisplay;
