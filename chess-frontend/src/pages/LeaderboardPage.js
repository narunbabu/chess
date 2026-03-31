import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BACKEND_URL } from '../config';
import { waitForImagesToLoad } from '../utils/imageUtils';
import { getEcho } from '../services/echoSingleton';

// Share URLs
const SHARE_URLS = {
  whatsapp: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  twitter: (text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://chess99.com/leaderboard')}`,
  facebook: (text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://chess99.com/leaderboard')}&quote=${encodeURIComponent(text)}`,
};

const SHARE_TEMPLATES = {
  most_games: [
    "{value} games strong! Can you match {name}'s dedication on Chess99?",
    "{name} has played {value} games on Chess99! That's commitment. Join the battle!",
    "Legend alert: {name} with {value} games on Chess99. Think you can keep up?",
  ],
  most_wins: [
    "Checkmate! {name} has {value} victories on Chess99. Challenge them!",
    "{value} wins! {name} is dominating Chess99. Dare to take them on?",
    "Victory machine: {name} with {value} wins on Chess99. Can you stop them?",
  ],
  highest_points: [
    "{name} scored {value} points on Chess99! Can you beat that?",
    "{value} points! {name} is a scoring machine on Chess99.",
    "Point monster: {name} racked up {value} points. Join Chess99 and compete!",
  ],
  by_rating: [
    "Rated {value}! {name} is a force on Chess99. Dare to challenge?",
    "{name} hit a {value} rating on Chess99! Think you can climb higher?",
    "Rating royalty: {name} at {value} on Chess99. The board awaits your challenge!",
  ],
};

const CATEGORIES = [
  { key: 'most_games', label: 'Most Games', icon: '🎮', valueLabel: 'Games' },
  { key: 'most_wins', label: 'Most Wins', icon: '🏆', valueLabel: 'Wins' },
  { key: 'highest_points', label: 'Highest Points', icon: '⭐', valueLabel: 'Points' },
  { key: 'by_rating', label: 'By Rating', icon: '📊', valueLabel: 'Rating' },
];

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'all', label: 'All Time' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_EMOJIS = ['👑', '🥈', '🥉'];
const MEDAL_LABELS = ['1st', '2nd', '3rd'];

const INVITE_MESSAGES = [
  "Think you've got what it takes? Chess99 players are battling it out right now. Join free and claim your spot on the leaderboard!",
  "The kings and queens of Chess99 have been crowned. Can you dethrone them? Play free at chess99.com!",
  "Real players. Real ratings. Real competition. See where you rank on Chess99 — join the battle for free!",
];

const getInviteMessage = () => INVITE_MESSAGES[Math.floor(Math.random() * INVITE_MESSAGES.length)];

// Generate initials-based data URL fallback for when CORS blocks avatar loading
const generateInitialsAvatar = (name, size = 80) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = (name || 'P').split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('');
  ctx.fillText(initials, size / 2, size / 2);
  return canvas.toDataURL();
};

// Convert images to data URLs with initials fallback for CORS-blocked avatars
const convertCardImages = async (cardEl) => {
  const images = Array.from(cardEl.querySelectorAll('img'));
  await Promise.all(images.map(async (img) => {
    if (img.src.startsWith('data:')) return;
    try {
      // Try loading with CORS
      const dataUrl = await new Promise((resolve, reject) => {
        const testImg = new Image();
        testImg.crossOrigin = 'anonymous';
        testImg.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = testImg.naturalWidth || testImg.width;
            c.height = testImg.naturalHeight || testImg.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(testImg, 0, 0);
            resolve(c.toDataURL('image/jpeg', 0.8));
          } catch { reject(new Error('Canvas tainted')); }
        };
        testImg.onerror = () => reject(new Error('Load failed'));
        setTimeout(() => reject(new Error('Timeout')), 5000);
        testImg.src = img.src;
      });
      img.src = dataUrl;
    } catch {
      // CORS blocked or failed — use initials avatar
      img.src = generateInitialsAvatar(img.alt || 'Player');
    }
  }));
};

// ─── Capture a ref'd element to blob + file using html2canvas ───
const captureCardToBlob = async (cardEl) => {
  await waitForImagesToLoad(cardEl);
  await convertCardImages(cardEl);
  await new Promise(r => setTimeout(r, 200));

  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(cardEl, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    allowTaint: true, // allow tainted canvas since we already converted images
    logging: false,
    foreignObjectRendering: false,
    removeContainer: true,
    imageTimeout: 10000,
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Failed to create image');
  return blob;
};

// Helper: download blob as file
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Helper: try native share, return true if succeeded
const tryNativeShare = async (blob, text, filename) => {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: 'Chess99 Leaderboard', text, files: [file] });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return true; // user cancelled, still "handled"
    }
  }
  return false;
};

