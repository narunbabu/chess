const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Chess } = require('chess.js');

const repoRoot = path.resolve(__dirname, '../..');
const ebookRoot = path.resolve(__dirname, '../src/data/ebooks/v2');
const reviewRoot = path.resolve(repoRoot, 'docs/ebook-review-packs');
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const boardBlockTypes = new Set([
  'board_diagram',
  'board_animation',
  'guided_move',
  'puzzle',
  'cct_scan',
  'mistake_refutation',
  'model_game',
]);
const tierOrder = {
  free: 0,
  silver: 1,
  gold: 2,
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
  const sectionBlocks = (chapter.sections || []).flatMap((section) => (
    (section.blocks || []).map((block) => ({ ...block, sectionTitle: section.title, sectionId: section.id }))
  ));
  const checkpointBlocks = (chapter.checkpoint?.blocks || []).map((block) => ({
    ...block,
    sectionTitle: chapter.checkpoint.title || 'Checkpoint',
    sectionId: chapter.checkpoint.id || 'checkpoint',
  }));
  return sectionBlocks.concat(checkpointBlocks);
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

function textForBlock(block) {
  return [
    block.title,
    block.body_md,
    block.caption_md,
    block.prompt_md,
    block.question_md,
    block.successMessage,
    block.failureMessage,
  ].filter(Boolean).join('\n');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractSquares(text) {
  return unique((String(text || '').match(/\b[a-h][1-8]\b/gi) || []).map((square) => square.toLowerCase()));
}

function extractMoves(text) {
  return unique((String(text || '').match(/\b[a-h][1-8][a-h][1-8][qrbn]?\b/gi) || []).map((move) => move.toLowerCase()));
}

function arrowEndpoints(arrow) {
  if (Array.isArray(arrow)) return [arrow[0], arrow[1]];
  return [arrow?.from, arrow?.to];
}

function blockArrows(block) {
  const arrows = [...(block.arrows || [])];
  if (block.type === 'board_animation') {
    (block.sequence || []).forEach((entry) => {
      if (entry?.arrow) arrows.push(entry.arrow);
      const move = normalizeMove(entry);
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || '')) {
        arrows.push({ from: move.slice(0, 2), to: move.slice(2, 4), colorRole: 'best' });
      }
    });
  }
  return arrows;
}

function visualSquares(block) {
  const squares = new Set(Object.keys(parseBoardPlacement(finalFenForBlock(block))));

  (block.highlights || []).forEach((highlight) => {
    squares.add(typeof highlight === 'string' ? highlight : highlight.square);
  });

  blockArrows(block).forEach((arrow) => {
    const [from, to] = arrowEndpoints(arrow);
    squares.add(from);
    squares.add(to);
  });

  return unique([...squares]);
}

function summarizeArrows(block) {
  const arrows = blockArrows(block).map((arrow) => {
    const [from, to] = arrowEndpoints(arrow);
    const role = Array.isArray(arrow) ? arrow[2] : arrow.colorRole || arrow.color;
    return `${from || '?'}-${to || '?'}${role ? ` (${role})` : ''}`;
  });
  return arrows.length ? arrows.join(', ') : 'none';
}

function summarizeHighlights(block) {
  const highlights = (block.highlights || []).map((highlight) => {
    if (typeof highlight === 'string') return highlight;
    return `${highlight.square}${highlight.colorRole ? ` (${highlight.colorRole})` : ''}`;
  });
  return highlights.length ? highlights.join(', ') : 'none';
}

function summarizeAssertions(block) {
  const assertions = (block.assertions || []).map((assertion) => {
    if (assertion.type === 'piece_on') return `piece_on ${assertion.piece} ${assertion.square}`;
    if (assertion.type === 'legal_move') return `legal_move ${assertion.move}`;
    if (assertion.type === 'side_to_move') return `side_to_move ${assertion.value}`;
    if (assertion.type === 'highlight_exists') return `highlight_exists ${assertion.square}`;
    if (assertion.type === 'arrow_exists') return `arrow_exists ${assertion.from}-${assertion.to}`;
    return assertion.type;
  });
  return assertions.length ? assertions.join(', ') : 'none';
}

