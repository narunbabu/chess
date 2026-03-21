import React, { useState, useEffect, useCallback } from 'react';
import { BASE_URL } from '../config';

const REFRESH_INTERVAL = 10000; // 10 seconds

const SystemStatusPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const reverbColor = data?.reverb?.status === 'connected' ? '#4caf50' : '#f44336';
  const dbColor = data?.status === 'healthy' ? '#4caf50' : '#ff9800';

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>System Status</h1>
        <p style={styles.subtitle}>
          Auto-refreshes every {REFRESH_INTERVAL / 1000}s
          {lastFetched && (
            <span style={styles.lastFetched}>
              {' '}| Last: {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </p>

        {error && (
          <div style={styles.errorBanner}>
            Failed to fetch status: {error}
          </div>
        )}

        {data && (
          <>
            {/* ── Health Indicators ──────────────────────────────── */}
            <div style={styles.cardRow}>
              <StatusCard
                label="Database"
                value={data.status}
                color={dbColor}
                icon="DB"
              />
              <StatusCard
                label="Reverb WebSocket"
                value={data.reverb.status}
                color={reverbColor}
                icon="WS"
                detail={`${data.reverb.host}:${data.reverb.port}`}
                error={data.reverb.error}
              />
            </div>

            {/* ── Players & Games ────────────────────────────────── */}
            <div style={styles.cardRow}>
              <MetricCard
                label="Online Players"
                primary={data.players.strongly_online}
                secondary={`+${data.players.recently_active - data.players.strongly_online} recently active`}
                icon="&#9823;"
              />
              <MetricCard
                label="Active Games"
                primary={data.games.active_total}
                secondary={`${data.games.active_human} human | ${data.games.active_computer} vs computer`}
                icon="&#9812;"
              />
              <MetricCard
                label="Matchmaking"
                primary={data.matchmaking.currently_searching}
                secondary={`${data.matchmaking.pending_smart_matches} smart match pending`}
                icon="&#128269;"
              />
            </div>

            {/* ── Online Player Details ──────────────────────────── */}
            {data.players.online_details.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Online Players</h2>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>User ID</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Socket</th>
                      <th style={styles.th}>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.online_details.map((p, i) => (
                      <tr key={i} style={styles.tr}>
                        <td style={styles.td}>{p.user_id}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, backgroundColor: p.status === 'online' ? '#4caf50' : '#ff9800' }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={styles.td}>{p.has_socket ? 'Yes' : 'No'}</td>
                        <td style={styles.td}>{formatTime(p.last_activity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Recent Smart Matches ──────────────────────────── */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Recent Smart Matches</h2>
              {data.recent_smart_matches.length === 0 ? (
                <p style={styles.empty}>No recent smart match attempts</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Requester</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Targets</th>
                      <th style={styles.th}>Accepted</th>
                      <th style={styles.th}>Declined</th>
                      <th style={styles.th}>Game</th>
                      <th style={styles.th}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_smart_matches.slice(0, 5).map((m, i) => (
                      <tr key={i} style={styles.tr}>
                        <td style={styles.td}>{m.requester}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, backgroundColor: statusColor(m.status) }}>
                            {m.status}
                          </span>
                        </td>
                        <td style={styles.td}>{m.targets_count}</td>
                        <td style={styles.td}>{m.accepted_targets}</td>
                        <td style={styles.td}>{m.declined_targets}</td>
                        <td style={styles.td}>{m.game_id || '—'}</td>
                        <td style={styles.td}>{m.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Recent Queue Matches ─────────────────────────── */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Recent Queue Matches</h2>
              {data.recent_queue_matches.length === 0 ? (
                <p style={styles.empty}>No recent queue matches</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>User</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Game ID</th>
                      <th style={styles.th}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_queue_matches.slice(0, 5).map((m, i) => (
                      <tr key={i} style={styles.tr}>
                        <td style={styles.td}>#{m.user_id}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: m.match_type === 'human' ? '#4caf50' : '#ff9800',
                          }}>
                            {m.match_type}
                          </span>
                        </td>
                        <td style={styles.td}>{m.game_id}</td>
                        <td style={styles.td}>{m.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Server Time ─────────────────────────────────── */}
            <p style={styles.serverTime}>
              Server time: {data.server_time}
            </p>
          </>
        )}

        {!data && !error && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <p>Loading status...</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Helper Components ────────────────────────────────────────────────

const StatusCard = ({ label, value, color, icon, detail, error: err }) => (
  <div style={styles.card}>
    <div style={{ ...styles.cardIcon, backgroundColor: color }}>{icon}</div>
    <div>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
      {detail && <div style={styles.cardDetail}>{detail}</div>}
      {err && <div style={styles.cardError}>{err}</div>}
    </div>
  </div>
);

const MetricCard = ({ label, primary, secondary, icon }) => (
  <div style={styles.card}>
    <div style={styles.metricIcon} dangerouslySetInnerHTML={{ __html: icon }} />
    <div>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.metricValue}>{primary}</div>
      <div style={styles.cardDetail}>{secondary}</div>
    </div>
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────────

function statusColor(status) {
  switch (status) {
    case 'accepted': return '#4caf50';
    case 'expired': return '#f44336';
    case 'cancelled': return '#ff9800';
    case 'searching': return '#2196f3';
    default: return '#757575';
  }
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#1a1a18',
    color: '#e0e0e0',
    padding: '24px',
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#81b64c',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#8b8987',
    marginBottom: '24px',
  },
  lastFetched: {
    color: '#6b6966',
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    border: '1px solid #f44336',
    color: '#f44336',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  cardRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  card: {
    flex: '1 1 200px',
    backgroundColor: '#2e2c2a',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #3a3836',
  },
  cardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 0,
  },
  metricIcon: {
    fontSize: '32px',
    flexShrink: 0,
    width: '40px',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: '12px',
    color: '#8b8987',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  metricValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#81b64c',
  },
  cardDetail: {
    fontSize: '12px',
    color: '#6b6966',
    marginTop: '2px',
  },
  cardError: {
    fontSize: '11px',
    color: '#f44336',
    marginTop: '2px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#bababa',
    marginBottom: '12px',
    borderBottom: '1px solid #3a3836',
    paddingBottom: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid #3a3836',
    color: '#8b8987',
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tr: {
    borderBottom: '1px solid #2a2826',
  },
  td: {
    padding: '8px 12px',
    color: '#bababa',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#fff',
  },
  empty: {
    color: '#6b6966',
    fontStyle: 'italic',
    fontSize: '14px',
  },
  serverTime: {
    fontSize: '12px',
    color: '#6b6966',
    textAlign: 'right',
    marginTop: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#8b8987',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #3a3836',
    borderTop: '3px solid #81b64c',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
};

export default SystemStatusPage;
