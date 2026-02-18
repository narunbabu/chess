// src/components/play/BoardCustomizer.js
import React, { useState, useRef, useEffect } from 'react';
import { BOARD_THEMES } from '../../config/boardThemes';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';

// --- Exported helpers (reusable from other files) ---

export const getBoardTheme = (user) =>
  user?.board_theme || localStorage.getItem('chess99_board_theme') || 'classic';

export const getPieceStyle = () =>
  localStorage.getItem('chess99_piece_style') || 'standard';

// --- Component ---

const BoardCustomizer = ({ boardTheme, pieceStyle, onThemeChange, onPieceStyleChange }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);
  const { isAuthenticated, user, fetchUser } = useAuth();
  const { isPremium } = useSubscription();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  const handleThemeSelect = async (key) => {
    const theme = BOARD_THEMES[key];
    if (theme.tier === 'premium' && !isPremium) {
      alert('This theme requires a premium subscription. Upgrade in your Profile to unlock it!');
      return;
    }
    // Save to localStorage (works for guests too)
    try { localStorage.setItem('chess99_board_theme', key); } catch { /* noop */ }
    onThemeChange(key);
    // Persist to backend if authenticated
    if (isAuthenticated) {
      try {
        await api.post('/profile', { board_theme: key });
        if (fetchUser) await fetchUser();
      } catch (err) {
        console.error('Error saving board theme:', err);
      }
    }
  };

  const handlePieceStyleSelect = (style) => {
    try { localStorage.setItem('chess99_piece_style', style); } catch { /* noop */ }
    onPieceStyleChange(style);
  };

  const themeKeys = Object.keys(BOARD_THEMES);

  return (
    <div style={{ position: 'relative' }}>
      {/* Toggle button — styled like SoundToggle */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Customize board"
        title="Customize board"
        style={{
          background: open ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '18px',
          color: open ? '#fff' : '#bababa',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.color = open ? '#fff' : '#bababa';
        }}
      >
        {'\uD83C\uDFA8'}
      </button>

      {/* Popover dropdown */}
      {open && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: '42px',
            right: 0,
            width: '260px',
            background: 'linear-gradient(180deg, #2d2a27 0%, #1a1816 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '14px',
            zIndex: 1000,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Board Theme Section */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#999', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Board Theme
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {themeKeys.map((key) => {
                const theme = BOARD_THEMES[key];
                const isSelected = boardTheme === key;
                const isLocked = theme.tier === 'premium' && !isPremium;
                return (
                  <button
                    key={key}
                    onClick={() => handleThemeSelect(key)}
                    title={`${theme.name}${isLocked ? ' (Premium)' : ''}`}
                    style={{
                      position: 'relative',
                      padding: '3px',
                      borderRadius: '6px',
                      border: `2px solid ${isSelected ? '#81b64c' : 'transparent'}`,
                      background: 'none',
                      cursor: 'pointer',
                      opacity: isLocked ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* 2x2 mini board swatch */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: '3px', overflow: 'hidden', aspectRatio: '1' }}>
                      <div style={{ backgroundColor: theme.light }} />
                      <div style={{ backgroundColor: theme.dark }} />
                      <div style={{ backgroundColor: theme.dark }} />
                      <div style={{ backgroundColor: theme.light }} />
                    </div>
                    {/* Lock icon for premium */}
                    {isLocked && (
                      <div style={{
                        position: 'absolute', top: '-2px', right: '-2px',
                        fontSize: '10px', lineHeight: 1,
                      }}>
                        {'\uD83D\uDD12'}
                      </div>
                    )}
                    {/* Theme name */}
                    <div style={{ color: isSelected ? '#81b64c' : '#999', fontSize: '0.6rem', marginTop: '2px', textAlign: 'center', lineHeight: 1.1 }}>
                      {theme.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Piece Style Section */}
          <div>
            <div style={{ color: '#999', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Piece Style
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'standard', label: 'Standard' },
                { key: '3d', label: '3D Classic' },
              ].map(({ key, label }) => {
                const isSelected = pieceStyle === key;
                return (
                  <button
                    key={key}
                    onClick={() => handlePieceStyleSelect(key)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `2px solid ${isSelected ? '#81b64c' : '#4a4744'}`,
                      background: isSelected ? 'rgba(129, 182, 76, 0.1)' : 'transparent',
                      color: isSelected ? '#81b64c' : '#bababa',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardCustomizer;
