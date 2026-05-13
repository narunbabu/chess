const MIN_ELO = 200;
const MAX_ELO = 1300;
const ELO_STEP = 50;

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PROFILE_ANCHORS = [
  {
    elo: 200,
    depth: 3,
    multipvCap: 96,
    searchTimeMs: 250,
    temperatureCp: 900,
    pInaccuracy: 0.23,
    pMistake: 0.32,
    pBlunder: 0.40,
    maxLossCp: 2800,
    mateBlunderWeight: 0.95,
    unscoredTailLimit: 24,
  },
  {
    elo: 400,
    depth: 4,
    multipvCap: 80,
    searchTimeMs: 350,
    temperatureCp: 650,
    pInaccuracy: 0.25,
    pMistake: 0.33,
    pBlunder: 0.30,
    maxLossCp: 2300,
    mateBlunderWeight: 0.9,
    unscoredTailLimit: 18,
  },
  {
    elo: 600,
    depth: 5,
    multipvCap: 64,
    searchTimeMs: 500,
    temperatureCp: 405,
    pInaccuracy: 0.32,
    pMistake: 0.28,
    pBlunder: 0.2,
    maxLossCp: 1800,
    mateBlunderWeight: 0.8,
    unscoredTailLimit: 8,
  },
  {
    elo: 800,
    depth: 6,
    multipvCap: 53,
    searchTimeMs: 650,
    temperatureCp: 281,
    pInaccuracy: 0.28,
    pMistake: 0.21,
    pBlunder: 0.13,
    maxLossCp: 1514,
    mateBlunderWeight: 0.5,
    unscoredTailLimit: 0,
  },
  {
    elo: 1000,
    depth: 8,
    multipvCap: 41,
    searchTimeMs: 850,
    temperatureCp: 170,
    pInaccuracy: 0.24,
    pMistake: 0.14,
    pBlunder: 0.07,
    maxLossCp: 1229,
    mateBlunderWeight: 0.24,
    unscoredTailLimit: 0,
  },
  {
    elo: 1200,
    depth: 9,
    multipvCap: 30,
    searchTimeMs: 1050,
    temperatureCp: 77,
    pInaccuracy: 0.2,
    pMistake: 0.07,
    pBlunder: 0.03,
    maxLossCp: 943,
    mateBlunderWeight: 0.08,
    unscoredTailLimit: 0,
  },
  {
    elo: 1300,
    depth: 10,
    multipvCap: 24,
    searchTimeMs: 1200,
    temperatureCp: 45,
    pInaccuracy: 0.16,
    pMistake: 0.04,
    pBlunder: 0.02,
    maxLossCp: 800,
    mateBlunderWeight: 0.02,
    unscoredTailLimit: 0,
  },
];

export const SUB1300_STOCKFISH_MIN_ELO = MIN_ELO;
export const SUB1300_STOCKFISH_MAX_ELO = MAX_ELO;
export const SUB1300_STOCKFISH_ELO_STEP = ELO_STEP;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const interpolate = (from, to, t) => from + (to - from) * t;

const roundProfileNumber = (value, key) => {
  if (key.startsWith('p') || key === 'mateBlunderWeight') {
    return Number(value.toFixed(4));
  }
  return Math.round(value);
};

export const clampEloToSub1300Step = (elo) => {
  const numericElo = Number.isFinite(Number(elo)) ? Number(elo) : MAX_ELO;
  const snapped = Math.round(numericElo / ELO_STEP) * ELO_STEP;
  return clamp(snapped, MIN_ELO, MAX_ELO);
};

export const shouldUseSub1300Stockfish = (elo) => {
  const numericElo = Number(elo);
  return Number.isFinite(numericElo) && numericElo <= MAX_ELO;
};

