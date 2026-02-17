import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import matchmakingService from '../../services/matchmakingService';
import '../../styles/UnifiedCards.css';

const QUEUE_TIMEOUT_SECONDS = 20;
const POLL_INTERVAL_MS = 2000;

const TIME_PRESETS = [
  { minutes: 3, increment: 0, label: '3 min', category: 'Blitz' },
  { minutes: 3, increment: 2, label: '3|2', category: 'Blitz' },
  { minutes: 5, increment: 0, label: '5 min', category: 'Blitz' },
  { minutes: 5, increment: 3, label: '5|3', category: 'Blitz' },
  { minutes: 10, increment: 0, label: '10 min', category: 'Rapid' },
  { minutes: 10, increment: 5, label: '10|5', category: 'Rapid' },
  { minutes: 15, increment: 10, label: '15|10', category: 'Rapid' },
  { minutes: 30, increment: 0, label: '30 min', category: 'Classical' },
];

/**
 * MatchmakingQueue — Modal overlay for searching opponents
 *
 * States: idle (options) → searching → matched (human or synthetic) → navigating
 */
const MatchmakingQueue = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | searching | matched | error
  const [entryId, setEntryId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(QUEUE_TIMEOUT_SECONDS);
  const [matchResult, setMatchResult] = useState(null);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const startTimeRef = useRef(null);

  // Pre-search preferences
  const [preferredColor, setPreferredColor] = useState('random');
  const [timeControl, setTimeControl] = useState(10);
  const [increment, setIncrement] = useState(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    pollRef.current = null;
    countdownRef.current = null;
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setStatus('idle');
      setEntryId(null);
      setSecondsLeft(QUEUE_TIMEOUT_SECONDS);
      setMatchResult(null);
    }
  }, [isOpen, cleanup]);

  const startSearch = useCallback(async () => {
    try {
      setStatus('searching');
      startTimeRef.current = Date.now();

      const data = await matchmakingService.joinQueue({
        preferred_color: preferredColor,
        time_control_minutes: timeControl,
        increment_seconds: increment,
      });
      const id = data.entry.id;
      setEntryId(id);

      // Start countdown timer
      countdownRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = Math.max(0, QUEUE_TIMEOUT_SECONDS - elapsed);
        setSecondsLeft(remaining);
      }, 250);

      // Start polling for match
      pollRef.current = setInterval(async () => {
        try {
          const result = await matchmakingService.checkStatus(id);
          const entry = result.entry;

          if (entry.status === 'matched') {
            cleanup();
            setStatus('matched');
            setMatchResult(entry);

            // Navigate after brief celebration
            setTimeout(() => {
              if (entry.match_type === 'human') {
                // Human match → multiplayer game
                sessionStorage.setItem('lastInvitationAction', 'matchmaking_matched');
                sessionStorage.setItem('lastInvitationTime', Date.now().toString());
                sessionStorage.setItem('lastGameId', entry.game_id.toString());
                navigate(`/play/multiplayer/${entry.game_id}`);
              } else {
                // Synthetic match → computer game with bot identity
                navigate('/play', {
                  state: {
                    gameMode: 'synthetic',
                    syntheticPlayer: entry.opponent,
                    backendGameId: entry.game_id,
                  },
                });
              }
            }, 1500);
          } else if (entry.status === 'expired' || entry.status === 'cancelled') {
            cleanup();
            setStatus('error');
          }
        } catch (err) {
          console.error('[Matchmaking] Poll error:', err);
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error('[Matchmaking] Failed to join queue:', err);
      setStatus('error');
    }
  }, [preferredColor, timeControl, increment, cleanup, navigate]);

  const handleCancel = async () => {
    cleanup();
    if (entryId) {
      try {
        await matchmakingService.cancelQueue(entryId);
      } catch (err) {
        console.error('[Matchmaking] Cancel error:', err);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const progress = ((QUEUE_TIMEOUT_SECONDS - secondsLeft) / QUEUE_TIMEOUT_SECONDS) * 100;
  const categories = [...new Set(TIME_PRESETS.map(p => p.category))];

  return (
    <div className="matchmaking-overlay" onClick={handleCancel}>
      <div className="matchmaking-modal" onClick={(e) => e.stopPropagation()}>
        {/* Pre-search options screen */}
        {status === 'idle' && (
          <>
            <h2 className="matchmaking-title" style={{ marginBottom: '16px' }}>Play Online</h2>

            {/* Time Control */}
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa', fontSize: '14px' }}>Time Control:</p>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: '6px' }}>
                  <p style={{ fontSize: '11px', color: '#8b8987', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {TIME_PRESETS.filter(p => p.category === cat).map(preset => {
                      const isSelected = timeControl === preset.minutes && increment === preset.increment;
                      return (
                        <button
                          key={`${preset.minutes}-${preset.increment}`}
                          onClick={() => { setTimeControl(preset.minutes); setIncrement(preset.increment); }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '16px',
                            border: `2px solid ${isSelected ? '#81b64c' : '#4a4744'}`,
                            backgroundColor: isSelected ? 'rgba(129, 182, 76, 0.2)' : 'transparent',
                            color: isSelected ? '#81b64c' : '#bababa',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Color Preference */}
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa', fontSize: '14px' }}>Color Preference:</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'white', label: '♔ White', bg: '#e0e0e0', fg: '#1a1a18' },
                  { value: 'black', label: '♚ Black', bg: '#1a1a18', fg: '#bababa' },
                  { value: 'random', label: '🎲 Random', bg: '#81b64c', fg: '#ffffff' },
                ].map(opt => {
                  const isSelected = preferredColor === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setPreferredColor(opt.value)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: `2px solid ${isSelected ? '#81b64c' : '#4a4744'}`,
                        backgroundColor: isSelected ? opt.bg : 'transparent',
                        color: isSelected ? opt.fg : '#bababa',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Find Match button */}
            <button
              className="matchmaking-cancel-btn"
              onClick={startSearch}
              style={{
                backgroundColor: '#81b64c',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '16px',
                padding: '12px 32px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
                marginBottom: '8px',
              }}
            >
              Find Match
            </button>
            <button
              className="matchmaking-cancel-btn"
              onClick={onClose}
              style={{ marginTop: '4px' }}
            >
              Cancel
            </button>
          </>
        )}

        {status === 'searching' && (
          <>
            <div className="matchmaking-spinner">
              <div className="chess-piece-spin">♚</div>
            </div>
            <h2 className="matchmaking-title">Searching for opponent...</h2>
            <p className="matchmaking-subtitle">
              {timeControl}+{increment} &bull; {preferredColor === 'random' ? 'Any color' : preferredColor.charAt(0).toUpperCase() + preferredColor.slice(1)}
            </p>

            <div className="matchmaking-progress-bar">
              <div
                className="matchmaking-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="matchmaking-timer">{secondsLeft}s remaining</p>
            <p className="matchmaking-hint">
              Finding the best match for you...
            </p>

            <button className="matchmaking-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          </>
        )}

        {status === 'matched' && matchResult && (
          <>
            <div className="matchmaking-matched-icon">⚔️</div>
            <h2 className="matchmaking-title">Match Found!</h2>
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
            <div className="matchmaking-error-icon">😞</div>
            <h2 className="matchmaking-title">No match found</h2>
            <p className="matchmaking-subtitle">Please try again</p>
            <button className="matchmaking-cancel-btn" onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MatchmakingQueue;
