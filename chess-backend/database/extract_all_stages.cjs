// extract_all_stages.cjs
// Run from chess-backend/database/: node extract_all_stages.cjs
// Reads lichess_db_puzzle.csv and outputs 5 JSON files (beginner + 4 stages)
// Requires the CSV to exist (280MB compressed → 1.1GB extracted)

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Stage Definitions ────────────────────────────────────────────────────────
const STAGE_DEFS = [
  {
    key: 'beginner',
    file: 'beginner_puzzles.json',
    minElo: 800,
    maxElo: 1400,
    targetCount: 500,
    themes: ['fork', 'pin', 'mateIn1', 'mateIn2', 'skewer', 'trappedPiece', 'hangingPiece', 'backRankMate'],
    difficultyFn: r => r < 1100 ? 'easy' : r < 1250 ? 'medium' : 'hard',
    label: 'Beginner',
    stageNum: 0,
  },
  {
    key: 'stage1',
    file: 'stage1_puzzles.json',
    minElo: 1400,
    maxElo: 1650,
    targetCount: 500,
    themes: ['fork', 'pin', 'discoveredAttack', 'clearance', 'advantage', 'skewer', 'removeTheDefender', 'doubleCheck'],
    difficultyFn: r => r < 1520 ? 'medium' : 'hard',
    label: 'Tactical Sharpness',
    stageNum: 1,
  },
  {
    key: 'stage2',
    file: 'stage2_puzzles.json',
    minElo: 1650,
    maxElo: 1900,
    targetCount: 500,
    themes: ['zwischenzug', 'deflection', 'sacrifice', 'attraction', 'crushing', 'intermezzo', 'quietMove', 'pin'],
    difficultyFn: r => r < 1770 ? 'medium' : 'hard',
    label: 'Calculation Depth',
    stageNum: 2,
  },
  {
    key: 'stage3',
    file: 'stage3_puzzles.json',
    minElo: 1900,
    maxElo: 2100,
    targetCount: 500,
    themes: ['quietMove', 'overloadedPiece', 'trappedPiece', 'endgame', 'pawnEndgame', 'promotion', 'zugzwang', 'interference'],
    difficultyFn: r => r < 2000 ? 'medium' : 'hard',
    label: 'Positional Tactics',
    stageNum: 3,
  },
  {
    key: 'stage4',
    file: 'stage4_puzzles.json',
    minElo: 2100,
    maxElo: 2800,
    targetCount: 500,
    themes: ['long', 'veryLong', 'endgame', 'masterVsMaster', 'defensiveMove', 'zugzwang', 'mateIn5', 'mateIn4', 'quietMove'],
    difficultyFn: r => r < 2300 ? 'hard' : 'very hard',
    label: 'Master Calculation',
    stageNum: 4,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function extractAll() {
  const csvPath = path.join(__dirname, 'lichess_db_puzzle.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('ERROR: lichess_db_puzzle.csv not found. Download and extract it first.');
    process.exit(1);
  }

  // Init collectors
  const collectors = {};
  for (const def of STAGE_DEFS) {
    collectors[def.key] = [];
  }

  let lineNum = 0;
  let allDone = false;

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  console.log('Scanning CSV (this may take 2-3 minutes for 5.8M rows)...');

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // skip header

    if (lineNum % 500000 === 0) {
      const counts = STAGE_DEFS.map(d => `${d.label}: ${collectors[d.key].length}/${d.targetCount}`).join(', ');
      console.log(`  Row ${(lineNum/1000000).toFixed(1)}M — ${counts}`);
    }

    // Check if all stages are full
    if (!allDone) {
      allDone = STAGE_DEFS.every(d => collectors[d.key].length >= d.targetCount);
      if (allDone) {
        console.log('All stages full — stopping early.');
        break;
      }
    }

    // CSV: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const cols = line.split(',');
    if (cols.length < 8) continue;

    const [id, fen, movesStr, ratingStr, ratingDevStr, popularityStr] = cols;
    const themesStr = cols[7] || '';
    const rating = parseInt(ratingStr, 10);
    const ratingDev = parseInt(ratingDevStr, 10);
    const popularity = parseInt(popularityStr, 10);

    if (isNaN(rating)) continue;
    // Filter out unreliable puzzles (high deviation = fewer games played)
    if (ratingDev > 150) continue;
    // Filter out unpopular puzzles
    if (!isNaN(popularity) && popularity < 60) continue;

    const themes = themesStr.trim().split(' ').filter(Boolean);
    const moves = movesStr.trim().split(' ').filter(Boolean);
    if (moves.length < 2) continue; // skip trivial 1-move puzzles at least for harder stages

    const playerColor = fen.includes(' w ') ? 'w' : 'b';

    // Match to a stage
    for (const def of STAGE_DEFS) {
      if (collectors[def.key].length >= def.targetCount) continue;
      if (rating < def.minElo || rating > def.maxElo) continue;

      const hasTheme = themes.some(t => def.themes.includes(t));
      if (!hasTheme) continue;

      // Deduplicate by FEN prefix (avoid very similar positions)
      const fenKey = fen.split(' ').slice(0, 2).join(' ');

      collectors[def.key].push({
        id: `s${def.stageNum}_${id}`,
        stage: def.stageNum,
        fen,
        moves,
        themes: themes.slice(0, 4),
        difficulty: def.difficultyFn(rating),
        rating,
        explanation: buildExplanation(playerColor, themes, rating),
        playerColor,
      });

      break; // Each puzzle goes to at most one stage
    }
  }

  // Write output files
  const outDir = path.join(__dirname, '..', '..', 'chess-frontend', 'src', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  for (const def of STAGE_DEFS) {
    const puzzles = collectors[def.key];
    const outPath = path.join(outDir, def.file);
    fs.writeFileSync(outPath, JSON.stringify(puzzles, null, 2));
    console.log(`✓ ${def.file}: ${puzzles.length} puzzles (target ${def.targetCount})`);
  }

  console.log('\nDone! All puzzle files written to chess-frontend/src/data/');
}

function buildExplanation(playerColor, themes, rating) {
  const who = playerColor === 'w' ? 'White' : 'Black';
  const motifs = {
    fork: 'win material with a fork',
    pin: 'exploit the pin',
    discoveredAttack: 'unleash a discovered attack',
    clearance: 'use a clearance sacrifice',
    sacrifice: 'find the winning sacrifice',
    zwischenzug: 'spot the zwischenzug (in-between move)',
    deflection: 'deflect the defending piece',
    attraction: 'lure the king into a mating net',
    quietMove: 'find the quiet, powerful move',
    overloadedPiece: 'exploit the overloaded defender',
    trappedPiece: 'trap the opponent\'s piece',
    mateIn1: 'deliver checkmate in one move',
    mateIn2: 'deliver checkmate in two moves',
    endgame: 'convert the endgame advantage',
    skewer: 'execute the skewer',
    removeTheDefender: 'remove the key defender',
    backRankMate: 'exploit the back rank weakness',
    promotion: 'promote a pawn to win',
    zugzwang: 'create a zugzwang',
    interference: 'use interference to win',
  };

  for (const theme of themes) {
    if (motifs[theme]) {
      return `${who} to move and ${motifs[theme]}. Rating: ${rating}`;
    }
  }
  return `Find the best move for ${who}. Rating: ${rating}`;
}

extractAll().catch(err => { console.error(err); process.exit(1); });
