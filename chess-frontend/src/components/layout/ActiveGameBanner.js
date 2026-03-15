// src/components/layout/ActiveGameBanner.js
// Banner shown on every page (except the game itself) when user has active or paused games.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { isGameEnded } from '../../utils/endedGamesTracker';

const POLL_INTERVAL_MS = 15000; // re-check every 15 s
const MAX_BANNERS = 3; // show at most 3 banners

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ActiveGameBanner = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeGames, setActiveGames] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const prevPathRef = useRef(location.pathname);

  // ── helpers ──────────────────────────────────────────────────────────────
  const getOpponentName = (game) => {
    if (!game || !user) return null;
    return game.white_player_id === user.id
      ? (game.black_player?.name || game.black_player_name || 'Opponent')
      : (game.white_player?.name || game.white_player_name || 'Opponent');
  };

  const getGameStatus = (game) => {
    return game.status || game.status_code || game.statusRelation?.code || '';
  };

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchActiveGames = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/games/active?limit=10');
      const list = Array.isArray(res.data) ? res.data
        : (res.data?.data ?? res.data?.games ?? []);

      // Include active, waiting, AND paused MULTIPLAYER games only.
      // Exclude computer/synthetic games — no real opponent is waiting.
      const games = list.filter(g => {
        const s = getGameStatus(g);
        if (!['active', 'in_progress', 'waiting', 'paused'].includes(s)) return false;
        if (isGameEnded(g.id)) return false;
        if (g.computer_player_id || g.synthetic_player_id) return false;
        return true;
      });

      setActiveGames(prev => {
        // Reset dismissed for any NEW game that wasn't in the previous list
        const prevIds = new Set(prev.map(g => g.id));
        const newGameIds = games.filter(g => !prevIds.has(g.id)).map(g => g.id);
        if (newGameIds.length > 0) {
          setDismissedIds(d => {
            const next = new Set(d);
            newGameIds.forEach(id => next.delete(id));
            return next;
          });
        }
        return games;
      });
    } catch {
      // non-critical — fail silently
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { setActiveGames([]); return; }
    fetchActiveGames();
    const t = setInterval(fetchActiveGames, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isAuthenticated, fetchActiveGames]);

  // Re-fetch immediately whenever user navigates away FROM a game page
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (prev.startsWith('/play/multiplayer/') && !location.pathname.startsWith('/play/multiplayer/')) {
      setTimeout(fetchActiveGames, 1000);
    }
  }, [location.pathname, fetchActiveGames]);

  // ── filter out games user is currently viewing + dismissed ───────────────
  const visibleGames = activeGames.filter(g => {
    const isOnThisGame = location.pathname === `/play/multiplayer/${g.id}`;
    const isOnPlayPage = location.pathname === '/play';
    return !isOnThisGame && !isOnPlayPage && !dismissedIds.has(g.id);
  }).slice(0, MAX_BANNERS);

  if (!isAuthenticated || visibleGames.length === 0) return null;

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
        @keyframes agb-glow-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.6); }
          50%       { box-shadow: 0 0 0 6px rgba(245,158,11,0); }
        }
        .agb-enter-btn:hover { background: #15803d !important; transform: scale(1.04); }
        .agb-enter-btn:active { transform: scale(0.97); }
        .agb-resume-btn:hover { background: #b45309 !important; transform: scale(1.04); }
        .agb-resume-btn:active { transform: scale(0.97); }
        .agb-dismiss:hover { opacity: 1 !important; }
      `}</style>

      {visibleGames.map(game => {
        const status = getGameStatus(game);
        const isPaused = status === 'paused';
        const opponentName = getOpponentName(game);
        const gamePath = `/play/multiplayer/${game.id}`;

        // Format when game was started
        const startedAt = game.created_at ? new Date(game.created_at) : null;
        const timeAgo = startedAt ? formatTimeAgo(startedAt) : null;

        return (
          <div
            key={game.id}
            role="alert"
            aria-label={isPaused ? 'Paused chess game' : 'Active chess game in progress'}
            style={{
              position: 'sticky',
              top: '48px',
              zIndex: 999996,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '10px 16px',
              background: isPaused
                ? 'linear-gradient(90deg, #78350f 0%, #b45309 50%, #78350f 100%)'
                : 'linear-gradient(90deg, #166534 0%, #16a34a 50%, #166534 100%)',
              backgroundSize: '200% 100%',
              animation: 'agb-pulse 2.4s ease-in-out infinite',
              borderBottom: isPaused ? '2px solid #f59e0b' : '2px solid #22c55e',
              flexWrap: 'wrap',
            }}
          >
            {/* pulsing dot */}
            <span style={{
              display: 'inline-block',
              width: 10, height: 10,
              borderRadius: '50%',
              background: isPaused ? '#fcd34d' : '#86efac',
              flexShrink: 0,
              animation: isPaused
                ? 'agb-glow-amber 1.8s ease-in-out infinite'
                : 'agb-glow 1.8s ease-in-out infinite',
            }} />

            {/* chess icon + label */}
            <span style={{ fontSize: '18px', lineHeight: 1 }}>♟</span>
            <span style={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              letterSpacing: '0.01em',
            }}>
              {isPaused
                ? (opponentName
                    ? <>Paused game vs <strong style={{ color: '#fef3c7' }}>{opponentName}</strong>{timeAgo && <span style={{ opacity: 0.7, fontSize: '12px' }}> · started {timeAgo}</span>}</>
                    : <>Paused game{timeAgo && <span style={{ opacity: 0.7, fontSize: '12px' }}> · started {timeAgo}</span>}</>)
                : (opponentName
                    ? <>Active game vs <strong style={{ color: '#bbf7d0' }}>{opponentName}</strong>{timeAgo && <span style={{ opacity: 0.7, fontSize: '12px' }}> · started {timeAgo}</span>}</>
                    : <>Active game in progress{timeAgo && <span style={{ opacity: 0.7, fontSize: '12px' }}> · started {timeAgo}</span>}</>)}
            </span>

            {/* main CTA button */}
            <button
              className={isPaused ? 'agb-resume-btn' : 'agb-enter-btn'}
              onClick={() => navigate(gamePath)}
              style={{
                padding: '7px 20px',
                background: isPaused ? '#d97706' : '#22c55e',
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
              {isPaused ? '▶\u00A0\u00A0Resume Game' : '▶\u00A0\u00A0Enter Game'}
            </button>

            {/* dismiss */}
            <button
              className="agb-dismiss"
              onClick={() => setDismissedIds(d => new Set(d).add(game.id))}
              aria-label="Dismiss banner"
              style={{
                background: 'transparent',
                border: 'none',
                color: isPaused ? '#fef3c7' : '#bbf7d0',
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
        );
      })}
    </>
  );
};

export default ActiveGameBanner;
