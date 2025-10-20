// src/components/layout/Header.js
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveGame } from '../../hooks/useActiveGame';
import { trackAuth, trackNavigation } from '../../utils/analytics';
import { BACKEND_URL } from '../../config';
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
  const hideTimeoutRef = useRef(null);

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
          const response = await fetch(`${BACKEND_URL}/presence/stats`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          // Check if response is OK and content-type is JSON
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              // data.stats contains: { total_online, total_away, in_game }
              const onlineCount = data.stats?.total_online || 0;
              // Available players = online users not in game, excluding self
              const availablePlayers = Math.max(0, (data.stats?.total_online || 0) - (data.stats?.in_game || 0) - 1);
              setOnlineStats({ onlineCount, availablePlayers });
            } else {
              console.warn('Online stats API returned non-JSON response');
            }
          } else {
            console.warn(`Online stats API returned status ${response.status}`);
          }
        } catch (error) {
          // Silently fail for online stats - this is non-critical UI data
          console.debug('Failed to fetch online stats:', error.message);
        }
      };

      fetchOnlineStats();
      // Poll every 30 seconds for updates
      const interval = setInterval(fetchOnlineStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, location.pathname, user]);

  // Auto-hide functionality for mobile landscape on play pages
  useEffect(() => {
    const isPlayPage = location.pathname === '/play' || location.pathname.startsWith('/play/');
    if (!isPlayPage) return;

    const checkLandscapeAndHide = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const headerElement = document.querySelector('.app-header');

      if (isLandscape && isMobile && headerElement) {
        // Clear any existing timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }

        // Show header initially
        headerElement.classList.remove('header-hidden');

        // Hide after 1 second
        hideTimeoutRef.current = setTimeout(() => {
          if (headerElement) {
            headerElement.classList.add('header-hidden');
          }
        }, 1000);
      } else {
        // Not in landscape mobile mode, ensure header is visible
        if (headerElement) {
          headerElement.classList.remove('header-hidden');
        }
      }
    };

    // Check on mount
    checkLandscapeAndHide();

    // Listen for orientation changes and user interactions
    const orientationQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = () => {
      checkLandscapeAndHide();
    };

    // Show header on user interaction
    const handleUserInteraction = () => {
      const headerElement = document.querySelector('.app-header');
      if (headerElement) {
        headerElement.classList.remove('header-hidden');

        // Hide again after 1.5 seconds of inactivity
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          if (headerElement) {
            headerElement.classList.add('header-hidden');
          }
        }, 1500);
      }
    };

    orientationQuery.addEventListener('change', handleOrientationChange);
    ['touchstart', 'mousemove', 'click'].forEach(ev =>
      window.addEventListener(ev, handleUserInteraction)
    );

    // Cleanup
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      orientationQuery.removeEventListener('change', handleOrientationChange);
      ['touchstart', 'mousemove', 'click'].forEach(ev =>
        window.removeEventListener(ev, handleUserInteraction)
      );
    };
  }, [location.pathname]);

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
                src={user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.email}`}
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
                  src={user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.email}`}
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
