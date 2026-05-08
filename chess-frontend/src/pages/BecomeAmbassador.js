import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';
import { isAmbassador } from '../utils/permissionHelpers';

const STATUS_LABELS = {
  pending: { label: 'Pending review', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const BecomeAmbassador = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    name: user?.name || '',
    mobile: user?.mobile_number ? `+${user.mobile_country_code || '91'}${user.mobile_number}` : '',
    upi_id: '',
    reason: '',
  });

  const fetchApplication = useCallback(async () => {
    try {
      const token = localStorage.getItem('chess99_token') || localStorage.getItem('token');
      const res = await fetch(`${BACKEND_URL}/ambassador/application`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplication(data.application);
        if (data.application) {
          setForm((f) => ({
            ...f,
            name: data.application.name || f.name,
            mobile: data.application.mobile || f.mobile,
            upi_id: data.application.upi_id || f.upi_id,
            reason: data.application.reason || '',
          }));
        }
      }
    } catch (e) {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login?next=/become-ambassador', { replace: true });
      return;
    }
    if (isAmbassador(user)) {
      navigate('/ambassador', { replace: true });
      return;
    }
    fetchApplication();
  }, [user, navigate, fetchApplication]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim() || !form.mobile.trim() || !form.upi_id.trim()) {
      setError('Name, mobile, and UPI ID are required.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('chess99_token') || localStorage.getItem('token');
      const res = await fetch(`${BACKEND_URL}/ambassador/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit application.');
        return;
      }
      setApplication(data.application);
      setSuccess(data.message || 'Application submitted!');
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#262421] text-white flex items-center justify-center">
        <div className="text-[#8b8987]">Loading…</div>
      </div>
    );
  }

  const status = application?.status;
  const statusInfo = status ? STATUS_LABELS[status] : null;
  const isPending = status === 'pending';
  const canReapply = status === 'rejected' || !application;

  return (
    <div className="min-h-screen bg-[#262421] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Become a Chess99 Ambassador</h1>
        <p className="text-[#b8b6b3] mb-6">
          Bring chess to your school, neighborhood, or community. Earn commissions on every signup
          you bring through your referral code.
        </p>

        <div className="bg-[#312e2b] rounded-lg p-5 mb-6 border border-[#3d3a37]">
          <h2 className="text-lg font-semibold mb-3 text-[#81b64c]">What you get</h2>
          <ul className="space-y-2 text-sm text-[#d8d6d3]">
            <li>• <b>₹2</b> when your referral signs up + <b>₹3</b> on first rated game + <b>₹5</b> on first paid plan</li>
            <li>• <b>10% / 5% / 2% / 2%</b> recurring commissions across years 1–4</li>
            <li>• Personal QR code, printable poster, share templates</li>
            <li>• Monthly UPI payouts, full transparency dashboard</li>
          </ul>
        </div>

        {statusInfo && (
          <div className={`mb-6 rounded-lg px-4 py-3 border ${statusInfo.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Application status: {statusInfo.label}</div>
                {application?.reviewed_at && (
                  <div className="text-xs opacity-80 mt-1">
                    Reviewed {new Date(application.reviewed_at).toLocaleDateString()}
                  </div>
                )}
                {application?.decline_reason && (
                  <div className="text-xs mt-2 opacity-90">
                    Reviewer note: {application.decline_reason}
                  </div>
                )}
              </div>
              {status === 'approved' && (
                <button
                  onClick={() => navigate('/ambassador')}
                  className="bg-[#81b64c] hover:bg-[#739f43] px-4 py-2 rounded text-sm font-semibold"
                >
                  Go to dashboard
                </button>
              )}
            </div>
          </div>
        )}

        {(canReapply || isPending) && (
          <form onSubmit={submit} className="bg-[#312e2b] rounded-lg p-5 border border-[#3d3a37] space-y-4">
            <div>
              <label className="block text-sm text-[#b8b6b3] mb-1">Full name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={isPending}
                className="w-full bg-[#262421] border border-[#3d3a37] rounded px-3 py-2 text-white disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[#b8b6b3] mb-1">Mobile (WhatsApp)</label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                disabled={isPending}
                placeholder="+91XXXXXXXXXX"
                className="w-full bg-[#262421] border border-[#3d3a37] rounded px-3 py-2 text-white disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[#b8b6b3] mb-1">UPI ID (for payouts)</label>
              <input
                type="text"
                value={form.upi_id}
                onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                disabled={isPending}
                placeholder="yourname@upi"
                className="w-full bg-[#262421] border border-[#3d3a37] rounded px-3 py-2 text-white disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[#b8b6b3] mb-1">
                Why you want to be an ambassador <span className="text-[#6b6966]">(optional)</span>
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                disabled={isPending}
                rows={4}
                placeholder="School, club, neighborhood, social group… anything that helps us understand your reach."
                className="w-full bg-[#262421] border border-[#3d3a37] rounded px-3 py-2 text-white disabled:opacity-60 resize-none"
              />
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}
            {success && <div className="text-emerald-400 text-sm">{success}</div>}

            {!isPending && (
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#81b64c] hover:bg-[#739f43] disabled:opacity-50 px-4 py-3 rounded font-semibold"
              >
                {submitting ? 'Submitting…' : (canReapply && application ? 'Re-apply' : 'Submit application')}
              </button>
            )}

            {isPending && (
              <div className="text-sm text-[#b8b6b3] text-center pt-2">
                Your application is under review. We will notify you by email.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default BecomeAmbassador;
