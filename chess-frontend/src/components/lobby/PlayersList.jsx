import React, { useState } from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import {
  DEFAULT_USER_RATING,
  isRatingInWindow,
  normalizeRatingWindow,
} from '../../utils/ratingWindow';
import '../../styles/UnifiedCards.css';

const COLLAPSED_COUNT = 3;

/**
 * PlayersList - Displays available players to challenge.
 */
const getPlayerStatus = (player) => {
  if (player.type === 'synthetic') return { label: 'Available', color: '#81b64c' };
  if (player.status === 'playing' || player.in_game) return { label: 'Playing', color: '#e8a93e' };
  if (player.status === 'idle') return { label: 'Idle', color: '#8b8987' };
  return { label: 'Online', color: '#81b64c' };
};

const inputStyle = {
  width: '82px',
  padding: '6px 9px',
  borderRadius: '6px',
  background: '#312e2b',
  border: '1px solid #4a4744',
  color: '#e5e7eb',
  fontSize: '0.85rem',
};

const filterButtonStyle = {
  border: '1px solid #4a4744',
  borderRadius: '7px',
  padding: '6px 10px',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const PlayersList = ({
  players,
  onChallenge,
  title = 'Online Players',
  ratingWindow,
  onRatingWindowChange,
  onApplyRatingWindow,
  onResetRatingWindow,
  isRefreshing = false,
}) => {
  const [showAll, setShowAll] = useState(false);
  const normalizedWindow = normalizeRatingWindow(ratingWindow);

  const updateRatingWindow = (field, value) => {
    onRatingWindowChange?.({
      minRating: ratingWindow?.minRating ?? normalizedWindow.minRating,
      maxRating: ratingWindow?.maxRating ?? normalizedWindow.maxRating,
      [field]: value,
    });
  };

  const allPlayers = players
    .filter(p => !p.isComputer && p.id !== 'computer')
    .filter(p => isRatingInWindow(p.rating ?? DEFAULT_USER_RATING, normalizedWindow));

  const visiblePlayers = showAll ? allPlayers : allPlayers.slice(0, COLLAPSED_COUNT);
  const hiddenCount = Math.max(0, allPlayers.length - COLLAPSED_COUNT);

  return (
    <div className="unified-section">
      <h2 className="unified-section-header">{title}</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#8b8987', fontSize: '0.85rem', fontWeight: 700 }}>ELO</span>
        <input
          type="number"
          min="0"
          max="3200"
          placeholder="From"
          value={ratingWindow?.minRating ?? normalizedWindow.minRating}
          onChange={e => updateRatingWindow('minRating', e.target.value)}
          style={inputStyle}
        />
        <span style={{ color: '#5c5a57' }}>to</span>
        <input
          type="number"
          min="0"
          max="3200"
          placeholder="To"
          value={ratingWindow?.maxRating ?? normalizedWindow.maxRating}
          onChange={e => updateRatingWindow('maxRating', e.target.value)}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={onApplyRatingWindow}
          disabled={isRefreshing}
          style={{
            ...filterButtonStyle,
            background: isRefreshing ? '#4a4744' : '#81b64c',
            borderColor: isRefreshing ? '#4a4744' : '#81b64c',
            color: '#fff',
            opacity: isRefreshing ? 0.65 : 1,
          }}
        >
          {isRefreshing ? 'Updating...' : 'Refresh'}
        </button>
        {onResetRatingWindow && (
          <button
            type="button"
            onClick={onResetRatingWindow}
            style={{
              ...filterButtonStyle,
              background: 'transparent',
              color: '#bababa',
            }}
          >
            Near me
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
                  <span style={{
                    position: 'absolute',
                    bottom: '1px',
                    right: '1px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: status.color,
                    border: '2px solid #312e2b',
                    display: 'block',
                  }} title={status.label} />
                </div>
                <div className="unified-card-content">
                  <h3 className="unified-card-title">{player.name}</h3>
                  <p className="unified-card-info">
                    Rating: {player.rating ?? DEFAULT_USER_RATING}
                  </p>
                  <span className="unified-card-status online" style={{ color: status.color }}>{status.label}</span>
                </div>
                <div className="unified-card-actions">
                  {player.in_game ? (
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#8b8987',
                      fontStyle: 'italic',
                    }}>In game</span>
                  ) : (
                    <button
                      className="unified-card-btn primary"
                      onClick={() => onChallenge(player)}
                    >
                      Challenge
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="unified-empty-state">
            <p>No players in this rating range.</p>
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
