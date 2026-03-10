import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const FRONTEND_URL = window.location.origin;

const ReferralDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [referredUsers, setReferredUsers] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newCodeLabel, setNewCodeLabel] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [statsRes, usersRes, earningsRes, payoutsRes] = await Promise.all([
        api.get('/referrals/stats'),
        api.get('/referrals/referred-users'),
        api.get('/referrals/earnings'),
        api.get('/referrals/payouts'),
      ]);
      setStats(statsRes.data);
      setReferredUsers(usersRes.data.referred_users || []);
      setEarnings(earningsRes.data.data || []);
      setPayouts(payoutsRes.data.payouts || []);
    } catch (err) {
      console.error('Failed to load referral data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const referralLink = stats?.user_referral_code
    ? `${FRONTEND_URL}/join/${stats.user_referral_code}`
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      await api.post('/referrals/generate', {
        label: newCodeLabel || null,
      });
      setNewCodeLabel('');
      await loadData();
    } catch (err) {
      console.error('Failed to generate code:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a18]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a18] text-white px-4 py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Referral Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="People Referred" value={stats?.referred_users_count || 0} />
        <StatCard label="Total Earnings" value={`₹${stats?.total_earnings || '0.00'}`} />
        <StatCard label="Pending" value={`₹${stats?.pending_earnings || '0.00'}`} />
        <StatCard label="Paid Out" value={`₹${stats?.paid_earnings || '0.00'}`} />
      </div>

      {/* Share link */}
      <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Your Referral Link</h2>
        <p className="text-sm text-[#8b8987] mb-4">
          Share this link. When someone joins and subscribes, you earn {stats?.commission_rate || '10%'} of their payment every month.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 px-4 py-2.5 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white"
          />
          <button
            onClick={copyLink}
            className="px-5 py-2.5 bg-[#81b64c] text-white font-medium rounded-lg hover:bg-[#93c85a] transition-colors text-sm whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Share buttons */}
        <div className="flex gap-3 mt-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Join me on Chess99! ${referralLink}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[#25D366]/20 text-[#25D366] rounded-lg text-sm hover:bg-[#25D366]/30 transition-colors"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent('Join Chess99!')}&body=${encodeURIComponent(`Play chess online with me on Chess99! Sign up here: ${referralLink}`)}`}
            className="px-4 py-2 bg-[#3d3a37] text-[#bababa] rounded-lg text-sm hover:bg-[#4a4744] transition-colors"
          >
            Email
          </a>
        </div>
      </div>

      {/* Additional referral codes */}
      {stats?.codes?.length > 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Your Referral Codes</h2>
          <div className="space-y-2">
            {stats.codes.map(code => (
              <div key={code.id} className="flex items-center justify-between py-2 px-3 bg-[#1a1a18] rounded-lg">
                <div>
                  <span className="font-mono text-[#81b64c] text-sm">{code.code}</span>
                  {code.label && <span className="text-[#8b8987] text-xs ml-2">({code.label})</span>}
                </div>
                <div className="text-xs text-[#8b8987]">
                  {code.used_count} uses{code.max_uses ? ` / ${code.max_uses}` : ''}
                  {!code.is_active && <span className="text-red-400 ml-2">Inactive</span>}
                </div>
              </div>
            ))}
          </div>
          {/* Generate new code */}
          <div className="flex gap-2 mt-4">
            <input
              placeholder="Label (optional, e.g. School name)"
              value={newCodeLabel}
              onChange={e => setNewCodeLabel(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#1a1a18] border border-[#3d3a37] rounded-lg text-sm text-white placeholder-[#6b6966]"
            />
            <button
              onClick={generateCode}
              disabled={generating}
              className="px-4 py-2 bg-[#3d3a37] text-white rounded-lg text-sm hover:bg-[#4a4744] disabled:opacity-50 transition-colors"
            >
              {generating ? '...' : 'New Code'}
            </button>
          </div>
        </div>
      )}

      {/* Referred Users */}
      {referredUsers.length > 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">People You Referred</h2>
          <div className="space-y-2">
            {referredUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-[#1a1a18] rounded-lg">
                <span className="text-sm">{u.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#8b8987] capitalize">{u.subscription_tier || 'free'}</span>
                  <span className="text-xs text-[#6b6966]">{new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earnings */}
      {earnings.length > 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Earnings History</h2>
          <div className="space-y-2">
            {earnings.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-[#1a1a18] rounded-lg">
                <div>
                  <span className="text-sm">{e.referred_user?.name || 'User'}</span>
                  {e.referral_code && (
                    <span className="text-xs text-[#6b6966] ml-2">via {e.referral_code.code}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm text-[#81b64c] font-medium">+₹{e.earning_amount}</span>
                  <span className={`text-xs ml-2 ${
                    e.status === 'paid' ? 'text-[#81b64c]' :
                    e.status === 'approved' ? 'text-yellow-400' :
                    'text-[#8b8987]'
                  }`}>
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payouts */}
      {payouts.length > 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Payout History</h2>
          <div className="space-y-2">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-[#1a1a18] rounded-lg">
                <div>
                  <span className="text-sm">{p.period}</span>
                  <span className="text-xs text-[#6b6966] ml-2">({p.earnings_count} payments)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">₹{p.total_amount}</span>
                  <span className={`text-xs ml-2 ${p.status === 'paid' ? 'text-[#81b64c]' : 'text-yellow-400'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {referredUsers.length === 0 && earnings.length === 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-8 text-center">
          <p className="text-[#8b8987] mb-2">No referrals yet</p>
          <p className="text-sm text-[#6b6966]">
            Share your link above to start earning 10% of every subscription payment from people you refer.
          </p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-4 text-center">
    <p className="text-xl font-bold text-[#81b64c]">{value}</p>
    <p className="text-xs text-[#8b8987] mt-1">{label}</p>
  </div>
);

export default ReferralDashboard;