export const createSub1300Profile = (elo) => {
  const snappedElo = clampEloToSub1300Step(elo);
  const exact = PROFILE_ANCHORS.find(anchor => anchor.elo === snappedElo);

  if (exact) {
    const normalProbability = Math.max(
      0,
      1 - exact.pInaccuracy - exact.pMistake - exact.pBlunder
    );

    return {
      ...exact,
      normalProbability: Number(normalProbability.toFixed(4)),
    };
  }

  let lower = PROFILE_ANCHORS[0];
  let upper = PROFILE_ANCHORS[PROFILE_ANCHORS.length - 1];

  for (let i = 0; i < PROFILE_ANCHORS.length - 1; i += 1) {
    if (snappedElo >= PROFILE_ANCHORS[i].elo && snappedElo <= PROFILE_ANCHORS[i + 1].elo) {
      lower = PROFILE_ANCHORS[i];
      upper = PROFILE_ANCHORS[i + 1];
      break;
    }
  }

  const t = (snappedElo - lower.elo) / (upper.elo - lower.elo);
  const profile = { elo: snappedElo };

  Object.keys(lower).forEach((key) => {
    if (key === 'elo') return;
    profile[key] = roundProfileNumber(interpolate(lower[key], upper[key], t), key);
  });

  profile.normalProbability = Number(Math.max(
    0,
    1 - profile.pInaccuracy - profile.pMistake - profile.pBlunder
  ).toFixed(4));

  return profile;
};

const moveToUci = (move) => {
  if (!move || !move.from || !move.to) return null;
  return `${move.from}${move.to}${move.promotion || ''}`.toLowerCase();
};

const normalizeUciMove = (move) => {
  if (typeof move !== 'string') return null;
  const normalized = move.trim().split(/\s+/)[0].toLowerCase();
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized) ? normalized : null;
};

const getLegalMoveEntries = (game) => (
  game.moves({ verbose: true }).map(move => ({
    ...move,
    uci: moveToUci(move),
  })).filter(move => move.uci)
);

export const getSub1300StockfishConfig = (game, elo) => {
  if (!shouldUseSub1300Stockfish(elo)) return null;

  const profile = createSub1300Profile(elo);
  const legalMoveCount = game?.moves ? game.moves().length : profile.multipvCap;

  return {
    profile,
    depth: profile.depth,
    moveTimeMs: profile.searchTimeMs,
    multipv: Math.max(1, Math.min(legalMoveCount || 1, profile.multipvCap)),
    timeoutMs: profile.searchTimeMs + 2500,
  };
};

const isCheckmateAfterMove = (game, moveUci) => {
  try {
    const copy = new game.constructor(game.fen());
    const result = copy.move(moveUci);
    return Boolean(result && copy.isCheckmate());
  } catch (_) {
    return false;
  }
};

const allowsMateInOne = (game, moveUci) => {
  try {
    const copy = new game.constructor(game.fen());
    const result = copy.move(moveUci);
    if (!result || copy.isGameOver()) return false;

    const replies = copy.moves({ verbose: true });

    for (const reply of replies) {
      const replyUci = moveToUci(reply);
      if (!replyUci) continue;

      const replyCopy = new copy.constructor(copy.fen());
      replyCopy.move(replyUci);

      if (replyCopy.isCheckmate()) {
        return true;
      }
    }

    return false;
  } catch (_) {
    return false;
  }
};

const isRecapture = (game, move) => {
  const history = game.history({ verbose: true });
  if (!history.length || !move?.captured) return false;
  return history[history.length - 1].to === move.to;
};

const getFullMoveNumber = (game) => {
  const parts = game.fen().split(' ');
  const fullMove = Number(parts[5]);
  return Number.isFinite(fullMove) && fullMove > 0 ? fullMove : 1;
};

const humanPlausibility = (game, move, lossCp) => {
  if (!move) return 0.05;

  let weight = 1.0;
  const piece = move.piece;
  const captured = move.captured;
  const flags = move.flags || '';
  const early = getFullMoveNumber(game) <= 10;
  const ownBackRank = game.turn() === 'w' ? '1' : '8';
  const fromRank = move.from?.[1];
  const toRank = move.to?.[1];

  if (captured || flags.includes('c') || flags.includes('e')) {
    weight *= 1.35;

    if (captured && piece) {
      const attackerValue = PIECE_VALUES[piece] || 100;
      const victimValue = PIECE_VALUES[captured] || 100;
      weight *= victimValue >= attackerValue ? 1.25 : 0.95;
    }
  }

  if ((move.san || '').includes('+') || (move.san || '').includes('#')) {
    weight *= 1.25;
  }

  if (move.promotion) {
    weight *= 2.0;
  }

  if (flags.includes('k') || flags.includes('q')) {
    weight *= 1.35;
  }

  if (isRecapture(game, move)) {
    weight *= 1.3;
  }

  if (early) {
    if ((piece === 'n' || piece === 'b') && fromRank === ownBackRank && toRank !== ownBackRank) {
      weight *= 1.25;
    }

    if (piece === 'q') {
      weight *= 0.9;
    }

    if (piece === 'k' && !flags.includes('k') && !flags.includes('q')) {
      weight *= 0.25;
    }

    if (piece === 'r') {
      weight *= 0.65;
    }
  }

  if (piece === 'p') {
    weight *= 1.05;

    const file = move.from?.[0];
    if (early && (file === 'a' || file === 'h')) {
      weight *= 0.85;
    }
  }

  if (lossCp > 1200) {
    weight *= 0.75;
  }

  return Math.max(0.05, weight);
};

