
import React from "react";
import { truncatePlayerName, getPlayerAvatar } from '../../utils/playerDisplayUtils';

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

  const playerData = isOnlineGame && players ? players[playerColor] : null;
  const opponentData = isOnlineGame && players ? players[playerColor === 'w' ? 'b' : 'w'] : null;
  const playerName = playerData?.name || "You";
  const opponentName = opponentData?.name || "CPU";

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px'
    }}>
      {/* Computer/Opponent Score */}
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
          {isOnlineGame && getPlayerAvatar(opponentData) ? (
            <img
              src={getPlayerAvatar(opponentData)}
              alt={opponentName}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <span style={{ fontSize: '14px' }}>
              {isOnlineGame ? '👤' : '🤖'}
            </span>
          )}
          <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '500' }}>
            {isOnlineGame ? truncatePlayerName(opponentName) : opponentName}
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
          {isOnlineGame && getPlayerAvatar(playerData) ? (
            <img
              src={getPlayerAvatar(playerData)}
              alt={playerName}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <span style={{ fontSize: '14px' }}>👤</span>
          )}
          <span style={{ fontSize: '14px', color: '#22c55e', fontWeight: '500' }}>
            {isOnlineGame ? truncatePlayerName(playerName) : playerName}
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
