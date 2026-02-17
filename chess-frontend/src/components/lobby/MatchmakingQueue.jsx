import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import matchmakingService from '../../services/matchmakingService';
import '../../styles/UnifiedCards.css';

const QUEUE_TIMEOUT_SECONDS = 20;
const POLL_INTERVAL_MS = 2000;

/**
 * MatchmakingQueue — Modal overlay for searching opponents
 *
 * States: searching → matched (human or synthetic) → navigating
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

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    pollRef.current = null;
    countdownRef.current = null;
  }, []);

  // Start searching when modal opens
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setStatus('idle');
      setEntryId(null);
      setSecondsLeft(QUEUE_TIMEOUT_SECONDS);
      setMatchResult(null);
      return;
    }

    const startSearch = async () => {
      try {
        setStatus('searching');
        startTimeRef.current = Date.now();

        const data = await matchmakingService.joinQueue();
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
    };

    startSearch();

    return cleanup;
  }, [isOpen, cleanup, navigate]);

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

  return (
    <div className="matchmaking-overlay" onClick={handleCancel}>
      <div className="matchmaking-modal" onClick={(e) => e.stopPropagation()}>
        {status === 'searching' && (
          <>
            <div className="matchmaking-spinner">
              <div className="chess-piece-spin">♚</div>
            </div>
            <h2 className="matchmaking-title">Searching for opponent...</h2>
            <p className="matchmaking-subtitle">Looking for a player near your rating</p>

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