function posixRelative(fromFile, targetFile) {
  return path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToHtml(md) {
  return String(md || '')
    .split(/\n{2,}/)
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph.trim())
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      return escaped ? `<p>${escaped}</p>` : '';
    })
    .join('\n');
}

function mdText(md) {
  return String(md || '').replace(/\n{3,}/g, '\n\n');
}

function assetStatus(block, bookRoot) {
  if (!block.exports?.png) return { label: 'no exported PNG', detail: 'Interactive or prose-only block.' };

  const assetPath = path.resolve(bookRoot, block.exports.png);
  if (!fs.existsSync(assetPath)) {
    return { label: 'missing', detail: block.exports.png };
  }

  const actualHash = sha256File(assetPath);
  if (block.exports.hash !== actualHash) {
    return { label: 'hash mismatch', detail: `${block.exports.hash || 'missing'} != ${actualHash}` };
  }

  return { label: 'ok', detail: actualHash, assetPath };
}

function reviewAssertionResults(chapter, blocks) {
  const results = [];
  const assertions = chapter.reviewAssertions || [];

  assertions.forEach((assertion) => {
    if (assertion.type === 'minimum_board_diagrams') {
      const count = blocks.filter((block) => block.type === 'board_diagram').length;
      results.push({
        gate: `minimum_board_diagrams >= ${assertion.value}`,
        passed: count >= assertion.value,
        detail: `${count} board_diagram block(s)`,
      });
      return;
    }

    if (assertion.type === 'minimum_guided_moves') {
      const count = blocks.filter((block) => block.type === 'guided_move').length;
      results.push({
        gate: `minimum_guided_moves >= ${assertion.value}`,
        passed: count >= assertion.value,
        detail: `${count} guided_move block(s)`,
      });
      return;
    }

    if (assertion.type === 'minimum_quizzes') {
      const count = blocks.filter((block) => block.type === 'quiz').length;
      results.push({
        gate: `minimum_quizzes >= ${assertion.value}`,
        passed: count >= assertion.value,
        detail: `${count} quiz block(s)`,
      });
      return;
    }

    if (assertion.type === 'tier_allowed') {
      const required = tierOrder[chapter.requiredTier];
      const allowed = tierOrder[assertion.value];
      results.push({
        gate: `tier_allowed <= ${assertion.value}`,
        passed: required <= allowed,
        detail: `chapter tier is ${chapter.requiredTier}`,
      });
      return;
    }

    results.push({
      gate: assertion.type,
      passed: false,
      detail: 'Unknown review assertion type.',
    });
  });

  return results;
}

function blockReview(block, bookRoot) {
  const warnings = [];
  const text = textForBlock(block);
  const mentionedSquares = extractSquares(text);
  const mentionedMoves = extractMoves(text);
  const visibleSquares = boardBlockTypes.has(block.type) ? visualSquares(block) : [];
  const asset = assetStatus(block, bookRoot);

  if (boardBlockTypes.has(block.type) && !(block.assertions || []).length) {
    warnings.push('Board-like block has no deterministic assertions.');
  }

  if (boardBlockTypes.has(block.type) && mentionedSquares.length) {
    const missingSquares = mentionedSquares.filter((square) => !visibleSquares.includes(square));
    if (missingSquares.length) {
      warnings.push(`Text mentions square(s) not represented by pieces, highlights, or arrows: ${missingSquares.join(', ')}.`);
    }
  }

  if (block.exports?.png && asset.label !== 'ok') {
    warnings.push(`Exported PNG status is ${asset.label}: ${asset.detail}`);
  }

  return {
    warnings,
    mentionedSquares,
    mentionedMoves,
    visibleSquares,
    asset,
  };
}

