import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import matchmakingService from '../../services/matchmakingService';
import {
  getPreferredGameMode, setPreferredGameMode,
  getPreferredTimeControl, setPreferredTimeControl,
  getPreferredColor as getSavedColor, setPreferredColor as saveColor,
} from '../../utils/gamePreferences';
import { BASE_URL } from '../../config';
import '../../styles/UnifiedCards.css';
import '../../pages/LobbyPage.css'; // Matchmaking overlay/modal styles

const QUEUE_TIMEOUT_SECONDS = 15;
const FIND_PLAYERS_TIMEOUT_SECONDS = 15; // Sync with backend match request expiry (15s)
const TOTAL_SEARCH_SECONDS = 15;
const POLL_INTERVAL_MS = 2000;

const TIME_PRESETS = [
  { minutes: 3, increment: 1, label: '3|1', category: 'Blitz' },
  { minutes: 3, increment: 2, label: '3|2', category: 'Blitz' },
  { minutes: 5, increment: 2, label: '5|2', category: 'Blitz' },
  { minutes: 5, increment: 3, label: '5|3', category: 'Blitz' },
  { minutes: 10, increment: 0, label: '10 min', category: 'Rapid' },
  { minutes: 10, increment: 5, label: '10|5', category: 'Rapid' },
  { minutes: 15, increment: 10, label: '15|10', category: 'Rapid' },
  { minutes: 30, increment: 10, label: '30|10', category: 'Classical' },
];

/**
 * MatchmakingQueue — Modal overlay for searching opponents
 *
 * States: idle (options) → findingPlayers (smart match) → searching (queue fallback) → matched → navigating
 */
