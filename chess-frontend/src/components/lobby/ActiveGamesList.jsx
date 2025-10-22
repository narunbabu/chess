import React from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

/**
 * ActiveGamesList - Displays active/paused games
 * Pure UI component with no business logic
 *
 * @param {array} activeGames - List of active games
 * @param {number} currentUserId - Current user's ID to determine opponent and color
 * @param {function} onResumeGame - Callback when resume game button is clicked
 */
const ActiveGamesList = ({ activeGames, currentUserId, onResumeGame }) => {
  return (
    <div className="unified-section">
      <h2 className="unified-section-header">🎮 Active Games</h2>
      {activeGames.length > 0 ? (
        <div className="unified-card-grid cols-1">
          {activeGames.map((game) => {
            const opponent =
              game.white_player_id === currentUserId
                ? game.black_player
                : game.white_player;
            const playerColor =
              game.white_player_id === currentUserId ? 'white' : 'black';
            const statusClass =
              game.status === 'active'
                ? 'active'
                : game.status === 'paused'
                ? 'paused'
                : '';

            return (
              <div key={game.id} className="unified-card horizontal">
                <img
                  src={
                    getPlayerAvatar(opponent) ||
                    `https://i.pravatar.cc/150?u=${opponent?.email || `user${opponent?.id}`}`
                  }
                  alt={opponent?.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">vs {opponent?.name}</h3>
                  <p className="unified-card-subtitle">
                    <span className={`unified-card-status ${statusClass}`}>
                      {game.status}
                    </span>
                    {' • '}Playing as {playerColor}
                  </p>
                  <p className="unified-card-meta">
                    Last move:{' '}
                    {game.last_move_at
                      ? new Date(game.last_move_at).toLocaleString()
                      : 'No moves yet'}
                  </p>
                </div>
                <div className="unified-card-actions">
                  <button
                    className="unified-card-btn secondary"
                    onClick={() => onResumeGame(game.id)}
                  >
                    ▶️ Resume Game
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="unified-empty-state">
          <p>🎮 No active games</p>
          <p>Challenge a player to start a new game!</p>
        </div>
      )}
    </div>
  );
};

export default ActiveGamesList;
