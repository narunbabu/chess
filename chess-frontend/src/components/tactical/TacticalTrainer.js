import React, { useState, useCallback } from 'react';
import TacticalTrainerDashboard from './TacticalTrainerDashboard';
import TacticalPuzzleBoard from './TacticalPuzzleBoard';
import { loadProgress, saveProgress, stages, computeRatingDelta } from './tacticalStages';
import { STAGE_VIDEOS } from './stageVideos';

// Lazy-load puzzle data per stage
const PUZZLE_LOADERS = {
  0: () => import('../../data/beginner_puzzles.json').then(m => m.default),
  1: () => import('../../data/stage1_puzzles.json').then(m => m.default),
  2: () => import('../../data/stage2_puzzles.json').then(m => m.default),
  3: () => import('../../data/stage3_puzzles.json').then(m => m.default),
  4: () => import('../../data/stage4_puzzles.json').then(m => m.default),
};

// Deterministic shuffle so each session feels different
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TacticalTrainer() {
  const [stats,              setStats]              = useState(loadProgress);
  const [currentStageId,     setCurrentStageId]     = useState(null);
  const [stagePuzzles,       setStagePuzzles]        = useState([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [loading,            setLoading]            = useState(false);
  const [lastDelta,          setLastDelta]          = useState(null);  // for animated rating badge
  const [wrongCountForDelta, setWrongCountForDelta] = useState(0);

  // ── Select a stage, lazy-load its puzzles ─────────────────────────────────
  const handleSelectStage = useCallback(async stageId => {
    setLoading(true);
    try {
      const loader = PUZZLE_LOADERS[stageId];
      if (!loader) throw new Error(`No loader for stage ${stageId}`);
      const puzzles = await loader();
      setStagePuzzles(shuffle(puzzles));
      setCurrentStageId(stageId);
      setCurrentPuzzleIndex(0);
      setLastDelta(null);
    } catch (err) {
      console.error('Failed to load puzzles:', err);
    }
    setLoading(false);
  }, []);

  const handleBack = useCallback(() => {
    setCurrentStageId(null);
    setStagePuzzles([]);
    setLastDelta(null);
    setWrongCountForDelta(0);
  }, []);

  // ── Puzzle completed ───────────────────────────────────────────────────────
  const handlePuzzleComplete = useCallback((success, wrongCount = 0) => {
    setWrongCountForDelta(wrongCount);

    setStats(prev => {
      const puzzle    = stagePuzzles[currentPuzzleIndex];
      const delta     = computeRatingDelta(puzzle, success, wrongCount);
      setLastDelta(delta);

      const stageProg = { ...prev.stageProgress[currentStageId] };
      stageProg.attempted = (stageProg.attempted || 0) + 1;

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

        // Unlock next stage
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
      return next;
    });
  }, [currentStageId, currentPuzzleIndex, stagePuzzles]);

  const handleNext = useCallback(() => {
    setCurrentPuzzleIndex(i => i + 1);
    setLastDelta(null);
    setWrongCountForDelta(0);
  }, []);

  const handleJumpToPuzzle = useCallback((index) => {
    setCurrentPuzzleIndex(index);
    setLastDelta(null);
    setWrongCountForDelta(0);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentPuzzle = stagePuzzles[currentPuzzleIndex] ?? null;
  const hasNext       = currentPuzzleIndex < stagePuzzles.length - 1;
  const stageDef      = stages.find(s => s.id === currentStageId);
  const stageVideo    = currentStageId !== null && STAGE_VIDEOS[currentStageId]?.youtubeId
    ? STAGE_VIDEOS[currentStageId]
    : null;
  const completedPuzzleIds = stats?.stageProgress?.[currentStageId]?.completedPuzzleIds || [];

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
            Come back tomorrow for a fresh shuffle, or try the next stage.
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
      completedPuzzleIds={completedPuzzleIds}
      allStagePuzzles={stagePuzzles}
    />
  );
}
