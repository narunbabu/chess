// src/components/game/CCTPanel.jsx
// Live learning panel: Checks, Captures, Threats scanner + Stockfish best moves.

import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { analyzeCCT, cctToArrows, classifyMoveAgainstCCT } from '../../utils/cctAnalysis';
import { getStockfishTopMoves, mapDepthToMoveTime } from '../../utils/computerMoveUtils';
import './CCTPanel.css';

// ─── Warning Message Database ────────────────────────────────────────────────
// Sentences selected deterministically per position to avoid flicker.

const CCT_WARNINGS = {
  check: [
    "🔴 Check alert! Your opponent can deliver check — secure your king first.",
    "🔴 King in danger! Opponent has a checking move — don't ignore it.",
    "🔴 Opponent can give check. Resolve king vulnerability before anything else.",
    "🔴 Check threat detected! Move your king or block the check immediately.",
  ],
  capture: [
    "🟠 Material at risk! Opponent can capture one of your pieces this turn.",
    "🟠 A piece is hanging! Defend it or move it before your opponent strikes.",
    "🟠 Watch out — opponent has a winning capture. Protect your pieces.",
    "🟠 Piece under attack! Defend it or trade favorably right now.",
  ],
  threat: [
    "🟡 Subtle threat — opponent's next move could attack your pieces.",
    "🟡 Danger ahead: opponent may be setting up a fork, pin, or skewer.",
    "🟡 Look one move ahead! Opponent threatens to win material next turn.",
    "🟡 Positional threat detected — anticipate your opponent's plan.",
  ],
  multiple_check_capture: [
    "🔴 High danger! Opponent can check AND capture — king safety is priority one.",
    "🔴 Critical position: check threats and material threats both exist. Defend your king first.",
  ],
  multiple_all: [
    "🔴 Maximum pressure! Checks, captures, and threats are all on the table.",
    "🔴 Serious danger — your opponent has multiple attacking options. Calculate carefully.",
  ],
  safe: [
    "✅ No immediate threats — position looks balanced. Stick to your plan.",
    "✅ You're safe this turn. Good time to improve your pieces or castle.",
    "✅ Quiet position — use this move to strengthen your setup.",
    "✅ Opponent has no forcing moves. Stay alert and keep developing.",
  ],
};

// Deterministic pick per FEN — same position always shows same message
function pickMessage(messages, fen) {
  const hash = [...fen].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return messages[hash % messages.length];
}

