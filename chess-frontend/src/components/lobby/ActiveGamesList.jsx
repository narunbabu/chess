import React from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

/**
 * ActiveGamesList - Displays active/paused games
 * Pure UI component with no business logic
 *
 * @param {array} activeGames - List of active games
 * @param {number} currentUserId - Current user's ID to determine opponent and color
 * @param {object} opponentOnlineStatus - Map of opponent userId to online status (boolean)
 * @param {function} onResumeGame - Callback when resume game button is clicked (gameId, opponentId, opponentName, isOpponentOnline)
 * @param {function} onDeleteGame - Callback when delete game button is clicked
 */
const ActiveGamesList = ({ activeGames, currentUserId, opponentOnlineStatus, onResumeGame, onDeleteGame }) => {
  console.log('[ActiveGamesList] Received opponentOnlineStatus prop:', opponentOnlineStatus);
  console.log('[ActiveGamesList] Active games count:', activeGames.length);

  return (
    <div className="unified-section">
      <h2 className="unified-section-header">🎮 Active Games</h2>
      {activeGames.length > 0 ? (
        <div className="unified-card-grid cols-1">
          {activeGames.map((game) => {
            // Log full game data for debugging
            console.log('[ActiveGamesList] Full game data:', {
              gameId: game.id,
              white_player_id: game.white_player_id,
              black_player_id: game.black_player_id,
              white_player: game.white_player,
              black_player: game.black_player,
              currentUserId: currentUserId
            });

            const opponent =
              game.white_player_id === currentUserId
                ? game.black_player
                : game.white_player;
            const opponentId = opponent?.id;
            // Ensure consistent type (convert to number)
            const opponentIdNum = parseInt(opponentId);
            const isOpponentOnline = opponentOnlineStatus?.[opponentIdNum] || false;

            console.log('[ActiveGamesList] Game:', game.id, 'Opponent:', opponent?.name, 'Opponent ID (raw):', opponentId, 'Opponent ID (parsed):', opponentIdNum, 'Online:', isOpponentOnline, 'Status Map:', opponentOnlineStatus);

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
                <div style={{ position: 'relative' }}>
                  <img
                    src={
                      getPlayerAvatar(opponent) ||
                      `https://i.pravatar.cc/150?u=${opponent?.email || `user${opponent?.id}`}`
                    }
                    alt={opponent?.name}
                    className="unified-card-avatar"
                  />
                  {/* Online indicator - green dot */}
                  {isOpponentOnline && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#00ff00',
                        border: '2px solid white',
                        boxShadow: '0 0 4px rgba(0, 255, 0, 0.6)'
                      }}
                      title="Online"
                    />
                  )}
                </div>
                <div className="unified-card-content">
                  <h3 className="unified-card-title">
                    vs {opponent?.name}
                  </h3>
                  <p className="unified-card-subtitle">{opponent?.email}</p>
                  <p className="unified-card-info">
                    <span className={`unified-card-status ${statusClass}`}>
                      {game.status}
                    </span>
                    {' • '}
                    <span style={{
                      color: isOpponentOnline ? '#00ff00' : '#ff6b6b',
                      fontWeight: 'bold'
                    }}>
                      {isOpponentOnline ? '🟢 Online' : '🔴 Offline'}
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
                    className={`unified-card-btn ${isOpponentOnline ? 'secondary' : 'secondary-disabled'}`}
                    onClick={() => onResumeGame(game.id, opponentIdNum, opponent?.name, isOpponentOnline)}
                    title={isOpponentOnline ? 'Resume game' : 'Opponent is offline - click for details'}
                    style={{
                      opacity: isOpponentOnline ? 1 : 0.6,
                      cursor: 'pointer'
                    }}
                  >
                    ▶️ Resume Game
                  </button>
                  <button
                    className="unified-card-btn danger"
                    onClick={() => onDeleteGame(game.id, opponent?.name)}
                    title="Delete this game"
                  >
                    🗑️ Delete
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
