import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import matchmakingService from '../../services/matchmakingService';
import '../../styles/UnifiedCards.css';

const QUEUE_TIMEOUT_SECONDS = 20;
const FIND_PLAYERS_TIMEOUT_SECONDS = 15;
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
 * States: idle (options) → findingPlayers (smart match) → searching (queue fallback) → matched → navigating
 */
const MatchmakingQueue = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | findingPlayers | searching | matched | error
  const [entryId, setEntryId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(QUEUE_TIMEOUT_SECONDS);
  const [matchResult, setMatchResult] = useState(null);
  const [remainingTargets, setRemainingTargets] = useState(0);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const startTimeRef = useRef(null);
  const matchRequestTokenRef = useRef(null);
  const findPlayersTimeoutRef = useRef(null);
  const statusRef = useRef('idle');
  statusRef.current = status;

  // Pre-search preferences
  const [preferredColor, setPreferredColor] = useState('random');
  const [timeControl, setTimeControl] = useState(10);
  const [increment, setIncrement] = useState(0);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (findPlayersTimeoutRef.current) clearTimeout(findPlayersTimeoutRef.current);
    pollRef.current = null;
    countdownRef.current = null;
    findPlayersTimeoutRef.current = null;
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setStatus('idle');
      setEntryId(null);
      setSecondsLeft(QUEUE_TIMEOUT_SECONDS);
      setMatchResult(null);
      setRemainingTargets(0);
      matchRequestTokenRef.current = null;
    }
  }, [isOpen, cleanup]);

  // Fall back to existing polling-based queue
  const fallbackToQueue = useCallback(async () => {
    try {
      setStatus('searching');
      startTimeRef.current = Date.now();
      setSecondsLeft(QUEUE_TIMEOUT_SECONDS);

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
                sessionStorage.setItem('lastInvitationAction', 'matchmaking_matched');
                sessionStorage.setItem('lastInvitationTime', Date.now().toString());
                sessionStorage.setItem('lastGameId', entry.game_id.toString());
                navigate(`/play/multiplayer/${entry.game_id}`);
              } else {
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

  // Start smart matchmaking: try findPlayers first, then fall back
  const startSearch = useCallback(async () => {
    try {
      setStatus('findingPlayers');
      startTimeRef.current = Date.now();
      setSecondsLeft(FIND_PLAYERS_TIMEOUT_SECONDS);

      const data = await matchmakingService.findPlayers({
        preferred_color: preferredColor,
        time_control_minutes: timeControl,
        increment_seconds: increment,
      });

      const targetsCount = data.match_request?.targets_count || 0;
      matchRequestTokenRef.current = data.match_request?.token;
      setRemainingTargets(targetsCount);

      // If no targets found, immediately fall back to queue
      if (targetsCount === 0) {
        console.log('[Matchmaking] No online players found, falling back to queue');
        matchRequestTokenRef.current = null;
        fallbackToQueue();
        return;
      }

      // Start countdown timer for finding players phase
      countdownRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = Math.max(0, FIND_PLAYERS_TIMEOUT_SECONDS - elapsed);
        setSecondsLeft(remaining);
      }, 250);

      // Set timeout: after 15s, cancel find and fall back to queue
      findPlayersTimeoutRef.current = setTimeout(async () => {
        // Only fall back if still in findingPlayers state
        if (statusRef.current !== 'findingPlayers') return;

        console.log('[Matchmaking] Find players timeout, falling back to queue');
        cleanup();

        // Cancel the match request
        if (matchRequestTokenRef.current) {
          try {
            await matchmakingService.cancelFindPlayers(matchRequestTokenRef.current);
          } catch (err) {
            console.error('[Matchmaking] Cancel find error:', err);
          }
          matchRequestTokenRef.current = null;
        }

        fallbackToQueue();
      }, FIND_PLAYERS_TIMEOUT_SECONDS * 1000);
    } catch (err) {
      console.error('[Matchmaking] Failed to find players:', err);
      // Fall back to queue on error
      fallbackToQueue();
    }
  }, [preferredColor, timeControl, increment, cleanup, fallbackToQueue]);

  // Listen for matchRequestAccepted DOM event (from GlobalInvitationContext)
  useEffect(() => {
    const handleMatchAccepted = (event) => {
      const { gameId } = event.detail;
      if (statusRef.current === 'findingPlayers' && gameId) {
        cleanup();
        setStatus('matched');
        setMatchResult({
          match_type: 'human',
          game_id: gameId,
          opponent: event.detail.acceptedBy || {},
        });

        setTimeout(() => {
          sessionStorage.setItem('lastInvitationAction', 'smart_match_accepted');
          sessionStorage.setItem('lastInvitationTime', Date.now().toString());
          sessionStorage.setItem('lastGameId', gameId.toString());
          navigate(`/play/multiplayer/${gameId}`);
        }, 1500);
      }
    };

    const handleMatchDeclined = (event) => {
      const { remainingTargets: remaining } = event.detail;
      if (statusRef.current === 'findingPlayers') {
        setRemainingTargets(remaining);
        // If all declined, immediately fall back
        if (remaining === 0) {
          cleanup();
          if (matchRequestTokenRef.current) {
            matchRequestTokenRef.current = null;
          }
          fallbackToQueue();
        }
      }
    };

    window.addEventListener('matchRequestAccepted', handleMatchAccepted);
    window.addEventListener('matchRequestDeclined', handleMatchDeclined);
    return () => {
      window.removeEventListener('matchRequestAccepted', handleMatchAccepted);
      window.removeEventListener('matchRequestDeclined', handleMatchDeclined);
    };
  }, [cleanup, navigate, fallbackToQueue]);

  const handleCancel = async () => {
    cleanup();

    // Cancel smart match request if active
    if (matchRequestTokenRef.current) {
      try {
        await matchmakingService.cancelFindPlayers(matchRequestTokenRef.current);
      } catch (err) {
        console.error('[Matchmaking] Cancel find error:', err);
      }
      matchRequestTokenRef.current = null;
    }

    // Cancel queue entry if active
    if (entryId) {
      try {
        await matchmakingService.cancelQueue(entryId);
      } catch (err) {
        console.error('[Matchmaking] Cancel queue error:', err);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const timeoutForProgress = status === 'findingPlayers' ? FIND_PLAYERS_TIMEOUT_SECONDS : QUEUE_TIMEOUT_SECONDS;
  const progress = ((timeoutForProgress - secondsLeft) / timeoutForProgress) * 100;
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
                  { value: 'white', label: '\u2654 White', bg: '#e0e0e0', fg: '#1a1a18' },
                  { value: 'black', label: '\u265A Black', bg: '#1a1a18', fg: '#bababa' },
                  { value: 'random', label: '\uD83C\uDFB2 Random', bg: '#81b64c', fg: '#ffffff' },
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

        {/* Finding real players (smart matchmaking phase) */}
        {status === 'findingPlayers' && (
          <>
            <div className="matchmaking-spinner">
              <div className="chess-piece-spin">&#9812;</div>
            </div>
            <h2 className="matchmaking-title">Finding players...</h2>
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
              {remainingTargets > 0
                ? `Waiting for ${remainingTargets} player${remainingTargets !== 1 ? 's' : ''} to respond...`
                : 'Looking for online players...'
              }
            </p>

            <button className="matchmaking-cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          </>
        )}

        {/* Queue-based searching (fallback) */}
        {status === 'searching' && (
          <>
            <div className="matchmaking-spinner">
              <div className="chess-piece-spin">&#9818;</div>
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
            <div className="matchmaking-matched-icon">&#9876;&#65039;</div>
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
            <div className="matchmaking-error-icon">&#128542;</div>
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
