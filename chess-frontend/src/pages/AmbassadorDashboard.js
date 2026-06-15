import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';
import { isAmbassador } from '../utils/permissionHelpers';

const SHARE_TEMPLATES = [
  {
    id: 'parent',
    label: 'For Parents',
    text: (url) =>
      `Chess99 helps kids think sharper. Daily puzzles, rated games, and tactical trainer — built for Indian schools.\n\nSign up here: ${url}`,
  },
  {
    id: 'student',
    label: 'For Students',
    text: (url) =>
      `Play rated chess and solve daily tactics on Chess99. Track your rating, climb the leaderboard, learn from your games.\n\n${url}`,
  },
  {
    id: 'friend',
    label: 'For Friends',
    text: (url) =>
      `Found a clean Indian chess platform — Chess99. No ads, instant matchmaking, and a tactical trainer that actually helps.\n\nJoin me: ${url}`,
  },
  {
    id: 'coach',
    label: 'For Coaches',
    text: (url) =>
      `Chess99 has a structured tactical trainer (5 stages, 500 puzzles each) and rated play with full game review. Worth showing your students.\n\n${url}`,
  },
  {
    id: 'telugu',
    label: 'తెలుగులో',
    text: (url) =>
      `Chess99 — భారతదేశపు చెస్ ప్లాట్‌ఫారమ్. రోజువారీ పజిల్స్, రేటెడ్ గేమ్స్, ట్యాక్టికల్ ట్రైనర్.\n\nఇక్కడ చేరండి: ${url}`,
  },
];

const AmbassadorDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [activeTemplate, setActiveTemplate] = useState('parent');
  const qrCanvasRef = useRef(null);

  // Payout request state
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    payment_method: 'upi',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    upi_id: '',
  });
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState(null);
  const [payoutSuccess, setPayoutSuccess] = useState(null);

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

  const fetchPayoutRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/ambassador/payout-requests`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setPayoutRequests(json.payout_requests || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPayoutRequests(); }, [fetchPayoutRequests]);

  const submitPayoutRequest = async (e) => {
    e.preventDefault();
    setPayoutError(null);
    setPayoutSuccess(null);
    setPayoutSubmitting(true);

    try {
      const body = {
        amount: parseFloat(payoutForm.amount),
        payment_method: payoutForm.payment_method,
      };
      if (payoutForm.payment_method === 'bank') {
        body.bank_account_name = payoutForm.bank_account_name;
        body.bank_account_number = payoutForm.bank_account_number;
        body.bank_ifsc = payoutForm.bank_ifsc;
        if (payoutForm.bank_name) body.bank_name = payoutForm.bank_name;
      } else {
        body.upi_id = payoutForm.upi_id;
      }

      const res = await fetch(`${BACKEND_URL}/ambassador/payout-request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setPayoutSuccess('Payout request submitted successfully!');
      setPayoutForm({ amount: '', payment_method: 'upi', bank_account_name: '', bank_account_number: '', bank_ifsc: '', bank_name: '', upi_id: '' });
      setShowPayoutForm(false);
      fetchPayoutRequests();
      fetchData();
    } catch (err) {
      setPayoutError(err.message);
    } finally {
      setPayoutSubmitting(false);
    }
  };

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

  const shareUrl = data?.share?.short_url || data?.share?.join_url;

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const buildMessage = (templateId) => {
    const tpl = SHARE_TEMPLATES.find(t => t.id === templateId) || SHARE_TEMPLATES[0];
    return tpl.text(shareUrl || '');
  };

  const shareWhatsApp = (templateId) => {
    if (!shareUrl) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage(templateId))}`, '_blank', 'noopener,noreferrer');
  };

  const copyMessage = (templateId) => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(buildMessage(templateId));
    setCopiedTemplate(templateId);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  useEffect(() => {
    if (!shareUrl) { setQrDataUrl(null); return; }
    QRCode.toDataURL(shareUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#262421', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [shareUrl]);

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `chess99-referral-${data?.share?.code || 'qr'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openPoster = () => {
    if (!data?.share?.code) return;
    window.open(`/ambassador/poster?code=${encodeURIComponent(data.share.code)}`, '_blank', 'noopener,noreferrer');
  };

  // Not an ambassador yet — show enrollment page
  if (!userIsAmbassador && !loading) {
    return (
      <div className="min-h-screen bg-[#262421] text-[#bababa] p-6 flex items-center justify-center">
        <div className="bg-[#312e2b] rounded-lg p-8 max-w-lg text-center">
          <div className="text-5xl mb-4">&#9819;</div>
          <h1 className="text-2xl font-bold text-white mb-3">Become a Chess99 Ambassador</h1>
          <p className="text-[#bababa] mb-2">Share Chess99 with friends, students, and chess enthusiasts.</p>
          <p className="text-[#bababa] mb-4">Earn ₹2 per signup, ₹3 on first activity, ₹5 at 100 games/puzzles, plus a share of every subscription you bring in.</p>
          {/* Earnings preview */}
          <div className="bg-[#262421] rounded-lg p-4 mb-6 text-left space-y-3">
            <div>
              <p className="text-xs text-[#9b9895] mb-2 uppercase tracking-wider">Activity Milestones</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>User signs up with phone</span><span className="text-[#81b64c] font-semibold">₹2</span></div>
                <div className="flex justify-between"><span>First rated game or puzzle solved</span><span className="text-[#81b64c] font-semibold">₹3</span></div>
                <div className="flex justify-between"><span>100 games + puzzles combined</span><span className="text-[#81b64c] font-semibold">₹5</span></div>
              </div>
            </div>
            <div className="border-t border-[#464340] pt-3">
              <p className="text-xs text-[#9b9895] mb-2 uppercase tracking-wider">Subscription Commission</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Year 1</span><span className="text-[#ffd700] font-semibold">10%</span></div>
                <div className="flex justify-between"><span>Year 2</span><span className="text-[#e8a93e] font-semibold">5%</span></div>
                <div className="flex justify-between"><span>Years 3 & 4</span><span className="text-[#bababa] font-semibold">2%</span></div>
              </div>
            </div>
          </div>
          <button
            onClick={() => { window.location.href = '/become-ambassador'; }}
            className="w-full py-3 rounded-lg bg-[#81b64c] text-white font-bold text-lg hover:bg-[#6da03d] transition"
          >
            Apply to be an Ambassador
          </button>
        </div>
      </div>
    );
  }

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
          {/* Activity Milestones earned */}
          {data.milestones && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {[
                { key: 'signup_phone',   label: 'Signups (with phone)', amount: '₹2' },
                { key: 'first_activity', label: 'First Activity',       amount: '₹3' },
                { key: 'activity_100',   label: '100 Games + Puzzles',   amount: '₹5' },
              ].map(m => {
                const row = data.milestones[m.key] || { count: 0, total: 0 };
                return (
                  <div key={m.key} className="bg-[#312e2b] rounded-lg p-4">
                    <p className="text-xs text-[#9b9895] uppercase tracking-wider">{m.label}</p>
                    <p className="text-xs text-[#5ba4cf] mb-1">{m.amount} per user</p>
                    <p className="text-2xl font-bold text-white">{row.count}</p>
                    <p className="text-sm text-[#81b64c]">₹{Number(row.total).toFixed(2)} earned</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Subscription Commission Schedule */}
          {Array.isArray(data.subscription_years) && (
            <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Subscription Commission</h2>
              <p className="text-xs text-[#9b9895] mb-3">Earned for each subscription you brought in. Time-decaying — pays nothing after Year 4.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {data.subscription_years.map(y => (
                  <div key={y.year} className="bg-[#262421] rounded-lg p-3">
                    <p className="text-xs text-[#9b9895] uppercase tracking-wider">Year {y.year}</p>
                    <p className="text-lg font-bold" style={{ color: y.year === 1 ? '#ffd700' : y.year === 2 ? '#e8a93e' : '#bababa' }}>{y.rate_pct}%</p>
                    <p className="text-xs text-[#bababa]">{y.count} payment{y.count !== 1 ? 's' : ''}</p>
                    <p className="text-sm text-[#81b64c]">₹{Number(y.total).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Payout Section */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-white">Payouts</h2>
              <button
                onClick={() => { setShowPayoutForm(!showPayoutForm); setPayoutError(null); setPayoutSuccess(null); }}
                className="px-4 py-2 rounded bg-[#81b64c] text-white text-sm font-medium hover:bg-[#6da03d] transition"
              >
                {showPayoutForm ? 'Cancel' : 'Request Payout'}
              </button>
            </div>

            {payoutSuccess && (
              <div className="bg-[#81b64c]/20 border border-[#81b64c]/40 text-[#81b64c] rounded px-4 py-2 text-sm mb-4">{payoutSuccess}</div>
            )}

            {showPayoutForm && (
              <form onSubmit={submitPayoutRequest} className="bg-[#262421] rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-xs text-[#9b9895] mb-1">Amount (₹) — minimum ₹100</label>
                  <input
                    type="number"
                    min="100"
                    step="0.01"
                    required
                    value={payoutForm.amount}
                    onChange={e => setPayoutForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={`Max: ₹${data?.stats?.pending_earnings ?? 0}`}
                    className="w-full bg-[#312e2b] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                  />
                  <p className="text-xs text-[#9b9895] mt-1">Available: ₹{data?.stats?.pending_earnings ?? 0}</p>
                </div>

                <div>
                  <label className="block text-xs text-[#9b9895] mb-2">Payment Method</label>
                  <div className="flex gap-3">
                    {['upi', 'bank'].map(m => (
                      <label key={m} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded text-sm ${payoutForm.payment_method === m ? 'bg-[#81b64c]/20 text-[#81b64c] ring-1 ring-[#81b64c]' : 'bg-[#312e2b] text-[#bababa]'}`}>
                        <input
                          type="radio"
                          name="payment_method"
                          value={m}
                          checked={payoutForm.payment_method === m}
                          onChange={e => setPayoutForm(f => ({ ...f, payment_method: e.target.value }))}
                          className="accent-[#81b64c]"
                        />
                        {m === 'upi' ? 'UPI' : 'Bank Transfer'}
                      </label>
                    ))}
                  </div>
                </div>

                {payoutForm.payment_method === 'upi' ? (
                  <div>
                    <label className="block text-xs text-[#9b9895] mb-1">UPI ID</label>
                    <input
                      type="text"
                      required
                      value={payoutForm.upi_id}
                      onChange={e => setPayoutForm(f => ({ ...f, upi_id: e.target.value }))}
                      placeholder="yourname@upi"
                      className="w-full bg-[#312e2b] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#9b9895] mb-1">Account Holder Name</label>
                      <input
                        type="text"
                        required
                        value={payoutForm.bank_account_name}
                        onChange={e => setPayoutForm(f => ({ ...f, bank_account_name: e.target.value }))}
                        className="w-full bg-[#312e2b] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9b9895] mb-1">Account Number</label>
                      <input
                        type="text"
                        required
                        value={payoutForm.bank_account_number}
                        onChange={e => setPayoutForm(f => ({ ...f, bank_account_number: e.target.value }))}
                        className="w-full bg-[#312e2b] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9b9895] mb-1">IFSC Code</label>
                      <input
                        type="text"
                        required
                        value={payoutForm.bank_ifsc}
                        onChange={e => setPayoutForm(f => ({ ...f, bank_ifsc: e.target.value }))}
                        className="w-full bg-[#312e2b] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9b9895] mb-1">Bank Name (optional)</label>
                      <input
                        type="text"
                        value={payoutForm.bank_name}
                        onChange={e => setPayoutForm(f => ({ ...f, bank_name: e.target.value }))}
                        className="w-full bg-[#312e2b] text-white rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#81b64c]"
                      />
                    </div>
                  </div>
                )}

                {payoutError && <p className="text-red-400 text-sm">{payoutError}</p>}

                <button
                  type="submit"
                  disabled={payoutSubmitting}
                  className="w-full py-2.5 rounded bg-[#81b64c] text-white font-semibold text-sm hover:bg-[#6da03d] disabled:opacity-50 transition"
                >
                  {payoutSubmitting ? 'Submitting...' : 'Submit Payout Request'}
                </button>
              </form>
            )}

            {/* Payout History */}
            {payoutRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2 pr-4">Method</th>
                      <th className="py-2 pr-4">Details</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRequests.map(pr => (
                      <tr key={pr.id} className="border-b border-[#3d3a36]">
                        <td className="py-2 pr-4 text-[#bababa]">{new Date(pr.created_at).toLocaleDateString()}</td>
                        <td className="py-2 pr-4 text-white font-mono">₹{Number(pr.amount).toFixed(2)}</td>
                        <td className="py-2 pr-4 text-[#bababa]">{pr.payment_method === 'upi' ? 'UPI' : 'Bank'}</td>
                        <td className="py-2 pr-4 text-[#9b9895] text-xs font-mono">
                          {pr.payment_method === 'upi' ? pr.upi_id : `****${(pr.bank_account_number || '').slice(-4)}`}
                        </td>
                        <td className="py-2">
                          <StatusBadge status={pr.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[#9b9895] text-sm">No payout requests yet.</p>
            )}
          </div>

          {/* Share Section */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Your Referral Link</h2>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 bg-[#262421] rounded px-3 py-2 text-sm font-mono text-[#81b64c] truncate">
                {shareUrl}
              </div>
              <button
                onClick={copyLink}
                className="px-4 py-2 rounded bg-[#81b64c] text-white text-sm font-medium hover:bg-[#6da03d] transition shrink-0"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* Message templates */}
            <div className="mb-4">
              <p className="text-xs text-[#9b9895] uppercase tracking-wider mb-2">Message Templates</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {SHARE_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTemplate(t.id)}
                    className={`text-xs px-3 py-1 rounded ${
                      activeTemplate === t.id
                        ? 'bg-[#81b64c] text-white'
                        : 'bg-[#262421] text-[#bababa] hover:bg-[#3d3a36]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                readOnly
                value={buildMessage(activeTemplate)}
                rows={4}
                className="w-full bg-[#262421] rounded px-3 py-2 text-sm text-[#bababa] font-sans resize-none border border-[#464340]"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => copyMessage(activeTemplate)}
                  className="px-3 py-1.5 rounded bg-[#464340] text-white text-xs font-medium hover:bg-[#555] transition"
                >
                  {copiedTemplate === activeTemplate ? 'Copied!' : 'Copy Message'}
                </button>
                <button
                  onClick={() => shareWhatsApp(activeTemplate)}
                  className="px-3 py-1.5 rounded bg-[#25D366] text-white text-xs font-medium hover:bg-[#1da851] transition"
                >
                  Send via WhatsApp
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-[#464340] pt-4">
              <button
                onClick={() => setShowQR(!showQR)}
                className="px-4 py-2 rounded bg-[#464340] text-white text-sm font-medium hover:bg-[#555] transition"
              >
                {showQR ? 'Hide QR Code' : 'Show QR Code'}
              </button>
              <button
                onClick={downloadQR}
                disabled={!qrDataUrl}
                className="px-4 py-2 rounded bg-[#464340] text-white text-sm font-medium hover:bg-[#555] transition disabled:opacity-50"
              >
                Download QR (PNG)
              </button>
              <button
                onClick={openPoster}
                disabled={!data?.share?.code}
                className="px-4 py-2 rounded bg-[#e8a93e] text-[#262421] text-sm font-medium hover:bg-[#d99a2f] transition disabled:opacity-50"
              >
                Printable Poster
              </button>
            </div>

            {showQR && qrDataUrl && (
              <div className="mt-4 flex flex-col items-center">
                <img
                  ref={qrCanvasRef}
                  src={qrDataUrl}
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

          {/* Referred Users — mini-tutor view */}
          <div className="bg-[#312e2b] rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              People You Referred ({data.referred_users.length})
            </h2>
            <p className="text-xs text-[#9b9895] mb-3">Reach out to your users to encourage them to play. Every game and puzzle they finish moves them closer to your next milestone.</p>
            {data.referred_users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#9b9895] border-b border-[#464340]">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Joined</th>
                      <th className="py-2 pr-3 text-center">Phone</th>
                      <th className="py-2 pr-3 text-right">Games</th>
                      <th className="py-2 pr-3 text-right">Puzzles</th>
                      <th className="py-2 pr-3">Toward 100</th>
                      <th className="py-2 pr-3">Plan</th>
                      <th className="py-2 pr-3 text-right hidden sm:table-cell">Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referred_users.map(u => (
                      <tr key={u.id} className="border-b border-[#3d3a36]">
                        <td className="py-2 pr-3 text-white">{u.name}</td>
                        <td className="py-2 pr-3 text-[#9b9895]">{new Date(u.joined_at).toLocaleDateString()}</td>
                        <td className="py-2 pr-3 text-center">
                          {u.milestones?.signup_phone ? (
                            <span title="Phone signup ₹2 earned" className="text-[#81b64c]">✓</span>
                          ) : u.has_phone ? (
                            <span title="Phone present" className="text-[#5ba4cf]">●</span>
                          ) : (
                            <span title="No phone" className="text-[#9b9895]">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-[#bababa]">{u.games_played}</td>
                        <td className="py-2 pr-3 text-right font-mono text-[#bababa]">{u.puzzles_solved}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-[#262421] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${u.activity_100_progress}%`,
                                  background: u.milestones?.activity_100 ? '#81b64c' : '#5ba4cf',
                                }}
                              />
                            </div>
                            <span className="text-xs text-[#9b9895] tabular-nums">{u.activity_combined}/100</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {u.subscription_tier && u.subscription_tier !== 'free' ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-[#e8a93e]/20 text-[#e8a93e]">
                              {u.subscription_tier}{u.subscription_year ? ` Y${u.subscription_year}` : ''}
                              {u.subscription_rate ? ` (${Math.round(u.subscription_rate * 100)}%)` : ''}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-[#464340] text-[#9b9895]">free</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right hidden sm:table-cell font-mono text-[#81b64c]">
                          ₹{Number(u.earned_from_user || 0).toFixed(2)}
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

const STATUS_STYLES = {
  pending: 'bg-[#e8a93e]/20 text-[#e8a93e]',
  approved: 'bg-[#5ba4cf]/20 text-[#5ba4cf]',
  paid: 'bg-[#81b64c]/20 text-[#81b64c]',
  rejected: 'bg-red-900/20 text-red-400',
};

const StatusBadge = ({ status }) => (
  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[status] || 'bg-[#464340] text-[#9b9895]'}`}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

export default AmbassadorDashboard;
