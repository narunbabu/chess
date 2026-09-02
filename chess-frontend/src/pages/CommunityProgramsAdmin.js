import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const statusClass = (status) => ({
  pending: 'text-yellow-200 bg-yellow-500/20',
  approved: 'text-emerald-200 bg-emerald-500/20',
  rejected: 'text-red-200 bg-red-500/20',
  paid: 'text-sky-200 bg-sky-500/20',
}[status] || 'text-[#bababa] bg-[#464340]');

const CommunityProgramsAdmin = () => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [payouts, setPayouts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/admin/community-programs/overview?status=${status}`);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'You do not have access to this queue.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const updateApplication = async (id, action) => {
    setBusy(`application-${id}`);
    try {
      await api.post(`/admin/community-programs/tester-applications/${id}/${action}`, action === 'reject' ? { decline_reason: 'Not selected for this intake.' } : {});
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the application.');
    } finally {
      setBusy(null);
    }
  };

  const reviewSubmission = async (id, nextStatus) => {
    setBusy(`submission-${id}`);
    try {
      await api.post(`/admin/community-programs/tester-submissions/${id}/review`, {
        status: nextStatus,
        payout_amount: Number(payouts[id] || 0),
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the report.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#262421] text-[#bababa]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-wider text-[#81b64c]">Ameyem Geo Solutions</p><h1 className="text-3xl font-bold text-white">Community programme queue</h1></div>
          <Link to="/community-programs" className="text-sm text-[#b9dc97] underline">View applicant page</Link>
        </div>
        {error && <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded bg-[#312e2b] p-4"><p className="text-xs text-[#9b9895]">Promoter seats</p><p className="text-2xl font-bold text-white">{data?.promoter ? `${data.promoter.active_members}/${data.promoter.capacity}` : '—'}</p><p className="text-xs text-[#9b9895]">Up to ₹{Number(data?.promoter?.monthly_max || 5000).toLocaleString('en-IN')}/member/month</p></div>
          <div className="rounded bg-[#312e2b] p-4"><p className="text-xs text-[#9b9895]">Tester applications</p><p className="text-2xl font-bold text-white">{data?.applications?.length ?? '—'}</p></div>
          <div className="rounded bg-[#312e2b] p-4"><p className="text-xs text-[#9b9895]">Tester reports</p><p className="text-2xl font-bold text-white">{data?.submissions?.length ?? '—'}</p></div>
        </div>
        <div className="mb-5 flex gap-2 border-b border-[#464340] pb-2">{['pending', 'approved', 'rejected', 'paid', 'all'].map((value) => <button key={value} onClick={() => setStatus(value)} className={`rounded px-3 py-1.5 text-sm ${status === value ? 'bg-[#81b64c] text-white' : 'bg-[#312e2b] text-[#bababa]'}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div>
        {loading ? <p>Loading queue…</p> : (
          <>
            <section className="mb-6 rounded-lg bg-[#312e2b] p-4">
              <h2 className="mb-3 text-lg font-semibold text-white">Tester applications</h2>
              {data?.applications?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[#9b9895]"><tr><th className="py-2 pr-3">Applicant</th><th className="py-2 pr-3">Contact</th><th className="py-2 pr-3">Reason</th><th className="py-2 pr-3">Status</th><th className="py-2">Action</th></tr></thead><tbody>{data.applications.map((row) => <tr key={row.id} className="border-t border-[#464340]"><td className="py-2 pr-3 text-white">{row.name}<div className="text-xs text-[#9b9895]">{row.user?.email}</div></td><td className="py-2 pr-3">{row.mobile}<div className="text-xs text-[#9b9895]">{row.upi_id}</div></td><td className="max-w-sm py-2 pr-3 text-xs">{row.reason || '—'}</td><td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span></td><td className="py-2">{row.status === 'pending' && <div className="flex gap-2"><button disabled={busy === `application-${row.id}`} onClick={() => updateApplication(row.id, 'approve')} className="rounded bg-[#81b64c] px-2 py-1 text-xs text-white">Approve</button><button disabled={busy === `application-${row.id}`} onClick={() => updateApplication(row.id, 'reject')} className="rounded bg-red-700/70 px-2 py-1 text-xs text-white">Reject</button></div>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[#9b9895]">No applications in this view.</p>}
            </section>
            <section className="rounded-lg bg-[#312e2b] p-4">
              <h2 className="mb-3 text-lg font-semibold text-white">Monthly test reports</h2>
              {data?.submissions?.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[#9b9895]"><tr><th className="py-2 pr-3">Tester</th><th className="py-2 pr-3">Period / app</th><th className="py-2 pr-3">Report</th><th className="py-2 pr-3">Payout</th><th className="py-2">Action</th></tr></thead><tbody>{data.submissions.map((row) => <tr key={row.id} className="border-t border-[#464340] align-top"><td className="py-2 pr-3 text-white">{row.user?.name}<div className="text-xs text-[#9b9895]">{row.user?.email}</div></td><td className="py-2 pr-3">{row.period}<div className="text-white">{row.app_name}</div><div className="text-xs">{row.issue_count} issue(s)</div></td><td className="max-w-md py-2 pr-3 text-xs"><a href={row.test_link} target="_blank" rel="noreferrer" className="text-[#b9dc97] underline">Open submitted link</a><p className="mt-1 whitespace-pre-wrap">{row.feedback_summary}</p></td><td className="py-2 pr-3"><input type="number" min="0" max="5000" step="0.01" value={payouts[row.id] ?? row.payout_amount ?? ''} onChange={(e) => setPayouts({ ...payouts, [row.id]: e.target.value })} className="w-28 rounded border border-[#464340] bg-[#262421] px-2 py-1 text-white" placeholder="₹" /></td><td className="py-2">{row.status === 'pending' ? <div className="flex flex-col gap-2"><button disabled={busy === `submission-${row.id}`} onClick={() => reviewSubmission(row.id, 'approved')} className="rounded bg-[#81b64c] px-2 py-1 text-xs text-white">Approve amount</button><button disabled={busy === `submission-${row.id}`} onClick={() => reviewSubmission(row.id, 'rejected')} className="rounded bg-red-700/70 px-2 py-1 text-xs text-white">Reject</button></div> : row.status === 'approved' ? <button disabled={busy === `submission-${row.id}`} onClick={() => reviewSubmission(row.id, 'paid')} className="rounded bg-sky-700/70 px-2 py-1 text-xs text-white">Mark paid</button> : <span className={`rounded px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[#9b9895]">No reports in this view.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default CommunityProgramsAdmin;
