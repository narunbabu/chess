import React from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

/**
 * PlayersList - Displays available players to challenge
 * Shows real online players first, then synthetic players.
 * Users cannot distinguish between real and synthetic players.
 *
 * @param {array} players - Combined list of real + synthetic players
 * @param {array} sentInvitations - List of sent invitations to check invited status
 * @param {function} onChallenge - Callback when challenge button is clicked
 */
const PlayersList = ({ players, onChallenge }) => {
  // Filter out any legacy computer entries
  const allPlayers = players.filter(p => !p.isComputer && p.id !== 'computer');

  return (
    <div className="unified-section">
      <h2 className="unified-section-header">Online Players</h2>
      <div className="unified-card-grid cols-2">
        {allPlayers.length > 0 ? (
          allPlayers.map((player, index) => (
            <div key={`${player.type || 'human'}-${player.id || index}`} className="unified-card horizontal">
              <img
                src={
                  player.avatar_url ||
                  getPlayerAvatar(player) ||
                  `https://i.pravatar.cc/150?u=${player.email || `user${player.id}`}`
                }
                alt={player.name}
                className="unified-card-avatar"
              />
              <div className="unified-card-content">
                <h3 className="unified-card-title">{player.name}</h3>
                <p className="unified-card-info">
                  Rating: {player.rating || 1200}
                </p>
                <span className="unified-card-status online">Online</span>
              </div>
              <div className="unified-card-actions">
                <button
                  className="unified-card-btn primary"
                  onClick={() => onChallenge(player)}
                >
                  Challenge
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="unified-empty-state">
            <p>No other players are online right now.</p>
            <p>Use "Play Online" above to find an opponent, or search for a friend.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersList;
