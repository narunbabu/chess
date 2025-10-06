import React from 'react';

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
    <>
      {activeGames.length > 0 ? (
        <div className="invitations-section">
          <h2>🎮 Active Games</h2>
          <div className="invitations-list">
            {activeGames.map((game) => {
              const opponent =
                game.white_player_id === currentUserId
                  ? game.blackPlayer
                  : game.whitePlayer;
              const playerColor =
                game.white_player_id === currentUserId ? 'white' : 'black';
              const statusEmoji =
                game.status === 'active'
                  ? '🟢'
                  : game.status === 'paused'
                  ? '⏸️'
                  : '⏳';

              return (
                <div key={game.id} className="invitation-card">
                  <img
                    src={
                      opponent?.avatar ||
                      `https://i.pravatar.cc/150?u=${opponent?.email}`
                    }
                    alt={opponent?.name}
                    className="invitation-avatar"
                  />
                  <div className="invitation-info">
                    <h4>vs {opponent?.name}</h4>
                    <p>
                      {statusEmoji} {game.status} • Playing as {playerColor}
                    </p>
                    <p className="invitation-time">
                      Last move:{' '}
                      {game.last_move_at
                        ? new Date(game.last_move_at).toLocaleString()
                        : 'No moves yet'}
                    </p>
                  </div>
                  <div className="invitation-actions">
                    <button
                      className="accept-btn"
                      onClick={() => onResumeGame(game.id)}
                    >
                      ▶️ Resume Game
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="invitations-section">
          <div className="no-players">
            <p>🎮 No active games</p>
            <p>Challenge a player to start a new game!</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ActiveGamesList;
