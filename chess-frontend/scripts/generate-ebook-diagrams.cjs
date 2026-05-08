const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('@playwright/test');
const { Chess } = require('chess.js');

const root = path.resolve(__dirname, '../src/data/ebooks/v2');
const pieceRoot = path.resolve(__dirname, '../../chess-backend/vendor/chesslablab/php-chess/img/pieces/standard');
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const colorRoles = {
  best: '#81b64c',
  candidate: '#7b61a6',
  check: '#ef4444',
  capture: '#5b8dd9',
  threat: '#c9882a',
  target: '#f59e0b',
  lastMove: 'rgba(255,221,0,0.35)',
  wrong: 'rgba(220,60,60,0.35)',
  safe: 'rgba(129,182,76,0.25)',
};
const boardTheme = {
  light: '#eeeed2',
  dark: '#769656',
};
const arrowStyle = {
  strokeWidth: 7,
  headWidth: 18,
  headHeight: 18,
  headRefX: 16,
  headRefY: 9,
  startPadding: 18,
  endPadding: 34,
  opacity: 0.78,
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findManifestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findManifestFiles(fullPath);
    return entry.name === 'manifest.json' ? [fullPath] : [];
  });
}

function collectBlocks(chapter) {
  const sectionBlocks = (chapter.sections || []).flatMap((section) => section.blocks || []);
  const checkpointBlocks = chapter.checkpoint?.blocks || [];
  return [...sectionBlocks, ...checkpointBlocks];
}

function collectMutableBlocks(chapter) {
  const sectionBlocks = (chapter.sections || []).flatMap((section) => section.blocks || []);
  const checkpointBlocks = chapter.checkpoint?.blocks || [];
  return [...sectionBlocks, ...checkpointBlocks];
}

function normalizeMove(move) {
  if (typeof move === 'string') return move;
  return move?.move;
}

function applyMove(chess, move) {
  const value = normalizeMove(move);
  if (!value) return false;

  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value)) {
    const from = value.slice(0, 2);
    const to = value.slice(2, 4);
    const promotion = value.length > 4 ? value.slice(4, 5) : undefined;
    return chess.move({ from, to, promotion });
  }

  return chess.move(value);
}

function finalFenForBlock(block) {
  if (block.type !== 'board_animation') return block.fen;

  try {
    const chess = new Chess(block.fen);
    (block.sequence || []).forEach((move) => applyMove(chess, move));
    return chess.fen();
  } catch {
    return block.fen;
  }
}

function parseBoardPlacement(fen) {
  const placement = String(fen || '').split(' ')[0];
  const ranks = placement.split('/');
  const board = {};

  ranks.forEach((rank, rankIdx) => {
    let fileIdx = 0;
    const boardRank = 8 - rankIdx;

    [...rank].forEach((char) => {
      if (/^[1-8]$/.test(char)) {
        fileIdx += Number(char);
        return;
      }

      const file = files[fileIdx];
      if (file && /^[pnbrqkPNBRQK]$/.test(char)) {
        board[`${file}${boardRank}`] = char;
      }
      fileIdx += 1;
    });
  });

  return board;
}

function squareToXY(square, orientation, squareSize) {
  const file = square[0];
  const rank = square[1];
  const displayFiles = orientation === 'black' ? [...files].reverse() : files;
  const displayRanks = orientation === 'black'
    ? ['1', '2', '3', '4', '5', '6', '7', '8']
    : ['8', '7', '6', '5', '4', '3', '2', '1'];

  return {
    x: displayFiles.indexOf(file) * squareSize,
    y: displayRanks.indexOf(rank) * squareSize,
  };
}