function getWarningInfo(opponentCct, fen) {
  if (!opponentCct || !fen) return null;
  const { checks, captures, threats } = opponentCct;

  if (checks.length > 0 && (captures.length > 0 || threats.length > 0)) {
    return { severity: 'critical', msg: pickMessage(CCT_WARNINGS.multiple_check_capture, fen) };
  }
  if (checks.length > 0) {
    return { severity: 'danger',  msg: pickMessage(CCT_WARNINGS.check, fen) };
  }
  if (captures.length > 0) {
    return { severity: 'warning', msg: pickMessage(CCT_WARNINGS.capture, fen) };
  }
  if (threats.length > 0) {
    return { severity: 'caution', msg: pickMessage(CCT_WARNINGS.threat, fen) };
  }
  return { severity: 'safe', msg: pickMessage(CCT_WARNINGS.safe, fen) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TAG_CLASSES = {
  'Check+Capture': 'cct-tag-check-capture',
  'Check':         'cct-tag-check',
  'Capture':       'cct-tag-capture',
  'Threat':        'cct-tag-threat',
  'Positional':    'cct-tag-positional',
};

// Rank colours: gold, silver, bronze
const BEST_COLORS       = ['rgba(255,215,0,0.9)',  'rgba(192,192,192,0.9)',  'rgba(205,127,50,0.9)'];
const BEST_COLORS_SOLID = ['#FFD700',              '#C0C0C0',                '#CD7F32'];

function uciToMoveObj(uciStr, fen) {
  try {
    const g = new Chess(fen);
    const from = uciStr.slice(0, 2);
    const to   = uciStr.slice(2, 4);
    const promotion = uciStr.length > 4 ? uciStr[4] : undefined;
    const moved = g.move({ from, to, promotion });
    return { san: moved.san, from, to, uci: uciStr, isCheckmate: g.isCheckmate() };
  } catch {
    return { san: uciStr, from: uciStr.slice(0, 2), to: uciStr.slice(2, 4), uci: uciStr };
  }
}

// Convert best moves to arrow objects (from → to, rank colour)
function bestMovesToArrows(moves) {
  return moves.slice(0, 3).map((m, i) => ({
    from: m.from, to: m.to, color: BEST_COLORS[i],
  }));
}

// Numbered labels at origin squares
function bestMovesToLabels(moves) {
  return moves.slice(0, 3).map((m, i) => ({
    square: m.from,
    label:  String(i + 1),
    color:  BEST_COLORS_SOLID[i],
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CCTPanel — live learning assistant
 *
 * Props:
 *   game          {Chess}    live chess.js instance
 *   isActive      {boolean}  game in progress
 *   isRated       {boolean}  rated game — disable hints
 *   onArrowsChange {Function} ({from,to,color}[]) → board arrows
 *   onLabelsChange {Function} ({square,label,color}[]) → numbered board labels
 */
const CCTPanel = ({ game, isActive, isRated = false, onArrowsChange, onLabelsChange }) => {
  const [perspective, setPerspective] = useState('mine');
  // 0=off  1=CCT arrows  2=Best moves
  // Default to 1 so CCT is active as soon as the tab is opened
  const [hintLevel,   setHintLevel]   = useState(1);

  const [cct,         setCct]         = useState(null);
  const [opponentCct, setOpponentCct] = useState(null); // always opponent view for warnings
  const [bestMoves,   setBestMoves]   = useState(null);
  const [loadingBest, setLoadingBest] = useState(false);

  const [openSection, setOpenSection] = useState({ checks: true, captures: true, threats: true });

  const fenRef  = useRef(null);
  const sfAbort = useRef(null);

  // ── recompute CCT whenever game position or perspective changes ────────────
  useEffect(() => {
    if (!game || !isActive) {
      setCct(null);
      setOpponentCct(null);
      onArrowsChange?.([]);
      onLabelsChange?.([]);
      return;
    }

    const fen = game.fen();
    const key = `${fen}::${perspective}`;
    if (key === fenRef.current) return;
    fenRef.current = key;

    setCct(analyzeCCT(game, perspective));
    setOpponentCct(analyzeCCT(game, 'opponent')); // always for warnings
    setBestMoves(null);
    sfAbort.current = Date.now(); // cancel any in-flight Stockfish call
  }, [game, perspective, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── push arrows + labels to board ─────────────────────────────────────────
  useEffect(() => {
    if (!onArrowsChange) return;

    if (!isActive || hintLevel === 0 || !cct || isRated) {
      onArrowsChange([]);
      onLabelsChange?.([]);
      return;
    }

    if (hintLevel === 1) {
      // CCT mode: show CCT arrows, no numbered labels
      onArrowsChange(cctToArrows(cct));
      onLabelsChange?.([]);
    } else if (hintLevel === 2 && bestMoves && bestMoves.length > 0) {
      // Best mode: show rank-coloured arrows + numbered origin labels
      onArrowsChange(bestMovesToArrows(bestMoves));
      onLabelsChange?.(bestMovesToLabels(bestMoves));
    } else if (hintLevel === 2 && !bestMoves) {
      // Still loading — clear board
      onArrowsChange([]);
      onLabelsChange?.([]);
    }
  }, [cct, bestMoves, hintLevel, isActive, isRated, onArrowsChange, onLabelsChange]);

  // ── load Stockfish best moves ──────────────────────────────────────────────
  useEffect(() => {
    if (hintLevel !== 2 || !game || !isActive || isRated || !cct) return;

    const fen    = game.fen();
    const callId = Date.now();
    sfAbort.current = callId;

    setLoadingBest(true);
    setBestMoves(null);

    getStockfishTopMoves(fen, 3, mapDepthToMoveTime(12))
      .then(uciMoves => {
        if (sfAbort.current !== callId) return;
        const classified = uciMoves.map(uci => ({
          ...uciToMoveObj(uci, fen),
          tag: classifyMoveAgainstCCT(uci, cct),
        }));
        setBestMoves(classified);
      })
      .catch(() => { if (sfAbort.current === callId) setBestMoves([]); })
      .finally(() => { if (sfAbort.current === callId) setLoadingBest(false); });
  }, [hintLevel, cct]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up board overlays on unmount
  useEffect(() => {
    return () => {
      onArrowsChange?.([]);
      onLabelsChange?.([]);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── rated gate ─────────────────────────────────────────────────────────────
  if (isRated) {
    return (
      <div className="cct-panel">
        <div className="cct-rated-gate">
          <div className="cct-gate-icon">🏆</div>
          <p style={{ fontWeight: 'bold', color: '#e5e5e5' }}>Limited in Rated games</p>
          <p style={{ fontSize: '12px' }}>
            CCT counts are visible but move hints and best moves are disabled.
          </p>
        </div>
        {cct && <CctCounts cct={cct} />}
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="cct-panel">
        <p className="cct-inactive">Start a game to activate the learning panel.</p>
      </div>
    );
  }

  const fen     = game?.fen?.() || '';
  const warning = hintLevel >= 1 ? getWarningInfo(opponentCct, fen) : null;

  // ── main render ────────────────────────────────────────────────────────────
  return (
    <div className="cct-panel">

      {/* ── Mode toggle buttons ─────────────────────────────────────────── */}
      <div className="cct-mode-row">
        <button
          className={`cct-mode-btn cct-mode-cct ${hintLevel === 1 ? 'active' : ''}`}
          onClick={() => setHintLevel(hl => hl === 1 ? 0 : 1)}
          title={hintLevel === 1 ? 'Click to turn off CCT arrows' : 'Show CCT arrows on board'}
        >
          💡 CCT
        </button>
        <button
          className={`cct-mode-btn cct-mode-best ${hintLevel === 2 ? 'active' : ''}`}
          onClick={() => setHintLevel(hl => hl === 2 ? 0 : 2)}
          title={hintLevel === 2 ? 'Click to turn off Best moves' : 'Show top 3 moves on board'}
        >
          ⭐ Best
        </button>
      </div>

      {/* ── Warning notification ─────────────────────────────────────────── */}
      {warning && (
        <div className={`cct-warning cct-warning-${warning.severity}`}>
          {warning.msg}
        </div>
      )}

      {/* ── Perspective toggle ───────────────────────────────────────────── */}
      <div className="cct-perspective-row">
        {[
          { key: 'mine',     label: '♟ My Moves' },
          { key: 'opponent', label: '⚔ Their Threats' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`cct-persp-btn ${perspective === key ? 'active' : ''}`}
            onClick={() => setPerspective(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── CCT sections ─────────────────────────────────────────────────── */}
      {cct ? (
        <>
          <CctSection
            type="checks" label="Checks" moves={cct.checks}
            open={openSection.checks} showMoves={hintLevel >= 1}
            onToggle={() => setOpenSection(s => ({ ...s, checks: !s.checks }))}
          />
          <CctSection
            type="captures" label="Captures" moves={cct.captures}
            open={openSection.captures} showMoves={hintLevel >= 1}
            onToggle={() => setOpenSection(s => ({ ...s, captures: !s.captures }))}
            renderDetail={m => m.victimName ? `×${m.victimName}` : ''}
          />
          <CctSection
            type="threats" label="Threats" moves={cct.threats}
            open={openSection.threats} showMoves={hintLevel >= 1}
            onToggle={() => setOpenSection(s => ({ ...s, threats: !s.threats }))}
            renderDetail={m => m.victimName ? `→ ${m.victimName}` : ''}
          />
        </>
      ) : (
        <p className="cct-empty">Calculating…</p>
      )}

      {/* ── Best moves list ──────────────────────────────────────────────── */}
      {hintLevel === 2 && (
        <>
          <div className="cct-best-header">Top 3 Moves</div>
          {loadingBest && (
            <div className="cct-loading">
              <div className="cct-spinner" />
              Analysing position…
            </div>
          )}
          {!loadingBest && bestMoves && (
            <div className="cct-best-list">
              {bestMoves.length === 0 && <p className="cct-empty">No moves found.</p>}
              {bestMoves.map((m, i) => (
                <div
                  key={i}
                  className="cct-best-item"
                  style={{ borderLeft: `3px solid ${BEST_COLORS_SOLID[i]}` }}
                >
                  <span className="cct-best-rank" style={{ color: BEST_COLORS_SOLID[i] }}>
                    {i + 1}.
                  </span>
                  <span className="cct-best-san">{m.san}</span>
                  <span className={`cct-best-tag ${TAG_CLASSES[m.tag] || 'cct-tag-positional'}`}>
                    {m.tag}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function CctCounts({ cct }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      <CountPill type="checks"   label="Checks"   count={cct.checks.length} />
      <CountPill type="captures" label="Captures" count={cct.captures.length} />
      <CountPill type="threats"  label="Threats"  count={cct.threats.length} />
    </div>
  );
}

function CountPill({ type, label, count }) {
  const colors = {
    checks:   { bg: 'rgba(239,68,68,0.15)',  text: '#fca5a5' },
    captures: { bg: 'rgba(249,115,22,0.15)', text: '#fdba74' },
    threats:  { bg: 'rgba(234,179,8,0.15)',  text: '#fde68a' },
  };
  const c = colors[type] || {};
  return (
    <div style={{
      background: c.bg, color: c.text,
      borderRadius: 8, padding: '4px 10px',
      fontSize: 12, fontWeight: 600, textAlign: 'center',
    }}>
      <div style={{ fontSize: 16 }}>{count}</div>
      <div style={{ fontSize: 10, opacity: 0.8 }}>{label}</div>
    </div>
  );
}

function CctSection({ type, label, moves, open, showMoves, onToggle, renderDetail }) {
  return (
    <div className="cct-section">
      <div className={`cct-section-header ${type}`} onClick={onToggle}>
        <span>{label}</span>
        <span className="cct-badge">{moves.length}</span>
      </div>
      {open && (
        <div className="cct-move-list">
          {moves.length === 0 && (
            <span className="cct-empty">None</span>
          )}
          {showMoves && moves.slice(0, 5).map((m, i) => (
            <div key={i} className="cct-move-item">
              <span className="cct-move-san">{m.label}</span>
              {m.isCheckmate && <span className="cct-checkmate-tag">Mate</span>}
              {renderDetail && (
                <span className="cct-move-detail">{renderDetail(m)}</span>
              )}
            </div>
          ))}
          {!showMoves && moves.length > 0 && (
            <span className="cct-empty" style={{ fontStyle: 'normal', color: '#6b7280' }}>
              {moves.length} move{moves.length !== 1 ? 's' : ''} — enable hints to reveal
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default CCTPanel;
