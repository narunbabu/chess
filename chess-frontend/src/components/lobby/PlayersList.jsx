import React from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

/**
 * PlayersList - Displays available players to challenge
 * Pure UI component with no business logic
 *
 * @param {array} players - List of available players
 * @param {array} sentInvitations - List of sent invitations to check invited status
 * @param {function} onChallenge - Callback when challenge button is clicked
 * @param {function} onComputerChallenge - Callback when computer challenge button is clicked
 */
const PlayersList = ({ players, sentInvitations, onChallenge, onComputerChallenge }) => {
  return (
    <div className="unified-section">
      <h2 className="unified-section-header">🎯 Available Players</h2>
      <div className="unified-card-grid cols-2">
        {players.length > 0 ? (
          players.map((player, index) => {
            // Check if this is the Computer player
            const isComputer = player.isComputer || player.id === 'computer';

            // Only check for PENDING invitations (not accepted/declined) for human players
            const hasPendingInvitation = !isComputer && sentInvitations.some(
              (inv) => inv.invited_id === player.id && inv.status === 'pending'
            );
            return (
              <div key={player.id || index} className="unified-card horizontal">
                <img
                  src={
                    isComputer
                      ? 'https://api.dicebear.com/7.x/bottts/svg?seed=computer'
                      : getPlayerAvatar(player) ||
                        `https://i.pravatar.cc/150?u=${player.email || `user${player.id}`}`
                  }
                  alt={player.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">
                    {player.name}
                    {isComputer && ' 🤖'}
                  </h3>
                  <p className="unified-card-subtitle">{player.email}</p>
                  <p className="unified-card-info">
                    Rating: {player.rating || 1200}
                  </p>
                  <span className="unified-card-status online">🟢 Online</span>
                </div>
                <div className="unified-card-actions">
                  {hasPendingInvitation ? (
                    <button className="unified-card-btn neutral" disabled>
                      ⏳ Invited
                    </button>
                  ) : (
                    <button
                      className="unified-card-btn primary"
                      onClick={() => isComputer ? onComputerChallenge() : onChallenge(player)}
                    >
                      ⚡ {isComputer ? 'Play' : 'Challenge'}
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
