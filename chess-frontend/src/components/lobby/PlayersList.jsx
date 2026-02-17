import React, { useState } from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

const COLLAPSED_COUNT = 3;

/**
 * PlayersList - Displays available players to challenge
 * Shows top 3 collapsed with expand toggle, full list when expanded.
 *
 * @param {array} players - Combined list of real + synthetic players
 * @param {function} onChallenge - Callback when challenge button is clicked
 */
const PlayersList = ({ players, onChallenge }) => {
  const [showAll, setShowAll] = useState(false);

  // Filter out any legacy computer entries
  const allPlayers = players.filter(p => !p.isComputer && p.id !== 'computer');
  const visiblePlayers = showAll ? allPlayers : allPlayers.slice(0, COLLAPSED_COUNT);
  const hiddenCount = allPlayers.length - COLLAPSED_COUNT;

  return (
    <div className="unified-section">
      <h2 className="unified-section-header">Online Players</h2>
      <div className="unified-card-grid cols-2">
        {visiblePlayers.length > 0 ? (
          visiblePlayers.map((player, index) => (
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
      {allPlayers.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          style={{
            display: 'block',
            margin: '1rem auto 0',
            padding: '0.5rem 1.25rem',
            background: 'transparent',
            border: '1px solid #4a4744',
            borderRadius: '8px',
            color: '#bababa',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.target.style.background = '#3d3a37'; e.target.style.color = '#fff'; }}
          onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#bababa'; }}
        >
          {showAll ? 'Show less' : `Show ${hiddenCount} more player${hiddenCount !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
};

export default PlayersList;