function qualityRows(chapter, blocks, blockReviews) {
  const exported = blocks.filter((block) => block.exports?.png).length;
  const boardBlocks = blocks.filter((block) => boardBlockTypes.has(block.type)).length;
  const interactive = blocks.filter((block) => ['guided_move', 'puzzle', 'quiz', 'checkpoint'].includes(block.type)).length;
  const warnings = blockReviews.flatMap((review) => review.warnings);

  return [
    ['Sections', `${chapter.sections?.length || 0}`, true],
    ['Total blocks', `${blocks.length}`, true],
    ['Board-like blocks', `${boardBlocks}`, boardBlocks > 0],
    ['Generated PNG exports', `${exported}`, exported > 0],
    ['Interactive/check blocks', `${interactive}`, interactive > 0],
    ['Deterministic warnings', `${warnings.length}`, warnings.length === 0],
  ];
}

function renderMarkdownReview({ manifest, chapter, chapterPath, outputPath, bookRoot }) {
  const blocks = collectBlocks(chapter);
  const blockReviews = blocks.map((block) => blockReview(block, bookRoot));
  const assertionResults = reviewAssertionResults(chapter, blocks);
  const hasFailures = blockReviews.some((review) => review.warnings.length) || assertionResults.some((result) => !result.passed);
  const quality = qualityRows(chapter, blocks, blockReviews);
  const lines = [];

  lines.push(`# Review Pack: ${chapter.title}`);
  lines.push('');
  lines.push(`Book: ${manifest.title}`);
  lines.push(`Chapter: ${chapter.chapterId}`);
  lines.push(`Source: ${posixRelative(outputPath, chapterPath)}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Status: ${hasFailures ? 'NEEDS REVIEW' : 'PASS - deterministic checks clean'}`);
  lines.push('');
  lines.push('## Chapter Intent');
  lines.push('');
  lines.push(`ELO range: ${chapter.eloRange || `${manifest.eloStart || '?'}-${manifest.eloEnd || '?'}`}`);
  lines.push(`Required tier: ${chapter.requiredTier}`);
  lines.push(`Estimated minutes: ${chapter.estimatedMinutes || 'unknown'}`);
  lines.push('');
  lines.push('Learning objectives:');
  (chapter.learningObjectives || []).forEach((objective) => lines.push(`- ${objective}`));
  lines.push('');
  lines.push('## Quality Gates');
  lines.push('');
  lines.push('| Gate | Result | Detail |');
  lines.push('| --- | --- | --- |');
  quality.forEach(([gate, detail, passed]) => {
    lines.push(`| ${gate} | ${passed ? 'PASS' : 'FLAG'} | ${detail} |`);
  });
  assertionResults.forEach((result) => {
    lines.push(`| ${result.gate} | ${result.passed ? 'PASS' : 'FLAG'} | ${result.detail} |`);
  });
  lines.push('');
  lines.push('## Block Review');
  lines.push('');

  blocks.forEach((block, index) => {
    const review = blockReviews[index];
    lines.push(`### ${block.id} - ${block.title || block.type}`);
    lines.push('');
    lines.push(`Section: ${block.sectionTitle || 'n/a'}`);
    lines.push(`Type: ${block.type}`);

    if (block.fen) lines.push(`FEN: \`${block.fen}\``);
    if (block.orientation) lines.push(`Orientation: ${block.orientation}`);
    if (boardBlockTypes.has(block.type)) {
      lines.push(`Arrows: ${summarizeArrows(block)}`);
      lines.push(`Highlights: ${summarizeHighlights(block)}`);
      lines.push(`Assertions: ${summarizeAssertions(block)}`);
      lines.push(`Text square claims: ${review.mentionedSquares.length ? review.mentionedSquares.join(', ') : 'none'}`);
      lines.push(`Text move claims: ${review.mentionedMoves.length ? review.mentionedMoves.join(', ') : 'none'}`);
      lines.push(`Visual square evidence: ${review.visibleSquares.length ? review.visibleSquares.join(', ') : 'none'}`);
    }

    if (review.asset.assetPath) {
      const imagePath = posixRelative(outputPath, review.asset.assetPath);
      lines.push('');
      lines.push(`![${block.id}](${imagePath})`);
      lines.push('');
      lines.push(`PNG hash: \`${review.asset.detail}\``);
    } else if (block.exports?.png) {
      lines.push(`PNG: ${review.asset.label} (${review.asset.detail})`);
    }

    const text = mdText(textForBlock(block));
    if (text) {
      lines.push('');
      lines.push('Text under review:');
      lines.push('');
      lines.push('```text');
      lines.push(text);
      lines.push('```');
    }

    if (block.type === 'quiz') {
      lines.push('');
      lines.push('Quiz options:');
      (block.options || []).forEach((option) => {
        lines.push(`- ${option.isCorrect ? '[correct]' : '[wrong]'} ${option.id}: ${option.label}`);
      });
    }

    lines.push('');
    if (review.warnings.length) {
      lines.push('Reviewer flags:');
      review.warnings.forEach((warning) => lines.push(`- ${warning}`));
    } else {
      lines.push('Reviewer flags: none from deterministic checks.');
    }
    lines.push('');
  });

  lines.push('## Human Signoff');
  lines.push('');
  lines.push('- Chess analyst: pending');
  lines.push('- Visual reviewer: pending');
  lines.push('- Pedagogy reviewer: pending');
  lines.push('- Final editor: pending');
  lines.push('');

  return lines.join('\n');
}

