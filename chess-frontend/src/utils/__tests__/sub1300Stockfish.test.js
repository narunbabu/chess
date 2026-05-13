import { Chess } from 'chess.js';
import {
  buildSub1300Candidates,
  clampEloToSub1300Step,
  createSub1300Profile,
  getSub1300StockfishConfig,
  selectSub1300StockfishMove,
  shouldUseSub1300Stockfish,
} from '../sub1300Stockfish';

const legalUciMoves = (game) => new Set(
  game.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion || ''}`)
);

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const createSeededRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const evaluateForColor = (game, color) => {
  if (game.isCheckmate()) {
    return game.turn() === color ? -100000 : 100000;
  }

  if (game.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = game.board();

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type] || 0;
      score += piece.color === color ? value : -value;
    }
  }

  const legalCount = game.moves().length;
  score += game.turn() === color ? legalCount * 2 : -legalCount * 2;

  if (game.isCheck()) {
    score += game.turn() === color ? -35 : 35;
  }

  return score;
};

const buildSimulatedEngineCandidates = (game) => {
  const sideToMove = game.turn();
  return game.moves({ verbose: true })
    .map((move) => {
      const copy = new Chess(game.fen());
      copy.move(`${move.from}${move.to}${move.promotion || ''}`);

      let cp = evaluateForColor(copy, sideToMove);
      if (move.san.includes('#')) cp = 100000;
      if (copy.isCheckmate()) cp = 100000;

      return {
        move: `${move.from}${move.to}${move.promotion || ''}`,
        cp,
      };
    })
    .sort((a, b) => b.cp - a.cp);
};

const testProfile = (elo) => ({
  ...createSub1300Profile(elo),
  skipMateSafetyChecks: true,
});

const playSyntheticGame = ({ whiteElo, blackElo, seed, maxPlies = 48 }) => {
  const game = new Chess();
  const rng = createSeededRng(seed);
  const plies = [];
  const cpLossByElo = {};

  while (!game.isGameOver() && plies.length < maxPlies) {
    const elo = game.turn() === 'w' ? whiteElo : blackElo;
    const candidates = buildSimulatedEngineCandidates(game);
    const selected = selectSub1300StockfishMove(game, candidates, elo, {
      rng,
      profile: testProfile(elo),
    });
    const legalMoves = legalUciMoves(game);

    expect(selected).toBeTruthy();
    expect(legalMoves.has(selected)).toBe(true);

    const bestCp = candidates[0]?.cp || 0;
    const selectedCp = candidates.find(candidate => candidate.move === selected)?.cp || 0;
    const cpLoss = Math.max(0, bestCp - selectedCp);
    cpLossByElo[elo] = cpLossByElo[elo] || [];
    cpLossByElo[elo].push(cpLoss);

    const result = game.move(selected);
    expect(result).toBeTruthy();

    plies.push({
      elo,
      move: selected,
      san: result.san,
    });
  }

  let result = 'draw';
  if (game.isCheckmate()) {
    result = game.turn() === 'w' ? 'black' : 'white';
  }

  return {
    result,
    plies: plies.length,
    finalFen: game.fen(),
    cpLossByElo,
  };
};

const average = (values) => (
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
);

const compareAverageCpLoss = ({ lowerElo, higherElo, seeds }) => {
  const lowerLosses = [];
  const higherLosses = [];
  const games = [];

  seeds.forEach((seed, index) => {
    const higherIsWhite = index % 2 === 0;
    const game = playSyntheticGame({
      whiteElo: higherIsWhite ? higherElo : lowerElo,
      blackElo: higherIsWhite ? lowerElo : higherElo,
      seed,
    });

    lowerLosses.push(...(game.cpLossByElo[lowerElo] || []));
    higherLosses.push(...(game.cpLossByElo[higherElo] || []));
    games.push(game);
  });

  return {
    lowerAverageLoss: average(lowerLosses),
    higherAverageLoss: average(higherLosses),
    lowerMoveCount: lowerLosses.length,
    higherMoveCount: higherLosses.length,
    games,
  };
};

describe('sub1300Stockfish policy wrapper', () => {
  it('snaps and clamps Elo to 50-point intervals from 200 to 1300', () => {
    expect(clampEloToSub1300Step(120)).toBe(200);
    expect(clampEloToSub1300Step(224)).toBe(200);
    expect(clampEloToSub1300Step(226)).toBe(250);
    expect(clampEloToSub1300Step(625)).toBe(650);
    expect(clampEloToSub1300Step(1399)).toBe(1300);
  });

  it('creates concrete profile values for anchor ratings', () => {
    const profile600 = createSub1300Profile(600);
    expect(profile600).toMatchObject({
      elo: 600,
      depth: 5,
      multipvCap: 64,
      temperatureCp: 405,
      pInaccuracy: 0.32,
      pMistake: 0.28,
      pBlunder: 0.2,
      maxLossCp: 1800,
    });
    expect(profile600.normalProbability).toBeCloseTo(0.2);

    const profile1300 = createSub1300Profile(1300);
    expect(profile1300.depth).toBe(10);
    expect(profile1300.multipvCap).toBe(24);
    expect(profile1300.normalProbability).toBeCloseTo(0.78);
  });

  it('builds a bounded Stockfish search config only for sub-1300 targets', () => {
    const game = new Chess();
    const config = getSub1300StockfishConfig(game, 850);

    expect(shouldUseSub1300Stockfish(1300)).toBe(true);
    expect(shouldUseSub1300Stockfish(1301)).toBe(false);
    expect(config.profile.elo).toBe(850);
    expect(config.depth).toBeGreaterThanOrEqual(6);
    expect(config.multipv).toBeLessThanOrEqual(game.moves().length);
    expect(getSub1300StockfishConfig(game, 1600)).toBeNull();
  });

  it('filters illegal Stockfish candidates before building move choices', () => {
    const game = new Chess();
    const profile = createSub1300Profile(900);
    const candidates = buildSub1300Candidates(game, [
      { move: 'e9e5', cp: 900 },
      { move: 'e2e4', cp: 30 },
      { move: 'g1f3', cp: 20 },
    ], profile);

    expect(candidates.map(candidate => candidate.move)).toEqual(['e2e4', 'g1f3']);
  });

  it('always returns a legal move even when Stockfish gives no usable candidate', () => {
    const game = new Chess();
    const selected = selectSub1300StockfishMove(game, [
      { move: 'e9e5', cp: 900 },
      { move: '(none)', cp: 0 },
    ], 300, { rng: () => 0 });

    expect(legalUciMoves(game).has(selected)).toBe(true);
  });

  it('can deliberately choose a blunder-band move at very low Elo', () => {
    const game = new Chess();
    const rngValues = [0, 0];
    const rng = () => (rngValues.length ? rngValues.shift() : 0);

    const selected = selectSub1300StockfishMove(game, [
      { move: 'e2e4', cp: 100 },
      { move: 'g1f3', cp: 90 },
      { move: 'h2h4', cp: -500 },
      { move: 'a2a4', cp: -700 },
    ], 200, { rng });

    expect(['h2h4', 'a2a4']).toContain(selected);
    expect(legalUciMoves(game).has(selected)).toBe(true);
  });

  it('plays synthetic-vs-synthetic plies across beginner levels without illegal moves', () => {
    const matchups = [
      { whiteElo: 200, blackElo: 600, seed: 101 },
      { whiteElo: 600, blackElo: 1000, seed: 202 },
      { whiteElo: 900, blackElo: 1300, seed: 303 },
      { whiteElo: 1300, blackElo: 200, seed: 404 },
    ];

    const results = matchups.map(playSyntheticGame);

    expect(results).toHaveLength(matchups.length);
    results.forEach((result) => {
      expect(result.plies).toBeGreaterThan(0);
      expect(result.plies).toBeLessThanOrEqual(48);
      expect(result.finalFen).toEqual(expect.any(String));
    });
  });

  it('stronger synthetic levels choose lower-loss moves over paired-color simulations', () => {
    const seeds = [11, 22, 33, 44];
    const pairings = [
      { lowerElo: 200, higherElo: 600 },
      { lowerElo: 600, higherElo: 1000 },
      { lowerElo: 900, higherElo: 1300 },
    ];

    pairings.forEach((pairing) => {
      const result = compareAverageCpLoss({ ...pairing, seeds });
      expect(result.games).toHaveLength(seeds.length);
      expect(result.lowerMoveCount).toBeGreaterThan(0);
      expect(result.higherMoveCount).toBeGreaterThan(0);
      expect(result.higherAverageLoss).toBeLessThan(result.lowerAverageLoss);
    });
  });
});
