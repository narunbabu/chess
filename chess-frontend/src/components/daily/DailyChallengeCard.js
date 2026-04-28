import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import '../../styles/UnifiedCards.css';

const TIER_COLORS = {
  beginner: { bg: '#4CAF50', label: 'Beginner' },
  intermediate: { bg: '#2196F3', label: 'Intermediate' },
  advanced: { bg: '#9C27B0', label: 'Advanced' },
};

const DailyChallengeCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = () => {
      api.get('/v1/daily-challenge')
        .then(res => setChallenge(res.data.data || res.data))
        .catch(() => {});
      api.get('/v1/tutorial/progress/stats')
        .then(res => {
          const stats = res.data.data || res.data;
          setStreak(stats.daily_streak || 0);
        })
        .catch(() => {});
      setLoading(false);
    };

    fetchData();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  const handleClick = () => navigate('/daily-challenge');

  if (loading) {
    return (
      <section className="unified-section">
        <h2 className="unified-section-header">Daily Challenge</h2>
        <div className="unified-card" style={{ minHeight: 100, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 28, height: 28, border: '3px solid #3d3a37', borderTopColor: '#81b64c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </section>
    );
  }

  if (!challenge) return null;

  const completed = challenge.user_completion?.completed;
  const tier = TIER_COLORS[challenge.skill_tier] || TIER_COLORS.beginner;

  return (
    <section className="unified-section">
      <h2 className="unified-section-header">
        <span>Daily Challenge</span>
      </h2>
      <div
        className="unified-card"
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          background: completed ? 'rgba(76,175,80,0.06)' : undefined,
          borderColor: completed ? '#4CAF50' : undefined,
          padding: '1rem 1.25rem',
          gap: '0.6rem',
        }}
      >
        {/* Top row: title + tier badge + streak */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <h3
              className="unified-card-title"
              style={{ fontSize: 15, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {challenge.challenge_data?.title || 'Daily Puzzle'}
            </h3>
            <span style={{
              fontSize: 11,
              padding: '1px 8px',
              borderRadius: 10,
              fontWeight: 600,
              background: tier.bg,
              color: '#fff',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {tier.label}
            </span>
          </div>
          {streak > 0 && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#FF9800',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16 }}>&#128293;</span>
              {streak}
            </span>
          )}
        </div>

        {/* Description / status */}
        <p className="unified-card-subtitle" style={{ margin: 0, fontSize: 13 }}>
          {completed
            ? 'Completed! Come back tomorrow for a new puzzle.'
            : (challenge.challenge_data?.description || 'Find the best move.')}
        </p>

        {/* Meta row: XP + solvers + completion badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="unified-card-meta" style={{ margin: 0 }}>
            +{challenge.xp_reward} XP
          </span>
          <span className="unified-card-meta" style={{ margin: 0 }}>
            {challenge.completion_count || 0} solved
          </span>
          {challenge.success_rate != null && (
            <span className="unified-card-meta" style={{ margin: 0 }}>
              {Math.round(challenge.success_rate)}% rate
            </span>
          )}
          {completed && (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#4CAF50',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}>
              &#10003; Done
            </span>
          )}
          {/* Daily puzzle cap for free users */}
          {challenge.daily_puzzle_cap && !completed && (
            <span className="unified-card-meta" style={{ margin: 0, color: '#FF9800' }}>
              {challenge.daily_puzzle_cap.remaining}/{challenge.daily_puzzle_cap.limit} remaining today
            </span>
          )}
        </div>

        {/* Streak bar — visual progress for last 7 days */}
        {streak > 0 && <StreakBar streak={streak} />}

        {/* Action button */}
        <div style={{ marginTop: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className={`unified-card-btn ${completed ? 'secondary' : 'primary'}`}
            style={{ width: '100%' }}
          >
            {completed ? 'Review' : 'Solve Now'}
          </button>
        </div>
      </div>
    </section>
  );
};

/* 7-day streak visualisation — filled circles for active days, hollow for missed */
const StreakBar = ({ streak }) => {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date().getDay(); // 0=Sun

  // Build array of last 7 days (oldest first). `true` means the user completed
  // that day's challenge. For simplicity we mark `streak` consecutive days back
  // from today as filled — this mirrors the backend streak definition.
  const filled = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i; // 6 = today slot
    return offset < streak;
  });

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {filled.map((done, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: done ? '#FF9800' : 'transparent',
              border: done ? 'none' : '2px solid #555',
              transition: 'background 0.3s',
            }}
          />
          <span style={{ fontSize: 9, color: '#777' }}>
            {days[(today - 6 + i + 7) % 7]}
          </span>
        </div>
      ))}
    </div>
  );
};

export default DailyChallengeCard;