export const buildSub1300Candidates = (game, movesWithEval, profile = createSub1300Profile(MAX_ELO)) => {
  const legalMoves = getLegalMoveEntries(game);
  const legalByUci = new Map(legalMoves.map(move => [move.uci, move]));
  const scoredByUci = new Map();

  (movesWithEval || []).forEach((candidate) => {
    const uci = normalizeUciMove(candidate?.move);
    const cp = Number(candidate?.cp);

    if (!uci || !legalByUci.has(uci) || !Number.isFinite(cp) || scoredByUci.has(uci)) {
      return;
    }

    scoredByUci.set(uci, {
      move: uci,
      verboseMove: legalByUci.get(uci),
      scoreCp: cp,
      fromUnscoredTail: false,
    });
  });

  const scored = Array.from(scoredByUci.values());

  if (!scored.length) {
    return [];
  }

  if (profile.unscoredTailLimit > 0 && scored.length < legalMoves.length) {
    const worstCp = Math.min(...scored.map(candidate => candidate.scoreCp));
    const missing = legalMoves.filter(move => !scoredByUci.has(move.uci));

    missing.slice(0, profile.unscoredTailLimit).forEach((move, index) => {
      scoredByUci.set(move.uci, {
        move: move.uci,
        verboseMove: move,
        scoreCp: worstCp - 300 - (index * 80),
        fromUnscoredTail: true,
      });
    });
  }

  const allScored = Array.from(scoredByUci.values());
  const bestCp = Math.max(...allScored.map(candidate => candidate.scoreCp));

  return allScored
    .map((candidate) => {
      const rawLossCp = Math.max(0, bestCp - candidate.scoreCp);

      return {
        ...candidate,
        rawLossCp,
        lossCp: Math.min(rawLossCp, 5000),
        plausibility: humanPlausibility(game, candidate.verboseMove, rawLossCp),
        allowsMateInOne: null,
      };
    })
    .sort((a, b) => a.rawLossCp - b.rawLossCp);
};

const getAllowsMateInOne = (game, candidate) => {
  if (typeof candidate.allowsMateInOne !== 'boolean') {
    candidate.allowsMateInOne = allowsMateInOne(game, candidate.move);
  }
  return candidate.allowsMateInOne;
};

const sampleTier = (profile, rng) => {
  let r = rng();

  if (r < profile.pBlunder) return 'blunder';
  r -= profile.pBlunder;

  if (r < profile.pMistake) return 'mistake';
  r -= profile.pMistake;

  if (r < profile.pInaccuracy) return 'inaccuracy';

  return 'normal';
};

const getTierWindow = (profile, tier) => {
  const weakness = (MAX_ELO - profile.elo) / (MAX_ELO - MIN_ELO);

  if (tier === 'inaccuracy') {
    return {
      lo: 25,
      hi: Math.round(180 + (80 * weakness)),
    };
  }

  if (tier === 'mistake') {
    return {
      lo: 140,
      hi: Math.round(500 + (220 * weakness)),
    };
  }

  return {
    lo: Math.round(400 - (150 * weakness)),
    hi: Math.max(700, profile.maxLossCp),
  };
};

const weightedChoice = (items, weights, rng) => {
  const cleanWeights = weights.map(weight => (
    Number.isFinite(weight) && weight > 0 ? weight : 0
  ));
  const total = cleanWeights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return items[Math.floor(rng() * items.length)] || items[0];
  }

  let r = rng() * total;

  for (let i = 0; i < items.length; i += 1) {
    r -= cleanWeights[i];
    if (r <= 0) return items[i];
  }

  return items[items.length - 1];
};