function renderPrintHtml({ manifest, chapter, outputPath, bookRoot }) {
  const blocks = collectBlocks(chapter);
  const blockReviews = blocks.map((block) => blockReview(block, bookRoot));
  const title = `${manifest.title}: ${chapter.title}`;
  const parts = [];
  let activeSectionId = null;

  parts.push('<!doctype html>');
  parts.push('<html lang="en">');
  parts.push('<head>');
  parts.push('<meta charset="utf-8">');
  parts.push(`<title>${escapeHtml(title)}</title>`);
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push('<style>');
  parts.push(`
    body { font-family: Arial, sans-serif; color: #172018; font-size: 17px; margin: 0; background: #f7f7f2; line-height: 1.62; }
    main { max-width: 900px; margin: 0 auto; padding: 40px 34px 60px; background: #fff; }
    h1, h2, h3 { line-height: 1.2; color: #172018; }
    h1 { font-size: 36px; margin: 0 0 8px; }
    h2 { font-size: 25px; margin: 38px 0 16px; border-top: 1px solid #d8ddcf; padding-top: 24px; }
    h3 { font-size: 20px; margin: 0 0 10px; }
    p { margin: 0 0 16px; }
    .meta { color: #536257; margin-bottom: 24px; }
    .objectives { background: #eef4e7; border-left: 4px solid #81b64c; padding: 14px 18px; }
    .block { break-inside: avoid; margin: 24px 0; }
    .block + .block { margin-top: 30px; }
    .diagram { width: min(100%, 560px); display: block; margin: 14px auto; border: 1px solid #d4dcc8; }
    .caption { color: #536257; font-size: 15px; margin-top: 8px; }
    .quiz-options { margin-top: 10px; }
    .quiz-option { margin: 7px 0; }
    @media print {
      body { background: #fff; }
      main { max-width: none; padding: 0; }
      .block { page-break-inside: avoid; }
    }
  `);
  parts.push('</style>');
  parts.push('</head>');
  parts.push('<body>');
  parts.push('<main>');
  parts.push(`<h1>${escapeHtml(chapter.title)}</h1>`);
  parts.push(`<div class="meta">${escapeHtml(manifest.title)} | ${escapeHtml(chapter.eloRange || '')} | ${escapeHtml(chapter.requiredTier || '')}</div>`);
  if (chapter.subtitle) parts.push(mdToHtml(chapter.subtitle));
  parts.push('<section class="objectives">');
  parts.push('<strong>Learning objectives</strong>');
  parts.push('<ul>');
  (chapter.learningObjectives || []).forEach((objective) => parts.push(`<li>${escapeHtml(objective)}</li>`));
  parts.push('</ul>');
  parts.push('</section>');

  blocks.forEach((block, index) => {
    const review = blockReviews[index];
    if (block.sectionId && block.sectionId !== activeSectionId) {
      activeSectionId = block.sectionId;
      if (block.sectionTitle) {
        parts.push(`<h2>${escapeHtml(block.sectionTitle)}</h2>`);
      }
    }

    parts.push(`<section class="block" id="${escapeHtml(block.id)}">`);
    if (block.title) {
      parts.push(`<h3>${escapeHtml(block.title)}</h3>`);
    }

    if (block.body_md) parts.push(mdToHtml(block.body_md));
    if (block.prompt_md) parts.push(mdToHtml(block.prompt_md));
    if (block.question_md) parts.push(mdToHtml(block.question_md));

    if (review.asset.assetPath) {
      const imagePath = posixRelative(outputPath, review.asset.assetPath);
      parts.push(`<img class="diagram" src="${escapeHtml(imagePath)}" alt="${escapeHtml(block.title || block.id)}">`);
    }

    if (block.caption_md) {
      parts.push(`<div class="caption">${mdToHtml(block.caption_md)}</div>`);
    }

    if (block.type === 'quiz') {
      parts.push('<div class="quiz-options">');
      (block.options || []).forEach((option) => {
        parts.push(`<div class="quiz-option">${escapeHtml(option.id)}. ${escapeHtml(option.label)}</div>`);
      });
      parts.push('</div>');
    }

    parts.push('</section>');
  });

  parts.push('</main>');
  parts.push('</body>');
  parts.push('</html>');
  return parts.join('\n');
}

