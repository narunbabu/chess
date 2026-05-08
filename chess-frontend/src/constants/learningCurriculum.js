export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    label: 'Free',
    rank: 0,
    color: '#8b8987',
    promise: 'Start playing confidently with rules, core lessons, and a daily habit.',
  },
  silver: {
    id: 'silver',
    label: 'Silver',
    rank: 1,
    color: '#b8c0c8',
    promise: 'Build club strength with full beginner and club training access.',
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    rank: 2,
    color: '#e8a93e',
    promise: 'Train deliberately with advanced calculation, preparation, and analytics.',
  },
};

export const normalizeSubscriptionTier = (tier) => {
  if (tier === 'standard') return 'silver';
  if (tier === 'premium') return 'gold';
  return SUBSCRIPTION_TIERS[tier] ? tier : 'free';
};

export const canAccessTier = (currentTier = 'free', requiredTier = 'free') => {
  const current = SUBSCRIPTION_TIERS[normalizeSubscriptionTier(currentTier)];
  const required = SUBSCRIPTION_TIERS[normalizeSubscriptionTier(requiredTier)];
  return current.rank >= required.rank;
};

export const getSubscriptionLabel = (tier = 'free') => {
  return SUBSCRIPTION_TIERS[normalizeSubscriptionTier(tier)].label;
};

export const SKILL_BANDS = [
  {
    id: 'newcomer',
    label: 'Newcomer',
    ratingRange: '0-600',
    legacyTier: 'beginner',
    requiredTier: 'free',
    focus: 'Rules, legal moves, check, mate, and first complete games.',
    promise: 'I can play a legal game.',
  },
  {
    id: 'beginner',
    label: 'Beginner',
    ratingRange: '600-1000',
    legacyTier: 'beginner',
    requiredTier: 'free',
    focus: 'Basic threats, hanging pieces, simple mates, and opening habits.',
    promise: 'I can recognize basic threats.',
  },
  {
    id: 'improving-beginner',
    label: 'Improving Beginner',
    ratingRange: '1000-1400',
    legacyTier: 'intermediate',
    requiredTier: 'silver',
    focus: 'Tactical patterns, simple calculation, and practical endgames.',
    promise: 'I know what to look for.',
  },
  {
    id: 'club-player',
    label: 'Club Player',
    ratingRange: '1400-1800',
    legacyTier: 'intermediate',
    requiredTier: 'silver',
    focus: 'Candidate moves, plans, pawn structures, conversion, and defense.',
    promise: 'I can make structured decisions.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    ratingRange: '1800-2200',
    legacyTier: 'advanced',
    requiredTier: 'gold',
    focus: 'Deep calculation, defensive resources, complex endings, and tradeoffs.',
    promise: 'I can compete seriously.',
  },
  {
    id: 'competitive',
    label: 'Competitive',
    ratingRange: '2200+',
    legacyTier: 'advanced',
    requiredTier: 'gold',
    focus: 'Preparation, model games, repertoire work, and tournament routines.',
    promise: 'I train deliberately for results.',
  },
];

export const getSkillBand = (id) => SKILL_BANDS.find((band) => band.id === id);

export const getSkillBandsForLegacyTier = (legacyTier) => {
  return SKILL_BANDS.filter((band) => band.legacyTier === legacyTier);
};

export const DAILY_CHALLENGE_TRACKS = [
  {
    id: 'daily-starter',
    label: 'Daily Starter',
    requiredTier: 'free',
    skillBands: ['newcomer', 'beginner'],
    challengeType: 'puzzle',
    focus: 'One clear tactic or mate pattern.',
  },
  {
    id: 'daily-improvement',
    label: 'Daily Improvement',
    requiredTier: 'silver',
    skillBands: ['beginner', 'improving-beginner', 'club-player'],
    challengeType: 'puzzle',
    focus: 'A calculation puzzle matched to the player path.',
  },
  {
    id: 'daily-endgame',
    label: 'Daily Endgame',
    requiredTier: 'silver',
    skillBands: ['improving-beginner', 'club-player', 'advanced'],
    challengeType: 'endgame',
    focus: 'Practical conversion or saving technique.',
  },
  {
    id: 'daily-master',
    label: 'Daily Master',
    requiredTier: 'gold',
    skillBands: ['advanced', 'competitive'],
    challengeType: 'puzzle',
    focus: 'A deeper calculation or defensive-resource challenge.',
  },
];

export const getAvailableDailyTracks = (currentTier = 'free') => {
  return DAILY_CHALLENGE_TRACKS.map((track) => ({
    ...track,
    isLocked: !canAccessTier(currentTier, track.requiredTier),
  }));
};

