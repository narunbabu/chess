const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const dataDir = path.join(__dirname, '..', 'src', 'data');
const puzzleFiles = fs.readdirSync(dataDir)
  .filter((file) => /^stage\d+_puzzles\.json$/.test(file) || file === 'beginner_puzzles.json')
  .sort();

const failures = [];
let total = 0;

function getPuzzleList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.puzzles)) return raw.puzzles;
  return [];
}

function normalizeMoves(moves) {
  if (Array.isArray(moves)) return moves;
  return String(moves || '').trim().split(/\s+/).filter(Boolean);
}

function playMove(game, move) {
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(move)) {
    return game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] || undefined,
    });
  }

  return game.move(move);
}

for (const file of puzzleFiles) {
  const fullPath = path.join(dataDir, file);
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const puzzles = getPuzzleList(raw);

  if (puzzles.length === 0) {
    failures.push({ file, error: 'No puzzles found' });
    continue;
  }

  for (const puzzle of puzzles) {
    total += 1;
    const id = puzzle.id || puzzle.puzzle_id || puzzle.PuzzleId || `${file}:${total}`;
    const fen = puzzle.fen || puzzle.FEN;
    const moves = normalizeMoves(puzzle.moves || puzzle.solution || puzzle.Moves);

    if (!fen) {
      failures.push({ file, id, error: 'Missing FEN' });
      continue;
    }

    if (moves.length === 0) {
      failures.push({ file, id, error: 'Missing solution moves' });
      continue;
    }

    let game;
    try {
      game = new Chess(fen);
    } catch (error) {
      failures.push({ file, id, error: `Invalid FEN: ${error.message}` });
      continue;
    }

    for (const move of moves) {
      const before = game.fen();
      let result = null;

      try {
        result = playMove(game, move);
      } catch {
        result = null;
      }

      if (!result) {
        failures.push({ file, id, error: `Illegal move: ${move}`, fen: before });
        break;
      }
    }
  }
}

const summary = {
  files: puzzleFiles,
  total,
  failures: failures.length,
  examples: failures.slice(0, 20),
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = failures.length > 0 ? 1 : 0;