function renderIndex(entries) {
  const lines = [];
  lines.push('# Chess99 E-Book Review Packs');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Book | Chapter | Markdown review | Print HTML | Status |');
  lines.push('| --- | --- | --- | --- | --- |');
  entries.forEach((entry) => {
    lines.push(`| ${entry.bookTitle} | ${entry.chapterTitle} | [review](${entry.reviewPath}) | [print](${entry.printPath}) | ${entry.status} |`);
  });
  lines.push('');
  lines.push('These files are generated from the v2 ebook JSON packages and deterministic PNG assets. Reviewers should use them as the handoff surface before chapter publication.');
  lines.push('');
  return lines.join('\n');
}

function exportReviewPacks() {
  ensureDir(reviewRoot);
  const entries = [];
  const manifestFiles = findManifestFiles(ebookRoot);

  manifestFiles.forEach((manifestPath) => {
    const bookRoot = path.dirname(manifestPath);
    const manifest = readJson(manifestPath);
    const bookOutputRoot = path.join(reviewRoot, manifest.bookId);
    ensureDir(bookOutputRoot);

    (manifest.chapterOrder || []).forEach((chapterEntry) => {
      const chapterPath = path.resolve(bookRoot, chapterEntry.path);
      const chapter = readJson(chapterPath);
      const outputPath = path.join(bookOutputRoot, `${chapter.chapterId}.md`);
      const printPath = path.join(bookOutputRoot, `${chapter.chapterId}.print.html`);
      const blocks = collectBlocks(chapter);
      const blockReviews = blocks.map((block) => blockReview(block, bookRoot));
      const assertionResults = reviewAssertionResults(chapter, blocks);
      const status = blockReviews.some((review) => review.warnings.length) || assertionResults.some((result) => !result.passed)
        ? 'NEEDS REVIEW'
        : 'PASS';

      fs.writeFileSync(outputPath, renderMarkdownReview({ manifest, chapter, chapterPath, outputPath, bookRoot }), 'utf8');
      fs.writeFileSync(printPath, renderPrintHtml({ manifest, chapter, outputPath: printPath, bookRoot }), 'utf8');

      entries.push({
        bookTitle: manifest.title,
        chapterTitle: chapter.title,
        reviewPath: posixRelative(path.join(reviewRoot, 'index.md'), outputPath),
        printPath: posixRelative(path.join(reviewRoot, 'index.md'), printPath),
        status,
      });
    });
  });

  const indexPath = path.join(reviewRoot, 'index.md');
  fs.writeFileSync(indexPath, renderIndex(entries), 'utf8');

  console.log(`Generated ${entries.length} ebook review pack(s). Index: ${indexPath}`);
}

exportReviewPacks();
