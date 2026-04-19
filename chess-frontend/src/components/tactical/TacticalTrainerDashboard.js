import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { stages } from './tacticalStages';
import { useAuth } from '../../contexts/AuthContext';
import { getLeaderboard } from '../../services/tacticalApi';

export default function TacticalTrainerDashboard({ stats, onSelectStage }) {
  const { isAuthenticated } = useAuth();
  const [rankInfo, setRankInfo] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getLeaderboard('rating', 'all', 1)
      .then(data => {
        if (cancelled) return;
        setRankInfo({
          rank: data.currentUserRank ?? null,
          total: data.meta?.total ?? data.leaderboard?.length ?? null,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const overallAccuracy =
    stats.totalAttempted > 0
      ? Math.round((stats.totalSolved / stats.totalAttempted) * 100)
      : 0;

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#262421' }}>
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: '#8b8987' }}>
          <Link to="/training" className="hover:text-white transition-colors">Training Hub</Link>
          <span>/</span>
          <span style={{ color: '#bababa' }}>Tactical Trainer</span>
        </div>

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-white mb-3">Tactical Progression Trainer</h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#bababa' }}>
            A structured thinking system: 2,500 real Lichess puzzles across 5 stages.
            Write your analysis before every move — then solve.
          </p>
        </div>

        {/* Stats row */}
        <div className={`grid gap-4 mb-10 ${rankInfo?.rank ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
          {[
            { label: 'Trainer Rating', value: stats.rating, color: '#81b64c' },
            { label: 'Total Solved',   value: stats.totalSolved || 0, color: '#ffffff' },
            { label: 'Accuracy',       value: `${overallAccuracy}%`, color: overallAccuracy >= 70 ? '#81b64c' : '#f59e0b' },
            { label: 'Streak',
              value: (stats.streak || 0) > 0 ? `🔥 ${stats.streak}` : stats.streak || 0,
              color: (stats.streak || 0) > 4 ? '#f59e0b' : '#ffffff' },
            ...(rankInfo?.rank ? [{
              label: 'Global Rank',
              value: `#${rankInfo.rank}${rankInfo.total ? ` of ${rankInfo.total}` : ''}`,
              color: rankInfo.rank <= 3 ? '#FFD700' : rankInfo.rank <= 10 ? '#81b64c' : '#5b8dd9',
            }] : []),
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl p-5 text-center"
              style={{ backgroundColor: '#312e2b', border: '1px solid #4a4744' }}
            >
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#8b8987' }}>
                {label}
              </div>
              <div className="text-2xl font-bold" style={{ color }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard link */}
        <div className="flex justify-center mb-8">
          <Link
            to="/leaderboard"
            state={{ category: 'tactical' }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              backgroundColor: '#312e2b',
              border: '1px solid #4a4744',
              color: '#bababa',
              textDecoration: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#81b64c';
              e.currentTarget.style.color = '#81b64c';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#4a4744';
              e.currentTarget.style.color = '#bababa';
            }}
          >
            🧩 View Tactical Leaderboard
          </Link>
        </div>

        {/* Overall progress bar */}
        <div className="mb-8 px-1">
          <div className="flex justify-between text-xs font-medium mb-1" style={{ color: '#8b8987' }}>
            <span>Overall Progress</span>
            <span style={{ color: '#bababa' }}>
              {stages.reduce((s, st) => s + (stats.stageProgress?.[st.id]?.solved || 0), 0)} / {stages.reduce((s, st) => s + st.puzzleCount, 0)} puzzles
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#4a4744' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.round(
                  (stages.reduce((s, st) => s + (stats.stageProgress?.[st.id]?.solved || 0), 0) /
                    stages.reduce((s, st) => s + st.puzzleCount, 0)) * 100
                )}%`,
                background: 'linear-gradient(90deg, #4ade80, #81b64c, #5b8dd9, #c9882a, #c93a3a)',
              }}
            />
          </div>
        </div>

        {/* Stage cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {stages.map(stage => {
            const progress   = stats.stageProgress?.[stage.id] || { attempted: 0, solved: 0, unlocked: stage.id === 0 };
            const isUnlocked = progress.unlocked || stage.id === 0;
            const solved     = progress.solved || 0;
            const attempted  = progress.attempted || 0;
            const accuracy   = attempted > 0 ? Math.round((solved / attempted) * 100) : null;
            const pct        = Math.min(100, Math.round((solved / stage.puzzleCount) * 100));

            // How many more to unlock next stage
            const toUnlock   = isUnlocked ? Math.max(0, stage.unlockAfter - solved) : null;
            const nextStageDef = stages.find(s => s.id === stage.id + 1);

            return (
              <div
                key={stage.id}
                onClick={() => isUnlocked && onSelectStage(stage.id)}
                className="rounded-3xl p-7 transition-all duration-200 relative overflow-hidden"
                style={{
                  backgroundColor: '#312e2b',
                  border: `2px solid ${isUnlocked ? '#4a4744' : '#2e2b28'}`,
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  opacity: isUnlocked ? 1 : 0.55,
                }}
                onMouseEnter={e => {
                  if (isUnlocked) {
                    e.currentTarget.style.borderColor = stage.color;
                    e.currentTarget.style.transform   = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow   = `0 8px 30px ${stage.color}20`;
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isUnlocked ? '#4a4744' : '#2e2b28';
                  e.currentTarget.style.transform   = 'translateY(0)';
                  e.currentTarget.style.boxShadow   = 'none';
                }}
              >
                {/* Lock badge */}
                {!isUnlocked && (
                  <div className="absolute top-5 right-5 text-xl" title="Complete previous stage to unlock">
                    🔒
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="text-3xl p-3 rounded-2xl flex-shrink-0"
                    style={{ backgroundColor: `${stage.color}18` }}
                  >
                    {stage.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: stage.color }}>
                      Stage {stage.id === 0 ? 'Beginner' : stage.id} · {stage.eloRange}
                    </div>
                    <h2 className="text-xl font-bold text-white">{stage.title}</h2>
                  </div>
                </div>

                <p className="text-sm mb-5 leading-relaxed" style={{ color: '#bababa' }}>
                  {stage.description}
                </p>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-medium mb-1.5" style={{ color: '#8b8987' }}>
                    <span>Progress</span>
                    <span style={{ color: '#ffffff' }}>{solved} / {stage.puzzleCount}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#4a4744' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isUnlocked ? stage.color : '#4a4744',
                      }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #3a3734' }}>
                  <div className="flex flex-wrap gap-1.5">
                    {stage.themes.slice(0, 2).map((theme, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium px-2.5 py-1 rounded-md"
                        style={{ backgroundColor: '#4a4744', color: '#bababa' }}
                      >
                        {theme}
                      </span>
                    ))}
                    {stage.themes.length > 2 && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ backgroundColor: '#3a3734', color: '#8b8987' }}>
                        +{stage.themes.length - 2}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {isUnlocked && accuracy !== null && (
                      <span className="text-sm font-bold" style={{ color: accuracy >= 70 ? '#81b64c' : '#f59e0b' }}>
                        {accuracy}% acc
                      </span>
                    )}
                    {isUnlocked && accuracy === null && (
                      <span className="text-sm font-medium" style={{ color: '#8b8987' }}>
                        Not started
                      </span>
                    )}
                    {!isUnlocked && toUnlock === null && nextStageDef && (
                      <span className="text-xs" style={{ color: '#8b8987' }}>
                        Solve {stage.unlockAfter} in prev stage
                      </span>
                    )}
                  </div>
                </div>

                {/* Unlock progress hint */}
                {isUnlocked && toUnlock !== null && toUnlock > 0 && nextStageDef && (
                  <div className="mt-3 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#1a1916', color: '#8b8987' }}>
                    ✦ Solve <strong style={{ color: '#bababa' }}>{toUnlock} more</strong> to unlock{' '}
                    <strong style={{ color: nextStageDef.color }}>{nextStageDef.title}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Philosophy */}
        <div
          className="mt-10 rounded-2xl p-6 text-center"
          style={{ backgroundColor: '#1a1916', border: '1px solid #3a3734' }}
        >
          <p className="text-base font-semibold italic" style={{ color: '#bababa' }}>
            "This is not a puzzle app — it is a thinking trainer."
          </p>
          <p className="text-sm mt-2" style={{ color: '#8b8987' }}>
            Identify candidate moves and opponent threats before every move.
            2,500 real Lichess puzzles. Guided + Fast mode. Solution reveal when stuck.
          </p>
        </div>
      </div>
    </div>
  );
}
