import React from 'react';

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
    <div className="available-players-section">
      <h2>🎯 Available Players</h2>
      <div className="player-list">
        {players.length > 0 ? (
          players.map((player, index) => {
            const hasInvited = sentInvitations.some(
              (inv) => inv.invited_id === player.id
            );
            return (
              <div key={player.id || index} className="player-card">
                <img
                  src={
                    player.avatar ||
                    `https://i.pravatar.cc/150?u=${player.email}`
                  }
                  alt={player.name}
                  className="player-avatar"
                />
                <div className="player-info">
                  <h3>{player.name}</h3>
                  <p className="player-email">{player.email}</p>
                  <p className="player-rating">
                    Rating: {player.rating || 1200}
                  </p>
                  <p className="player-status">🟢 Online</p>
                </div>
                {hasInvited ? (
                  <button className="invite-btn invited" disabled>
                    ⏳ Invited
                  </button>
                ) : (
                  <button
                    className="invite-btn"
                    onClick={() => onChallenge(player)}
                  >
                    ⚡ Challenge
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="no-players">
            <p>🤖 No other players available right now.</p>
            <p>Why not invite a friend to play?</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayersList;
