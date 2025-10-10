import React from 'react';
import '../../styles/UnifiedCards.css';

/**
 * PlayersList - Displays available players to challenge
 * Pure UI component with no business logic
 *
 * @param {array} players - List of available players
 * @param {array} sentInvitations - List of sent invitations to check invited status
 * @param {function} onChallenge - Callback when challenge button is clicked
 */
const PlayersList = ({ players, sentInvitations, onChallenge }) => {
  return (
    <div className="unified-section">
      <h2 className="unified-section-header">🎯 Available Players</h2>
      <div className="unified-card-grid cols-2">
        {players.length > 0 ? (
          players.map((player, index) => {
            const hasInvited = sentInvitations.some(
              (inv) => inv.invited_id === player.id
            );
            return (
              <div key={player.id || index} className="unified-card horizontal">
                <img
                  src={
                    player.avatar ||
                    `https://i.pravatar.cc/150?u=${player.email}`
                  }
                  alt={player.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">{player.name}</h3>
                  <p className="unified-card-subtitle">{player.email}</p>
                  <p className="unified-card-info">
                    Rating: {player.rating || 1200}
                  </p>
                  <span className="unified-card-status online">🟢 Online</span>
                </div>
                <div className="unified-card-actions">
                  {hasInvited ? (
                    <button className="unified-card-btn neutral" disabled>
                      ⏳ Invited
                    </button>
                  ) : (
                    <button
                      className="unified-card-btn primary"
                      onClick={() => onChallenge(player)}
                    >
                      ⚡ Challenge
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="unified-empty-state">
            <p>🤖 No other players available right now.</p>
            <p>Why not invite a friend to play?</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersList;
