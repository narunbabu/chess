import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../styles/UnifiedCards.css';

const TIER_COLORS = {
  beginner: { bg: '#4CAF50', label: 'Beginner' },
  intermediate: { bg: '#2196F3', label: 'Intermediate' },
  advanced: { bg: '#9C27B0', label: 'Advanced' },
};

const TIER_ICONS = { beginner: '🌱', intermediate: '🎯', advanced: '🏆' };

const DailyChallengesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [streak, setStreak] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [challengeRes, statsRes, lbRes] = await Promise.allSettled([
          api.get('/v1/daily-challenge'),
          api.get('/v1/tutorial/progress/stats'),
          api.get('/v1/daily-challenge/leaderboard'),
        ]);

        if (challengeRes.status === 'fulfilled') {
          setChallenge(challengeRes.value.data.data || challengeRes.value.data);
        }
        if (statsRes.status === 'fulfilled') {
          const stats = statsRes.value.data.data || statsRes.value.data;
          setStreak(stats.daily_streak || 0);
        }
        if (lbRes.status === 'fulfilled') {
          const lbData = lbRes.value.data.data || lbRes.value.data;
          setLeaderboard(lbData.leaderboard || lbData || []);
        }
      } catch (err) {
        console.error('[DailyChallengesPage] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#262421' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#81b64c] mx-auto mb-3" />
          <p style={{ color: '#bababa', fontSize: 14 }}>Loading daily challenges...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#262421', color: '#bababa' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🧩</p>
          <p style={{ fontSize: 18 }}>Please log in to access daily challenges.</p>
          <button onClick={() => navigate('/login')} style={{ marginTop: 16, background: '#81b64c', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Log In</button>
        </div>
      </div>
    );
  }

  const completed = challenge?.user_completion?.completed;
  const tier = challenge ? (TIER_COLORS[challenge.skill_tier] || TIER_COLORS.beginner) : null;
  const fen = challenge?.challenge_data?.fen;
  const turnColor = fen ? (fen.split(' ')[1] === 'b' ? 'black' : 'white') : 'white';

  return (
    <div style={{ minHeight: '100vh', background: '#262421', color: '#bababa', padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', margin: '0 0 8px' }}>
            🧩 Daily Challenges
          </h1>
          <p style={{ fontSize: 15, color: '#999', margin: 0 }}>
            A new puzzle every day. Build your streak. Earn XP.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left: Today's Challenge */}
          <div>
            <div className="unified-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>Today's Puzzle</h2>
                {challenge && tier && (
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 600, background: tier.bg, color: '#fff' }}>
                    {TIER_ICONS[challenge.skill_tier]} {tier.label}
                  </span>
                )}
              </div>

              {challenge ? (
                <>
                  {/* Mini Board */}
                  <div
                    style={{ width: '100%', aspectRatio: '1', marginBottom: 12, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => navigate('/daily-challenge')}
                  >
                    <Chessboard
                      id="daily-preview-board"
                      position={fen || 'start'}
                      boardOrientation={turnColor}
                      arePiecesDraggable={false}
                      customBoardStyle={{ borderRadius: 6 }}
                      customDarkSquareStyle={{ backgroundColor: '#779952' }}
                      customLightSquareStyle={{ backgroundColor: '#edeed1' }}
                    />
                    {/* Click overlay */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', cursor: 'pointer', zIndex: 1 }} />
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ fontSize: 15, color: '#fff', margin: '0 0 4px', fontWeight: 600 }}>
                    {challenge.challenge_data?.title || 'Daily Puzzle'}
                  </h3>
                  <p style={{ fontSize: 13, color: '#999', margin: '0 0 12px' }}>
                    {challenge.challenge_data?.description || 'Find the best move.'}
                  </p>

                  {/* Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: completed ? '#4CAF50' : '#FF9800',
                      background: completed ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)',
                      padding: '4px 12px', borderRadius: 6,
                    }}>
                      {completed ? '✓ Completed' : '● Unsolved'}
                    </span>
                    <span style={{ fontSize: 13, color: '#81b64c' }}>+{challenge.xp_reward} XP</span>
                    <span style={{ fontSize: 13, color: '#777' }}>{challenge.completion_count || 0} solved</span>
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => navigate('/daily-challenge')}
                    className={`unified-card-btn ${completed ? 'secondary' : 'primary'}`}
                    style={{ width: '100%' }}
                  >
                    {completed ? 'Review Puzzle' : 'Solve Now'}
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: 40, margin: '0 0 8px' }}>🧩</p>
                  <p style={{ color: '#999', margin: 0 }}>No challenge available today.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Streak + Stats + Leaderboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Streak Card */}
            <div className="unified-card" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
                🔥 Your Streak
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: '#FF9800', lineHeight: 1 }}>
                  {streak}
                </span>
                <div>
                  <span style={{ fontSize: 14, color: '#bababa' }}>day{streak !== 1 ? 's' : ''}</span>
                  <br />
                  <span style={{ fontSize: 12, color: '#777' }}>
                    {streak === 0 ? 'Complete today to start!' : streak >= 7 ? 'Incredible consistency!' : 'Keep it going!'}
                  </span>
                </div>
              </div>

              {/* 7-day visual */}
              <StreakBar streak={streak} />

              {/* Stats row */}
              {challenge && (
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTop: '1px solid #3d3a37', fontSize: 13 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999' }}>Attempts</div>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{challenge.user_completion?.attempts || 0}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999' }}>Success Rate</div>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{challenge.success_rate != null ? `${Math.round(challenge.success_rate)}%` : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999' }}>XP Earned</div>
                    <div style={{ color: '#81b64c', fontWeight: 600 }}>{completed ? `+${challenge.xp_reward}` : '0'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Leaderboard Card */}
            <div className="unified-card" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
                🏆 Today's Leaderboard
              </h2>

              {leaderboard.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {leaderboard.slice(0, 10).map((entry, i) => {
                    const isCurrentUser = entry.user_id === user?.id;
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                    return (
                      <div
                        key={entry.id || i}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 8px', borderRadius: 6,
                          background: isCurrentUser ? 'rgba(129,182,76,0.1)' : 'transparent',
                          border: isCurrentUser ? '1px solid rgba(129,182,76,0.25)' : '1px solid transparent',
                        }}
                      >
                        <span style={{ width: 28, textAlign: 'center', fontSize: 14, flexShrink: 0 }}>{medal}</span>
                        <span style={{ flex: 1, fontSize: 13, color: isCurrentUser ? '#81b64c' : '#bababa', fontWeight: isCurrentUser ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.user?.name || entry.name || `Player ${entry.user_id}`}
                        </span>
                        <span style={{ fontSize: 12, color: '#777', flexShrink: 0 }}>
                          {formatTime(entry.time_spent_seconds || 0)}
                        </span>
                        <span style={{ fontSize: 11, color: '#999', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
                          {entry.attempts || 1} try
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: 24, margin: '0 0 4px' }}>👑</p>
                  <p style={{ color: '#777', fontSize: 13, margin: 0 }}>Be the first to solve today's puzzle!</p>
                </div>
              )}
            </div>

            {/* How It Works */}
            <div className="unified-card" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>How It Works</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#999' }}>
                <p style={{ margin: 0 }}>🧩 A new chess puzzle every day at midnight</p>
                <p style={{ margin: 0 }}>🔥 Solve daily to build your streak</p>
                <p style={{ margin: 0 }}>⭐ Earn XP for each correct solution</p>
                <p style={{ margin: 0 }}>🥇 Compete for the fastest solve time</p>
                <p style={{ margin: 0 }}>💡 Use hints if you get stuck (no penalty)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 7-day streak visualisation */
const StreakBar = ({ streak }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  const filled = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    return offset < streak;
  });

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
      {filled.map((done, i) => {
        const dayIndex = (today - 6 + i + 7) % 7;
        const isToday = i === 6;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: done ? '#FF9800' : 'transparent',
                border: done ? 'none' : `2px solid ${isToday ? '#81b64c' : '#444'}`,
                transition: 'background 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: done ? '#fff' : '#666',
              }}
            >
              {done ? '✓' : ''}
            </div>
            <span style={{ fontSize: 10, color: isToday ? '#81b64c' : '#666', fontWeight: isToday ? 600 : 400 }}>
              {days[dayIndex]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default DailyChallengesPage;
