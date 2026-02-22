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
// Determine player activity status label + color (L-R6)
const getPlayerStatus = (player) => {
  if (player.type === 'synthetic') return { label: 'Available', color: '#81b64c' };
  if (player.status === 'playing' || player.in_game) return { label: 'Playing', color: '#e8a93e' };
  if (player.status === 'idle') return { label: 'Idle', color: '#8b8987' };
  return { label: 'Online', color: '#81b64c' };
};

const PlayersList = ({ players, onChallenge }) => {
  const [showAll, setShowAll] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [maxRating, setMaxRating] = useState('');

  // Filter out any legacy computer entries, then apply rating range (L-R3)
  const allPlayers = players
    .filter(p => !p.isComputer && p.id !== 'computer')
    .filter(p => {
      const r = p.rating || 1200;
      if (minRating !== '' && r < Number(minRating)) return false;
      if (maxRating !== '' && r > Number(maxRating)) return false;
      return true;
    });

  const visiblePlayers = showAll ? allPlayers : allPlayers.slice(0, COLLAPSED_COUNT);
  const hiddenCount = allPlayers.length - COLLAPSED_COUNT;

  return (
    <div className="unified-section">
      <h2 className="unified-section-header">Online Players</h2>

      {/* Rating Range Filter (L-R3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#8b8987', fontSize: '0.85rem', fontWeight: 600 }}>Rating:</span>
        <input
          type="number"
          placeholder="Min"
          value={minRating}
          onChange={e => setMinRating(e.target.value)}
          style={{
            width: '72px', padding: '4px 8px', borderRadius: '6px',
            background: '#312e2b', border: '1px solid #4a4744',
            color: '#e5e7eb', fontSize: '0.85rem'
          }}
        />
        <span style={{ color: '#5c5a57' }}>–</span>
        <input
          type="number"
          placeholder="Max"
          value={maxRating}
          onChange={e => setMaxRating(e.target.value)}
          style={{
            width: '72px', padding: '4px 8px', borderRadius: '6px',
            background: '#312e2b', border: '1px solid #4a4744',
            color: '#e5e7eb', fontSize: '0.85rem'
          }}
        />
        {(minRating || maxRating) && (
          <button
            onClick={() => { setMinRating(''); setMaxRating(''); }}
            style={{
              background: 'transparent', border: 'none',
              color: '#8b8987', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="unified-card-grid cols-2">
        {visiblePlayers.length > 0 ? (
          visiblePlayers.map((player, index) => {
            const status = getPlayerStatus(player);
            return (
            <div key={`${player.type || 'human'}-${player.id || index}`} className="unified-card horizontal">
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={
                    player.avatar_url ||
                    getPlayerAvatar(player) ||
                    `https://i.pravatar.cc/150?u=${player.email || `user${player.id}`}`
                  }
                  alt={player.name}
                  className="unified-card-avatar"
                />
                {/* Status dot (L-R6) */}
                <span style={{
                  position: 'absolute', bottom: '1px', right: '1px',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: status.color,
                  border: '2px solid #312e2b',
                  display: 'block',
                }} title={status.label} />
              </div>
              <div className="unified-card-content">
                <h3 className="unified-card-title">
                  {player.name}
                  {player.type === 'synthetic' && (
                    <span style={{
                      marginLeft: '6px', fontSize: '0.65rem', fontWeight: 700,
                      background: 'rgba(129, 182, 76, 0.15)', color: '#81b64c',
                      padding: '1px 5px', borderRadius: '4px', verticalAlign: 'middle',
                    }}>BOT</span>
                  )}
                </h3>
                <p className="unified-card-info">
                  Rating: {player.rating || 1200}
                  {player.personality && (
                    <span style={{ marginLeft: '8px', color: '#8b8987', fontSize: '0.8rem' }}>
                      {player.personality}
                    </span>
                  )}
                </p>
                <span className="unified-card-status online" style={{ color: status.color }}>{status.label}</span>
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
            );
          })
        ) : (
          <div className="unified-empty-state">
            {(minRating || maxRating) ? (
              <p>No players in that rating range. Try adjusting the filter.</p>
            ) : (
              <>
                <p>No other players are online right now.</p>
                <p>Use "Play Online" above to find an opponent, or search for a friend.</p>
              </>
            )}
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
