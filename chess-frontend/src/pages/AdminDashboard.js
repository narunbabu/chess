import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';
import { isPlatformAdmin, isOrganizationAdmin } from '../utils/permissionHelpers';
import UserProgressCharts from '../components/UserProgressCharts';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'games', label: 'Games' },
  { id: 'users', label: 'Users' },
  { id: 'ambassadors', label: 'Ambassadors', adminOnly: true },
  { id: 'institutes', label: 'Institutes', adminOnly: true },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [orgId, setOrgId] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('rating');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const isAdmin = isPlatformAdmin(user) || isOrganizationAdmin(user);
  const isPlatAdmin = isPlatformAdmin(user);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period, page, per_page: 20, sort, order });
      if (orgId) params.set('org_id', orgId);
      if (search) params.set('search', search);

      const res = await fetch(`${BACKEND_URL}/admin/dashboard/overview?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, orgId, search, sort, order, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (col) => {
    if (sort === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const sortArrow = (col) => sort === col ? (order === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#262421] text-white flex items-center justify-center">
        <p className="text-xl text-red-400">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const visibleTabs = TABS.filter(t => !t.adminOnly || isPlatAdmin);

  return (
    <div className="min-h-screen bg-[#262421] text-[#bababa] p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">Admin Dashboard</h1>

      {/* Period filters + org selector — always visible */}
      <div className="flex flex-wrap gap-3 mb-4">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => { setPeriod(p.value); setPage(1); }}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              period === p.value
                ? 'bg-[#81b64c] text-white'
                : 'bg-[#312e2b] text-[#bababa] hover:bg-[#3d3a36]'
            }`}
          >
            {p.label}
          </button>
        ))}
        {data?.meta?.is_platform_admin && data.organizations?.length > 0 && (
          <select
            value={orgId}
            onChange={(e) => { setOrgId(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded bg-[#312e2b] text-[#bababa] border border-[#464340] text-sm"
          >
            <option value="">All Organizations</option>
            {data.organizations.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-[#464340] overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#81b64c] text-white'
                : 'border-transparent text-[#9b9895] hover:text-[#bababa] hover:border-[#464340]'
            }`}
          >
            {tab.label}
            {tab.id === 'ambassadors' && data?.ambassador_stats?.length > 0 && (
              <span className="ml-1.5 text-xs bg-[#464340] px-1.5 py-0.5 rounded-full">{data.ambassador_stats.length}</span>
            )}
            {tab.id === 'institutes' && data?.institute_breakdown?.length > 0 && (
              <span className="ml-1.5 text-xs bg-[#464340] px-1.5 py-0.5 rounded-full">{data.institute_breakdown.length}</span>
            )}
            {tab.id === 'users' && data?.users?.total > 0 && (
              <span className="ml-1.5 text-xs bg-[#464340] px-1.5 py-0.5 rounded-full">{data.users.total}</span>
            )}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
        </div>
      )}
      {error && <p className="text-red-400 mb-4">Error: {error}</p>}

      {data && (
        <>
          {/* ==================== OVERVIEW TAB ==================== */}
          {activeTab === 'overview' && (
            <>
              <OverviewCards overview={data.overview} joinedThisWeek={data.joined_this_week} tutorialStats={data.tutorial_stats} />
              <RatingDistribution distribution={data.rating_distribution} />
              {/* Organizations summary */}
              {data.meta?.is_platform_admin && data.organizations?.length > 0 && (
                <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
                  <h2 className="text-lg font-semibold text-white mb-3">Organizations</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4 text-right">Players</th>
                          <th className="py-2 pr-4 text-right">Active Today</th>
                          <th className="py-2 text-right">Avg Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.organizations.map(o => (
                          <tr key={o.id} className="border-b border-[#3d3a36] hover:bg-[#3d3a36]">
                            <td className="py-2 pr-4 text-white">{o.name}</td>
                            <td className="py-2 pr-4 text-right font-mono">{o.player_count}</td>
                            <td className="py-2 pr-4 text-right font-mono">{o.active_today_count}</td>
                            <td className="py-2 text-right font-mono">{o.avg_rating ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== GAMES TAB ==================== */}
          {activeTab === 'games' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatsSection title="By Outcome" items={data.games_by_outcome.map(i => ({ label: i.label, count: i.count }))} />
                <StatsSection title="By Mode" items={data.games_by_mode.map(i => ({ label: i.label, count: i.count }))} />
                <StatsSection title="By Time Control" items={data.games_by_time_control.map(i => ({ label: i.label, count: i.count }))} />
              </div>

              <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Recent Games</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                        <th className="py-2 pr-3">White</th>
                        <th className="py-2 pr-3">Black</th>
                        <th className="py-2 pr-3">Result</th>
                        <th className="py-2 pr-3 hidden sm:table-cell">End Reason</th>
                        <th className="py-2 pr-3 hidden md:table-cell">Mode</th>
                        <th className="py-2 pr-3 hidden md:table-cell text-center">Rating Δ</th>
                        <th className="py-2 pr-3 hidden md:table-cell text-right">Moves</th>
                        <th className="py-2 hidden sm:table-cell">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_games.map(g => (
                        <tr key={g.id} className="border-b border-[#3d3a36] hover:bg-[#3d3a36]">
                          <td className="py-2 pr-3">
                            <span className={g.result === '1-0' ? 'text-[#81b64c] font-semibold' : 'text-[#bababa]'}>
                              {g.white?.is_bot ? '🤖 ' : ''}{g.white?.name || 'Unknown'}
                            </span>
                            <span className="text-[#9b9895] text-xs ml-1">({g.white?.rating || '?'})</span>
                            {!g.white?.is_bot && g.white?.rating_change != null && (
                              <span className={`text-xs ml-1 font-mono ${g.white.rating_change >= 0 ? 'text-[#81b64c]' : 'text-red-400'}`}>
                                {g.white.rating_change >= 0 ? '+' : ''}{g.white.rating_change}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={g.result === '0-1' ? 'text-[#81b64c] font-semibold' : 'text-[#bababa]'}>
                              {g.black?.is_bot ? '🤖 ' : ''}{g.black?.name || 'Unknown'}
                            </span>
                            <span className="text-[#9b9895] text-xs ml-1">({g.black?.rating || '?'})</span>
                            {!g.black?.is_bot && g.black?.rating_change != null && (
                              <span className={`text-xs ml-1 font-mono ${g.black.rating_change >= 0 ? 'text-[#81b64c]' : 'text-red-400'}`}>
                                {g.black.rating_change >= 0 ? '+' : ''}{g.black.rating_change}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono">
                            {g.result === '1-0' ? '1-0' : g.result === '0-1' ? '0-1' : g.result === '1/2-1/2' ? '\u00BD-\u00BD' : g.result}
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell text-[#9b9895]">{g.end_reason || '-'}</td>
                          <td className="py-2 pr-3 hidden md:table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              g.is_bot_game ? 'bg-[#464340] text-[#9b9895]'
                              : g.game_mode_raw === 'rated' ? 'bg-[#81b64c]/20 text-[#81b64c]'
                              : 'bg-[#464340] text-[#9b9895]'
                            }`}>
                              {g.is_bot_game ? 'vs bot' : g.game_mode_raw || 'casual'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-center">
                            {g.is_bot_game ? (
                              <span className="text-[#9b9895] text-xs">—</span>
                            ) : (
                              <span className="text-[#9b9895] text-xs">
                                {g.white?.rating_change != null || g.black?.rating_change != null ? (
                                  <>
                                    <span className={g.white?.rating_change >= 0 ? 'text-[#81b64c]' : 'text-red-400'}>
                                      W:{g.white?.rating_change != null ? (g.white.rating_change >= 0 ? '+' : '') + g.white.rating_change : '?'}
                                    </span>
                                    {' / '}
                                    <span className={g.black?.rating_change >= 0 ? 'text-[#81b64c]' : 'text-red-400'}>
                                      B:{g.black?.rating_change != null ? (g.black.rating_change >= 0 ? '+' : '') + g.black.rating_change : '?'}
                                    </span>
                                  </>
                                ) : g.game_mode_raw === 'rated' ? (
                                  <span className="text-yellow-500 text-xs" title="Rating not recorded">⚠ missing</span>
                                ) : '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-right font-mono">{g.move_count}</td>
                          <td className="py-2 hidden sm:table-cell text-[#9b9895] text-xs">
                            {g.ended_at ? new Date(g.ended_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                      {data.recent_games.length === 0 && (
                        <tr><td colSpan={8} className="py-4 text-center text-[#9b9895]">No games found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ==================== USERS TAB ==================== */}
          {activeTab === 'users' && (
            <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Users ({data.users.total})</h2>
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="px-3 py-2 rounded bg-[#262421] text-[#bababa] border border-[#464340] text-sm w-full sm:w-64"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                      <th className="py-2 pr-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>Name{sortArrow('name')}</th>
                      <th className="py-2 pr-4 hidden md:table-cell">Email</th>
                      <th className="py-2 pr-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('rating')}>Rating{sortArrow('rating')}</th>
                      <th className="py-2 pr-4 cursor-pointer hover:text-white text-right" onClick={() => handleSort('games_played')}>Games{sortArrow('games_played')}</th>
                      <th className="py-2 cursor-pointer hover:text-white hidden sm:table-cell" onClick={() => handleSort('last_activity_at')}>Last Active{sortArrow('last_activity_at')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.data.map(u => (
                      <tr
                        key={u.id}
                        className="border-b border-[#3d3a36] hover:bg-[#3d3a36] cursor-pointer"
                        onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                      >
                        <td className="py-2 pr-4 text-white">{u.name} {selectedUserId === u.id ? '\u25B2' : ''}</td>
                        <td className="py-2 pr-4 hidden md:table-cell text-[#9b9895]">{u.email}</td>
                        <td className="py-2 pr-4 text-right font-mono">{u.rating ?? '-'}</td>
                        <td className="py-2 pr-4 text-right font-mono">{u.games_played ?? 0}</td>
                        <td className="py-2 hidden sm:table-cell text-[#9b9895]">
                          {u.last_activity_at ? new Date(u.last_activity_at).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                    {data.users.data.length === 0 && (
                      <tr><td colSpan={5} className="py-4 text-center text-[#9b9895]">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {data.users.last_page > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 rounded bg-[#262421] text-[#bababa] disabled:opacity-40 hover:bg-[#3d3a36] text-sm"
                  >Prev</button>
                  <span className="px-3 py-1 text-sm text-[#9b9895]">
                    Page {data.users.current_page} of {data.users.last_page}
                  </span>
                  <button
                    disabled={page >= data.users.last_page}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 rounded bg-[#262421] text-[#bababa] disabled:opacity-40 hover:bg-[#3d3a36] text-sm"
                  >Next</button>
                </div>
              )}
            </div>
          )}

          {/* User Detail Panel — shown below users table when a user is selected */}
          {activeTab === 'users' && selectedUserId && (
            <UserDetailPanel userId={selectedUserId} period={period} onClose={() => setSelectedUserId(null)} />
          )}

          {/* ==================== AMBASSADORS TAB ==================== */}
          {activeTab === 'ambassadors' && data.meta?.is_platform_admin && (
            <>
              <TierManager />
              <AmbassadorManager ambassadors={data.ambassador_stats || []} onRefresh={fetchData} />
            </>
          )}

          {/* ==================== INSTITUTES TAB ==================== */}
          {activeTab === 'institutes' && data.meta?.is_platform_admin && (
            <>
              {data.institute_breakdown?.length > 0 ? (
                <InstituteBreakdown institutes={data.institute_breakdown} />
              ) : (
                <div className="bg-[#312e2b] rounded-lg p-8 text-center">
                  <p className="text-[#9b9895]">No institutes/organizations created yet.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

/* ─── User Detail Panel ─── */

const UserDetailPanel = ({ userId, period, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPeriod, setUserPeriod] = useState(period);
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => { setUserPeriod(period); }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BACKEND_URL}/admin/dashboard/user/${userId}?period=${userPeriod}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, userPeriod]);

  if (loading) return (
    <div className="bg-[#312e2b] rounded-lg p-6 mb-6 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#81b64c] mx-auto" />
    </div>
  );
  if (!data?.profile) return null;

  const p = data.profile;
  const o = data.overview;
  const formColors = { W: '#81b64c', L: '#e74c3c', D: '#e8a93e' };
  const daysSinceJoin = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);

  return (
    <div className="bg-[#312e2b] rounded-lg p-4 mb-6 border border-[#81b64c]/30">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">{p.name}</h2>
          <p className="text-[#9b9895] text-sm">{p.email}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#262421] text-[#81b64c]">Rating: {p.rating}</span>
            <span className="px-2 py-0.5 rounded bg-[#262421] text-[#e8a93e]">{p.subscription_tier || 'free'}</span>
            <span className="text-[#9b9895]">Joined {daysSinceJoin}d ago ({new Date(p.created_at).toLocaleDateString()})</span>
            {p.last_activity_at && <span className="text-[#9b9895]">Last seen: {new Date(p.last_activity_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-[#9b9895] hover:text-white text-xl leading-none">&times;</button>
      </div>

      {/* Period filter for this panel */}
      <div className="flex gap-2 mb-4">
        {PERIODS.map(pr => (
          <button
            key={pr.value}
            onClick={() => setUserPeriod(pr.value)}
            className={`px-3 py-1 rounded text-xs font-medium transition ${
              userPeriod === pr.value ? 'bg-[#81b64c] text-white' : 'bg-[#262421] text-[#bababa] hover:bg-[#3d3a36]'
            }`}
          >{pr.label}</button>
        ))}
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        {[
          { label: 'Games', value: o.total_games, color: '#5ba4cf' },
          { label: 'Wins', value: o.wins, color: '#81b64c' },
          { label: 'Losses', value: o.losses, color: '#e74c3c' },
          { label: 'Draws', value: o.draws, color: '#e8a93e' },
          { label: 'Win Rate', value: o.win_rate + '%', color: o.win_rate >= 50 ? '#81b64c' : '#e74c3c' },
          { label: 'Avg Moves', value: o.avg_moves, color: '#9b59b6' },
          { label: 'Streak', value: o.streak, color: o.streak?.endsWith('W') ? '#81b64c' : '#e74c3c' },
          { label: 'Tutorials', value: `${data.tutorial?.completed || 0}/${data.tutorial?.started || 0}`, color: '#f39c12' },
        ].map((c, i) => (
          <div key={i} className="bg-[#262421] rounded p-3 border-l-2" style={{ borderColor: c.color }}>
            <p className="text-[#9b9895] text-xs">{c.label}</p>
            <p className="text-lg font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Form */}
      {o.recent_form?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-[#9b9895] mb-1">Last {o.recent_form.length} games:</p>
          <div className="flex gap-1">
            {o.recent_form.map((r, i) => (
              <span key={i} className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: formColors[r] || '#464340' }}>{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Game breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <StatsSection title="By Outcome" items={(data.games_by_outcome || []).map(i => ({ label: i.label, count: i.count }))} />
        <StatsSection title="By Mode" items={(data.games_by_mode || []).map(i => ({ label: i.label, count: i.count }))} />
        <StatsSection title="By Time Control" items={(data.games_by_time_control || []).map(i => ({ label: i.label, count: i.count }))} />
      </div>

      {/* Progress Graphs */}
      <div className="mb-4">
        <button
          onClick={() => setShowCharts(!showCharts)}
          className="flex items-center gap-2 text-sm font-semibold text-white hover:text-[#81b64c] transition-colors"
        >
          <span className="text-xs">{showCharts ? '▼' : '▶'}</span>
          <span>Progress Graphs</span>
        </button>
        {showCharts && <UserProgressCharts userId={userId} period={userPeriod} />}
      </div>

      {/* Recent Games */}
      {data.recent_games?.length > 0 && (
        <div className="bg-[#262421] rounded p-3">
          <h3 className="text-sm font-semibold text-white mb-2">Recent Games</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#9b9895] border-b border-[#3d3a36]">
                  <th className="py-1.5 pr-2 text-left">Result</th>
                  <th className="py-1.5 pr-2 text-left">Opponent</th>
                  <th className="py-1.5 pr-2 text-left hidden sm:table-cell">End Reason</th>
                  <th className="py-1.5 pr-2 hidden sm:table-cell">Mode</th>
                  <th className="py-1.5 pr-2 text-right hidden sm:table-cell">Rating Δ</th>
                  <th className="py-1.5 pr-2 text-right">Moves</th>
                  <th className="py-1.5 text-right hidden sm:table-cell">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_games.map(g => {
                  const isDraw = g.result === '1/2-1/2';
                  const won = g.user_won;
                  const opponent = g.user_color === 'white' ? g.black : g.white;
                  return (
                    <tr key={g.id} className="border-b border-[#3d3a36]/50">
                      <td className="py-1.5 pr-2">
                        <span className="font-bold" style={{ color: won ? '#81b64c' : isDraw ? '#e8a93e' : '#e74c3c' }}>
                          {won ? 'Win' : isDraw ? 'Draw' : 'Loss'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-white">
                        {opponent?.is_bot ? '🤖 ' : ''}{opponent?.name || 'Unknown'}
                        <span className="text-[#9b9895] ml-1">({opponent?.rating || '?'})</span>
                      </td>
                      <td className="py-1.5 pr-2 text-[#9b9895] hidden sm:table-cell">{g.end_reason || '-'}</td>
                      <td className="py-1.5 pr-2 hidden sm:table-cell">
                        <span className={`px-1.5 py-0.5 rounded ${
                          g.is_bot_game ? 'bg-[#3d3a36] text-[#9b9895]'
                          : g.game_mode === 'rated' ? 'bg-[#81b64c]/20 text-[#81b64c]'
                          : 'bg-[#3d3a36] text-[#9b9895]'
                        }`}>{g.is_bot_game ? 'vs bot' : g.game_mode || 'casual'}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right hidden sm:table-cell font-mono">
                        {g.is_bot_game ? (
                          <span className="text-[#9b9895]">—</span>
                        ) : g.rating_change != null ? (
                          <span style={{ color: g.rating_change >= 0 ? '#81b64c' : '#e74c3c' }}>
                            {g.rating_change >= 0 ? '+' : ''}{g.rating_change}
                          </span>
                        ) : g.game_mode === 'rated' ? (
                          <span className="text-yellow-500" title="Rating not yet recorded">⚠</span>
                        ) : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono">{g.move_count}</td>
                      <td className="py-1.5 text-right text-[#9b9895] hidden sm:table-cell">
                        {g.ended_at ? new Date(g.ended_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */

const OverviewCards = ({ overview, joinedThisWeek, tutorialStats }) => {
  const cards = [
    { label: 'Total Users', value: overview.total_users, color: '#81b64c' },
    { label: 'Joined This Week', value: joinedThisWeek ?? 0, color: '#2ecc71' },
    { label: 'Active Today', value: overview.active_today, color: '#e8a93e' },
    { label: 'Active This Week', value: overview.active_week, color: '#5ba4cf' },
    { label: 'Games Played', value: overview.total_games, color: '#e74c3c' },
    { label: 'Total Hours', value: overview.total_hours, color: '#1abc9c' },
    { label: 'Tutorial Completions', value: tutorialStats?.total_lesson_completions ?? 0, color: '#9b59b6' },
    { label: 'Learners', value: tutorialStats?.users_completed_lessons ?? 0, color: '#f39c12' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      {cards.map((c, i) => (
        <div key={i} className="bg-[#312e2b] rounded-lg p-4 border-t-2" style={{ borderColor: c.color }}>
          <p className="text-[#9b9895] text-xs mb-1">{c.label}</p>
          <p className="text-2xl font-bold text-white">{c.value?.toLocaleString?.() ?? c.value}</p>
        </div>
      ))}
    </div>
  );
};

const StatsSection = ({ title, items }) => {
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="bg-[#312e2b] rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#bababa]">{item.label}</span>
              <span className="text-white font-mono">{item.count}</span>
            </div>
            <div className="h-2 bg-[#262421] rounded overflow-hidden">
              <div
                className="h-full bg-[#81b64c] rounded transition-all"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-[#9b9895] text-xs">No data</p>}
      </div>
    </div>
  );
};

const RatingDistribution = ({ distribution }) => {
  const maxCount = Math.max(...distribution.map(b => b.count), 1);
  return (
    <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold text-white mb-3">Rating Distribution</h2>
      <div className="space-y-2">
        {distribution.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[#bababa] text-xs w-20 text-right shrink-0">{b.label}</span>
            <div className="flex-1 h-5 bg-[#262421] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all flex items-center px-2"
                style={{
                  width: `${Math.max((b.count / maxCount) * 100, b.count > 0 ? 4 : 0)}%`,
                  background: `hsl(${80 + i * 20}, 60%, 45%)`,
                }}
              >
                {b.count > 0 && <span className="text-white text-xs font-mono">{b.count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Ambassador Management ─── */

const AmbassadorManager = ({ ambassadors, onRefresh }) => {
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Search users to assign as ambassador
  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${BACKEND_URL}/admin/ambassadors/search-users?q=${encodeURIComponent(searchQ)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}`, Accept: 'application/json' },
        });
        if (res.ok) { const d = await res.json(); setSearchResults(d.users || []); }
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const assignAmbassador = async (userId, userName) => {
    try {
      const res = await fetch(`${BACKEND_URL}/admin/ambassadors/${userId}/assign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}`, Accept: 'application/json' },
      });
      const d = await res.json();
      setActionMsg(d.message || 'Assigned!');
      setSearchQ(''); setSearchResults([]);
      setTimeout(() => setActionMsg(''), 3000);
      onRefresh();
    } catch (err) { setActionMsg('Error: ' + err.message); }
  };

  const removeAmbassador = async (userId, userName) => {
    if (!window.confirm(`Remove ambassador role from ${userName}?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/admin/ambassadors/${userId}/remove`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}`, Accept: 'application/json' },
      });
      const d = await res.json();
      setActionMsg(d.message || 'Removed');
      setTimeout(() => setActionMsg(''), 3000);
      onRefresh();
    } catch (err) { setActionMsg('Error: ' + err.message); }
  };

  const ambassadorIds = new Set(ambassadors.map(a => a.id));

  return (
    <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white">Ambassadors ({ambassadors.length})</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search user to assign..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="px-3 py-2 rounded bg-[#262421] text-[#bababa] border border-[#464340] text-sm w-64"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#262421] border border-[#464340] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {searchResults.map(u => (
                <div key={u.id} className="px-3 py-2 flex items-center justify-between hover:bg-[#3d3a36] text-sm">
                  <div>
                    <span className="text-white">{u.name}</span>
                    <span className="text-[#9b9895] text-xs ml-2">{u.email}</span>
                  </div>
                  {ambassadorIds.has(u.id) ? (
                    <span className="text-xs text-[#9b9895]">Already</span>
                  ) : (
                    <button
                      onClick={() => assignAmbassador(u.id, u.name)}
                      className="text-xs px-2 py-1 rounded bg-[#81b64c] text-white hover:bg-[#6da03d]"
                    >Assign</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {searching && <span className="absolute right-2 top-2.5 text-xs text-[#9b9895]">...</span>}
        </div>
      </div>
      {actionMsg && <p className="text-xs text-[#81b64c] mb-3">{actionMsg}</p>}

      {ambassadors.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3 hidden md:table-cell">Email</th>
                <th className="py-2 pr-3 text-right">Referred</th>
                <th className="py-2 pr-3 text-right">Paid Subs</th>
                <th className="py-2 pr-3 text-right">Tier</th>
                <th className="py-2 pr-3 text-right">Rate</th>
                <th className="py-2 pr-3 text-right">This Month</th>
                <th className="py-2 pr-3 text-right hidden sm:table-cell">Total</th>
                <th className="py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {ambassadors.map(a => (
                <React.Fragment key={a.id}>
                  <tr
                    className="border-b border-[#3d3a36] hover:bg-[#3d3a36] cursor-pointer"
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  >
                    <td className="py-2 pr-3 text-white">{a.name}</td>
                    <td className="py-2 pr-3 hidden md:table-cell text-[#9b9895]">{a.email}</td>
                    <td className="py-2 pr-3 text-right font-mono">{a.referred_count}</td>
                    <td className="py-2 pr-3 text-right font-mono">{a.subscribed_paid}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#262421]">{a.tier_name || 'Starter'}</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-[#e8a93e]">{a.commission_rate || '10%'}</td>
                    <td className="py-2 pr-3 text-right font-mono text-[#81b64c]">{'\u20B9'}{a.earnings_this_month}</td>
                    <td className="py-2 pr-3 text-right font-mono hidden sm:table-cell">{'\u20B9'}{a.total_earnings}</td>
                    <td className="py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeAmbassador(a.id, a.name); }}
                        className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50"
                        title="Remove ambassador role"
                      >Remove</button>
                    </td>
                  </tr>
                  {expandedId === a.id && (
                    <tr>
                      <td colSpan={9} className="py-3 px-4 bg-[#262421]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div><span className="text-[#9b9895]">Referral Code:</span> <span className="text-[#81b64c] font-mono">{a.referral_code}</span></div>
                          <div><span className="text-[#9b9895]">Active (7d):</span> <span className="text-white">{a.active_this_week}</span></div>
                          <div><span className="text-[#9b9895]">Join Link:</span> <span className="text-[#81b64c] font-mono">chess99.com/join/{a.referral_code}</span></div>
                          <div><span className="text-[#9b9895]">Paid Subs:</span> <span className="text-white">{a.subscribed_paid}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[#9b9895] text-sm">No ambassadors yet. Search and assign users above.</p>
      )}
    </div>
  );
};

/* ─── Institute Breakdown ─── */

const InstituteBreakdown = ({ institutes }) => {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold text-white mb-3">Institutes ({institutes.length})</h2>
      <div className="space-y-3">
        {institutes.map(inst => (
          <div key={inst.id} className="bg-[#262421] rounded-lg overflow-hidden">
            {/* Header row */}
            <div
              className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-[#2a2825]"
              onClick={() => setExpandedId(expandedId === inst.id ? null : inst.id)}
            >
              <div>
                <h3 className="text-white font-semibold">{inst.name}</h3>
                {inst.type && <span className="text-[#9b9895] text-xs">{inst.type}</span>}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <div><span className="text-[#9b9895]">Members:</span> <span className="text-white font-mono">{inst.total_members}</span></div>
                <div><span className="text-[#9b9895]">Active Today:</span> <span className="text-white font-mono">{inst.active_today}</span></div>
                <div><span className="text-[#9b9895]">Joined (7d):</span> <span className="text-[#81b64c] font-mono">{inst.joined_this_week}</span></div>
                <div><span className="text-[#9b9895]">Active (7d):</span> <span className="text-white font-mono">{inst.active_this_week}</span></div>
                <div><span className="text-[#9b9895]">Paid:</span> <span className="text-[#e8a93e] font-mono">{inst.paid_members}</span></div>
                <span className="text-[#9b9895]">{expandedId === inst.id ? '\u25B2' : '\u25BC'}</span>
              </div>
            </div>
            {/* Expanded details */}
            {expandedId === inst.id && (
              <div className="px-3 pb-3 border-t border-[#3d3a36]">
                {/* Admins */}
                <div className="mt-3">
                  <p className="text-xs text-[#9b9895] uppercase tracking-wider mb-2">Institute Admin(s)</p>
                  {inst.admins?.length > 0 ? (
                    <div className="space-y-2">
                      {inst.admins.map(adm => (
                        <div key={adm.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#312e2b] rounded p-2 text-sm">
                          <div className="flex-1">
                            <span className="text-white font-medium">{adm.name}</span>
                            <span className="text-[#9b9895] text-xs ml-2">{adm.email}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-[#9b9895]">Code: <span className="text-[#81b64c] font-mono">{adm.referral_code || 'None'}</span></span>
                            {adm.referral_code && (
                              <span className="text-[#9b9895]">Link: <span className="text-[#81b64c] font-mono">chess99.com/join/{adm.referral_code}</span></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#9b9895] text-xs">No admins assigned</p>
                  )}
                </div>
                {/* Stats row */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#312e2b] rounded p-2">
                    <p className="text-[#9b9895]">Referred via Org</p>
                    <p className="text-white font-mono text-lg">{inst.referred_via_org}</p>
                  </div>
                  <div className="bg-[#312e2b] rounded p-2">
                    <p className="text-[#9b9895]">Paid Members</p>
                    <p className="text-[#e8a93e] font-mono text-lg">{inst.paid_members}</p>
                  </div>
                  <div className="bg-[#312e2b] rounded p-2">
                    <p className="text-[#9b9895]">Contact</p>
                    <p className="text-white text-xs truncate">{inst.contact_email || '-'}</p>
                  </div>
                  <div className="bg-[#312e2b] rounded p-2">
                    <p className="text-[#9b9895]">Created By</p>
                    <p className="text-white text-xs truncate">{inst.created_by?.name || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Tier Manager ─── */

const TierManager = () => {
  const [tiers, setTiers] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${BACKEND_URL}/admin/ambassador-tiers`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}`, Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(d => { setTiers(d.tiers); setDraft(d.tiers.map(t => ({ ...t }))); })
      .catch(() => {});
  }, []);

  const updateDraft = (idx, field, value) => {
    setDraft(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addTier = () => {
    const maxReq = Math.max(...draft.map(t => t.min_paid_referrals), 0);
    const maxRate = Math.max(...draft.map(t => t.commission_rate), 0.10);
    setDraft(prev => [...prev, { name: '', min_paid_referrals: maxReq + 100, commission_rate: Math.min(maxRate + 0.02, 0.50) }]);
  };

  const removeTier = (idx) => {
    if (draft.length <= 1) return;
    setDraft(prev => prev.filter((_, i) => i !== idx));
  };

  const saveTiers = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/admin/ambassador-tiers`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tiers: draft.map(t => ({
            name: t.name,
            min_paid_referrals: parseInt(t.min_paid_referrals, 10),
            commission_rate: parseFloat(t.commission_rate),
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error || 'Save failed'); return; }
      setTiers(d.tiers);
      setDraft(d.tiers.map(t => ({ ...t })));
      setEditing(false);
      setMsg('Saved!');
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!tiers) return null;

  return (
    <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Ambassador Commission Tiers</h2>
        <div className="flex gap-2 items-center">
          {msg && <span className={`text-xs ${msg === 'Saved!' ? 'text-[#81b64c]' : 'text-red-400'}`}>{msg}</span>}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-3 py-1 rounded bg-[#464340] text-white text-sm hover:bg-[#555]">Edit</button>
          ) : (
            <>
              <button onClick={() => { setDraft(tiers.map(t => ({ ...t }))); setEditing(false); }} className="px-3 py-1 rounded bg-[#464340] text-[#bababa] text-sm hover:bg-[#555]">Cancel</button>
              <button onClick={saveTiers} disabled={saving} className="px-3 py-1 rounded bg-[#81b64c] text-white text-sm hover:bg-[#6da03d] disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#9b9895] border-b border-[#464340]">
              <th className="py-2 pr-3">Tier Name</th>
              <th className="py-2 pr-3 text-right">Min Paid Subscribers</th>
              <th className="py-2 pr-3 text-right">Commission %</th>
              {editing && <th className="py-2 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {(editing ? draft : tiers).map((t, i) => (
              <tr key={editing ? i : t.id} className="border-b border-[#3d3a36]">
                <td className="py-2 pr-3">
                  {editing ? (
                    <input value={t.name} onChange={e => updateDraft(i, 'name', e.target.value)}
                      className="bg-[#262421] text-white px-2 py-1 rounded border border-[#464340] text-sm w-28" />
                  ) : (
                    <span className="text-white font-medium">{t.name}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editing ? (
                    <input type="number" min="0" value={t.min_paid_referrals} onChange={e => updateDraft(i, 'min_paid_referrals', e.target.value)}
                      className="bg-[#262421] text-white px-2 py-1 rounded border border-[#464340] text-sm w-24 text-right" />
                  ) : (
                    <span className="font-mono">{t.min_paid_referrals}</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right">
                  {editing ? (
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" step="0.01" min="0.01" max="1" value={t.commission_rate} onChange={e => updateDraft(i, 'commission_rate', e.target.value)}
                        className="bg-[#262421] text-white px-2 py-1 rounded border border-[#464340] text-sm w-20 text-right" />
                      <span className="text-[#9b9895] text-xs">({Math.round(parseFloat(t.commission_rate || 0) * 100)}%)</span>
                    </div>
                  ) : (
                    <span className="font-mono text-[#e8a93e]">{Math.round(t.commission_rate * 100)}%</span>
                  )}
                </td>
                {editing && (
                  <td className="py-2">
                    {draft.length > 1 && (
                      <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-300 text-xs">&#10005;</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <button onClick={addTier} className="mt-3 text-[#81b64c] text-sm hover:underline">+ Add tier</button>
      )}
    </div>
  );
};

export default AdminDashboard;