const MatchmakingQueue = ({ isOpen, onClose, autoStart = false }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | findingPlayers | searching | matched | fallback | error
  const [entryId, setEntryId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(QUEUE_TIMEOUT_SECONDS);
  const [matchResult, setMatchResult] = useState(null);
  const [remainingTargets, setRemainingTargets] = useState(0);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const startTimeRef = useRef(null);
  const searchStartTimeRef = useRef(null);
  const matchRequestTokenRef = useRef(null);
  const findPlayersTimeoutRef = useRef(null);
  const statusRef = useRef('idle');
  statusRef.current = status;

  // Live online count during search (polls /api/v1/status every 5s while searching)
  const [liveOnline, setLiveOnline] = useState(null);
  const [stronglyOnline, setStronglyOnline] = useState(null);
  useEffect(() => {
    if (status !== 'findingPlayers' && status !== 'searching') {
      setLiveOnline(null);
      setStronglyOnline(null);
      return;
    }
    const fetchCount = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/status`);
        if (res.ok) {
          const data = await res.json();
          const count = data.players?.recently_active ?? 0;
          const strongly = data.players?.strongly_online ?? 0;
          console.log('[Matchmaking] Online players:', count, '(strongly:', strongly, ')');
          setLiveOnline(count);
          setStronglyOnline(strongly);
        }
      } catch {}
    };
    fetchCount();
    const id = setInterval(fetchCount, 5000);
    return () => clearInterval(id);
  }, [status]);

  // Pre-search preferences (restored from localStorage)
  const [preferredColor, setPreferredColor] = useState(() => getSavedColor());
  const [timeControl, setTimeControl] = useState(() => getPreferredTimeControl().minutes);
  const [increment, setIncrement] = useState(() => getPreferredTimeControl().increment);
  const [gameMode, setGameMode] = useState(() => getPreferredGameMode());

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (findPlayersTimeoutRef.current) clearTimeout(findPlayersTimeoutRef.current);
    pollRef.current = null;
    countdownRef.current = null;
    findPlayersTimeoutRef.current = null;
  }, []);

  // Safety timeout: ensure a game is always created after countdown reaches 0
  useEffect(() => {
    if (secondsLeft === 0 && (status === 'findingPlayers' || status === 'searching')) {
      console.log('[Matchmaking] Countdown reached 0, creating synthetic game');
      cleanup();
      setStatus('matched');
      const syntheticPlayers = [
        { id: 1, name: 'Priya Mehta', avatar_seed: 'priya-mehta', computer_level: 6, rating: 1370 },
        { id: 2, name: 'Kiran Joshi', avatar_seed: 'kiran-joshi', computer_level: 6, rating: 1390 },
        { id: 3, name: 'Ravi Patel', avatar_seed: 'ravi-patel', computer_level: 6, rating: 1420 },
        { id: 4, name: 'Ananya Das', avatar_seed: 'ananya-das', computer_level: 6, rating: 1440 },
        { id: 5, name: 'Vikram Rao', avatar_seed: 'vikram-rao', computer_level: 7, rating: 1470 },
        { id: 6, name: 'Sneha Kulkarni', avatar_seed: 'sneha-kulkarni', computer_level: 7, rating: 1500 },
      ];
      const randomSynthetic = syntheticPlayers[Math.floor(Math.random() * syntheticPlayers.length)];
      setMatchResult({
        match_type: 'synthetic',
        opponent: randomSynthetic,
        game_id: null,
      });
      setTimeout(() => {
        onClose();
        navigate('/play', {
          state: {
            gameMode: 'synthetic',
            syntheticPlayer: randomSynthetic,
            backendGameId: null,
            preferredColor: preferredColor === 'random'
              ? (Math.random() < 0.5 ? 'white' : 'black')
              : preferredColor,
            ratedMode: gameMode,
            timeControl,
            increment,
          },
        });
      }, 1500);
    }
  }, [secondsLeft, status, cleanup, navigate, onClose, preferredColor, gameMode, timeControl, increment]);

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
      searchStartTimeRef.current = null;
    }
  }, [isOpen, cleanup]);

  // Auto-start search immediately when opened with autoStart=true (from "Play Now" button)
  useEffect(() => {
    if (isOpen && autoStart && status === 'idle') {
      startSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fall back to existing polling-based queue
  const fallbackToQueue = useCallback(async () => {
    try {
      setStatus('searching');
      // Unified countdown continues from startSearch — don't reset

      const data = await matchmakingService.joinQueue({
        preferred_color: preferredColor,
        time_control_minutes: timeControl,
        increment_seconds: increment,
        game_mode: gameMode,
      });
      const id = data.entry.id;
      setEntryId(id);

      // Emit debug event for dev panel
      window.dispatchEvent(new CustomEvent('mm:debug', { detail: { phase: 'joinQueue', entryId: id, status: data.entry.status } }));

      // Start polling for match (countdown already running)
      pollRef.current = setInterval(async () => {
        try {
          const result = await matchmakingService.checkStatus(id);
          const entry = result.entry;

          if (entry.status === 'matched') {
            cleanup();
            setStatus('matched');
            setMatchResult(entry);

            // Navigate after brief celebration — close modal first to prevent overlay persisting
            setTimeout(() => {
              onClose(); // Close modal before navigation to remove Portal overlay
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
                    preferredColor: preferredColor === 'random'
                      ? (Math.random() < 0.5 ? 'white' : 'black')
                      : preferredColor,
                    ratedMode: gameMode, // Respect user's rated/casual selection
                    timeControl,
                    increment,
                  },
                });
              }
            }, 1500);
          } else if (entry.status === 'expired' || entry.status === 'cancelled') {
            // No match found — create synthetic game as fallback
            cleanup();
            setStatus('matched');
            const syntheticPlayers = [
              { id: 1, name: 'Priya Mehta', avatar_seed: 'priya-mehta', computer_level: 6, rating: 1370 },
              { id: 2, name: 'Kiran Joshi', avatar_seed: 'kiran-joshi', computer_level: 6, rating: 1390 },
              { id: 3, name: 'Ravi Patel', avatar_seed: 'ravi-patel', computer_level: 6, rating: 1420 },
              { id: 4, name: 'Ananya Das', avatar_seed: 'ananya-das', computer_level: 6, rating: 1440 },
            ];
            const randomSynthetic = syntheticPlayers[Math.floor(Math.random() * syntheticPlayers.length)];
            setMatchResult({
              match_type: 'synthetic',
              opponent: randomSynthetic,
              game_id: null,
            });
            setTimeout(() => {
              onClose();
              navigate('/play', {
                state: {
                  gameMode: 'synthetic',
                  syntheticPlayer: randomSynthetic,
                  backendGameId: null,
                  preferredColor: preferredColor === 'random'
                    ? (Math.random() < 0.5 ? 'white' : 'black')
                    : preferredColor,
                  ratedMode: gameMode,
                  timeControl,
                  increment,
                },
              });
            }, 1500);
          }
        } catch (err) {
          console.error('[Matchmaking] Poll error:', err);
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      console.error('[Matchmaking] Failed to join queue:', err);
      // Handle 429 rate limit by creating a synthetic game directly
      if (err.response?.status === 429) {
        console.log('[Matchmaking] Rate limited, creating synthetic game directly');
        cleanup();
        setStatus('matched');
        const syntheticPlayers = [
          { id: 1, name: 'Priya Mehta', avatar_seed: 'priya-mehta', computer_level: 6, rating: 1370 },
          { id: 2, name: 'Kiran Joshi', avatar_seed: 'kiran-joshi', computer_level: 6, rating: 1390 },
          { id: 3, name: 'Ravi Patel', avatar_seed: 'ravi-patel', computer_level: 6, rating: 1420 },
          { id: 4, name: 'Ananya Das', avatar_seed: 'ananya-das', computer_level: 6, rating: 1440 },
        ];
        const randomSynthetic = syntheticPlayers[Math.floor(Math.random() * syntheticPlayers.length)];
        setMatchResult({
          match_type: 'synthetic',
          opponent: randomSynthetic,
          game_id: null,
        });
        setTimeout(() => {
          onClose();
          navigate('/play', {
            state: {
              gameMode: 'synthetic',
              syntheticPlayer: randomSynthetic,
              backendGameId: null,
              preferredColor: preferredColor === 'random'
                ? (Math.random() < 0.5 ? 'white' : 'black')
                : preferredColor,
              ratedMode: gameMode,
              timeControl,
              increment,
            },
          });
        }, 1500);
      } else {
        setStatus('error');
      }
    }
  }, [preferredColor, timeControl, increment, gameMode, cleanup, navigate, onClose]);

  // Start smart matchmaking: try findPlayers first, then fall back
  const startSearch = useCallback(async () => {
    try {
      setStatus('findingPlayers');
      searchStartTimeRef.current = Date.now();
      setSecondsLeft(TOTAL_SEARCH_SECONDS);

      // Start unified 30s countdown (runs through both smart match + queue phases)
      countdownRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - searchStartTimeRef.current) / 1000);
        const remaining = Math.max(0, TOTAL_SEARCH_SECONDS - elapsed);
        setSecondsLeft(remaining);
      }, 250);

      const data = await matchmakingService.findPlayers({
        preferred_color: preferredColor,
        time_control_minutes: timeControl,
        increment_seconds: increment,
        game_mode: gameMode,
      });

      const targetsCount = data.match_request?.targets_count || 0;
      matchRequestTokenRef.current = data.match_request?.token;
      setRemainingTargets(targetsCount);

      // Emit debug event for dev panel
      window.dispatchEvent(new CustomEvent('mm:debug', { detail: { phase: 'findPlayers', targets: targetsCount, token: data.match_request?.token, status: data.match_request?.status } }));

      // If no targets found, immediately fall back to queue (backend will match with bot)
      if (targetsCount === 0) {
        console.log('[Matchmaking] No online players found, falling back to queue');
        matchRequestTokenRef.current = null;
        fallbackToQueue();
        return;
      }

      // Set timeout: after 15s, cancel find and create synthetic game
      findPlayersTimeoutRef.current = setTimeout(async () => {
        // Only create synthetic if still in findingPlayers state
        if (statusRef.current !== 'findingPlayers') return;

        console.log('[Matchmaking] Find players timeout, creating synthetic game');

        // Cancel the match request
        if (matchRequestTokenRef.current) {
          try {
            await matchmakingService.cancelFindPlayers(matchRequestTokenRef.current);
          } catch (err) {
            // 404 is ok - request may have already expired
            if (err.response?.status !== 404) {
              console.error('[Matchmaking] Cancel find error:', err);
            }
          }
          matchRequestTokenRef.current = null;
        }

        // Create synthetic game directly
        cleanup();
        setStatus('matched');
        const syntheticPlayers = [
          { id: 1, name: 'Priya Mehta', avatar_seed: 'priya-mehta', computer_level: 6, rating: 1370 },
          { id: 2, name: 'Kiran Joshi', avatar_seed: 'kiran-joshi', computer_level: 6, rating: 1390 },
          { id: 3, name: 'Ravi Patel', avatar_seed: 'ravi-patel', computer_level: 6, rating: 1420 },
          { id: 4, name: 'Ananya Das', avatar_seed: 'ananya-das', computer_level: 6, rating: 1440 },
          { id: 5, name: 'Vikram Rao', avatar_seed: 'vikram-rao', computer_level: 7, rating: 1470 },
          { id: 6, name: 'Sneha Kulkarni', avatar_seed: 'sneha-kulkarni', computer_level: 7, rating: 1500 },
        ];
        const randomSynthetic = syntheticPlayers[Math.floor(Math.random() * syntheticPlayers.length)];
        setMatchResult({
          match_type: 'synthetic',
          opponent: randomSynthetic,
          game_id: null,
        });
        setTimeout(() => {
          onClose();
          navigate('/play', {
            state: {
              gameMode: 'synthetic',
              syntheticPlayer: randomSynthetic,
              backendGameId: null,
              preferredColor: preferredColor === 'random'
                ? (Math.random() < 0.5 ? 'white' : 'black')
                : preferredColor,
              ratedMode: gameMode,
              timeControl,
              increment,
            },
          });
        }, 1500);
      }, FIND_PLAYERS_TIMEOUT_SECONDS * 1000);
    } catch (err) {
      console.error('[Matchmaking] Failed to find players:', err);
      // Fall back to queue on error — if that also fails, go to computer
      try {
        await fallbackToQueue();
      } catch (fallbackErr) {
        console.error('[Matchmaking] Queue fallback also failed:', fallbackErr);
        cleanup();
        setStatus('fallback');
        setTimeout(() => {
          onClose();
          navigate('/play');
        }, 1500);
      }
    }
  }, [preferredColor, timeControl, increment, gameMode, cleanup, fallbackToQueue]);

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
          onClose(); // Close modal before navigation to remove Portal overlay
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
          // Clear smart match timeout; countdown keeps running for queue phase
          if (findPlayersTimeoutRef.current) {
            clearTimeout(findPlayersTimeoutRef.current);
            findPlayersTimeoutRef.current = null;
          }
          matchRequestTokenRef.current = null;
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
  }, [cleanup, navigate, fallbackToQueue, onClose]);

  const handleCancel = async () => {
    cleanup();

    // Cancel smart match request if active
    if (matchRequestTokenRef.current) {
      try {
        await matchmakingService.cancelFindPlayers(matchRequestTokenRef.current);
      } catch (err) {
        // 404 is ok - request may have already expired
        if (err.response?.status !== 404) {
          console.error('[Matchmaking] Cancel find error:', err);
        }
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

  const progress = ((TOTAL_SEARCH_SECONDS - secondsLeft) / TOTAL_SEARCH_SECONDS) * 100;
  const categories = [...new Set(TIME_PRESETS.map(p => p.category))];

  return createPortal(
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
                          onClick={() => { setTimeControl(preset.minutes); setIncrement(preset.increment); setPreferredTimeControl(preset.minutes, preset.increment); }}
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

            {/* Game Mode */}
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#bababa', fontSize: '14px' }}>Game Mode:</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'rated', label: 'Rated', desc: 'Rating changes' },
                  { value: 'casual', label: 'Casual', desc: 'No rating change' },
                ].map(opt => {
                  const isSelected = gameMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setGameMode(opt.value);
                        setPreferredGameMode(opt.value);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: `2px solid ${isSelected ? (opt.value === 'rated' ? '#e8a735' : '#81b64c') : '#4a4744'}`,
                        backgroundColor: isSelected
                          ? (opt.value === 'rated' ? 'rgba(232, 167, 53, 0.2)' : 'rgba(129, 182, 76, 0.2)')
                          : 'transparent',
                        color: isSelected ? (opt.value === 'rated' ? '#e8a735' : '#81b64c') : '#bababa',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                    >
                      <div>{opt.value === 'rated' ? '⭐' : '📋'} {opt.label}</div>
                      <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
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
                      onClick={() => { setPreferredColor(opt.value); saveColor(opt.value); }}
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

        {/* Unified search phase (smart match → queue → bot fallback) */}
        {(status === 'findingPlayers' || status === 'searching') && (
          <>
            <div className="matchmaking-spinner">
              <div className="chess-piece-spin">&#9812;</div>
            </div>
            <h2 className="matchmaking-title">Looking for an opponent...</h2>
            <p className="matchmaking-subtitle">
              {timeControl}+{increment} &bull; {gameMode === 'rated' ? '⭐ Rated' : 'Casual'} &bull; {preferredColor === 'random' ? 'Any color' : preferredColor.charAt(0).toUpperCase() + preferredColor.slice(1)}
            </p>

            <div className="matchmaking-progress-bar">
              <div
                className="matchmaking-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="matchmaking-timer">{secondsLeft}s</p>
            {liveOnline !== null && (
              <p style={{ fontSize: '0.78rem', color: liveOnline > 0 ? '#4caf50' : '#8b8987', margin: '4px 0 8px', textAlign: 'center' }}>
                {liveOnline > 0 ? `${liveOnline} player${liveOnline !== 1 ? 's' : ''} online` : 'No other players online right now'}
              </p>
            )}
            <p className="matchmaking-hint">
              {status === 'findingPlayers' && remainingTargets > 0
                ? `Waiting for ${remainingTargets} player${remainingTargets !== 1 ? 's' : ''} to respond...`
                : status === 'searching'
                  ? 'No players responded — finding you a worthy opponent...'
                  : 'Searching for online players...'
              }
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

        {/* Fallback: no human and no bot available — redirecting to computer setup */}
        {status === 'fallback' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>&#9820;</div>
            <h2 className="matchmaking-title">No players online right now</h2>
            <p className="matchmaking-subtitle">Redirecting you to play vs computer...</p>
            <p style={{ fontSize: '0.78rem', color: '#8b8987', marginTop: '8px' }}>
              Tip: Try again during peak hours for human opponents
            </p>
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
    </div>,
    document.body
  );
};

export default MatchmakingQueue;
