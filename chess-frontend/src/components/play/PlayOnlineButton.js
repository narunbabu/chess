import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPreferredGameMode,
  getPreferredTimeControl,
  getPreferredColor,
} from '../../utils/gamePreferences';
import { rememberOpponentRatingForMode, toRatingWindowParams } from '../../utils/ratingWindow';
import { getStoredLearningHelpLimit, pickBeginnerSyntheticPlayer } from '../../utils/syntheticMatchPlayers';
import '../../styles/UnifiedCards.css';

const SEARCH_DURATION = 10;

const PlayOnlineButton = ({ variant = 'primary', onSearchStart, onSearchEnd, ratingWindow }) => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [status, setStatus] = useState('idle');
  const [secondsLeft, setSecondsLeft] = useState(SEARCH_DURATION);
  const [matchResult, setMatchResult] = useState(null);
  const [error, setError] = useState(null);
  const countdownRef = useRef(null);
  const abortRef = useRef(null);
  const statusRef = useRef('idle');
  statusRef.current = status;

  const cleanup = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (abortRef.current) abortRef.current.abort();
    countdownRef.current = null;
    abortRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startQuickMatch = useCallback(async () => {
    if (loading) return;

    if (!isAuthenticated) {
      setStatus('authChoice');
      setError(null);
      return;
    }

    const preferredTime = getPreferredTimeControl();
    const prefs = {
      time_control_minutes: preferredTime.minutes,
      increment_seconds: preferredTime.increment,
      game_mode: getPreferredGameMode(),
      preferred_color: getPreferredColor(),
      learning_help_limit: getStoredLearningHelpLimit(),
      ...toRatingWindowParams(ratingWindow),
    };

    if (prefs.game_mode === 'learning') {
      const syntheticOpponent = pickBeginnerSyntheticPlayer(ratingWindow);
      rememberOpponentRatingForMode(prefs.game_mode, syntheticOpponent.rating);
      setStatus('matched');
      setMatchResult({
        match_type: 'synthetic',
        opponent: syntheticOpponent,
        game_id: null,
      });
      setError(null);
      onSearchStart?.();
      onSearchEnd?.();
      setTimeout(() => navigateToGame({
        match_type: 'synthetic',
        opponent: syntheticOpponent,
        game_id: null,
      }, prefs), 900);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('searching');
    setError(null);
    setSecondsLeft(SEARCH_DURATION);
    onSearchStart?.();

    const startTime = Date.now();
    countdownRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, SEARCH_DURATION - elapsed);
      setSecondsLeft(remaining);
    }, 250);

    try {
      const response = await api.post('/v1/matchmaking/quick-match', prefs, {
        signal: controller.signal,
      });

      cleanup();

      const data = response.data?.data || response.data;
      const matchType = data.match_type;
      rememberOpponentRatingForMode(prefs.game_mode, data.opponent?.rating);

      setStatus('matched');
      setMatchResult({ ...data, match_type: matchType });
      onSearchEnd?.();

      const navigateDelay = matchType === 'human' ? 1200 : 1500;
      setTimeout(() => navigateToGame(data, prefs), navigateDelay);
    } catch (err) {
      if (controller.signal.aborted) return;
      cleanup();

      console.error('[PlayOnline] Quick match failed:', err);

      if (err.response?.status === 429) {
        setError('Too many games in progress. Finish an existing game first.');
        setStatus('error');
        onSearchEnd?.();
        return;
      }

      setError('Could not find a match. Try again.');
      setStatus('error');
      onSearchEnd?.();
    }
  }, [cleanup, isAuthenticated, loading, navigate, onSearchEnd, onSearchStart, ratingWindow]);

  const navigateToGame = (data, prefs) => {
    if (data.match_type === 'human' && data.game_id) {
      sessionStorage.setItem('lastInvitationAction', 'quick_match');
      sessionStorage.setItem('lastInvitationTime', Date.now().toString());
      sessionStorage.setItem('lastGameId', data.game_id.toString());
      navigate(`/play/multiplayer/${data.game_id}`);
    } else if (data.match_type === 'synthetic') {
      navigate('/play', {
        state: {
          gameMode: 'synthetic',
          syntheticPlayer: data.opponent,
          backendGameId: data.game_id,
          preferredColor:
            prefs.preferred_color === 'random'
              ? Math.random() < 0.5 ? 'white' : 'black'
              : prefs.preferred_color,
          ratedMode: prefs.game_mode,
          timeControl: prefs.time_control_minutes,
          increment: prefs.increment_seconds,
          learningHelpLimit: prefs.game_mode === 'learning' ? prefs.learning_help_limit : null,
        },
      });
    } else {
      navigate('/play');
    }
  };

  const handleCancel = useCallback(() => {
    cleanup();
    setStatus('idle');
    setMatchResult(null);
    setError(null);
    onSearchEnd?.();
  }, [cleanup, onSearchEnd]);

  const handleRetry = () => {
    setError(null);
    startQuickMatch();
  };

  const handleGuestPlay = () => {
    cleanup();
    setStatus('idle');
    setError(null);
    onSearchEnd?.();
    navigate('/play', {
      state: {
        guestMode: true,
        ratedMode: 'casual',
        computerDepth: 3,
      },
    });
  };

  const handleLoginPlay = () => {
    cleanup();
    setStatus('idle');
    setError(null);
    onSearchEnd?.();
    navigate('/login', { state: { from: '/lobby' } });
  };

  const progress = ((SEARCH_DURATION - secondsLeft) / SEARCH_DURATION) * 100;

  // Modal overlay during search/match
  if (status === 'searching' || status === 'matched' || status === 'error' || status === 'authChoice') {
    return createPortal(
      <div
        className="matchmaking-overlay"
        onClick={status === 'searching' ? handleCancel : undefined}
      >
        <div className="matchmaking-modal" onClick={(e) => e.stopPropagation()}>
          {status === 'authChoice' && (
            <>
              <div className="matchmaking-matched-icon">&#9654;</div>
              <h2 className="matchmaking-title">Start Playing</h2>
              <p className="matchmaking-subtitle">
                Play a casual computer game now, or log in for online matchmaking.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                <button
                  className="matchmaking-cancel-btn"
                  onClick={handleGuestPlay}
                  style={{ backgroundColor: '#81b64c', color: '#fff', border: 'none' }}
                >
                  Play as Guest
                </button>
                <button className="matchmaking-cancel-btn" onClick={handleLoginPlay}>
                  Login / Register
                </button>
                <button className="matchmaking-cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {status === 'searching' && (
            <>
              <div className="matchmaking-spinner">
                <div className="chess-piece-spin">&#9812;</div>
              </div>
              <h2 className="matchmaking-title">Finding opponent...</h2>
              <div className="matchmaking-progress-bar">
                <div
                  className="matchmaking-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="matchmaking-timer">{secondsLeft}s</p>
              <p className="matchmaking-hint">
                Searching online players &amp; AI opponents
              </p>
              <button className="matchmaking-cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </>
          )}

          {status === 'matched' && matchResult && (
            <>
              <div className="matchmaking-matched-icon">&#9876;&#65039;</div>
              <h2 className="matchmaking-title">Match Found!</h2>
              {matchResult.match_type !== 'human' && (
                <p style={{ fontSize: '0.8rem', color: '#e8a93e', margin: '-4px 0 8px' }}>
                  No players online — matched with AI opponent
                </p>
              )}
              <div className="matchmaking-opponent-card">
                {matchResult.opponent?.avatar_url && (
                  <img
                    src={matchResult.opponent.avatar_url}
                    alt={matchResult.opponent.name}
                    className="matchmaking-opponent-avatar"
                  />
                )}
                <div className="matchmaking-opponent-info">
                  <h3>{matchResult.opponent?.name || 'Opponent'}</h3>
                  <p>Rating: {matchResult.opponent?.rating || '?'}</p>
                </div>
              </div>
              <p className="matchmaking-starting">Starting game...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="matchmaking-error-icon">&#128542;</div>
              <h2 className="matchmaking-title">No match found</h2>
              <p className="matchmaking-subtitle">
                {error || 'Please try again'}
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  className="matchmaking-cancel-btn"
                  onClick={handleRetry}
                  style={{ backgroundColor: '#81b64c', color: '#fff', border: 'none' }}
                >
                  Retry
                </button>
                <button className="matchmaking-cancel-btn" onClick={handleCancel}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // Idle — render as a button
  if (variant === 'hero') {
    return (
      <button
        data-tour="quick-play-button"
        onClick={startQuickMatch}
        style={{
          display: 'block',
          width: '100%',
          padding: '18px 24px',
          marginBottom: '12px',
          background: 'linear-gradient(135deg, #81b64c, #5d8a35)',
          border: 'none',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: 'pointer',
          letterSpacing: '0.3px',
          boxShadow: '0 4px 16px rgba(129,182,76,0.35)',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(129,182,76,0.45)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(129,182,76,0.35)';
        }}
      >
        ▶ Play Online
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 'normal',
            opacity: 0.85,
            marginTop: '2px',
          }}
        >
          Quick match — online players &amp; AI fallback
        </span>
      </button>
    );
  }

  // Default: compact card button
  return (
    <button
      onClick={startQuickMatch}
      className="unified-card centered"
      style={{
        background: 'rgba(129,182,76,0.1)',
        border: '2px solid #81b64c',
      }}
    >
      <div className="unified-card-content">
        <h3 className="unified-card-title" style={{ fontSize: '15px', color: '#81b64c' }}>
          ▶ Play Online
        </h3>
        <p className="unified-card-subtitle">Quick match with fallback</p>
      </div>
    </button>
  );
};

export default PlayOnlineButton;