function squareCenter(square, orientation, squareSize) {
  const { x, y } = squareToXY(square, orientation, squareSize);
  return {
    x: x + squareSize / 2,
    y: y + squareSize / 2,
  };
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getRoleColor(colorRole, fallback = colorRoles.best) {
  return colorRoles[colorRole] || fallback;
}

function pieceDataUri(pieceChar) {
  const isWhite = pieceChar === pieceChar.toUpperCase();
  const dir = isWhite ? 'svg_white' : 'svg_black';
  const fileName = `${isWhite ? pieceChar.toUpperCase() : pieceChar.toLowerCase()}.svg`;
  const piecePath = path.join(pieceRoot, dir, fileName);
  const data = fs.readFileSync(piecePath, 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(data).toString('base64')}`;
}

function normalizeArrows(block) {
  const arrows = [...(block.arrows || [])];
  if (block.type === 'board_animation' && Array.isArray(block.sequence)) {
    block.sequence.forEach((entry) => {
      if (entry?.arrow) arrows.push(entry.arrow);
    });
  }
  return arrows;
}

function renderSvg(block) {
  const squareSize = 90;
  const boardSize = squareSize * 8;
  const orientation = block.orientation || 'white';
  const board = parseBoardPlacement(finalFenForBlock(block));
  const displayFiles = orientation === 'black' ? [...files].reverse() : files;
  const displayRanks = orientation === 'black'
    ? ['1', '2', '3', '4', '5', '6', '7', '8']
    : ['8', '7', '6', '5', '4', '3', '2', '1'];

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boardSize}" height="${boardSize}" viewBox="0 0 ${boardSize} ${boardSize}">`,
    '<defs>',
  ];

  normalizeArrows(block).forEach((arrow, index) => {
    const color = Array.isArray(arrow) ? (arrow[2] || colorRoles.best) : getRoleColor(arrow.colorRole, arrow.color || colorRoles.best);
    parts.push(`<marker id="arrow-${index}" markerWidth="${arrowStyle.headWidth}" markerHeight="${arrowStyle.headHeight}" refX="${arrowStyle.headRefX}" refY="${arrowStyle.headRefY}" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L${arrowStyle.headWidth},${arrowStyle.headRefY} L0,${arrowStyle.headHeight} Z" fill="${escapeAttr(color)}" /></marker>`);
  });

  parts.push('</defs>');
  parts.push(`<rect width="${boardSize}" height="${boardSize}" fill="${boardTheme.light}" />`);

  displayRanks.forEach((rank, row) => {
    displayFiles.forEach((file, col) => {
      const isDark = (row + col) % 2 === 1;
      parts.push(`<rect x="${col * squareSize}" y="${row * squareSize}" width="${squareSize}" height="${squareSize}" fill="${isDark ? boardTheme.dark : boardTheme.light}" />`);
    });
  });

  (block.highlights || []).forEach((highlight) => {
    const square = typeof highlight === 'string' ? highlight : highlight.square;
    if (!/^[a-h][1-8]$/.test(square || '')) return;
    const { x, y } = squareToXY(square, orientation, squareSize);
    const color = typeof highlight === 'string' ? colorRoles.safe : getRoleColor(highlight.colorRole, highlight.color || colorRoles.safe);
    parts.push(`<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${escapeAttr(color)}" />`);
  });

  Object.entries(board).forEach(([square, pieceChar]) => {
    const { x, y } = squareToXY(square, orientation, squareSize);
    const inset = 8;
    parts.push(`<image href="${pieceDataUri(pieceChar)}" x="${x + inset}" y="${y + inset}" width="${squareSize - inset * 2}" height="${squareSize - inset * 2}" preserveAspectRatio="xMidYMid meet" />`);
  });

  normalizeArrows(block).forEach((arrow, index) => {
    const from = Array.isArray(arrow) ? arrow[0] : arrow.from;
    const to = Array.isArray(arrow) ? arrow[1] : arrow.to;
    if (!/^[a-h][1-8]$/.test(from || '') || !/^[a-h][1-8]$/.test(to || '')) return;

    const start = squareCenter(from, orientation, squareSize);
    const end = squareCenter(to, orientation, squareSize);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const x1 = start.x + (dx / length) * arrowStyle.startPadding;
    const y1 = start.y + (dy / length) * arrowStyle.startPadding;
    const x2 = end.x - (dx / length) * arrowStyle.endPadding;
    const y2 = end.y - (dy / length) * arrowStyle.endPadding;
    const color = Array.isArray(arrow) ? (arrow[2] || colorRoles.best) : getRoleColor(arrow.colorRole, arrow.color || colorRoles.best);

    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeAttr(color)}" stroke-width="${arrowStyle.strokeWidth}" stroke-linecap="round" opacity="${arrowStyle.opacity}" marker-end="url(#arrow-${index})" />`);
  });

  displayFiles.forEach((file, col) => {
    const x = col * squareSize + squareSize - 14;
    const y = boardSize - 8;
    parts.push(`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#2f3a2c" text-anchor="middle">${file}</text>`);
  });

  displayRanks.forEach((rank, row) => {
    const x = 10;
    const y = row * squareSize + 18;
    parts.push(`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#2f3a2c">${rank}</text>`);
  });

  parts.push('</svg>');
  return parts.join('');
}

