import React, { useState, useCallback, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';

const CLASSIFICATION_STYLES = {
  brilliant: { icon: '★', bg: '#46bdf0', color: '#fff', label: 'Brilliant' },
  excellent: { icon: '⭐', bg: '#81b64c', color: '#fff', label: 'Excellent' },
  good:      { icon: '✓',  bg: '#a3d160', color: '#1a1a18', label: 'Good' },
  inaccuracy:{ icon: '?!', bg: '#e8a93e', color: '#1a1a18', label: 'Inaccuracy' },
  mistake:   { icon: '?',  bg: '#e07020', color: '#fff', label: 'Mistake' },
  blunder:   { icon: '??', bg: '#c33a3a', color: '#fff', label: 'Blunder' },
};

const EvalTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const evalPawns = (d.eval / 100).toFixed(2);
  const evalDisplay = Math.abs(d.eval) > 9000
    ? (d.eval > 0 ? `M${Math.round((d.eval - 10000) / 100)}` : `-M${Math.round((-d.eval - 10000) / 100)}`)
    : (d.eval > 0 ? `+${evalPawns}` : evalPawns);
  return (
    <div style={{ background: '#262421', border: '1px solid #3d3a37', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
      <div style={{ color: '#bababa' }}>Move {d.moveNum}. {d.san}</div>
      <div style={{ color: d.eval >= 0 ? '#81b64c' : '#c33a3a', fontWeight: 600 }}>{evalDisplay}</div>
    </div>
  );
};

const PostGameAnalysis = ({ gameId, onAnalysisLoaded }) => {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [analysis, setAnalysis] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const triggerAnalysis = useCallback(async () => {
    if (!gameId || status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await api.post(`/games/${gameId}/analyze`);
      const data = res.data?.analysis || res.data;
      setAnalysis(data);
      setStatus('done');
      if (onAnalysisLoaded) onAnalysisLoaded(data);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      if (err.response?.status === 409) {
        setStatus('loading');
        setErrorMsg('Analysis already in progress. Try again in a moment.');
        setStatus('error');
      } else {
        setErrorMsg(msg || 'Analysis failed');
        setStatus('error');
      }
    }
  }, [gameId, status, onAnalysisLoaded]);

  const chartData = useMemo(() => {
    if (!analysis?.move_analyses) return [];
    const moves = Array.isArray(analysis.move_analyses)
      ? analysis.move_analyses
      : (typeof analysis.move_analyses === 'string' ? JSON.parse(analysis.move_analyses) : []);
    const data = [{ moveNum: 0, eval: 0, san: 'Start', color: '' }];
    moves.forEach((m) => {
      const raw = m.eval_after_cp ?? 0;
      data.push({
        moveNum: m.move_number,
        eval: Math.max(-1000, Math.min(1000, raw)),
        san: m.san,
        color: m.color,
        classification: m.classification,
        cpLoss: m.cp_loss,
        bestMove: m.best_move,
      });
    });
    return data;
  }, [analysis]);

  const qualityCounts = useMemo(() => {
    if (!analysis?.quality_counts) return null;
    const qc = typeof analysis.quality_counts === 'string'
      ? JSON.parse(analysis.quality_counts)
      : analysis.quality_counts;
    return qc;
  }, [analysis]);

  const moveAnalyses = useMemo(() => {
    if (!analysis?.move_analyses) return [];
    return Array.isArray(analysis.move_analyses)
      ? analysis.move_analyses
      : (typeof analysis.move_analyses === 'string' ? JSON.parse(analysis.move_analyses) : []);
  }, [analysis]);

  // ── Idle: show trigger button ──
  if (status === 'idle') {
    return (
      <div className="unified-card">
        <button
          onClick={triggerAnalysis}
          className="w-full flex items-center justify-center gap-2 bg-[#81b64c] hover:bg-[#a3d160] rounded-lg px-4 py-3 text-white transition-all text-sm font-semibold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Analyze with Stockfish
        </button>
        <p className="text-[#8b8987] text-xs mt-2 text-center">Run full game analysis to see evaluations, accuracy, and move quality</p>
      </div>
    );
  }

  // ── Loading ──
  if (status === 'loading') {
    return (
      <div className="unified-card">
        <div className="flex flex-col items-center py-6">
          <div className="animate-spin w-8 h-8 border-2 border-[#81b64c] border-t-transparent rounded-full mb-3" />
          <p className="text-white text-sm font-semibold">Analyzing game...</p>
          <p className="text-[#8b8987] text-xs mt-1">Stockfish is evaluating each position (depth 18)</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (status === 'error') {
    return (
      <div className="unified-card">
        <div className="flex flex-col items-center py-4">
          <div className="text-[#c33a3a] text-lg mb-2">Analysis Failed</div>
          <p className="text-[#8b8987] text-xs mb-3 text-center">{errorMsg}</p>
          <button
            onClick={triggerAnalysis}
            className="px-4 py-2 bg-[#312e2b] border border-[#3d3a37] hover:border-[#81b64c] text-white rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Results ──
  const accW = analysis.accuracy_white ?? 0;
  const accB = analysis.accuracy_black ?? 0;
  const acplW = analysis.acpl_white ?? 0;
  const acplB = analysis.acpl_black ?? 0;

  return (
    <div className="unified-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-sm font-semibold flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#81b64c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Stockfish Analysis
        </h3>
        <span className="text-[#8b8987] text-[10px]">Depth 18</span>
      </div>

      {/* ── Accuracy Bars ── */}
      <div className="space-y-2">
        {[
          { label: 'White', acc: accW, acpl: acplW, barColor: '#e8e8e8', textColor: '#1a1a18' },
          { label: 'Black', acc: accB, acpl: acplB, barColor: '#4a4744', textColor: '#e8e8e8' },
        ].map(({ label, acc, acpl, barColor, textColor }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${label === 'White' ? 'text-[#e8e8e8]' : 'text-[#bababa]'}`}>{label}</span>
              <div className="flex items-center gap-3">
                <span className="text-[#8b8987] text-[10px]">ACPL: {acpl}</span>
                <span className="text-white text-xs font-bold tabular-nums">{acc}%</span>
              </div>
            </div>
            <div className="h-2 bg-[#1a1a18] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${acc}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Quality Summary ── */}
      {qualityCounts && (
        <div className="flex gap-2">
          {['white', 'black'].map((color) => {
            const counts = qualityCounts[color] || {};
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            if (total === 0) return null;
            return (
              <div key={color} className="flex-1 bg-[#262421] rounded-lg p-2">
                <div className="text-[#8b8987] text-[10px] mb-1 text-center">{color === 'white' ? 'White' : 'Black'}</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {Object.entries(CLASSIFICATION_STYLES).map(([key, style]) => {
                    const count = counts[key];
                    if (!count) return null;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: style.bg, color: style.color }}
                      >
                        {style.icon} {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Eval Graph ── */}
      {chartData.length > 1 && (
        <div>
          <div className="text-[#8b8987] text-[10px] mb-1 uppercase tracking-wider">Evaluation</div>
          <div className="bg-[#1a1a18] rounded-lg p-2" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#81b64c" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#81b64c" stopOpacity={0} />
                    <stop offset="50%" stopColor="#c33a3a" stopOpacity={0} />
                    <stop offset="100%" stopColor="#c33a3a" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262421" />
                <XAxis
                  dataKey="moveNum"
                  tick={{ fill: '#8b8987', fontSize: 10 }}
                  axisLine={{ stroke: '#3d3a37' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[-10, 10]}
                  tickFormatter={(v) => `${(v / 100).toFixed(1)}`}
                  tick={{ fill: '#8b8987', fontSize: 9 }}
                  axisLine={{ stroke: '#3d3a37' }}
                  tickLine={false}
                  ticks={[-1000, -500, 0, 500, 1000]}
                />
                <ReferenceLine y={0} stroke="#4a4744" strokeWidth={1} />
                <Tooltip content={<EvalTooltip />} />
                <Area
                  type="monotone"
                  dataKey="eval"
                  stroke="#81b64c"
                  strokeWidth={1.5}
                  fill="url(#evalGrad)"
                  isAnimationActive={false}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload?.classification || payload.moveNum === 0) return null;
                    const style = CLASSIFICATION_STYLES[payload.classification];
                    if (!style) return null;
                    return (
                      <circle
                        key={`dot-${payload.moveNum}`}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={style.bg}
                        stroke="#1a1a18"
                        strokeWidth={1}
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Move-by-Move Classifications ── */}
      {moveAnalyses.length > 0 && (
        <div>
          <div className="text-[#8b8987] text-[10px] mb-1.5 uppercase tracking-wider">Move Classifications</div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            <div className="grid gap-px">
              {(() => {
                const pairs = [];
                for (let i = 0; i < moveAnalyses.length; i += 2) {
                  const w = moveAnalyses[i];
                  const b = moveAnalyses[i + 1];
                  pairs.push({ num: w?.move_number || Math.floor(i / 2) + 1, w, b });
                }
                return pairs.map(({ num, w, b }) => (
                  <div key={num} className="grid grid-cols-[32px_1fr_1fr] items-center">
                    <span className="text-[#8b8987] text-[10px] text-right pr-2 tabular-nums">{num}.</span>
                    {w && <MoveBadge move={w} />}
                    {b ? <MoveBadge move={b} /> : <span />}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 pt-1 border-t border-[#3d3a37]">
        {Object.entries(CLASSIFICATION_STYLES).map(([key, style]) => (
          <span key={key} className="flex items-center gap-0.5 text-[9px]">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: style.bg }}
            />
            <span className="text-[#8b8987]">{style.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const MoveBadge = ({ move }) => {
  const style = CLASSIFICATION_STYLES[move.classification];
  if (!style) {
    return (
      <span className="text-[#bababa] text-xs font-mono px-1">{move.san}</span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono cursor-default"
      style={{ backgroundColor: `${style.bg}22`, color: style.bg }}
      title={`${style.label}${move.cp_loss != null ? ` (cp loss: ${move.cp_loss})` : ''}`}
    >
      <span style={{ fontSize: '9px', fontWeight: 700 }}>{style.icon}</span>
      {move.san}
    </span>
  );
};

export default PostGameAnalysis;
