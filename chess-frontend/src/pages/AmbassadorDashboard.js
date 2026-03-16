import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';
import { isAmbassador } from '../utils/permissionHelpers';

const TIER_COLORS = {
  Starter: '#9b9895',
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#e5e4e2',
};

const AmbassadorDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const userIsAmbassador = isAmbassador(user);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/ambassador/dashboard`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelfEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(`${BACKEND_URL}/ambassador/self-assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const copyLink = () => {
    if (data?.join_url) {
      navigator.clipboard.writeText(data.join_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareWhatsApp = () => {
    if (data?.join_url) {
      const text = encodeURIComponent(
        `Join me on Chess99 - India's best chess platform! Play, learn, and compete. Use my link to sign up:\n${data.join_url}`
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const qrUrl = data?.join_url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.join_url)}`
    : null;

  // Not an ambassador yet — show enrollment page
  if (!userIsAmbassador && !loading) {
    return (
      <div className="min-h-screen bg-[#262421] text-[#bababa] p-6 flex items-center justify-center">
        <div className="bg-[#312e2b] rounded-lg p-8 max-w-lg text-center">
          <div className="text-5xl mb-4">&#9819;</div>
          <h1 className="text-2xl font-bold text-white mb-3">Become a Chess99 Ambassador</h1>
          <p className="text-[#bababa] mb-2">Share Chess99 with friends, students, and chess enthusiasts.</p>
          <p className="text-[#bababa] mb-4">Start at <span className="text-[#81b64c] font-bold">10% commission</span>, unlock up to <span className="text-[#ffd700] font-bold">20%</span> as you grow.</p>
          {/* Tier preview */}
          <div className="bg-[#262421] rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-[#9b9895] mb-2 uppercase tracking-wider">Commission Tiers</p>
            <div className="space-y-1 text-sm">
              {[
                { name: 'Starter', req: '0', rate: '10%' },
                { name: 'Bronze', req: '50', rate: '12%' },
                { name: 'Silver', req: '200', rate: '15%' },
                { name: 'Gold', req: '500', rate: '18%' },
                { name: 'Platinum', req: '1000', rate: '20%' },
              ].map(t => (
                <div key={t.name} className="flex justify-between">
                  <span style={{ color: TIER_COLORS[t.name] }}>{t.name}</span>
                  <span className="text-[#bababa]">{t.req}+ paid subs = <span className="text-white font-semibold">{t.rate}</span></span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleSelfEnroll}
            disabled={enrolling}
            className="w-full py-3 rounded-lg bg-[#81b64c] text-white font-bold text-lg hover:bg-[#6da03d] disabled:opacity-50 transition"
          >
            {enrolling ? 'Enrolling...' : 'Become an Ambassador'}
          </button>
        </div>
      </div>
    );
  }

  const tier = data?.tier;
  const currentTierName = tier?.current_tier?.name || 'Starter';
  const tierColor = TIER_COLORS[currentTierName] || '#9b9895';

  return (
    <div className="min-h-screen bg-[#262421] text-[#bababa] p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Ambassador Dashboard</h1>
      <p className="text-[#9b9895] text-sm mb-6">Chess99 Ambassador Program</p>

      {loading && !data && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
        </div>
      )}
      {error && <p className="text-red-400 mb-4">Error: {error}</p>}

      {data && (
        <>
          {/* Tier Banner */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6 border-l-4" style={{ borderColor: tierColor }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold" style={{ color: tierColor }}>{currentTierName}</span>
                  <span className="text-xs bg-[#262421] px-2 py-0.5 rounded text-[#bababa]">
                    {data.stats.commission_rate} commission
                  </span>
                </div>
                <p className="text-sm text-[#9b9895]">
                  {tier?.paid_referrals ?? 0} paid subscriber{(tier?.paid_referrals ?? 0) !== 1 ? 's' : ''} referred
                </p>
              </div>
              {tier?.next_tier && (
                <div className="text-right">
                  <p className="text-xs text-[#9b9895]">
                    Next: <span style={{ color: TIER_COLORS[tier.next_tier.name] || '#bababa' }}>{tier.next_tier.name}</span> ({Math.round(tier.next_tier.commission_rate * 100)}%)
                  </p>
                  <p className="text-xs text-[#9b9895]">
                    {tier.next_tier.referrals_needed} more paid subscriber{tier.next_tier.referrals_needed !== 1 ? 's' : ''} needed
                  </p>
                </div>
              )}
            </div>
            {/* Progress bar */}
            {tier?.next_tier && (
              <div className="mt-3">
                <div className="h-2 bg-[#262421] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${tier.progress_to_next ?? 0}%`,
                      background: `linear-gradient(90deg, ${tierColor}, ${TIER_COLORS[tier.next_tier.name] || '#bababa'})`,
                    }}
                  />
                </div>
                <p className="text-xs text-[#9b9895] mt-1 text-right">{Math.round(tier.progress_to_next ?? 0)}%</p>
              </div>
            )}
            {!tier?.next_tier && (
              <p className="text-xs text-[#81b64c] mt-2">Maximum tier reached!</p>
            )}
          </div>

          {/* All Tiers Overview */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Commission Tiers</h2>
            <div className="flex flex-wrap gap-2">
              {tier?.all_tiers?.map(t => (
                <div
                  key={t.name}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    t.is_current ? 'ring-2' : 'opacity-60'
                  }`}
                  style={{
                    background: t.is_current ? `${TIER_COLORS[t.name]}15` : '#262421',
                    ringColor: TIER_COLORS[t.name],
                    borderColor: TIER_COLORS[t.name],
                  }}
                >
                  <p className="font-semibold" style={{ color: TIER_COLORS[t.name] || '#bababa' }}>{t.name}</p>
                  <p className="text-xs text-[#9b9895]">{t.min_paid_referrals}+ subs = {Math.round(t.commission_rate * 100)}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="People Joined" value={data.stats.total_referred} color="#81b64c" />
            <StatCard label="Paid Subscribers" value={data.stats.subscribed_count} color="#e8a93e" />
            <StatCard label="Active This Week" value={data.stats.active_this_week} color="#5ba4cf" />
            <StatCard label="Earnings This Month" value={`\u20B9${data.stats.earnings_this_month}`} color="#9b59b6" />
          </div>

          {/* Earnings Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-[#312e2b] rounded-lg p-4">
              <p className="text-[#9b9895] text-xs mb-1">Total Earnings</p>
              <p className="text-xl font-bold text-white">{'\u20B9'}{data.stats.total_earnings}</p>
            </div>
            <div className="bg-[#312e2b] rounded-lg p-4">
              <p className="text-[#9b9895] text-xs mb-1">Pending</p>
              <p className="text-xl font-bold text-[#e8a93e]">{'\u20B9'}{data.stats.pending_earnings}</p>
            </div>
            <div className="bg-[#312e2b] rounded-lg p-4">
              <p className="text-[#9b9895] text-xs mb-1">Paid Out</p>
              <p className="text-xl font-bold text-[#81b64c]">{'\u20B9'}{data.stats.paid_earnings}</p>
            </div>
          </div>

          {/* Share Section */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Your Referral Link</h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 bg-[#262421] rounded px-3 py-2 text-sm font-mono text-[#81b64c] truncate">
                {data.join_url}
              </div>
              <button
                onClick={copyLink}
                className="px-4 py-2 rounded bg-[#81b64c] text-white text-sm font-medium hover:bg-[#6da03d] transition shrink-0"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={shareWhatsApp}
                className="px-4 py-2 rounded bg-[#25D366] text-white text-sm font-medium hover:bg-[#1da851] transition"
              >
                Share on WhatsApp
              </button>
              <button
                onClick={() => setShowQR(!showQR)}
                className="px-4 py-2 rounded bg-[#464340] text-white text-sm font-medium hover:bg-[#555] transition"
              >
                {showQR ? 'Hide QR Code' : 'Show QR Code'}
              </button>
            </div>
            {showQR && qrUrl && (
              <div className="mt-4 flex flex-col items-center">
                <img
                  src={qrUrl}
                  alt="Referral QR Code"
                  className="rounded-lg bg-white p-2"
                  width={250}
                  height={250}
                />
                <p className="text-xs text-[#9b9895] mt-2">Scan to join Chess99 via your referral</p>
              </div>
            )}
          </div>

          {/* Referral Codes */}
          {data.codes && data.codes.length > 0 && (
            <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white mb-3">Your Referral Codes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Label</th>
                      <th className="py-2 pr-4 text-right">Used</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.codes.map(c => (
                      <tr key={c.id} className="border-b border-[#3d3a36]">
                        <td className="py-2 pr-4 font-mono text-[#81b64c]">{c.code}</td>
                        <td className="py-2 pr-4 text-[#9b9895]">{c.label || '-'}</td>
                        <td className="py-2 pr-4 text-right font-mono">{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                        <td className="py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${c.is_active ? 'bg-[#81b64c]/20 text-[#81b64c]' : 'bg-red-900/20 text-red-400'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Referred Users */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              People You Referred ({data.referred_users.length})
            </h2>
            {data.referred_users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Joined</th>
                      <th className="py-2 pr-4">Plan</th>
                      <th className="py-2 hidden sm:table-cell">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referred_users.map(u => (
                      <tr key={u.id} className="border-b border-[#3d3a36]">
                        <td className="py-2 pr-4 text-white">{u.name}</td>
                        <td className="py-2 pr-4 text-[#9b9895]">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            u.subscription_tier && u.subscription_tier !== 'free'
                              ? 'bg-[#e8a93e]/20 text-[#e8a93e]'
                              : 'bg-[#464340] text-[#9b9895]'
                          }`}>
                            {u.subscription_tier || 'free'}
                          </span>
                        </td>
                        <td className="py-2 hidden sm:table-cell text-[#9b9895]">
                          {u.last_activity_at ? new Date(u.last_activity_at).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[#9b9895] text-sm">No referrals yet. Share your link to get started!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className="bg-[#312e2b] rounded-lg p-4 border-t-2" style={{ borderColor: color }}>
    <p className="text-[#9b9895] text-xs mb-1">{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

export default AmbassadorDashboard;