// ─── Single-player share card (hidden, captured by html2canvas) ───
const LeaderboardShareCard = React.forwardRef(({ entry, category, period }, ref) => {
  const catInfo = CATEGORIES.find(c => c.key === category);
  const periodLabel = PERIODS.find(p => p.key === period)?.label || period;
  const isMedal = entry.rank <= 3;
  const medalIdx = entry.rank - 1;
  const displayValue = category === 'highest_points' ? Math.round(entry.value) : entry.value;

  const gradients = {
    most_games: 'linear-gradient(145deg, #1a3a5c 0%, #2d5a8a 40%, #3d7ab5 100%)',
    most_wins: 'linear-gradient(145deg, #1a5c1a 0%, #2d8a2d 40%, #3da53d 100%)',
    highest_points: 'linear-gradient(145deg, #5c4a1a 0%, #8a6e2d 40%, #b5923d 100%)',
    by_rating: 'linear-gradient(145deg, #2d1b69 0%, #4a2d8a 40%, #6b3fa0 100%)',
  };

  return (
    <div ref={ref} style={{ position: 'fixed', left: -9999, top: -9999, width: 360, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: gradients[category], borderRadius: 24, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: '28px 24px 24px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>♛</span>
          <span style={{ fontSize: 24, fontWeight: 800, marginLeft: 6, color: '#FFD700', letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(255,215,0,0.3)' }}>Chess99.com</span>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600 }}>
            {catInfo?.icon} {catInfo?.label} — {category === 'by_rating' ? 'All Time' : periodLabel}
          </span>
        </div>
        {/* Player card — vertical layout for full name display */}
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 16, padding: '20px', textAlign: 'center', border: isMedal ? `2px solid ${MEDAL_COLORS[medalIdx]}40` : '1px solid rgba(255,255,255,0.1)' }}>
          {/* Rank badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMedal ? `linear-gradient(135deg, ${MEDAL_COLORS[medalIdx]}, ${MEDAL_COLORS[medalIdx]}90)` : 'rgba(255,255,255,0.12)', border: isMedal ? `2px solid ${MEDAL_COLORS[medalIdx]}` : '2px solid rgba(255,255,255,0.2)', boxShadow: isMedal ? `0 4px 16px ${MEDAL_COLORS[medalIdx]}40` : 'none' }}>
              <span style={{ fontSize: isMedal ? 15 : 18, fontWeight: 800, color: isMedal ? '#1a1a18' : 'rgba(255,255,255,0.7)' }}>
                {isMedal ? MEDAL_LABELS[medalIdx] : `#${entry.rank}`}
              </span>
            </div>
          </div>
          {/* Avatar — large, centered */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
            <img src={entry.avatar_url || `https://i.pravatar.cc/120?u=${entry.user_id}`} alt={entry.name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: isMedal ? `3px solid ${MEDAL_COLORS[medalIdx]}` : '3px solid rgba(255,255,255,0.3)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }} />
            {isMedal && <div style={{ position: 'absolute', top: -4, right: 'calc(50% - 48px)', fontSize: 22, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>{MEDAL_EMOJIS[medalIdx]}</div>}
          </div>
          {/* Name — full, wrapping */}
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, textShadow: '0 1px 4px rgba(0,0,0,0.3)', wordBreak: 'break-word' }}>{entry.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>Rating: {entry.rating}</div>
          {/* Big stat */}
          <div style={{ color: '#FFD700', fontSize: 44, fontWeight: 800, lineHeight: 1, textShadow: '0 2px 12px rgba(255,215,0,0.3)' }}>{displayValue}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{catInfo?.valueLabel}</div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
          Think you can beat this? Join the battle at <span style={{ color: '#FFD700' }}>chess99.com</span>
        </div>
      </div>
    </div>
  );
});
LeaderboardShareCard.displayName = 'LeaderboardShareCard';

// ─── Overview card for "Share & Invite" (shows top 5 players) ───
const LeaderboardOverviewCard = React.forwardRef(({ entries, category, period }, ref) => {
  const catInfo = CATEGORIES.find(c => c.key === category);
  const periodLabel = PERIODS.find(p => p.key === period)?.label || period;
  const top5 = (entries || []).slice(0, 5);

  return (
    <div ref={ref} style={{ position: 'fixed', left: -9999, top: -9999, width: 360, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: 'linear-gradient(145deg, #1a2a1a 0%, #2a4a2a 50%, #1a3a1a 100%)', borderRadius: 24, overflow: 'hidden', border: '2px solid rgba(129,182,76,0.3)' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(129,182,76,0.08)' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(129,182,76,0.05)' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: '24px 20px 20px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>♛</span>
          <span style={{ fontSize: 22, fontWeight: 800, marginLeft: 6, color: '#FFD700', textShadow: '0 2px 8px rgba(255,215,0,0.3)' }}>Chess99.com</span>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Leaderboard</span>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>
            {catInfo?.icon} {catInfo?.label} — {category === 'by_rating' ? 'All Time' : periodLabel}
          </span>
        </div>

        {/* Top 5 rows — taller, names wrap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {top5.map((entry, idx) => {
            const isMedal = idx < 3;
            const displayValue = category === 'highest_points' ? Math.round(entry.value) : entry.value;
            return (
              <div key={entry.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isMedal ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)', borderRadius: 12, borderLeft: isMedal ? `3px solid ${MEDAL_COLORS[idx]}` : '3px solid transparent' }}>
                <span style={{ width: 26, textAlign: 'center', fontSize: isMedal ? 20 : 14, fontWeight: 700, color: isMedal ? MEDAL_COLORS[idx] : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                  {isMedal ? MEDAL_EMOJIS[idx] : `#${idx + 1}`}
                </span>
                <img src={entry.avatar_url || `https://i.pravatar.cc/80?u=${entry.user_id}`} alt={entry.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: isMedal ? `2px solid ${MEDAL_COLORS[idx]}` : '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>{entry.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>Rating: {entry.rating}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#FFD700', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{displayValue}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2, textTransform: 'uppercase' }}>{catInfo?.valueLabel}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(129,182,76,0.2)', border: '1px solid rgba(129,182,76,0.3)' }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Can you make it to the top?</div>
          <div style={{ color: '#81b64c', fontSize: 13, fontWeight: 600, marginTop: 3 }}>Play free at chess99.com</div>
        </div>
      </div>
    </div>
  );
});
LeaderboardOverviewCard.displayName = 'LeaderboardOverviewCard';

// ══════════════════════════════════════════════════════════
const LeaderboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [category, setCategory] = useState('most_games');
  const [lastFetched, setLastFetched] = useState(null);

  // Share state
  const [shareEntry, setShareEntry] = useState(null);       // single-player card
  const [shareOverview, setShareOverview] = useState(false); // overview card
  const [isCapturing, setIsCapturing] = useState(false);
  const [shareModal, setShareModal] = useState(null);        // { imageUrl, text }
  const shareCardRef = useRef(null);
  const overviewCardRef = useRef(null);

  // ─── Data fetching ───
  const fetchLeaderboard = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${BACKEND_URL}/leaderboard?period=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(period); }, [period, fetchLeaderboard]);

  // Auto-refresh when any game ends (listen on public lobby channel)
  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel('lobby');
    const handler = () => {
      console.log('[Leaderboard] Game ended — auto-refreshing');
      fetchLeaderboard(period);
    };
    channel.listen('.game.ended', handler);

    return () => {
      try {
        channel.stopListening('.game.ended', handler);
        echo.leave('lobby');
      } catch { /* ok */ }
    };
  }, [period, fetchLeaderboard]);

  const entries = useMemo(() => data?.[category] || [], [data, category]);

  const handlePeriodChange = (p) => { if (category !== 'by_rating') setPeriod(p); };

  const getShareText = (entry) => {
    const templates = SHARE_TEMPLATES[category];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const value = category === 'highest_points' ? Math.round(entry.value) : entry.value;
    return template.replace('{name}', entry.name).replace('{value}', value);
  };

  // ─── Unified share flow: capture image → native share or modal ───
  const doShare = async (cardEl, text) => {
    const blob = await captureCardToBlob(cardEl);
    const filename = `chess99-leaderboard-${Date.now()}.jpg`;

    // Copy text to clipboard
    try { await navigator.clipboard.writeText(text); } catch { /* ok */ }

    // Try native share (mobile — sends image + text together)
    const handled = await tryNativeShare(blob, text, filename);
    if (handled) return;

    // Desktop fallback: show modal with image preview + social buttons
    const imageUrl = URL.createObjectURL(blob);
    setShareModal({ imageUrl, text, blob, filename });
  };

  // ─── Per-row share: capture single-player card ───
  const handleSharePlayer = (entry) => {
    if (isCapturing) return;
    setShareEntry(entry);
    setIsCapturing(true);
  };

  useEffect(() => {
    if (!shareEntry || !isCapturing) return;
    const run = async () => {
      await new Promise(r => setTimeout(r, 400));
      const cardEl = shareCardRef.current;
      if (!cardEl) { setIsCapturing(false); setShareEntry(null); return; }
      try {
        const text = getShareText(shareEntry) + '\n\n♟️ Play free at https://chess99.com/leaderboard';
        await doShare(cardEl, text);
      } catch (err) {
        console.error('Share capture failed:', err);
        alert('Failed to create share card. Please try again.');
      } finally {
        setIsCapturing(false);
        setShareEntry(null);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareEntry, isCapturing]);

  // ─── Invite share: capture overview card with top 5 ───
  const handleShareInvite = () => {
    if (isCapturing || entries.length === 0) return;
    setShareOverview(true);
    setIsCapturing(true);
  };

  useEffect(() => {
    if (!shareOverview || !isCapturing) return;
    const run = async () => {
      await new Promise(r => setTimeout(r, 400));
      const cardEl = overviewCardRef.current;
      if (!cardEl) { setIsCapturing(false); setShareOverview(false); return; }
      try {
        const text = getInviteMessage() + '\n\n♟️ https://chess99.com/leaderboard';
        await doShare(cardEl, text);
      } catch (err) {
        console.error('Overview capture failed:', err);
        alert('Failed to create share card. Please try again.');
      } finally {
        setIsCapturing(false);
        setShareOverview(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOverview, isCapturing]);

  // ─── Modal actions ───
  const handleModalSocialShare = (platform) => {
    if (!shareModal) return;
    // Auto-download image so user can attach it
    downloadBlob(shareModal.blob, shareModal.filename);
    // Open social platform with text
    const url = SHARE_URLS[platform](shareModal.text);
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const handleModalDownload = () => {
    if (!shareModal) return;
    downloadBlob(shareModal.blob, shareModal.filename);
  };

  const handleModalNativeShare = async () => {
    if (!shareModal) return;
    const handled = await tryNativeShare(shareModal.blob, shareModal.text, shareModal.filename);
    if (handled) { closeShareModal(); return; }
    // Desktop: download + WhatsApp
    downloadBlob(shareModal.blob, shareModal.filename);
    window.open(SHARE_URLS.whatsapp(shareModal.text), '_blank');
  };

  const closeShareModal = () => {
    if (shareModal?.imageUrl) URL.revokeObjectURL(shareModal.imageUrl);
    setShareModal(null);
  };

  const emptyMessages = {
    today: "No games today yet. Be the first to play!",
    '7d': "No activity this week. Start a game!",
    '30d': "No activity this month. Time to play!",
    all: "No games played yet. Be the pioneer!",
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Hidden share cards (offscreen, for html2canvas capture) */}
        {shareEntry && <LeaderboardShareCard ref={shareCardRef} entry={shareEntry} category={category} period={period} />}
        {shareOverview && <LeaderboardOverviewCard ref={overviewCardRef} entries={entries} category={category} period={period} />}

        <div style={S.titleRow}>
          <h1 style={S.title}>Leaderboard</h1>
          <button
            onClick={() => fetchLeaderboard(period)}
            disabled={loading}
            style={{ ...S.refreshBtn, ...(loading ? { opacity: 0.5 } : {}) }}
            title="Refresh leaderboard"
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
        {lastFetched && !loading && (
          <p style={S.lastFetched}>Updated {lastFetched.toLocaleTimeString()}</p>
        )}

        {/* ─── Invite Banner ─── */}
        <div style={S.inviteBanner}>
          <div style={S.inviteContent}>
            <span style={S.inviteEmoji}>♚</span>
            <div>
              <div style={S.inviteHeadline}>Challenge your friends!</div>
              <div style={S.inviteSubtext}>Share the leaderboard card and invite them to compete</div>
            </div>
          </div>
          <button onClick={handleShareInvite} disabled={isCapturing || entries.length === 0 || loading} style={{ ...S.inviteBtn, ...((isCapturing || loading) ? { opacity: 0.6 } : {}) }}>
            {isCapturing && shareOverview ? '⏳ Creating...' : '📤 Share Card'}
          </button>
        </div>

        {/* ─── Period tabs ─── */}
        <div style={S.periodRow}>
          {PERIODS.map((p) => {
            const disabled = category === 'by_rating';
            const active = period === p.key && !disabled;
            return (
              <button key={p.key} onClick={() => handlePeriodChange(p.key)} disabled={disabled} style={{ ...S.periodBtn, ...(active ? S.periodBtnActive : {}), ...(disabled ? S.periodBtnDisabled : {}) }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* ─── Category tabs ─── */}
        <div style={S.categoryRow}>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{ ...S.categoryBtn, ...(category === c.key ? S.categoryBtnActive : {}) }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {category === 'by_rating' && <p style={S.ratingNote}>Rating leaderboard shows current standings (min. 5 games played)</p>}

        {/* ─── Content ─── */}
        {loading ? (
          <div style={S.loader}><div style={S.spinner} /><p style={{ color: '#bababa', marginTop: 12 }}>Loading...</p></div>
        ) : error ? (
          <div style={S.errorBox}><p>Failed to load: {error}</p><button onClick={() => fetchLeaderboard(period)} style={S.retryBtn}>Retry</button></div>
        ) : entries.length === 0 ? (
          <div style={S.emptyState}><span style={{ fontSize: 48 }}>♟️</span><p style={{ color: '#bababa', marginTop: 12 }}>{emptyMessages[period]}</p></div>
        ) : (
          <div style={S.list}>
            {entries.map((entry, index) => {
              const isMe = user && user.id === entry.user_id;
              const isMedal = index < 3;
              const valueLabel = CATEGORIES.find(c => c.key === category)?.valueLabel || 'Value';
              return (
                <div key={entry.user_id} style={{ ...S.row, ...(isMe ? S.rowHighlight : {}), ...(isMedal ? { borderLeft: `3px solid ${MEDAL_COLORS[index]}` } : {}) }}>
                  <div style={S.rankCol}>
                    {isMedal
                      ? <span style={{ fontSize: 22, color: MEDAL_COLORS[index] }}>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                      : <span style={S.rankNum}>{entry.rank}</span>
                    }
                  </div>
                  <div style={S.playerCol}>
                    <img src={entry.avatar_url || `https://i.pravatar.cc/40?u=${entry.user_id}`} alt={entry.name} style={S.avatar} onError={(e) => { if (!e.target.src.includes('pravatar.cc')) e.target.src = `https://i.pravatar.cc/40?u=${entry.user_id}`; }} />
                    <div>
                      <span style={S.playerName}>{entry.name}{isMe && <span style={S.youBadge}>You</span>}</span>
                      <span style={S.playerRating}>Rating: {entry.rating}</span>
                    </div>
                  </div>
                  <div style={S.valueCol}>
                    <span style={S.valueNum}>{category === 'highest_points' ? Math.round(entry.value) : entry.value}</span>
                    <span style={S.valueLbl}>{valueLabel}</span>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button onClick={() => handleSharePlayer(entry)} disabled={isCapturing} style={{ ...S.shareBtn, ...(isCapturing && shareEntry?.user_id === entry.user_id ? { opacity: 0.5 } : {}) }} title="Share rank card with image">
                      {isCapturing && shareEntry?.user_id === entry.user_id ? '⏳' : '📤'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Share Modal (desktop) ─── */}
      {shareModal && (
        <div style={S.overlay} onClick={closeShareModal}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <button onClick={closeShareModal} style={S.modalX}>✕</button>
            <h2 style={S.modalTitle}>Share Leaderboard Card</h2>

            <div style={S.modalImgWrap}>
              <img src={shareModal.imageUrl} alt="Leaderboard card" style={{ width: '100%', display: 'block' }} />
            </div>

            <div style={S.modalActions}>
              <button onClick={handleModalNativeShare} style={S.modalPrimary}>📱 Share with Image</button>
              <button onClick={handleModalDownload} style={S.modalSecondary}>💾 Save Image</button>
            </div>

            <p style={S.modalDivider}>Share on social — image auto-downloads, attach it!</p>

            <div style={S.modalSocialRow}>
              <button onClick={() => handleModalSocialShare('whatsapp')} style={S.modalSocial}>💬 WhatsApp</button>
              <button onClick={() => handleModalSocialShare('twitter')} style={S.modalSocial}>𝕏 Twitter</button>
              <button onClick={() => handleModalSocialShare('facebook')} style={S.modalSocial}>f Facebook</button>
            </div>

            <p style={S.modalHint}>📋 Share text already copied to clipboard</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Styles ───
const S = {
  page: { minHeight: '100vh', background: '#262421', padding: '20px 12px' },
  container: { maxWidth: 700, margin: '0 auto' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  title: { color: '#fff', fontSize: 28, fontWeight: 700, textAlign: 'center', margin: 0 },
  refreshBtn: { background: 'none', border: '1px solid #464340', borderRadius: 8, cursor: 'pointer', fontSize: 18, padding: '4px 8px', color: '#bababa' },
  lastFetched: { color: '#7a7572', fontSize: 11, textAlign: 'center', marginBottom: 12, marginTop: 0 },

  inviteBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px', marginBottom: 20, borderRadius: 12, background: 'linear-gradient(135deg, #2a3a1e 0%, #1e2d16 100%)', border: '1px solid #81b64c50', flexWrap: 'wrap' },
  inviteContent: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 },
  inviteEmoji: { fontSize: 32, color: '#81b64c', textShadow: '0 0 12px rgba(129,182,76,0.4)' },
  inviteHeadline: { color: '#fff', fontSize: 15, fontWeight: 700 },
  inviteSubtext: { color: '#9a9790', fontSize: 12 },
  inviteBtn: { padding: '10px 22px', borderRadius: 8, border: 'none', background: '#81b64c', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(129,182,76,0.3)' },

  periodRow: { display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' },
  periodBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #464340', background: '#312e2b', color: '#bababa', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  periodBtnActive: { background: '#81b64c', color: '#fff', borderColor: '#81b64c' },
  periodBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  categoryRow: { display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' },
  categoryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #464340', background: '#312e2b', color: '#bababa', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  categoryBtnActive: { background: '#3d3a37', color: '#fff', borderColor: '#81b64c' },
  ratingNote: { color: '#7a7572', fontSize: 12, textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },

  loader: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60 },
  spinner: { width: 40, height: 40, border: '4px solid #464340', borderTop: '4px solid #81b64c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorBox: { textAlign: 'center', padding: 40, color: '#e57373' },
  retryBtn: { marginTop: 12, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#81b64c', color: '#fff', cursor: 'pointer', fontWeight: 600 },
  emptyState: { textAlign: 'center', padding: 60 },

  list: { display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', alignItems: 'center', padding: '10px 12px', background: '#312e2b', borderRadius: 8, borderLeft: '3px solid transparent' },
  rowHighlight: { background: '#3d3a37', boxShadow: 'inset 0 0 0 1px #81b64c40' },
  rankCol: { width: 40, textAlign: 'center', flexShrink: 0 },
  rankNum: { color: '#7a7572', fontSize: 16, fontWeight: 600 },
  playerCol: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  playerName: { display: 'block', color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  youBadge: { marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#81b64c', color: '#fff', verticalAlign: 'middle' },
  playerRating: { display: 'block', color: '#7a7572', fontSize: 12 },
  valueCol: { textAlign: 'right', marginRight: 8, flexShrink: 0 },
  valueNum: { display: 'block', color: '#81b64c', fontSize: 18, fontWeight: 700 },
  valueLbl: { display: 'block', color: '#7a7572', fontSize: 11 },
  shareBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 8px', borderRadius: 6 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { position: 'relative', background: '#312e2b', borderRadius: 16, padding: '28px 24px', maxWidth: 440, width: '100%', maxHeight: '90vh', overflow: 'auto', border: '1px solid #464340', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' },
  modalX: { position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#bababa', fontSize: 18, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 16 },
  modalImgWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  modalActions: { display: 'flex', gap: 8, marginBottom: 14 },
  modalPrimary: { flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none', background: '#81b64c', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  modalSecondary: { flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid #464340', background: '#3d3a37', color: '#bababa', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  modalDivider: { color: '#7a7572', fontSize: 12, textAlign: 'center', marginBottom: 10, fontStyle: 'italic' },
  modalSocialRow: { display: 'flex', gap: 8, marginBottom: 12 },
  modalSocial: { flex: 1, padding: '10px 8px', borderRadius: 8, border: '1px solid #46434080', background: '#262421', color: '#bababa', cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'center' },
  modalHint: { color: '#81b64c', fontSize: 11, textAlign: 'center', fontWeight: 600 },
};

if (typeof document !== 'undefined' && !document.querySelector('[data-leaderboard-styles]')) {
  const s = document.createElement('style');
  s.setAttribute('data-leaderboard-styles', '');
  s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(s);
}

export default LeaderboardPage;
