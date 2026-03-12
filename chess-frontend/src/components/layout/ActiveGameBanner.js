// src/components/layout/ActiveGameBanner.js
// Bright pulsing banner shown on every page (except the game itself) when user has an active game.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const POLL_INTERVAL_MS = 15000; // re-check every 15 s

const ActiveGameBanner = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeGame, setActiveGame] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const prevPathRef = useRef(location.pathname);

  // ── helpers ──────────────────────────────────────────────────────────────
  const isOnThisGame = activeGame
    ? location.pathname === `/play/multiplayer/${activeGame.id}`
    : false;

  const opponentName = activeGame && user
    ? (activeGame.white_player_id === user.id
        ? (activeGame.black_player?.name || activeGame.black_player_name || 'Opponent')
        : (activeGame.white_player?.name || activeGame.white_player_name || 'Opponent'))
    : null;

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchActiveGame = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/games/active?limit=5');
      // API can return { data: [...] } or { games: [...] } or a plain array
      const list = Array.isArray(res.data) ? res.data
        : (res.data?.data ?? res.data?.games ?? []);

      // Pick the first truly active game (status can be string or nested object)
      const active = list.find(g => {
        const s = g.status || g.status_code || g.statusRelation?.code || '';
        return ['active', 'in_progress', 'waiting'].includes(s);
      });

      setActiveGame(prev => {
        // reset dismiss only when a NEW game appears
        if (active && (!prev || prev.id !== active.id)) setDismissed(false);
        return active || null;
      });
    } catch {
      // non-critical — fail silently
    }
  }, [isAuthenticated]);

  // ── polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { setActiveGame(null); return; }
    fetchActiveGame();
    const t = setInterval(fetchActiveGame, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isAuthenticated, fetchActiveGame]);

  // Re-fetch immediately whenever user navigates away FROM a game page
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (prev.startsWith('/play/multiplayer/') && !location.pathname.startsWith('/play/multiplayer/')) {
      // Small delay so backend has time to reflect ended game status
      setTimeout(fetchActiveGame, 1000);
    }
  }, [location.pathname, fetchActiveGame]);

  // ── render guard ──────────────────────────────────────────────────────────
  if (!isAuthenticated || !activeGame || isOnThisGame || dismissed) return null;

  const gamePath = `/play/multiplayer/${activeGame.id}`;

  return (
    <>
      <style>{`
        @keyframes agb-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.85; }
        }
        @keyframes agb-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
          50%       { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        .agb-enter-btn:hover { background: #15803d !important; transform: scale(1.04); }
        .agb-enter-btn:active { transform: scale(0.97); }
        .agb-dismiss:hover { opacity: 1 !important; }
      `}</style>

      <div
        role="alert"
        aria-label="Active chess game in progress"
        style={{
          position: 'sticky',
          top: '48px',           /* sits right below the 48px header */
          zIndex: 999996,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '10px 16px',
          background: 'linear-gradient(90deg, #166534 0%, #16a34a 50%, #166534 100%)',
          backgroundSize: '200% 100%',
          animation: 'agb-pulse 2.4s ease-in-out infinite',
          borderBottom: '2px solid #22c55e',
          flexWrap: 'wrap',
        }}
      >
        {/* pulsing dot */}
        <span style={{
          display: 'inline-block',
          width: 10, height: 10,
          borderRadius: '50%',
          background: '#86efac',
          flexShrink: 0,
          animation: 'agb-glow 1.8s ease-in-out infinite',
        }} />

        {/* chess icon + label */}
        <span style={{ fontSize: '18px', lineHeight: 1 }}>♟</span>
        <span style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          letterSpacing: '0.01em',
        }}>
          {opponentName
            ? <>Active game vs <strong style={{ color: '#bbf7d0' }}>{opponentName}</strong> in progress</>
            : 'Active game in progress'}
        </span>

        {/* main CTA button */}
        <button
          className="agb-enter-btn"
          onClick={() => navigate(gamePath)}
          style={{
            padding: '7px 20px',
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: '999px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            letterSpacing: '0.03em',
            transition: 'background 0.15s, transform 0.1s',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ▶&nbsp;&nbsp;Enter Game
        </button>

        {/* dismiss */}
        <button
          className="agb-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#bbf7d0',
            fontSize: '16px',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px',
            opacity: 0.7,
            transition: 'opacity 0.15s',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    </>
  );
};

export default ActiveGameBanner;
