import React, { useState, useEffect } from 'react';
import { BASE_URL } from '../config';

const CHECKS = [
  {
    key: 'frontend',
    label: 'Frontend',
    test: () => fetch(window.location.origin, { method: 'HEAD' }).then(r => r.ok),
  },
  {
    key: 'api',
    label: 'API (Laravel)',
    test: () => fetch(`${BASE_URL}/api/v1/health`).then(r => r.json()).then(d => d),
  },
];

export default function HealthPage() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState(null);

  const runChecks = async () => {
    setLoading(true);
    const r = {};
    for (const check of CHECKS) {
      const start = performance.now();
      try {
        const data = await check.test();
        const ms = Math.round(performance.now() - start);
        r[check.key] = { ok: true, ms, data, error: null };
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        r[check.key] = { ok: false, ms, data: null, error: err.message };
      }
    }
    setResults(r);
    setLastRun(new Date());
    setLoading(false);
  };

  useEffect(() => { runChecks(); }, []);

  const apiData = results.api?.data;
  const dbOk = apiData?.status === 'healthy';
  const allOk = results.frontend?.ok && results.api?.ok && dbOk;
  const upSince = document.querySelector('meta[name="build-time"]')?.content;

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div style={s.logo}>♚</div>
          <div>
            <h1 style={s.title}>Chess99 Health</h1>
            <p style={s.sub}>
              {lastRun
                ? `Last check: ${lastRun.toLocaleTimeString()}`
                : 'Running checks...'}
            </p>
          </div>
        </div>

        {/* ── Overall banner ─────────────────────────────────── */}
        <div style={{
          ...s.banner,
          backgroundColor: allOk ? 'rgba(129,182,76,0.12)' : loading ? 'rgba(100,100,100,0.12)' : 'rgba(244,67,54,0.12)',
          borderColor: allOk ? '#81b64c' : loading ? '#666' : '#f44336',
        }}>
          <span style={{
            ...s.dot,
            backgroundColor: allOk ? '#4caf50' : loading ? '#888' : '#f44336',
          }} />
          <span style={{ color: allOk ? '#81b64c' : loading ? '#999' : '#f44336', fontWeight: 700, fontSize: '18px' }}>
            {loading ? 'Checking...' : allOk ? 'All Systems Operational' : 'Issues Detected'}
          </span>
        </div>

        {/* ── Check cards ────────────────────────────────────── */}
        <div style={s.grid}>
          {CHECKS.map(check => {
            const r = results[check.key];
            return (
              <div key={check.key} style={s.card}>
                <div style={s.cardHead}>
                  <span style={{
                    ...s.dot,
                    backgroundColor: r?.ok ? '#4caf50' : r?.ok === false ? '#f44336' : '#555',
                  }} />
                  <span style={s.cardLabel}>{check.label}</span>
                  {r?.ms != null && <span style={s.ms}>{r.ms}ms</span>}
                </div>
                {r?.error && <div style={s.cardError}>{r.error}</div>}
                {check.key === 'api' && r?.data && (
                  <div style={s.cardDetails}>
                    <Detail label="Status" value={apiData.status} color={dbOk ? '#4caf50' : '#f44336'} />
                    <Detail label="API Version" value={apiData.api_version} />
                    <Detail label="Server Time" value={apiData.server_time?.replace('T', ' ').slice(0, 19)} />
                    {apiData.features && Object.entries(apiData.features).map(([k, v]) => (
                      <Detail key={k} label={k.replace(/_/g, ' ')} value={v ? 'Enabled' : 'Disabled'} color={v ? '#4caf50' : '#f44336'} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Actions ────────────────────────────────────────── */}
        <div style={s.actions}>
          <button onClick={runChecks} disabled={loading} style={{
            ...s.btn,
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}>
            {loading ? 'Checking...' : 'Re-check'}
          </button>
          <a href="/system-status" style={{ ...s.btn, backgroundColor: '#2e2c2a', color: '#bababa', textDecoration: 'none', borderColor: '#3a3836' }}>
            Detailed Status →
          </a>
        </div>

        <p style={s.footer}>chess99.com health check • <a href="/" style={s.link}>Home</a></p>
      </div>
    </div>
  );
}

function Detail({ label, value, color }) {
  return (
    <div style={s.detail}>
      <span style={s.detailLabel}>{label}</span>
      <span style={{ ...s.detailValue, color: color || '#bababa' }}>{String(value)}</span>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', backgroundColor: '#1a1a18', color: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  container: { maxWidth: '520px', width: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
  logo: { fontSize: '36px', color: '#81b64c' },
  title: { fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: 0 },
  sub: { fontSize: '13px', color: '#6b6966', margin: '2px 0 0' },
  banner: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 18px', borderRadius: '10px',
    border: '1px solid', marginBottom: '20px',
  },
  dot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  grid: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' },
  card: { backgroundColor: '#2e2c2a', borderRadius: '10px', padding: '16px', border: '1px solid #3a3836' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' },
  cardLabel: { fontWeight: 600, fontSize: '15px' },
  ms: { marginLeft: 'auto', fontSize: '12px', color: '#6b6966' },
  cardError: { fontSize: '13px', color: '#f44336', marginTop: '6px' },
  cardDetails: { marginTop: '10px', borderTop: '1px solid #3a3836', paddingTop: '10px' },
  detail: { display: 'flex', justifyContent: 'space-between', padding: '3px 0' },
  detailLabel: { fontSize: '13px', color: '#8b8987', textTransform: 'capitalize' },
  detailValue: { fontSize: '13px', fontWeight: 500 },
  actions: { display: 'flex', gap: '10px', marginBottom: '24px' },
  btn: {
    padding: '10px 20px', borderRadius: '8px', border: '1px solid #3a3836',
    backgroundColor: '#81b64c', color: '#fff', fontWeight: 600, fontSize: '14px',
    textAlign: 'center', display: 'inline-flex', alignItems: 'center',
  },
  footer: { textAlign: 'center', fontSize: '12px', color: '#6b6966' },
  link: { color: '#81b64c', textDecoration: 'none' },
};
