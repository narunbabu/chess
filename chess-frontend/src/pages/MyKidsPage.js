import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import parentDashboardService from '../services/parentDashboardService';

const RESULT_STYLES = {
  win: 'bg-[#81b64c]/20 text-[#81b64c]',
  loss: 'bg-red-500/20 text-red-400',
  draw: 'bg-gray-500/20 text-gray-300',
  unknown: 'bg-gray-700/40 text-gray-400',
};

function StatTile({ label, value, accent }) {
  return (
    <div className="bg-[#21201d] rounded-lg px-3 py-2 text-center border border-white/5">
      <div className={`text-lg font-bold ${accent || 'text-white'}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

function formatMinutes(seconds) {
  const mins = Math.floor((seconds || 0) / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function ChildCard({ report, onEmailReport, onManage }) {
  const child = report.child || {};
  const week = report.week || {};
  const totals = report.totals || {};
  const games = report.recent_games || [];
  const ratingChange = week.rating_change || 0;
  const [emailing, setEmailing] = useState(false);
  const [emailed, setEmailed] = useState(false);

  const handleEmail = async () => {
    setEmailing(true);
    try {
      await onEmailReport(report.relationship?.id);
      setEmailed(true);
      setTimeout(() => setEmailed(false), 3000);
    } finally {
      setEmailing(false);
    }
  };

  const downloadPgn = async (gameId) => {
    if (!gameId) return;
    try {
      const api = (await import('../services/api')).default;
      const res = await api.get(`/games/${gameId}/pgn`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `chess99-game-${gameId}.pgn`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PGN:', err);
    }
  };

  return (
    <div className="bg-[#262421] rounded-xl p-5 border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {child.avatar_url ? (
            <img src={child.avatar_url} alt={child.name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#81b64c]/20 flex items-center justify-center text-xl">♟️</div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{child.name}</div>
            <div className="text-xs text-gray-400 truncate">{child.email}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-white">{child.rating}</div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">Rating</div>
        </div>
      </div>

      {/* This week */}
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">This week</div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        <StatTile label="Games" value={week.games_played || 0} />
        <StatTile
          label="W / L / D"
          value={`${week.wins || 0}/${week.losses || 0}/${week.draws || 0}`}
        />
        <StatTile label="Puzzles" value={week.puzzles_solved || 0} accent="text-[#81b64c]" />
        <StatTile label="Lessons" value={week.lessons_completed || 0} accent="text-[#e8a93e]" />
        <StatTile
          label="Rating Δ"
          value={ratingChange >= 0 ? `+${ratingChange}` : ratingChange}
          accent={ratingChange >= 0 ? 'text-[#81b64c]' : 'text-red-400'}
        />
      </div>

      {/* Lifetime + time */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400 mb-4">
        <span>Learning time: <strong className="text-gray-200">{formatMinutes(week.time_played_seconds)}</strong></span>
        <span>Lifetime lessons: <strong className="text-gray-200">{totals.lessons_completed || 0}</strong></span>
        <span>Puzzles solved: <strong className="text-gray-200">{totals.puzzles_solved || 0}</strong></span>
        <span>Tactical rating: <strong className="text-gray-200">{totals.tactical_rating || 1000}</strong></span>
      </div>

      {/* Recent games */}
      {games.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Recent games</div>
          <div className="space-y-1">
            {games.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 bg-[#21201d] rounded px-3 py-1.5 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${RESULT_STYLES[g.result] || RESULT_STYLES.unknown}`}>
                  {g.result}
                </span>
                <span className="flex-1 truncate text-gray-300">
                  vs {g.opponent_name}
                  {g.opponent_rating ? <span className="text-gray-500"> ({g.opponent_rating})</span> : null}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {g.game_id && (
                    <Link to={`/games/${g.game_id}/replay`} className="text-[#81b64c] hover:underline text-xs">
                      Replay
                    </Link>
                  )}
                  {g.game_id && (
                    <button onClick={() => downloadPgn(g.game_id)} className="text-gray-400 hover:text-white text-xs">
                      PGN
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={handleEmail}
          disabled={emailing}
          className="px-3 py-1.5 rounded bg-[#81b64c] hover:bg-[#6fa03f] text-white text-sm font-medium disabled:opacity-60"
        >
          {emailed ? 'Report emailed ✓' : emailing ? 'Sending…' : '📧 Email report card'}
        </button>
        <button
          onClick={() => onManage(report.relationship)}
          className="px-3 py-1.5 rounded bg-[#3a3835] hover:bg-[#484540] text-gray-200 text-sm font-medium"
        >
          ⚙️ Manage account
        </button>
      </div>
    </div>
  );
}

function ManageChildModal({ relationship, onClose, onSave }) {
  const [name, setName] = useState(relationship?.child?.name || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (password && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await onSave(relationship.id, {
        name: name !== relationship?.child?.name ? name : undefined,
        password: password || undefined,
        passwordConfirmation: confirm || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#262421] rounded-xl p-6 w-full max-w-md border border-white/10" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">Manage {relationship?.child?.name}</h3>
        {error && <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</div>}
        <label className="block text-xs text-gray-400 mb-1">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-white text-sm"
        />
        <label className="block text-xs text-gray-400 mb-1">New password (optional)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to keep current"
          className="w-full mb-3 bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-white text-sm"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="w-full mb-5 bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-white text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-[#3a3835] text-gray-200 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-[#81b64c] text-white text-sm font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const MyKidsPage = () => {
  useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [childEmail, setChildEmail] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkNotice, setLinkNotice] = useState('');
  const [managing, setManaging] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await parentDashboardService.getDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load parent dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const linkChild = async (e) => {
    e.preventDefault();
    setLinkError('');
    setLinkNotice('');
    setLinking(true);
    try {
      await parentDashboardService.requestLink({ childEmail, relationshipLabel });
      setChildEmail('');
      setRelationshipLabel('');
      setLinkNotice('Invitation sent. Your child confirms it from their own account.');
      await load();
    } catch (err) {
      setLinkError(err.response?.data?.message || 'Could not send the invitation.');
    } finally {
      setLinking(false);
    }
  };

  const acceptGuardian = async (id) => {
    try {
      await parentDashboardService.acceptLink(id);
      await load();
    } catch (err) {
      console.error('Failed to accept guardian link:', err);
    }
  };

  const revoke = async (id) => {
    try {
      await parentDashboardService.revokeLink(id);
      await load();
    } catch (err) {
      console.error('Failed to revoke link:', err);
    }
  };

  const emailReport = async (id) => parentDashboardService.sendWeeklyReport(id);

  const saveChildProfile = async (id, payload) => {
    await parentDashboardService.updateChildProfile(id, payload);
    await load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a18]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
      </div>
    );
  }

  const children = dashboard?.children || [];
  const pendingChildren = dashboard?.pending_children || [];
  const pendingGuardianRequests = dashboard?.pending_guardian_requests || [];

  return (
    <div className="min-h-screen bg-[#1a1a18] text-white px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">My Kids</h1>
      <p className="text-gray-400 text-sm mb-6">
        Track your child's chess progress — ratings, puzzles, lessons and recent games — and get a weekly report card by email.
      </p>

      {/* Guardian requests addressed to me (I was invited as a child) */}
      {pendingGuardianRequests.length > 0 && (
        <div className="mb-6 space-y-2">
          {pendingGuardianRequests.map((rel) => (
            <div key={rel.id} className="bg-[#2b2a26] border border-[#e8a93e]/30 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-200">
                <strong>{rel.guardian?.name || 'A guardian'}</strong> wants to link to your account as a guardian.
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => acceptGuardian(rel.id)} className="px-3 py-1.5 rounded bg-[#81b64c] text-white text-sm font-medium">Accept</button>
                <button onClick={() => revoke(rel.id)} className="px-3 py-1.5 rounded bg-[#3a3835] text-gray-200 text-sm">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link a child */}
      <div className="bg-[#262421] rounded-xl p-5 border border-white/5 mb-6">
        <h2 className="font-semibold text-white mb-3">Link a child account</h2>
        {linkError && <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded px-3 py-2">{linkError}</div>}
        {linkNotice && <div className="mb-3 text-sm text-[#81b64c] bg-[#81b64c]/10 rounded px-3 py-2">{linkNotice}</div>}
        <form onSubmit={linkChild} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={childEmail}
            onChange={(e) => setChildEmail(e.target.value)}
            placeholder="Child's Chess99 account email"
            className="flex-1 bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-white text-sm"
          />
          <input
            value={relationshipLabel}
            onChange={(e) => setRelationshipLabel(e.target.value)}
            placeholder="Relationship (optional)"
            className="sm:w-40 bg-[#1a1a18] border border-white/10 rounded px-3 py-2 text-white text-sm"
          />
          <button
            type="submit"
            disabled={linking}
            className="px-4 py-2 rounded bg-[#81b64c] hover:bg-[#6fa03f] text-white text-sm font-medium disabled:opacity-60"
          >
            {linking ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Your child must already have a Chess99 account. They approve the link from their own account before you can see their reports.
        </p>
      </div>

      {/* Pending children (invited, not yet accepted) */}
      {pendingChildren.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Awaiting confirmation</div>
          <div className="space-y-2">
            {pendingChildren.map((rel) => (
              <div key={rel.id} className="bg-[#21201d] rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-sm text-gray-300 truncate">
                  {rel.child?.name || rel.invite_email}
                  <span className="text-gray-500"> — invitation pending</span>
                </div>
                <button onClick={() => revoke(rel.id)} className="px-3 py-1.5 rounded bg-[#3a3835] text-gray-200 text-sm shrink-0">Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active children */}
      {children.length > 0 ? (
        <div className="space-y-5">
          {children.map((report) => (
            <ChildCard
              key={report.relationship?.id || report.child?.id}
              report={report}
              onEmailReport={emailReport}
              onManage={(rel) => setManaging(rel)}
            />
          ))}
        </div>
      ) : (
        pendingChildren.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            No linked children yet. Add your child's account email above to start tracking their progress.
          </div>
        )
      )}

      {managing && (
        <ManageChildModal
          relationship={managing}
          onClose={() => setManaging(null)}
          onSave={saveChildProfile}
        />
      )}
    </div>
  );
};

export default MyKidsPage;
