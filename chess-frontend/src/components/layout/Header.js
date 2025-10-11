// src/components/layout/Header.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveGame } from '../../hooks/useActiveGame';
import { trackAuth, trackNavigation } from '../../utils/analytics';
import './Header.css';

/**
 * Header component extracted from App.js AppHeader
 * Conditionally renders based on current route
 * Preserves all existing auth and navigation logic
 * Added Resume button for active multiplayer games
 */
const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const { activeGame, loading } = useActiveGame();
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [onlineStats, setOnlineStats] = useState({ onlineCount: 0, availablePlayers: 0 });
  const userMenuRef = useRef(null);

  // Handle clicks outside nav panel to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNavPanel && !event.target.closest('.nav-panel') && !event.target.closest('.user-avatar')) {
        setShowNavPanel(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowNavPanel(false);
      }
    };

    if (showNavPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showNavPanel]);

  // Fetch online stats only when on lobby page
  useEffect(() => {
    if (isAuthenticated && location.pathname.includes('/lobby')) {
      const fetchOnlineStats = async () => {
        try {
          const response = await fetch('/api/users', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          });
          if (response.ok) {
            const users = await response.json();
            const onlineCount = users.length;
            const availablePlayers = users.filter(u => u.id !== user?.id).length;
            setOnlineStats({ onlineCount, availablePlayers });
          }
        } catch (error) {
          console.error('Failed to fetch online stats:', error);
        }
      };

      fetchOnlineStats();
      // Poll every 30 seconds for updates
      const interval = setInterval(fetchOnlineStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, location.pathname, user]);

  // Hide header only on landing page
  if (location.pathname === '/') {
    return null;
  }

  const handleLogout = () => {
    setShowNavPanel(false);
    trackAuth('logout', 'manual');
    logout();
    window.location.href = '/';
  };

  const handleUserMenuClick = () => {
    setShowNavPanel(!showNavPanel);
  };

  const handleNavItemClick = (action) => {
    setShowNavPanel(false);
    action();
  };

  const handleResumeGame = () => {
    if (activeGame) {
      trackNavigation('game', 'resume_button', { gameId: activeGame.id });
      // Store session info for PlayMultiplayer component
      sessionStorage.setItem('lastInvitationAction', 'resume_game');
      sessionStorage.setItem('lastInvitationTime', Date.now().toString());
      sessionStorage.setItem('lastGameId', activeGame.id.toString());
      navigate(`/play/multiplayer/${activeGame.id}`);
    }
  };

  const headerElement = (
    <header className="app-header glass-header">
      <div className="left-section">
        <Link to="/" className="logo">
        </Link>

        {isAuthenticated && (
          <>
            <Link
              to="/dashboard"
              className="nav-link"
              onClick={() => trackNavigation('dashboard', 'header')}
            >
              Dashboard
            </Link>
            <Link
              to="/lobby"
              className="nav-link"
              onClick={() => trackNavigation('lobby', 'header')}
            >
              Lobby
            </Link>
            {!loading && activeGame && (
              <button
                onClick={handleResumeGame}
                className="nav-link resume-btn"
                title={`Resume game #${activeGame.id}`}
              >
                ▶️ Resume
              </button>
            )}
          </>
        )}
      </div>

      <div className="center-section">
        {/* Empty center section - stats moved to right */}
      </div>

      <div className="right-section">
        {/* Show stats in right section when on lobby page */}
        {location.pathname.includes('/lobby') && (
          <div className="stats-row compact">
            <div className="stat-item">
              <span>🟢</span>
              {onlineStats.onlineCount}
            </div>
            <div className="stat-item">
              <span>⚡</span>
              {onlineStats.availablePlayers}
            </div>
          </div>
        )}

        {isAuthenticated ? (
          <div className="user-compact" ref={userMenuRef}>
            <div className="user-name">
              <span>{user?.name}</span>
              <small>{user?.rating || 1200}</small>
            </div>
            <div className="user-avatar" onClick={handleUserMenuClick}>
              <img
                src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.email}`}
                alt={user?.name}
              />
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="auth-button login-button"
            onClick={() => trackNavigation('login', 'header')}
          >
            Login
          </Link>
        )}
      </div>

    </header>
  );

  // Render navigation panel and overlay using portal to document.body
  // This ensures they appear above all other content regardless of stacking context
  return (
    <>
      {headerElement}
      {showNavPanel && createPortal(
        <>
          <div className={`nav-panel ${showNavPanel ? 'open' : ''}`}>
            <div className="nav-panel-header">
              <div className="nav-user-info">
                <img
                  src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.email}`}
                  alt={user?.name}
                  className="nav-user-avatar"
                />
                <div className="nav-user-details">
                  <h3>{user?.name}</h3>
                  <p>Rating: {user?.rating || 1200}</p>
                </div>
              </div>
              <button className="nav-close-btn" onClick={() => setShowNavPanel(false)}>
                ✕
              </button>
            </div>

            <nav className="nav-menu">
              <div className="nav-section">
                <h4>Navigation</h4>
                <button
                  className="nav-item"
                  onClick={() => handleNavItemClick(() => navigate('/dashboard'))}
                >
                  📊 Dashboard
                </button>
                <button
                  className="nav-item"
                  onClick={() => handleNavItemClick(() => navigate('/lobby'))}
                >
                  🎮 Lobby
                </button>
                {location.pathname.includes('/lobby') && (
                  <>
                    <div className="nav-stats">
                      <div className="nav-stat-item">
                        <span>🟢</span>
                        <span>Online: {onlineStats.onlineCount}</span>
                      </div>
                      <div className="nav-stat-item">
                        <span>⚡</span>
                        <span>Available: {onlineStats.availablePlayers}</span>
                      </div>
                    </div>
                  </>
                )}
                {!loading && activeGame && (
                  <button
                    className="nav-item nav-item-resume"
                    onClick={() => handleNavItemClick(handleResumeGame)}
                  >
                    ▶️ Resume Game
                  </button>
                )}
              </div>

              <div className="nav-section">
                <h4>Account</h4>
                <button
                  className="nav-item"
                  onClick={() => handleNavItemClick(() => navigate('/profile'))}
                >
                  👤 Profile
                </button>
                <button
                  className="nav-item"
                  onClick={() => handleNavItemClick(() => navigate('/settings'))}
                >
                  ⚙️ Settings
                </button>
                <button
                  className="nav-item nav-item-logout"
                  onClick={handleLogout}
                >
                  🚪 Logout
                </button>
              </div>
            </nav>
          </div>

          <div
            className="nav-overlay"
            onClick={() => setShowNavPanel(false)}
          />
        </>,
        document.body
      )}
    </>
  );
};

export default Header;
