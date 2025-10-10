// PresenceIndicator.js - Shows connection status and online users
import React, { useState, useEffect } from 'react';
import presenceService from '../services/presenceService';
import './PresenceIndicator.css';

const PresenceIndicator = ({ user }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [presenceStats, setPresenceStats] = useState({});
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);

  useEffect(() => {
    if (user) {
      initializePresence();
    }

    return () => {
      presenceService.disconnect();
    };
  }, [user]);

  const initializePresence = async () => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;

    // Set up event handlers
    presenceService.setEventHandlers({
      onConnectionChange: (connected) => {
        setIsConnected(connected);
        if (connected) {
          loadOnlineUsers();
          loadPresenceStats();
        }
      },
      onUserOnline: (users) => {
        setOnlineUsers(prev => {
          const userIds = prev.map(u => u.user_id || u.id);
          const newUsers = users.filter(u => !userIds.includes(u.user_id || u.id));
          return [...prev, ...newUsers];
        });
      },
      onUserOffline: (user) => {
        setOnlineUsers(prev =>
          prev.filter(u => (u.user_id || u.id) !== (user.user_id || user.id))
        );
      },
      onPresenceUpdate: (event) => {
        console.log('Presence update received:', event);
        loadPresenceStats();
      }
    });

    // Initialize the service
    const success = await presenceService.initialize(user, authToken);
    if (success) {
      setIsConnected(true);
      loadOnlineUsers();
      loadPresenceStats();
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const users = await presenceService.getOnlineUsers();
      setOnlineUsers(users);
    } catch (error) {
      console.error('Failed to load online users:', error);
    }
  };

  const loadPresenceStats = async () => {
    try {
      const stats = await presenceService.getPresenceStats();
      setPresenceStats(stats);
    } catch (error) {
      console.error('Failed to load presence stats:', error);
    }
  };

  const getStatusColor = () => {
    if (!isConnected) return '#dc3545'; // Red
    return '#28a745'; // Green
  };

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    return 'Online';
  };

  return (
    <div className="presence-indicator">
      {/* Connection Status */}
      <div className="connection-status">
        <div
          className="status-dot"
          style={{ backgroundColor: getStatusColor() }}
        ></div>
        <span className="status-text">{getStatusText()}</span>
      </div>

      {/* Online Users Count */}
      {isConnected && (
        <div className="online-stats">
          <button
            className="online-count-btn"
            onClick={() => setShowOnlineUsers(!showOnlineUsers)}
            title="Click to see online users"
          >
            👥 {presenceStats.total_online || 0} online
            {presenceStats.in_game > 0 && (
              <span className="in-game-count"> ({presenceStats.in_game} playing)</span>
            )}
          </button>

          {/* Online Users Dropdown */}
          {showOnlineUsers && (
            <div className="online-users-dropdown">
              <div className="dropdown-header">
                <h4>Online Users ({onlineUsers.length})</h4>
                <button
                  className="close-btn"
                  onClick={() => setShowOnlineUsers(false)}
                >
                  ×
                </button>
              </div>

              <div className="users-list">
                {onlineUsers.length === 0 ? (
                  <div className="no-users">No other users online</div>
                ) : (
                  onlineUsers.map((onlineUser, index) => (
                    <div key={index} className="user-item">
                      <div className="user-info">
                        <div className="user-name">
                          {onlineUser.user?.name || onlineUser.name || 'Anonymous'}
                        </div>
                        <div className="user-status">
                          {onlineUser.game_status === 'playing' ? (
                            <span className="status-playing">🎮 Playing</span>
                          ) : onlineUser.game_status === 'waiting' ? (
                            <span className="status-waiting">⏳ Waiting</span>
                          ) : (
                            <span className="status-available">✅ Available</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Refresh Button */}
              <div className="dropdown-footer">
                <button
                  className="refresh-btn"
                  onClick={loadOnlineUsers}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reconnecting Indicator */}
      {!isConnected && (
        <div className="reconnecting-indicator">
          <span className="reconnecting-text">Reconnecting...</span>
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default PresenceIndicator;