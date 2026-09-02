import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const STATUS_STYLES = {
  pending: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
  approved: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  rejected: 'bg-red-500/20 text-red-200 border-red-500/40',
  paid: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[status] || 'border-[#464340] text-[#bababa]'}`}>
    {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
  </span>
);

const CommunityPrograms = () => {
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState(null);
  const [application, setApplication] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [applying, setApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationForm, setApplicationForm] = useState({ name: '', mobile: '', upi_id: '', reason: '', terms_accepted: false });
  const [reportForm, setReportForm] = useState({ period: currentPeriod(), app_name: '', test_link: '', feedback_summary: '', issue_count: '0' });

  const adultGated = Boolean(user?.is_minor || user?.needs_birthday);

  const loadOverview = useCallback(async () => {
    try {
      const response = await api.get('/community-programs/overview');
      setOverview(response.data);
    } catch (err) {
      setError('Program information is temporarily unavailable.');
    }
  }, []);

  const loadTesterData = useCallback(async () => {
    if (!user || adultGated) return;
    try {
      const [applicationResponse, submissionsResponse] = await Promise.all([
        api.get('/tester-program/application'),
        api.get('/tester-program/submissions'),
      ]);
      setApplication(applicationResponse.data.application);
      setSubmissions(submissionsResponse.data.submissions || []);
    } catch (err) {
      if (err.response?.status === 403) setError('Paid community roles are available to adults (18+) only.');
    }
  }, [user, adultGated]);

  useEffect(() => {
    Promise.all([loadOverview(), loadTesterData()]).finally(() => setLoading(false));
  }, [loadOverview, loadTesterData]);

  useEffect(() => {
    if (!user) return;
    setApplicationForm((form) => ({
      ...form,
      name: form.name || user.name || '',
      mobile: form.mobile || (user.mobile_number ? `+${user.mobile_country_code || '91'}${user.mobile_number}` : ''),
    }));
  }, [user]);

  const tester = overview?.programs?.tester;
  const promoter = overview?.programs?.promoter;
  const applicationStatus = application?.status;
  const canSubmitReport = applicationStatus === 'approved';
  const isFull = promoter && promoter.active_members >= promoter.capacity;

  const applyTester = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setApplying(true);
    try {
      const response = await api.post('/tester-program/apply', applicationForm);
      setApplication(response.data.application);
      setMessage(response.data.message || 'Application submitted for review.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit the tester application.');
    } finally {
      setApplying(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const response = await api.post('/tester-program/submissions', {
        ...reportForm,
        issue_count: Number(reportForm.issue_count || 0),
      });
      setSubmissions((rows) => [response.data.submission, ...rows]);
      setReportForm({ period: currentPeriod(), app_name: '', test_link: '', feedback_summary: '', issue_count: '0' });
      setMessage(response.data.message || 'Test report submitted for review.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit the test report.');
    } finally {
      setSubmitting(false);
    }
  };

  const signInTarget = useMemo(() => `/login?next=${encodeURIComponent('/community-programs')}`, []);

  if (loading && !overview) {
    return <div className="min-h-screen bg-[#262421] text-white flex items-center justify-center">Loading community opportunities…</div>;
  }

  return (
    <div className="min-h-screen bg-[#262421] text-[#bababa]">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#81b64c]">Ameyem Geo Solutions</p>
          <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">Community opportunities</h1>
          <p className="text-[#d0cecb]">Join a small, accountable programme to test Ameyem games and apps or help new players find Chess99. These are paid community opportunities, not guaranteed employment.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="https://ameyem.com" target="_blank" rel="noreferrer" className="rounded bg-[#81b64c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#739f43]">Create an Ameyem account</a>
            {!user && <Link to={signInTarget} className="rounded border border-[#81b64c] px-4 py-2 text-sm font-semibold text-[#b9dc97] hover:bg-[#81b64c]/10">Sign in to apply</Link>}
          </div>
        </div>

        {error && <div className="mb-5 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        {message && <div className="mb-5 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-lg border border-[#464340] bg-[#312e2b] p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9b9895]">Role 1</p>
            <h2 className="mb-2 text-2xl font-bold text-white">Internal game & app tester</h2>
            <p className="mb-4 text-sm text-[#d0cecb]">Test assigned builds, record what you tried, and submit a link to your report. We review the work each month before any payment is processed.</p>
            <ul className="mb-4 space-y-2 text-sm text-[#bababa]">
              <li>• Use the report link to share notes, screenshots, or a short video.</li>
              <li>• Payment varies by assignment and verified report quality.</li>
              <li>• Ratings and reviews are never required or paid for.</li>
              <li>• Adult-only because this programme collects payout details.</li>
            </ul>
            {tester?.payment_policy && <p className="rounded bg-[#262421] p-3 text-xs text-[#9b9895]">{tester.payment_policy}</p>}
          </section>

          <section className="rounded-lg border border-[#464340] bg-[#312e2b] p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9b9895]">Role 2</p>
            <h2 className="mb-2 text-2xl font-bold text-white">Chess99 community promoter</h2>
            <p className="mb-4 text-sm text-[#d0cecb]">Share your personal Chess99 link with real friends, clubs, schools, or groups. Verified joins and qualifying activity drive the existing referral earnings.</p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded bg-[#262421] p-3"><p className="text-xs text-[#9b9895]">Active seats</p><p className="text-xl font-bold text-white">{promoter ? `${promoter.active_members}/${promoter.capacity}` : '—'}</p></div>
              <div className="rounded bg-[#262421] p-3"><p className="text-xs text-[#9b9895]">Maximum opportunity</p><p className="text-xl font-bold text-[#ffd166]">Up to ₹{Number(promoter?.monthly_max || 5000).toLocaleString('en-IN')}/mo</p></div>
            </div>
            <p className="mb-4 text-xs text-[#9b9895]">Actual monthly earnings depend on verified referrals, activity, refunds, and the programme terms. No payment is made for spam, self-referrals, or incentivised Play Store ratings.</p>
            <Link to="/become-ambassador" className={`inline-flex rounded px-4 py-2 text-sm font-semibold ${isFull ? 'pointer-events-none bg-[#464340] text-[#9b9895]' : 'bg-[#81b64c] text-white hover:bg-[#739f43]'}`}>{isFull ? 'Promoter seats are full' : 'Apply as a promoter'}</Link>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-[#464340] bg-[#312e2b] p-5">
          <h2 className="mb-3 text-xl font-semibold text-white">How the tester role works</h2>
          <div className="grid gap-3 text-sm text-[#d0cecb] md:grid-cols-4">
            <div><span className="mr-2 text-[#81b64c]">1</span>Create an account at <a href="https://ameyem.com" target="_blank" rel="noreferrer" className="text-[#b9dc97] underline">ameyem.com</a>.</div>
            <div><span className="mr-2 text-[#81b64c]">2</span>Sign in here and apply with your WhatsApp and UPI details.</div>
            <div><span className="mr-2 text-[#81b64c]">3</span>Test an assigned game or app on your available device(s).</div>
            <div><span className="mr-2 text-[#81b64c]">4</span>Submit one report link per app/month for review and manual payment processing.</div>
          </div>
        </section>

        {user && !authLoading && (
          <section className="mt-6 rounded-lg border border-[#464340] bg-[#312e2b] p-5">
            <h2 className="mb-2 text-xl font-semibold text-white">Tester workspace</h2>
            {adultGated ? (
              <p className="text-sm text-[#d0cecb]">Tester applications and payouts are available to adults (18+) only. Complete your date of birth in your profile if it is missing.</p>
            ) : (
              <>
                {application && <div className="mb-4 rounded border border-[#464340] bg-[#262421] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>Application status</span><StatusBadge status={application.status} /></div>{application.decline_reason && <p className="mt-2 text-xs text-red-200">Reviewer note: {application.decline_reason}</p>}</div>}

                {!application || application.status === 'rejected' ? (
                  <form onSubmit={applyTester} className="mb-6 grid gap-3 md:grid-cols-2">
                    <label className="text-sm">Full name<input required value={applicationForm.name} onChange={(e) => setApplicationForm({ ...applicationForm, name: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" /></label>
                    <label className="text-sm">Mobile / WhatsApp<input required value={applicationForm.mobile} onChange={(e) => setApplicationForm({ ...applicationForm, mobile: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" placeholder="+91…" /></label>
                    <label className="text-sm">UPI ID for approved payouts<input required value={applicationForm.upi_id} onChange={(e) => setApplicationForm({ ...applicationForm, upi_id: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" placeholder="name@upi" /></label>
                    <label className="text-sm">Why you want to test<textarea value={applicationForm.reason} onChange={(e) => setApplicationForm({ ...applicationForm, reason: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" rows={2} /></label>
                    <label className="flex items-start gap-2 text-xs text-[#bababa] md:col-span-2"><input type="checkbox" required checked={applicationForm.terms_accepted} onChange={(e) => setApplicationForm({ ...applicationForm, terms_accepted: e.target.checked })} className="mt-0.5" />I understand that assignments, report quality, verification, budget, and applicable law determine whether and how much I am paid. I will not submit paid ratings or reviews.</label>
                    <button disabled={applying} className="rounded bg-[#81b64c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{applying ? 'Submitting…' : 'Apply for tester review'}</button>
                  </form>
                ) : application.status === 'pending' ? (
                  <p className="mb-6 text-sm text-[#d0cecb]">Your tester application is in review. Once approved, this area will accept one report per app and month.</p>
                ) : null}

                {canSubmitReport && (
                  <>
                    <form onSubmit={submitReport} className="mb-6 grid gap-3 md:grid-cols-2">
                      <label className="text-sm">Month<input type="month" required value={reportForm.period} onChange={(e) => setReportForm({ ...reportForm, period: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" /></label>
                      <label className="text-sm">Game / app name<input required value={reportForm.app_name} onChange={(e) => setReportForm({ ...reportForm, app_name: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" /></label>
                      <label className="text-sm md:col-span-2">Report link<input required type="url" value={reportForm.test_link} onChange={(e) => setReportForm({ ...reportForm, test_link: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" placeholder="https://…" /></label>
                      <label className="text-sm">Issues found<input type="number" min="0" max="500" value={reportForm.issue_count} onChange={(e) => setReportForm({ ...reportForm, issue_count: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" /></label>
                      <label className="text-sm md:col-span-2">What you tested and learned<textarea required minLength={30} maxLength={4000} value={reportForm.feedback_summary} onChange={(e) => setReportForm({ ...reportForm, feedback_summary: e.target.value })} className="mt-1 w-full rounded border border-[#464340] bg-[#262421] px-3 py-2 text-white" rows={4} placeholder="Devices, flows, bugs, reproduction steps, and suggestions…" /></label>
                      <button disabled={submitting} className="rounded bg-[#81b64c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{submitting ? 'Submitting…' : 'Submit monthly report'}</button>
                    </form>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[#9b9895]"><tr><th className="py-2 pr-3">Month</th><th className="py-2 pr-3">App</th><th className="py-2 pr-3">Status</th><th className="py-2">Payout</th></tr></thead><tbody>{submissions.map((row) => <tr key={row.id} className="border-t border-[#464340]"><td className="py-2 pr-3">{row.period}</td><td className="py-2 pr-3 text-white">{row.app_name}</td><td className="py-2 pr-3"><StatusBadge status={row.status} /></td><td className="py-2">{Number(row.payout_amount) > 0 ? `₹${Number(row.payout_amount).toFixed(2)}` : 'Pending review'}</td></tr>)}</tbody></table></div>
                  </>
                )}
              </>
            )}
          </section>
        )}

        <p className="mt-6 text-xs text-[#7e7b78]">Programme terms: applications are reviewed manually; seats, assignments, payments, and eligibility can change. Keep your own records and never share passwords or OTPs. Questions can be sent through the contact details on <a href="https://ameyem.com" target="_blank" rel="noreferrer" className="text-[#b9dc97] underline">ameyem.com</a>.</p>
      </div>
    </div>
  );
};

export default CommunityPrograms;
