
import React from "react";
import { truncatePlayerName, getPlayerAvatar } from '../../utils/playerDisplayUtils';

const ScoreDisplay = ({
  playerScore,
  lastMoveEvaluation,
  computerScore,
  lastComputerEvaluation,
  isOnlineGame,
  mode = 'computer',
  playerData = null,
  opponentData = null
}) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const formatScore = (score) => {
    return typeof score === "number" ? Math.abs(score).toFixed(1) : "0.0";
  };

  const getMoveClassIcon = (classification) => {
    switch (classification?.toLowerCase()) {
      case "excellent": return "⭐";
      case "great": return "🔥";
      case "good": return "✓";
      case "inaccuracy": return "⚠️";
      case "mistake": return "❌";
      case "blunder": return "💥";
      default: return ""; // Don't show anything if no classification
    }
  };

  // Helper function to render avatar or icon
  const renderAvatar = (data, isComputer = false) => {
    // For computer/synthetic: show avatar if available, fall back to robot emoji
    if (isComputer) {
      const avatarUrl = data?.avatar_url || getPlayerAvatar(data);
      if (avatarUrl) {
        return (
          <img
            src={avatarUrl}
            alt={data?.name || 'Opponent'}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />
        );
      }
      return <span style={{ fontSize: '14px' }}>🤖</span>;
    }

    // For player, show avatar if available
    const avatarUrl = getPlayerAvatar(data);
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={data?.name || data?.user?.name || 'Player'}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
      );
    }

    // No avatar available - show placeholder emoji
    return <span style={{ fontSize: '14px' }}>👤</span>;
  };

  // Helper function to get display name
  const getDisplayName = (data, isComputer = false, fallback = 'Player') => {
    if (isComputer) {
      // Show synthetic player's name if available, fall back to CPU
      const name = data?.name || data?.user?.name;
      return truncatePlayerName(name || 'CPU');
    }
    // Handle both naming conventions: data.name or data.user.name
    const name = data?.name || data?.user?.name;
    return truncatePlayerName(name || fallback);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: isMobile ? '4px' : '8px',
      fontSize: isMobile ? '12px' : '14px'
    }}>
      {/* Computer/Opponent Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '4px' : '6px',
        padding: isMobile ? '5px 8px' : '6px 10px',
        borderRadius: '6px',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        border: '1px solid rgba(231, 76, 60, 0.3)',
        flex: '1',
        minWidth: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
          {renderAvatar(opponentData, mode === 'computer')}
          <span style={{ fontSize: isMobile ? '12px' : '14px', color: '#e74c3c', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getDisplayName(opponentData, mode === 'computer', 'Rival')}
          </span>
          {lastComputerEvaluation && (
            <span style={{ fontSize: isMobile ? '10px' : '12px', color: '#e74c3c' }}>
              {getMoveClassIcon(lastComputerEvaluation.moveClassification)}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: 'monospace',
          fontSize: isMobile ? '13px' : '16px',
          fontWeight: 'bold',
          color: '#e74c3c',
          marginLeft: 'auto',
          flexShrink: 0
        }}>
          {formatScore(computerScore)}
        </span>
      </div>

      {/* VS separator */}
      <div style={{
        fontSize: isMobile ? '10px' : '12px',
        color: '#8b8987',
        fontWeight: 'bold',
        padding: '0 2px',
        flexShrink: 0
      }}>
        VS
      </div>

      {/* Player Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '4px' : '6px',
        padding: isMobile ? '5px 8px' : '6px 10px',
        borderRadius: '6px',
        backgroundColor: 'rgba(129, 182, 76, 0.1)',
        border: '1px solid rgba(129, 182, 76, 0.3)',
        flex: '1',
        minWidth: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
          {renderAvatar(playerData, false)}
          <span style={{ fontSize: isMobile ? '12px' : '14px', color: '#81b64c', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getDisplayName(playerData, false, 'You')}
          </span>
          {lastMoveEvaluation && (
            <span style={{ fontSize: isMobile ? '10px' : '12px', color: '#81b64c' }}>
              {getMoveClassIcon(lastMoveEvaluation.moveClassification)}
            </span>
          )}
        </div>
        <span style={{
          fontFamily: 'monospace',
          fontSize: isMobile ? '13px' : '16px',
          fontWeight: 'bold',
          color: '#81b64c',
          marginLeft: 'auto',
          flexShrink: 0
        }}>
          {formatScore(playerScore)}
        </span>
      </div>
    </div>
  );
};

export default ScoreDisplay;