export const TRAINING_DRILL_CATALOG = [
  {
    id: 'queen-support-mate',
    legacyLevel: 'beginner',
    legacyId: 1,
    skillBand: 'newcomer',
    requiredTier: 'free',
    type: 'pattern',
    theme: 'Checkmate',
    title: 'Supported Queen Mate',
    description: 'Finish a mate in one by using queen and king coordination.',
    objective: 'Recognize when the queen is protected enough to deliver mate.',
    position: '4k3/7Q/4K3/8/8/8/8/8 w - - 0 1',
    solution: ['h7e7'],
    hints: ['The queen needs to check on the same file as the king.', 'Keep the white king close enough to support the queen.'],
    thinkingSteps: ['Find checks first.', 'Check whether the black king has an escape square.', 'Make the mate only when the queen is protected.'],
    successMessage: 'Correct. Qe7# uses the queen and king together.',
  },
  {
    id: 'promotion-check',
    legacyLevel: 'beginner',
    legacyId: 2,
    skillBand: 'newcomer',
    requiredTier: 'free',
    type: 'habit',
    theme: 'Promotion',
    title: 'Promote With Check',
    description: 'Convert an advanced pawn into a queen with check.',
    objective: 'Practice the promotion habit before the pawn is stopped.',
    position: '7k/6P1/5K2/8/8/8/8/8 w - - 0 1',
    solution: ['g7g8=Q'],
    hints: ['The pawn has reached the seventh rank.', 'Choose the strongest promotion piece.'],
    thinkingSteps: ['Look at forcing moves.', 'Promote before the king can approach.', 'Prefer a queen unless there is a special reason not to.'],
    successMessage: 'Good. Promotion creates a new queen and keeps the move forcing.',
  },
  {
    id: 'opposition-step',
    legacyLevel: 'beginner',
    legacyId: 3,
    skillBand: 'beginner',
    requiredTier: 'free',
    type: 'endgame',
    theme: 'King and pawn endings',
    title: 'Take the Opposition',
    description: 'Use the king actively before pushing the pawn.',
    objective: 'Learn that king position often decides pawn endings.',
    position: '4k3/8/8/3P4/3K4/8/8/8 w - - 0 1',
    solution: ['d4e5'],
    hints: ['The king should lead the pawn.', 'Step toward the key squares.'],
    thinkingSteps: ['Improve the king first.', 'Keep the pawn protected.', 'Force the defender backward.'],
    successMessage: 'Right. Ke5 takes key space before the pawn advances.',
  },
  {
    id: 'back-rank-mate',
    legacyLevel: 'intermediate',
    legacyId: 1,
    skillBand: 'beginner',
    requiredTier: 'free',
    type: 'pattern',
    theme: 'Back rank',
    title: 'Back Rank Mate',
    description: 'Use the trapped king and blocked escape squares.',
    objective: 'Spot a standard back-rank finish.',
    position: '6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1',
    solution: ['f1f8'],
    hints: ['The black pawns block the king.', 'A rook check on the back rank is decisive.'],
    thinkingSteps: ['Find checks.', 'Count escape squares.', 'Use the rook on the open file.'],
    successMessage: 'Perfect. Rf8# is the back-rank pattern.',
  },
  {
    id: 'knight-fork-king-rook',
    legacyLevel: 'intermediate',
    legacyId: 2,
    skillBand: 'improving-beginner',
    requiredTier: 'silver',
    type: 'calculation',
    theme: 'Forks',
    title: 'Knight Fork',
    description: 'Move the knight with check and attack a loose rook.',
    objective: 'Train forcing moves that win material.',
    position: '8/4k3/8/8/3N3r/8/8/4K3 w - - 0 1',
    solution: ['d4f5'],
    hints: ['Look for a knight check.', 'The rook on h4 is also vulnerable.'],
    thinkingSteps: ['Start with checks.', 'Check what the knight attacks after moving.', 'Prefer moves that gain time.'],
    successMessage: 'Nice. Nf5+ forks the king and rook.',
  },
  {
    id: 'rook-opposition-conversion',
    legacyLevel: 'intermediate',
    legacyId: 3,
    skillBand: 'club-player',
    requiredTier: 'silver',
    type: 'endgame',
    theme: 'Rook endings',
    title: 'Activate the Rook',
    description: 'Put the rook behind the passer before the king can blockade.',
    objective: 'Build the rook-ending habit of activity first.',
    position: '8/4k3/8/3P4/8/8/4K3/R7 w - - 0 1',
    solution: ['a1d1'],
    hints: ['The passed pawn needs support from behind.', 'Rook activity matters more than checking once.'],
    thinkingSteps: ['Identify the passed pawn.', 'Put the rook where it supports promotion.', 'Make the defender passive.'],
    successMessage: 'Good practical choice. Rd1 supports the passer from behind.',
  },
  {
    id: 'candidate-move-discipline',
    legacyLevel: 'advanced',
    legacyId: 1,
    skillBand: 'advanced',
    requiredTier: 'gold',
    type: 'calculation',
    theme: 'Candidate moves',
    title: 'Forcing Candidate',
    description: 'Choose the forcing move before settling for a quiet improvement.',
    objective: 'Practice calculating checks before positional moves.',
    position: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solution: ['e1e8'],
    hints: ['A check changes the move order.', 'The back rank is weak.'],
    thinkingSteps: ['List checks.', 'Compare the opponent replies.', 'Choose the forcing continuation.'],
    successMessage: 'Correct. Re8+ uses the back-rank weakness immediately.',
  },
  {
    id: 'competitive-prep-pattern',
    legacyLevel: 'advanced',
    legacyId: 2,
    skillBand: 'competitive',
    requiredTier: 'gold',
    type: 'review',
    theme: 'Conversion',
    title: 'Convert With Check',
    description: 'Keep the initiative while improving the rook.',
    objective: 'Train conversion through forcing move order.',
    position: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solution: ['d1d8'],
    hints: ['Checks reduce calculation noise.', 'The defender has few king squares.'],
    thinkingSteps: ['Find the forcing move.', 'Verify the back-rank pattern.', 'Keep the rook active after the check.'],
    successMessage: 'Strong. Rd8+ keeps control and forces the defender to solve problems.',
  },
];

export const getTrainingDrillsBySkillBand = () => {
  return SKILL_BANDS.map((band) => ({
    ...band,
    drills: TRAINING_DRILL_CATALOG.filter((drill) => drill.skillBand === band.id),
  }));
};

export const getExercise = (level, id) => {
  const normalizedId = String(id);

  return TRAINING_DRILL_CATALOG.find((exercise) => {
    const directMatch = exercise.skillBand === level && exercise.id === normalizedId;
    const legacyMatch = exercise.legacyLevel === level && String(exercise.legacyId) === normalizedId;
    return directMatch || legacyMatch;
  }) || null;
};
