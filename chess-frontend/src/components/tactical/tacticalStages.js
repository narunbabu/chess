export const stages = [
  {
    id: 0,
    title: 'Beginner Tactics',
    eloRange: '800 → 1400',
    description: 'Master the fundamentals: forks, pins, back-rank mates, and skewers. The patterns every player must see instantly.',
    themes: ['Fork', 'Pin', 'Back rank mate', 'Skewer', 'Hanging pieces'],
    puzzleCount: 500,
    unlocked: true,
    color: '#4ade80',
    icon: '♟',
    dataFile: 'beginner_puzzles.json',
    unlockAfter: 15, // puzzles to solve before Stage 1 unlocks
  },
  {
    id: 1,
    title: 'Tactical Sharpness',
    eloRange: '1400 → 1650',
    description: 'Stop missing multi-move tactics. Master double attacks, discovered checks, and removing the defender.',
    themes: ['Double attacks', 'Pins', 'Discovered attacks', 'Removing the defender'],
    puzzleCount: 500,
    unlocked: false,
    color: '#81b64c',
    icon: '⚡',
    dataFile: 'stage1_puzzles.json',
    unlockAfter: 20,
  },
  {
    id: 2,
    title: 'Calculation Depth',
    eloRange: '1650 → 1900',
    description: 'Calculate forcing lines clearly. Zwischenzug, deflection, sacrifices, and in-between moves.',
    themes: ['Zwischenzug', 'Deflection', 'Sacrifices', 'Forcing variations'],
    puzzleCount: 500,
    unlocked: false,
    color: '#5b8dd9',
    icon: '🧠',
    dataFile: 'stage2_puzzles.json',
    unlockAfter: 20,
  },
  {
    id: 3,
    title: 'Positional Tactics',
    eloRange: '1900 → 2100',
    description: 'See tactics arising from position — quiet moves, overloaded pieces, and zugzwang.',
    themes: ['Quiet moves', 'Overloaded pieces', 'Trapped pieces', 'Zugzwang'],
    puzzleCount: 500,
    unlocked: false,
    color: '#c9882a',
    icon: '🎯',
    dataFile: 'stage3_puzzles.json',
    unlockAfter: 20,
  },
  {
    id: 4,
    title: 'Master Calculation',
    eloRange: '2100 → 2200+',
    description: 'Long forcing lines, defensive resources, and endgame precision at master level.',
    themes: ['Long forcing lines', 'Defensive resources', 'Endgame tactics', 'Quiet killers'],
    puzzleCount: 500,
    unlocked: false,
    color: '#c93a3a',
    icon: '🏆',
    dataFile: 'stage4_puzzles.json',
    unlockAfter: 999,
  },
];

export const STORAGE_KEY = 'chess99_tactical_v2';

export function loadProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultProgress();
}

export function defaultProgress() {
  const stageProgress = {};
  stages.forEach(s => {
    stageProgress[s.id] = {
      attempted: 0,
      solved: 0,
      unlocked: s.id === 0,
      lastIndex: 0,
      completedPuzzleIds: [], // Track IDs of completed puzzles in this stage
    };
  });
  return {
    rating: 1000,
    totalAttempted: 0,
    totalSolved: 0,
    streak: 0,
    stageProgress,
  };
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

// Returns { cctScore, execScore, combined, cctQuality, myFound, myTotal, oppFound, oppTotal }
export function computePuzzleScore({
  wrongCount = 0,
  cctMyFound  = 0, cctMyTotal  = 0,
  cctOppFound = 0, cctOppTotal = 0,
  solutionShown = false,
}) {
  const myQuality  = cctMyTotal  > 0 ? cctMyFound  / cctMyTotal  : 1.0;
  const oppQuality = cctOppTotal > 0 ? cctOppFound / cctOppTotal : 1.0;
  const cctQuality = (myQuality + oppQuality) / 2;
  const cctScore   = Math.round(cctQuality * 100);

  const execScore = solutionShown ? 0
    : wrongCount === 0 ? 100
    : wrongCount === 1 ? 75
    : wrongCount === 2 ? 50
    : wrongCount === 3 ? 25
    : 10;

  const combined = Math.round(cctScore * 0.4 + execScore * 0.6);
  return {
    cctScore, execScore, combined, cctQuality,
    myFound: cctMyFound, myTotal: cctMyTotal,
    oppFound: cctOppFound, oppTotal: cctOppTotal,
  };
}

// Returns { value: number, sign: '+'/'-' } after a puzzle attempt
export function computeRatingDelta(puzzle, success, wrongCount, cctQuality = 1.0) {
  const base = puzzle.difficulty === 'very hard' ? 12
    : puzzle.difficulty === 'hard' ? 8
    : puzzle.difficulty === 'medium' ? 5
    : 3; // easy
  if (success) {
    const bonus = wrongCount === 0 ? Math.round(base * 0.4) : 0;
    const raw  = base + bonus;
    const mult = cctQuality >= 0.9 ? 1.0
      : cctQuality >= 0.7 ? 0.85
      : cctQuality >= 0.5 ? 0.70
      : 0.50;
    return { value: Math.max(1, Math.round(raw * mult)), sign: '+' };
  }
  return { value: Math.ceil(base * 0.3), sign: '-' };
}
