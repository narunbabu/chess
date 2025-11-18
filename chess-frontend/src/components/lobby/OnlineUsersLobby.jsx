// OnlineUsersLobby.jsx - Paginated lobby with infinite scroll
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useContextualPresence from '../../hooks/useContextualPresence';
import './OnlineUsersLobby.css';

const OnlineUsersLobby = ({ onChallenge }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [excludeFriends, setExcludeFriends] = useState(false);
  const observerRef = useRef();
  const lastUserRef = useRef();

  const {
    lobbyUsers,
    lobbyPagination,
    loading,
    error,
    loadLobbyUsers,
    loadMoreLobbyUsers
  } = useContextualPresence();

  // Initial load
  useEffect(() => {
    loadLobbyUsers({ page: 1, perPage: 20 });
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading.lobby) {
        loadLobbyUsers({ page: 1, perPage: 20 });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading.lobby, loadLobbyUsers]);

  // Intersection Observer for infinite scroll
  const lastUserCallback = useCallback(node => {
    if (loading.lobby) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && lobbyPagination.has_more) {
        console.log('📜 [Lobby] Loading more users...');
        loadMoreLobbyUsers({ excludeFriends });
      }
    });

    if (node) {
      observerRef.current.observe(node);
    }
  }, [loading.lobby, lobbyPagination.has_more, loadMoreLobbyUsers, excludeFriends]);

  // Handle search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    loadLobbyUsers({
      page: 1,
      perPage: 20,
      search: query || null,
      excludeFriends
    });
  }, [excludeFriends, loadLobbyUsers]);

  // Handle exclude friends toggle
  const handleExcludeFriendsToggle = useCallback(() => {
    const newValue = !excludeFriends;
    setExcludeFriends(newValue);
    loadLobbyUsers({
      page: 1,
      perPage: 20,
      search: searchQuery || null,
      excludeFriends: newValue
    });
  }, [excludeFriends, searchQuery, loadLobbyUsers]);

  // Handle challenge user
  const handleChallengeUser = useCallback((user) => {
    console.log('🎯 [Lobby] Challenging user:', user.name);

    if (onChallenge) {
      onChallenge(user);
    } else {
      // Default: Navigate to lobby with pre-selected user
      navigate(`/lobby?challenge=${user.user_id}`);
    }
  }, [onChallenge, navigate]);

  return (
    <div className="online-users-lobby">
      <div className="lobby-header">
        <h2>Online Users</h2>
        <div className="lobby-stats">
          <span className="online-count">
            {lobbyPagination.total} users online
          </span>
        </div>
      </div>

      <div className="lobby-controls">
        <input
          type="text"
          className="lobby-search"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />

        <label className="lobby-checkbox">
          <input
            type="checkbox"
            checked={excludeFriends}
            onChange={handleExcludeFriendsToggle}
          />
          <span>Exclude friends</span>
        </label>
      </div>

      {error && (
        <div className="lobby-error">
          ⚠️ {error}
        </div>
      )}

      <div className="lobby-users-list">
        {lobbyUsers.length === 0 && !loading.lobby ? (
          <div className="lobby-empty">
            <p>No online users found</p>
            {searchQuery && (
              <button
                className="btn-clear-search"
                onClick={() => handleSearch('')}
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          lobbyUsers.map((user, index) => (
            <div
              key={user.user_id}
              className="lobby-user-card"
              ref={index === lobbyUsers.length - 1 ? lastUserCallback : null}
            >
              <div className="user-info">
                <div className="user-status-dot online"></div>
                <div className="user-details">
                  <div className="user-name">{user.name}</div>
                  <div className="user-last-seen">{user.last_seen}</div>
                </div>
              </div>

              <button
                className="btn-challenge"
                onClick={() => handleChallengeUser(user)}
              >
                Challenge
              </button>
            </div>
          ))
        )}

        {loading.lobby && (
          <div className="lobby-loading">
            <div className="loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        )}

        {lobbyPagination.has_more && !loading.lobby && (
          <div className="lobby-load-more">
            <button
              className="btn-load-more"
              onClick={() => loadMoreLobbyUsers({ excludeFriends })}
            >
              Load More
            </button>
          </div>
        )}
      </div>

      <div className="lobby-footer">
        <div className="pagination-info">
          Page {lobbyPagination.current_page} of {lobbyPagination.total_pages}
        </div>
      </div>
    </div>
  );
};

export default OnlineUsersLobby;
