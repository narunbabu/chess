import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AdminReferralDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [period, setPeriod] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('pending');

  const loadData = useCallback(async () => {
    try {
      const [overviewRes, payoutsRes] = await Promise.all([
        api.get('/admin/referrals/overview', { params: period ? { period } : {} }),
        api.get('/admin/referrals/payouts', { params: { status: payoutFilter } }),
      ]);
      setOverview(overviewRes.data);
      setPayouts(payoutsRes.data.data || []);
      setError(null);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. Admin only.');
      } else {
        setError('Failed to load data.');
      }
    } finally {
      setLoading(false);
    }
  }, [period, payoutFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const calculatePayouts = async () => {
    setCalculating(true);
    try {
      const res = await api.post('/admin/referrals/calculate-payouts', {
        period: period || undefined,
      });
      alert(`Created ${res.data.payouts_created} payout(s) totaling ₹${res.data.total_amount}`);
      await loadData();
    } catch (err) {
      alert('Failed to calculate payouts: ' + (err.response?.data?.message || err.message));
    } finally {
      setCalculating(false);
    }
  };

  const markPaid = async (payoutId) => {
    const notes = prompt('Payment notes (optional):');
    try {
      await api.post(`/admin/referrals/payouts/${payoutId}/mark-paid`, { notes });
      await loadData();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a18]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a18]">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a18] text-white px-4 py-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Referral Admin Dashboard</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Earnings" value={`₹${overview?.total_earnings || '0.00'}`} />
        <StatCard label="Pending" value={`₹${overview?.pending_earnings || '0.00'}`} color="yellow" />
        <StatCard label="Paid Out" value={`₹${overview?.paid_earnings || '0.00'}`} />
        <StatCard label="Referred Users" value={overview?.total_referred_users || 0} />
        <StatCard label="Referral Codes" value={overview?.total_referral_codes || 0} />
      </div>

      {/* Period filter + Calculate button */}
      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="px-3 py-2 bg-[#262421] border border-[#3d3a37] rounded-lg text-sm text-white"
          placeholder="Filter by month"
        />
        <button
          onClick={calculatePayouts}
          disabled={calculating}
          className="px-4 py-2 bg-[#81b64c] text-white rounded-lg text-sm font-medium hover:bg-[#93c85a] disabled:opacity-50"
        >
          {calculating ? 'Calculating...' : 'Calculate Monthly Payouts'}
        </button>
      </div>

      {/* Top Referrers */}
      {overview?.top_referrers?.length > 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Top Referrers</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8b8987] text-left border-b border-[#3d3a37]">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2 text-right">Referred</th>
                <th className="pb-2 text-right">Total Earned</th>
              </tr>
            </thead>
            <tbody>
              {overview.top_referrers.map((r, i) => (
                <tr key={i} className="border-b border-[#3d3a37]/50">
                  <td className="py-2">{r.referrer?.name || '-'}</td>
                  <td className="py-2 text-[#8b8987]">{r.referrer?.email || '-'}</td>
                  <td className="py-2 text-right">{r.referred_count}</td>
                  <td className="py-2 text-right text-[#81b64c]">₹{parseFloat(r.total_earned).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Payouts */}
      <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Payouts</h2>
          <div className="flex gap-2">
            {['pending', 'paid'].map(s => (
              <button
                key={s}
                onClick={() => setPayoutFilter(s)}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  payoutFilter === s
                    ? 'bg-[#81b64c] text-white'
                    : 'bg-[#3d3a37] text-[#8b8987] hover:text-white'
                } transition-colors`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {payouts.length === 0 ? (
          <p className="text-[#6b6966] text-sm">No {payoutFilter} payouts.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8b8987] text-left border-b border-[#3d3a37]">
                <th className="pb-2">Referrer</th>
                <th className="pb-2">Period</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">Payments</th>
                <th className="pb-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id} className="border-b border-[#3d3a37]/50">
                  <td className="py-2">
                    <div>{p.referrer?.name || '-'}</div>
                    <div className="text-xs text-[#6b6966]">{p.referrer?.email}</div>
                  </td>
                  <td className="py-2">{p.period}</td>
                  <td className="py-2 text-right font-medium">₹{p.total_amount}</td>
                  <td className="py-2 text-right">{p.earnings_count}</td>
                  <td className="py-2 text-right">
                    {p.status === 'pending' ? (
                      <button
                        onClick={() => markPaid(p.id)}
                        className="px-3 py-1 bg-[#81b64c] text-white rounded text-xs hover:bg-[#93c85a]"
                      >
                        Mark Paid
                      </button>
                    ) : (
                      <span className="text-xs text-[#81b64c]">
                        Paid {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Earnings */}
      {overview?.recent_earnings?.length > 0 && (
        <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Earnings</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {overview.recent_earnings.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-[#1a1a18] rounded-lg text-sm">
                <div>
                  <span className="text-[#8b8987]">{e.referrer?.name}</span>
                  <span className="text-[#6b6966] mx-1">earned from</span>
                  <span>{e.referred_user?.name}</span>
                  {e.referral_code && (
                    <span className="text-xs text-[#6b6966] ml-1">({e.referral_code.code})</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#81b64c]">₹{e.earning_amount}</span>
                  <span className={`text-xs ${e.status === 'paid' ? 'text-[#81b64c]' : 'text-yellow-400'}`}>
                    {e.status}
                  </span>
                  <span className="text-xs text-[#6b6966]">{new Date(e.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className="bg-[#262421] rounded-xl border border-[#3d3a37] p-4 text-center">
    <p className={`text-xl font-bold ${color === 'yellow' ? 'text-yellow-400' : 'text-[#81b64c]'}`}>{value}</p>
    <p className="text-xs text-[#8b8987] mt-1">{label}</p>
  </div>
);

export default AdminReferralDashboard;
