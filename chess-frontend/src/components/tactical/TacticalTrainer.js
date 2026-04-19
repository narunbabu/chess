import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import TacticalTrainerDashboard from './TacticalTrainerDashboard';
import TacticalPuzzleBoard from './TacticalPuzzleBoard';
import { loadProgress, saveProgress, stages, computeRatingDelta, computePuzzleScore } from './tacticalStages';
import { STAGE_VIDEOS } from './stageVideos';
import { useAuth } from '../../contexts/AuthContext';
import tacticalApi from '../../services/tacticalApi';

/**
 * Lichess puzzle CSV format: FEN is the position BEFORE the opponent's setup move.
 * moves[0] = opponent's setup move; moves[1+] = player's solution.
 * playerColor in the extracted JSON is set to FEN's side-to-move (the opponent) — wrong.
 *
 * This function corrects that by applying moves[0] to the FEN so the puzzle starts
 * with the PLAYER to move, with the correct playerColor and moves array.
 */
function normalizePuzzle(puzzle) {
  if (!puzzle.moves || puzzle.moves.length < 2) return puzzle;

  const setupUCI = puzzle.moves[0];
  const playerMoves = puzzle.moves.slice(1);

  try {
    const tempChess = new Chess(puzzle.fen);
    const from  = setupUCI.slice(0, 2);
    const to    = setupUCI.slice(2, 4);
    const promo = setupUCI.length === 5 ? setupUCI[4] : 'q';
    const moved = tempChess.move({ from, to, promotion: promo });
    if (!moved) return puzzle;

    const newFen         = tempChess.fen();
    const newPlayerColor = newFen.split(' ')[1]; // 'w' or 'b' — now the real player
    const colorName      = newPlayerColor === 'w' ? 'White' : 'Black';
    const wrongName      = newPlayerColor === 'w' ? 'Black' : 'White';

    const explanation = (puzzle.explanation || '').startsWith(wrongName)
      ? colorName + (puzzle.explanation || '').slice(wrongName.length)
      : puzzle.explanation;

    return { ...puzzle, fen: newFen, moves: playerMoves, playerColor: newPlayerColor, explanation };
  } catch {
    return puzzle;
  }
}

// Lazy-load puzzle data per stage
const PUZZLE_LOADERS = {
  0: () => import('../../data/beginner_puzzles.json').then(m => m.default),
  1: () => import('../../data/stage1_puzzles.json').then(m => m.default),
  2: () => import('../../data/stage2_puzzles.json').then(m => m.default),
  3: () => import('../../data/stage3_puzzles.json').then(m => m.default),
  4: () => import('../../data/stage4_puzzles.json').then(m => m.default),
};

// ── Offline outbox queue ──────────────────────────────────────────────────────
const OUTBOX_KEY = 'tactical_outbox';

function getOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; }
  catch { return []; }
}

function saveOutbox(items) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

function enqueueAttempt(attempt) {
  const items = getOutbox();
  items.push({ ...attempt, _queuedAt: Date.now() });
  saveOutbox(items);
}

async function flushOutbox() {
  const items = getOutbox();
  if (items.length === 0) return;
  const remaining = [];
  for (const item of items) {
    const { _queuedAt, ...attempt } = item;
    try {
      await tacticalApi.submitAttempt(attempt);
    } catch {
      remaining.push(item);
    }
  }
  saveOutbox(remaining);
}