function collectDiagramJobs() {
  const jobs = [];

  findManifestFiles(root).forEach((manifestPath) => {
    const bookRoot = path.dirname(manifestPath);
    const manifest = readJson(manifestPath);

    (manifest.chapterOrder || []).forEach((chapterEntry) => {
      const chapterPath = path.resolve(bookRoot, chapterEntry.path);
      const chapter = readJson(chapterPath);

      collectBlocks(chapter)
        .filter((block) => block.exports?.png && block.fen)
        .forEach((block) => {
          jobs.push({
            bookId: manifest.bookId,
            chapterId: chapter.chapterId,
            block,
            outputPath: path.resolve(bookRoot, block.exports.png),
            sourcePath: chapterPath,
          });
        });
    });
  });

  return jobs;
}

function updateChapterHashes(hashesBySourcePath) {
  hashesBySourcePath.forEach((hashes, sourcePath) => {
    const chapter = readJson(sourcePath);
    let changed = false;

    hashes.forEach(({ blockId, hash }) => {
      const block = collectMutableBlocks(chapter).find((candidate) => candidate.id === blockId);
      if (!block?.exports) return;

      if (block.exports.hash !== hash) {
        block.exports.hash = hash;
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(sourcePath, `${JSON.stringify(chapter, null, 2)}\n`, 'utf8');
    }
  });
}

async function main() {
  const jobs = collectDiagramJobs();
  if (!jobs.length) {
    console.log('No ebook diagram export jobs found.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 760 }, deviceScaleFactor: 1 });
  const assetManifest = [];
  const hashesBySourcePath = new Map();

  for (const job of jobs) {
    ensureDir(path.dirname(job.outputPath));
    const svg = renderSvg(job.block);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#ffffff;}#diagram{display:inline-block;padding:20px;background:#ffffff;}</style></head><body><div id="diagram">${svg}</div></body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.locator('#diagram').screenshot({ path: job.outputPath });
    const hash = sha256File(job.outputPath);

    assetManifest.push({
      bookId: job.bookId,
      chapterId: job.chapterId,
      blockId: job.block.id,
      type: job.block.type,
      png: path.relative(root, job.outputPath).replace(/\\/g, '/'),
      sha256: hash,
    });

    if (!hashesBySourcePath.has(job.sourcePath)) {
      hashesBySourcePath.set(job.sourcePath, []);
    }
    hashesBySourcePath.get(job.sourcePath).push({
      blockId: job.block.id,
      hash,
    });
  }

  await browser.close();
  updateChapterHashes(hashesBySourcePath);

  const manifestPath = path.join(root, 'asset-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    diagrams: assetManifest,
  }, null, 2)}\n`);

  console.log(`Generated ${jobs.length} ebook diagram PNG(s).`);
  console.log(`Asset manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
