// src/components/layout/Header.js
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveGame } from '../../hooks/useActiveGame';

/**
 * Header component extracted from App.js AppHeader
 * Conditionally renders based on current route
 * Preserves all existing auth and navigation logic
 * Added Resume button for active multiplayer games
 */
const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const { activeGame, loading } = useActiveGame();

  // Hide header on landing page (preserve existing behavior)
  if (location.pathname === '/') {
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleResumeGame = () => {
    if (activeGame) {
      // Store session info for PlayMultiplayer component
      sessionStorage.setItem('lastInvitationAction', 'resume_game');
      sessionStorage.setItem('lastInvitationTime', Date.now().toString());
      sessionStorage.setItem('lastGameId', activeGame.id.toString());
      navigate(`/play/multiplayer/${activeGame.id}`);
    }
  };

  return (
    <header className="app-header">
      <div className="logo">
        <Link to="/" className="logo-link">
          {/* Logo content or img tag can go here if needed */}
        </Link>
      </div>
      <nav className="auth-nav">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            {!loading && activeGame && (
              <button
                onClick={handleResumeGame}
                className="nav-link resume-button"
                title={`Resume game #${activeGame.id}`}
              >
                ▶️ Resume Game
              </button>
            )}
            <button onClick={handleLogout} className="auth-button logout-button">
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="auth-button login-button">Login</Link>
        )}
      </nav>
    </header>
  );
};

export default Header;
