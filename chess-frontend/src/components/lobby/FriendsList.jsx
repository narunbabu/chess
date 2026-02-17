import React from 'react';
import '../../styles/UnifiedCards.css';

/**
 * FriendsList - Displays friends with online/offline status
 * Mirrors PlayersList patterns using UnifiedCards CSS.
 *
 * @param {array} friends - List of friends with is_online, name, rating, avatar_url, user_id
 * @param {boolean} loading - Whether friends data is still loading
 * @param {function} onChallenge - Callback when Challenge button is clicked
 */
const FriendsList = ({ friends = [], loading = false, onChallenge }) => {
  if (loading) {
    return (
      <div className="unified-section">
        <h2 className="unified-section-header">Friends</h2>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#8b8987' }}>
          Loading friends...
        </div>
      </div>
    );
  }

  const onlineFriends = friends.filter(f => f.is_online);
  const offlineFriends = friends.filter(f => !f.is_online);

  if (friends.length === 0) {
    return (
      <div className="unified-section">
        <h2 className="unified-section-header">Friends</h2>
        <div className="unified-empty-state">
          <p>No friends yet.</p>
          <p>Play games with others to add them as friends, or use the search above.</p>
        </div>
      </div>
    );
  }

  const renderFriendCard = (friend, isOnline) => (
    <div
      key={friend.user_id}
      className="unified-card horizontal"
      style={!isOnline ? { opacity: 0.55 } : undefined}
    >
      <img
        src={
          friend.avatar_url ||
          `https://i.pravatar.cc/150?u=user${friend.user_id}`
        }
        alt={friend.name}
        className="unified-card-avatar"
      />
      <div className="unified-card-content">
        <h3 className="unified-card-title">{friend.name}</h3>
        <p className="unified-card-info">
          Rating: {friend.rating || 1200}
        </p>
        <span className={`unified-card-status ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? 'Online' : friend.last_seen ? `Last seen ${friend.last_seen}` : 'Offline'}
        </span>
      </div>
      <div className="unified-card-actions">
        <button
          className="unified-card-btn primary"
          onClick={() => onChallenge({
            id: friend.user_id,
            name: friend.name,
            rating: friend.rating,
            avatar_url: friend.avatar_url
          })}
          disabled={!isOnline}
          style={!isOnline ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          Challenge
        </button>
      </div>
    </div>
  );

  return (
    <div className="unified-section">
      {onlineFriends.length > 0 && (
        <>
          <h2 className="unified-section-header">
            Online Friends ({onlineFriends.length})
          </h2>
          <div className="unified-card-grid cols-2">
            {onlineFriends.map(f => renderFriendCard(f, true))}
          </div>
        </>
      )}
      {offlineFriends.length > 0 && (
        <>
          <h2 className="unified-section-header" style={{ marginTop: onlineFriends.length > 0 ? '1.5rem' : 0 }}>
            Offline Friends ({offlineFriends.length})
          </h2>
          <div className="unified-card-grid cols-2">
            {offlineFriends.map(f => renderFriendCard(f, false))}
          </div>
        </>
      )}
    </div>
  );
};

export default FriendsList;