const tierWeight = (game, candidate, tier, window, profile) => {
  const target = (window.lo + window.hi) / 2;
  const spread = Math.max(1, (window.hi - window.lo) / 2);
  const z = (candidate.lossCp - target) / spread;
  let weight = candidate.plausibility * Math.exp(-0.5 * z * z);

  if (candidate.rawLossCp > profile.maxLossCp) {
    weight *= tier === 'blunder'
      ? Math.max(0.03, 0.5 * profile.mateBlunderWeight)
      : 0.03;
  }

  if (!profile.skipMateSafetyChecks && getAllowsMateInOne(game, candidate)) {
    weight *= tier === 'blunder'
      ? profile.mateBlunderWeight
      : 0.005;
  }

  if (candidate.fromUnscoredTail && profile.elo >= 600) {
    weight *= 0.35;
  }

  return Math.max(weight, 1e-12);
};

const selectCandidateFromTier = (game, candidates, tier, profile, rng) => {
  if (tier === 'normal') {
    let pool = candidates.filter(candidate => candidate.lossCp <= Math.min(250, profile.maxLossCp));

    if (!pool.length) {
      pool = candidates.slice(0, Math.min(8, candidates.length));
    }

    const weights = pool.map((candidate) => {
      let weight = candidate.plausibility * Math.exp(
        -candidate.lossCp / Math.max(1, profile.temperatureCp)
      );

      if (!profile.skipMateSafetyChecks && getAllowsMateInOne(game, candidate)) {
        weight *= 0.001 + (0.02 * profile.mateBlunderWeight);
      }

      return Math.max(weight, 1e-12);
    });

    return weightedChoice(pool, weights, rng);
  }

  const window = getTierWindow(profile, tier);
  let pool = candidates.filter(candidate => (
    candidate.lossCp >= window.lo && candidate.lossCp <= window.hi
  ));

  if (tier === 'blunder' && !pool.length) {
    pool = candidates.filter(candidate => candidate.lossCp >= window.lo);
  }

  if (!pool.length) {
    const target = (window.lo + window.hi) / 2;
    pool = [...candidates]
      .sort((a, b) => Math.abs(a.lossCp - target) - Math.abs(b.lossCp - target))
      .slice(0, Math.min(8, candidates.length));
  }

  const weights = pool.map(candidate => tierWeight(game, candidate, tier, window, profile));
  return weightedChoice(pool, weights, rng);
};

const chooseLegalFallback = (game, rng) => {
  const legalMoves = getLegalMoveEntries(game);
  if (!legalMoves.length) return null;
  const index = Math.floor(rng() * legalMoves.length);
  return legalMoves[index]?.uci || legalMoves[0].uci;
};

export const selectSub1300StockfishMove = (
  game,
  movesWithEval,
  targetElo,
  options = {}
) => {
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const profile = options.profile || createSub1300Profile(targetElo);
  const legalMoves = getLegalMoveEntries(game);
  const legalUciSet = new Set(legalMoves.map(move => move.uci));

  if (!legalMoves.length) return null;
  if (legalMoves.length === 1) return legalMoves[0].uci;

  const immediateMates = legalMoves
    .filter(move => isCheckmateAfterMove(game, move.uci))
    .map(move => move.uci);
  let excludedMoves = new Set();

  if (immediateMates.length) {
    const strength = (profile.elo - MIN_ELO) / (MAX_ELO - MIN_ELO);
    const pFindMate = 0.08 + (0.87 * strength);

    if (rng() < pFindMate) {
      return immediateMates[Math.floor(rng() * immediateMates.length)];
    }

    if (immediateMates.length < legalMoves.length) {
      excludedMoves = new Set(immediateMates);
    }
  }

  let candidates = buildSub1300Candidates(game, movesWithEval, profile);

  if (excludedMoves.size) {
    const filtered = candidates.filter(candidate => !excludedMoves.has(candidate.move));
    if (filtered.length) {
      candidates = filtered;
    }
  }

  if (!candidates.length) {
    return chooseLegalFallback(game, rng);
  }

  const tier = sampleTier(profile, rng);
  const selected = selectCandidateFromTier(game, candidates, tier, profile, rng);

  if (!selected || !legalUciSet.has(selected.move)) {
    return chooseLegalFallback(game, rng);
  }

  return selected.move;
};

const sub1300Stockfish = {
  SUB1300_STOCKFISH_MIN_ELO,
  SUB1300_STOCKFISH_MAX_ELO,
  SUB1300_STOCKFISH_ELO_STEP,
  clampEloToSub1300Step,
  shouldUseSub1300Stockfish,
  createSub1300Profile,
  getSub1300StockfishConfig,
  buildSub1300Candidates,
  selectSub1300StockfishMove,
};

export default sub1300Stockfish;
