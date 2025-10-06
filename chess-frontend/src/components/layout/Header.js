// src/components/layout/Header.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Header component extracted from App.js AppHeader
 * Conditionally renders based on current route
 * Preserves all existing auth and navigation logic
 */
const Header = () => {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  // Hide header on landing page (preserve existing behavior)
  if (location.pathname === '/') {
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/';
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