export default function TacticalTrainer() {
  const { user, isAuthenticated } = useAuth();
  const [stats,              setStats]              = useState(loadProgress);
  const [currentStageId,     setCurrentStageId]     = useState(null);
  const [stagePuzzles,       setStagePuzzles]        = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [loading,            setLoading]            = useState(false);
  const [lastDelta,          setLastDelta]          = useState(null);
  const [lastPuzzleScore,    setLastPuzzleScore]    = useState(null);
  const syncedRef = useRef(false);

  // ── Load progress from API when authenticated ──────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await tacticalApi.getProgress();
        if (cancelled) return;
        // Merge API progress into state; API response has { stats, stageProgress }
        const merged = {
          ...(data.stats || {}),
          stageProgress: data.stageProgress || {},
          badges: data.badges || [],
        };
        // Persist to localStorage so guests see last-known state if they log out
        saveProgress(merged);
        setStats(merged);
      } catch (err) {
        console.warn('TacticalTrainer: API load failed, using localStorage fallback', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // ── One-time sync of existing localStorage data to server on login ─────────
  useEffect(() => {
    if (!isAuthenticated || syncedRef.current) return;
    syncedRef.current = true;
    const local = loadProgress();
    if (!local || local.totalAttempted === 0) return;
    tacticalApi.syncLocalData(local).catch(err => {
      console.warn('TacticalTrainer: localStorage sync failed', err);
    });
  }, [isAuthenticated]);

  // ── Flush outbox on login or reconnect ──────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    flushOutbox();
    const onOnline = () => flushOutbox();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [isAuthenticated]);

  // ── Select a stage, lazy-load its puzzles ─────────────────────────────────
  const handleSelectStage = useCallback(async stageId => {
    setLoading(true);
    try {
      const loader = PUZZLE_LOADERS[stageId];
      if (!loader) throw new Error(`No loader for stage ${stageId}`);
      const puzzles = await loader();
      // Sort by rating ascending so puzzle order is stable across sessions
      const sorted = [...puzzles].sort((a, b) => a.rating - b.rating).map(normalizePuzzle);
      setStagePuzzles(sorted);
      setCurrentStageId(stageId);
      // Resume from first unsolved puzzle
      const completedIds = stats?.stageProgress?.[stageId]?.completedPuzzleIds || [];
      const firstUnsolved = sorted.findIndex(p => !completedIds.includes(p.id));
      setCurrentPuzzleIndex(firstUnsolved === -1 ? 0 : firstUnsolved);
      setLastDelta(null);
    } catch (err) {
      console.error('Failed to load puzzles:', err);
    }
    setLoading(false);
  }, [stats]);

  const handleBack = useCallback(() => {
    setCurrentStageId(null);
    setStagePuzzles([]);
    setLastDelta(null);
    setLastPuzzleScore(null);
  }, []);

  // ── Puzzle completed ───────────────────────────────────────────────────────
  const handlePuzzleComplete = useCallback((success, wrongCount = 0, cctMeta = {}) => {
    const {
      myFound = 0, myTotal = 0,
      oppFound = 0, oppTotal = 0,
      solutionShown = false,
    } = cctMeta;

    const puzzleScore = computePuzzleScore({
      wrongCount, cctMyFound: myFound, cctMyTotal: myTotal,
      cctOppFound: oppFound, cctOppTotal: oppTotal, solutionShown,
    });
    setLastPuzzleScore(puzzleScore);

    // CCT not attempted → puzzle stays pending, no rating change
    if (!puzzleScore.cctAttempted) {
      setLastDelta({ value: 0, sign: '+' });
      return;
    }

    setStats(prev => {
      const puzzle = stagePuzzles[currentPuzzleIndex];
      const delta  = computeRatingDelta(puzzle, success, wrongCount, puzzleScore.cctQuality);
      setLastDelta(delta);

      const stageProg = { ...prev.stageProgress[currentStageId] };
      stageProg.attempted = (stageProg.attempted || 0) + 1;

      // Store per-puzzle score
      stageProg.puzzleScores = { ...(stageProg.puzzleScores || {}) };
      const puzzleIdx = currentPuzzleIndex;
      if (!stageProg.puzzleScores[puzzleIdx] || puzzleScore.combined > stageProg.puzzleScores[puzzleIdx].combined) {
        stageProg.puzzleScores[puzzleIdx] = puzzleScore;
      }

      const next = {
        ...prev,
        totalAttempted: (prev.totalAttempted || 0) + 1,
        stageProgress: { ...prev.stageProgress },
      };

      if (success) {
        stageProg.solved   = (stageProg.solved || 0) + 1;
        stageProg.completedPuzzleIds = stageProg.completedPuzzleIds || [];
        if (!stageProg.completedPuzzleIds.includes(puzzle.id)) {
          stageProg.completedPuzzleIds.push(puzzle.id);
        }
        next.totalSolved   = (prev.totalSolved || 0) + 1;
        next.streak        = (prev.streak || 0) + 1;
        next.rating        = Math.min(2400, (prev.rating || 1000) + delta.value);

        const stageDef = stages.find(s => s.id === currentStageId);
        if (stageDef && stageProg.solved >= stageDef.unlockAfter) {
          const nextStageId = currentStageId + 1;
          if (nextStageId <= 4) {
            next.stageProgress[nextStageId] = {
              ...prev.stageProgress[nextStageId],
              unlocked: true,
            };
          }
        }
      } else {
        next.streak  = 0;
        next.rating  = Math.max(800, (prev.rating || 1000) - delta.value);
      }

      next.stageProgress[currentStageId] = stageProg;
      saveProgress(next);

      // Submit to API when authenticated and online; otherwise queue locally
      if (puzzle) {
        const payload = {
          stage_id: currentStageId,
          puzzle_id: puzzle.id,
          success,
          puzzle_rating: puzzle.rating,
          wrong_count: wrongCount,
          solution_shown: solutionShown,
          cct_my_found: myFound,
          cct_my_total: myTotal,
          cct_opp_found: oppFound,
          cct_opp_total: oppTotal,
          time_spent_ms: cctMeta.timeSpentMs,
          stage_total_puzzles: stagePuzzles.length,
        };
        if (isAuthenticated && navigator.onLine) {
          tacticalApi.submitAttempt(payload).catch(err => {
            console.warn('TacticalTrainer: attempt submit failed, queueing', err);
            enqueueAttempt(payload);
          });
        } else {
          enqueueAttempt(payload);
        }
      }

      return next;
    });
  }, [currentStageId, currentPuzzleIndex, stagePuzzles, isAuthenticated]);

  const handleNext = useCallback(() => {
    setCurrentPuzzleIndex(i => i + 1);
    setLastDelta(null);
    setLastPuzzleScore(null);
  }, []);

  const handleJumpToPuzzle = useCallback((index) => {
    setCurrentPuzzleIndex(index);
    setLastDelta(null);
    setLastPuzzleScore(null);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentPuzzle = stagePuzzles[currentPuzzleIndex] ?? null;
  const hasNext       = currentPuzzleIndex < stagePuzzles.length - 1;
  const stageDef      = stages.find(s => s.id === currentStageId);
  const stageVideo    = currentStageId !== null && STAGE_VIDEOS[currentStageId]?.youtubeId
    ? STAGE_VIDEOS[currentStageId]
    : null;
  const completedPuzzleIds = stats?.stageProgress?.[currentStageId]?.completedPuzzleIds || [];
  const puzzleScores       = stats?.stageProgress?.[currentStageId]?.puzzleScores || {};

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#262421' }}>
        <div className="text-center">
          <div className="text-5xl mb-4" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>♟️</div>
          <p className="text-white font-medium mt-2">Loading puzzles...</p>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  if (currentStageId === null) {
    return <TacticalTrainerDashboard stats={stats} onSelectStage={handleSelectStage} />;
  }

  // ── Stage exhausted ────────────────────────────────────────────────────────
  if (!currentPuzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: '#262421' }}>
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-6">🏆</div>
          <h2 className="text-3xl font-bold mb-4">Stage Complete!</h2>
          <p className="mb-2" style={{ color: '#bababa' }}>
            You've worked through all {stagePuzzles.length} puzzles in{' '}
            <strong style={{ color: '#ffffff' }}>{stageDef?.title}</strong>.
          </p>
          <p className="text-sm mb-8" style={{ color: '#8b8987' }}>
            All puzzles completed! Try the next stage to keep improving.
          </p>
          <button
            onClick={handleBack}
            className="px-8 py-3 rounded-xl font-bold text-white transition-colors"
            style={{ backgroundColor: '#81b64c' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#a3d160')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#81b64c')}
          >
            Back to Stages
          </button>
        </div>
      </div>
    );
  }

  // ── Puzzle board ───────────────────────────────────────────────────────────
  return (
    <TacticalPuzzleBoard
      puzzle={currentPuzzle}
      puzzleNumber={currentPuzzleIndex + 1}
      totalPuzzles={stagePuzzles.length}
      stageTitle={stageDef?.title || 'Stage'}
      stageVideo={stageVideo}
      onBack={handleBack}
      onComplete={handlePuzzleComplete}
      onNext={handleNext}
      onJumpToPuzzle={handleJumpToPuzzle}
      hasNext={hasNext}
      ratingDelta={lastDelta}
      puzzleScore={lastPuzzleScore}
      completedPuzzleIds={completedPuzzleIds}
      allStagePuzzles={stagePuzzles}
      puzzleScores={puzzleScores}
    />
  );
}
