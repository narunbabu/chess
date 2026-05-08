const fs = require('fs');
const path = require('path');
const { Chess } = require('chess.js');

const root = path.resolve(__dirname, '../src/data/ebooks/v2');
const validTiers = new Set(['free', 'silver', 'gold']);
const tierOrder = {
  free: 0,
  silver: 1,
  gold: 2,
};
const validColorRoles = new Set(['best', 'candidate', 'check', 'capture', 'threat', 'target', 'lastMove', 'wrong', 'safe']);
const validBlockTypes = new Set([
  'prose',
  'board_diagram',
  'board_animation',
  'guided_move',
  'puzzle',
  'cct_scan',
  'mistake_refutation',
  'model_game',
  'image',
  'quiz',
  'checkpoint',
]);
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const squarePattern = /^[a-h][1-8]$/;

function sha256File(filePath) {
  return require('crypto').createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findManifestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findManifestFiles(fullPath);
    return entry.name === 'manifest.json' ? [fullPath] : [];
  });
}

function parseBoardPlacement(fen) {
  const placement = String(fen || '').split(' ')[0];
  const ranks = placement.split('/');
  const board = {};

  if (ranks.length !== 8) {
    return { board, errors: ['FEN placement must have 8 ranks'] };
  }

  const errors = [];
  ranks.forEach((rank, rankIdx) => {
    let fileIdx = 0;
    const boardRank = 8 - rankIdx;

    [...rank].forEach((char) => {
      if (/^[1-8]$/.test(char)) {
        fileIdx += Number(char);
        return;
      }

      const file = files[fileIdx];
      if (!file || !/^[pnbrqkPNBRQK]$/.test(char)) {
        errors.push(`Invalid piece placement token "${char}" in rank ${boardRank}`);
        return;
      }

      board[`${file}${boardRank}`] = {
        color: char === char.toUpperCase() ? 'white' : 'black',
        type: {
          p: 'pawn',
          n: 'knight',
          b: 'bishop',
          r: 'rook',
          q: 'queen',
          k: 'king',
        }[char.toLowerCase()],
      };
      fileIdx += 1;
    });

    if (fileIdx !== 8) {
      errors.push(`Rank ${boardRank} resolves to ${fileIdx} files instead of 8`);
    }
  });

  return { board, errors };
}

function tryChess(fen) {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function addError(errors, location, message) {
  errors.push(`${location}: ${message}`);
}

function validateSquare(errors, location, square) {
  if (!squarePattern.test(square || '')) {
    addError(errors, location, `Invalid square "${square}"`);
  }
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

function validateArrow(errors, location, arrow) {
  if (Array.isArray(arrow)) {
    validateSquare(errors, `${location}.from`, arrow[0]);
    validateSquare(errors, `${location}.to`, arrow[1]);
    return;
  }

  validateSquare(errors, `${location}.from`, arrow?.from);
  validateSquare(errors, `${location}.to`, arrow?.to);
  if (arrow?.colorRole && !validColorRoles.has(arrow.colorRole)) {
    addError(errors, location, `Unknown colorRole "${arrow.colorRole}"`);
  }
}

function validateHighlight(errors, location, highlight) {
  const square = typeof highlight === 'string' ? highlight : highlight?.square;
  validateSquare(errors, location, square);
  if (highlight?.colorRole && !validColorRoles.has(highlight.colorRole)) {
    addError(errors, location, `Unknown colorRole "${highlight.colorRole}"`);
  }
}

function validateAssertions(errors, location, block, chess, board) {
  (block.assertions || []).forEach((assertion, index) => {
    const assertionLocation = `${location}.assertions[${index}]`;

    switch (assertion.type) {
      case 'side_to_move': {
        if (!chess) {
          addError(errors, assertionLocation, 'side_to_move assertion needs a legal chess position');
          return;
        }
        const actual = chess.turn() === 'w' ? 'white' : 'black';
        if (actual !== assertion.value) {
          addError(errors, assertionLocation, `Expected ${assertion.value} to move, got ${actual}`);
        }
        break;
      }
      case 'piece_on': {
        validateSquare(errors, `${assertionLocation}.square`, assertion.square);
        const actual = board[assertion.square];
        const expected = String(assertion.piece || '').split('_');
        if (!actual || actual.color !== expected[0] || actual.type !== expected.slice(1).join('_')) {
          addError(errors, assertionLocation, `Expected ${assertion.piece} on ${assertion.square}`);
        }
        break;
      }
      case 'legal_move': {
        if (!chess) {
          addError(errors, assertionLocation, 'legal_move assertion needs a legal chess position');
          return;
        }
        const copy = new Chess(chess.fen());
        if (!applyMove(copy, assertion.move)) {
          addError(errors, assertionLocation, `Illegal move "${assertion.move}"`);
        }
        break;
      }
      case 'highlight_exists': {
        const highlights = block.highlights || [];
        const exists = highlights.some((highlight) => (
          (typeof highlight === 'string' ? highlight : highlight.square) === assertion.square
        ));
        if (!exists) {
          addError(errors, assertionLocation, `Missing highlight on ${assertion.square}`);
        }
        break;
      }
      case 'arrow_exists': {
        const arrows = block.arrows || [];
        const exists = arrows.some((arrow) => {
          const from = Array.isArray(arrow) ? arrow[0] : arrow.from;
          const to = Array.isArray(arrow) ? arrow[1] : arrow.to;
          return from === assertion.from && to === assertion.to;
        });
        if (!exists) {
          addError(errors, assertionLocation, `Missing arrow ${assertion.from}-${assertion.to}`);
        }
        break;
      }
      default:
        addError(errors, assertionLocation, `Unknown assertion type "${assertion.type}"`);
    }
  });
}

function validateBoardBlock(errors, location, block, bookRoot) {
  if (!block.fen) {
    addError(errors, location, 'Missing FEN');
    return;
  }

  const { board, errors: placementErrors } = parseBoardPlacement(block.fen);
  placementErrors.forEach((message) => addError(errors, location, message));

  const chess = tryChess(block.fen);
  if (!chess && ['guided_move', 'puzzle', 'board_animation'].includes(block.type)) {
    addError(errors, location, `${block.type} needs a legal chess position`);
  }

  (block.arrows || []).forEach((arrow, index) => validateArrow(errors, `${location}.arrows[${index}]`, arrow));
  (block.highlights || []).forEach((highlight, index) => validateHighlight(errors, `${location}.highlights[${index}]`, highlight));
  validateAssertions(errors, location, block, chess, board);

  if (block.exports?.png) {
    const assetPath = path.resolve(bookRoot, block.exports.png);
    if (!fs.existsSync(assetPath)) {
      addError(errors, location, `Missing generated diagram asset "${block.exports.png}"`);
    } else if (!block.exports.hash || block.exports.hash === 'pending') {
      addError(errors, location, `Missing SHA-256 hash for "${block.exports.png}"`);
    } else {
      const actualHash = sha256File(assetPath);
      if (actualHash !== block.exports.hash) {
        addError(errors, location, `Hash mismatch for "${block.exports.png}"`);
      }
    }
  }

  if (block.type === 'guided_move') {
    (block.acceptedMoves || []).forEach((move, index) => {
      if (!chess) return;
      const copy = new Chess(chess.fen());
      if (!applyMove(copy, move)) {
        addError(errors, `${location}.acceptedMoves[${index}]`, `Illegal accepted move "${move}"`);
      }
    });
  }

  if (block.type === 'board_animation') {
    if (!Array.isArray(block.sequence) || block.sequence.length === 0) {
      addError(errors, location, 'board_animation needs a non-empty sequence');
      return;
    }

    if (chess) {
      const copy = new Chess(chess.fen());
      block.sequence.forEach((move, index) => {
        if (!applyMove(copy, move)) {
          addError(errors, `${location}.sequence[${index}]`, `Illegal animation move "${normalizeMove(move)}"`);
        }
      });
    }
  }
}

function collectBlocks(chapter) {
  const sectionBlocks = (chapter.sections || []).flatMap((section) => section.blocks || []);
  const checkpointBlocks = chapter.checkpoint?.blocks || [];
  return [...sectionBlocks, ...checkpointBlocks];
}

function validateQuiz(errors, location, block) {
  if (!block.question_md && !block.question) {
    addError(errors, location, 'quiz needs question_md');
  }
  if (!Array.isArray(block.options) || block.options.length < 2) {
    addError(errors, location, 'quiz needs at least two options');
    return;
  }
  const correctCount = block.options.filter((option) => option.isCorrect).length;
  if (correctCount !== 1) {
    addError(errors, location, `quiz needs exactly one correct option, got ${correctCount}`);
  }
}

function validateReviewAssertions(errors, location, chapter, blocks) {
  (chapter.reviewAssertions || []).forEach((assertion, index) => {
    const assertionLocation = `${location}.reviewAssertions[${index}]`;

    switch (assertion.type) {
      case 'minimum_board_diagrams': {
        const count = blocks.filter((block) => block.type === 'board_diagram').length;
        if (count < assertion.value) {
          addError(errors, assertionLocation, `Expected at least ${assertion.value} board_diagram block(s), got ${count}`);
        }
        break;
      }
      case 'minimum_guided_moves': {
        const count = blocks.filter((block) => block.type === 'guided_move').length;
        if (count < assertion.value) {
          addError(errors, assertionLocation, `Expected at least ${assertion.value} guided_move block(s), got ${count}`);
        }
        break;
      }
      case 'minimum_quizzes': {
        const count = blocks.filter((block) => block.type === 'quiz').length;
        if (count < assertion.value) {
          addError(errors, assertionLocation, `Expected at least ${assertion.value} quiz block(s), got ${count}`);
        }
        break;
      }
      case 'tier_allowed': {
        if (!validTiers.has(assertion.value)) {
          addError(errors, assertionLocation, `Invalid tier_allowed value "${assertion.value}"`);
          break;
        }
        if (tierOrder[chapter.requiredTier] > tierOrder[assertion.value]) {
          addError(errors, assertionLocation, `Chapter tier ${chapter.requiredTier} exceeds allowed tier ${assertion.value}`);
        }
        break;
      }
      default:
        addError(errors, assertionLocation, `Unknown review assertion type "${assertion.type}"`);
    }
  });
}

function validateChapter(manifestPath, manifest, chapterEntry, summary) {
  const errors = [];
  const bookRoot = path.dirname(manifestPath);
  const chapterPath = path.resolve(path.dirname(manifestPath), chapterEntry.path);

  if (!fs.existsSync(chapterPath)) {
    return { errors: [`${chapterEntry.path}: Chapter file does not exist`] };
  }

  const chapter = readJson(chapterPath);
  const location = path.relative(root, chapterPath);

  if (chapter.bookId !== manifest.bookId) addError(errors, location, 'chapter.bookId does not match manifest.bookId');
  if (!chapter.chapterId) addError(errors, location, 'Missing chapterId');
  if (!validTiers.has(chapter.requiredTier)) addError(errors, location, `Invalid requiredTier "${chapter.requiredTier}"`);
  if (!Array.isArray(chapter.sections) || chapter.sections.length === 0) addError(errors, location, 'Chapter needs sections');
  if (!Array.isArray(chapter.reviewAssertions) || chapter.reviewAssertions.length === 0) {
    addError(errors, location, 'Chapter needs reviewAssertions');
  }

  const blocks = collectBlocks(chapter);
  summary.blocks += blocks.length;

  blocks.forEach((block, index) => {
    const blockLocation = `${location}.blocks[${index}](${block.id || 'missing-id'})`;
    if (!block.id) addError(errors, blockLocation, 'Missing block id');
    if (!validBlockTypes.has(block.type)) addError(errors, blockLocation, `Unknown block type "${block.type}"`);

    if (['board_diagram', 'board_animation', 'guided_move', 'puzzle', 'cct_scan', 'mistake_refutation'].includes(block.type)) {
      summary.boardBlocks += 1;
      if (!Array.isArray(block.assertions) || block.assertions.length === 0) {
        addError(errors, blockLocation, 'board-like blocks need deterministic assertions');
      }
      validateBoardBlock(errors, blockLocation, block, bookRoot);
    }

    if (block.type === 'prose' && !block.body_md) {
      addError(errors, blockLocation, 'prose needs body_md');
    }

    if (block.type === 'quiz') {
      summary.quizzes += 1;
      validateQuiz(errors, blockLocation, block);
    }
  });
  validateReviewAssertions(errors, location, chapter, blocks);

  return { errors };
}

function validateManifest(manifestPath, summary) {
  const errors = [];
  const manifest = readJson(manifestPath);
  const location = path.relative(root, manifestPath);

  if (!manifest.bookId) addError(errors, location, 'Missing bookId');
  if (!manifest.title) addError(errors, location, 'Missing title');
  if (!validTiers.has(manifest.requiredTier)) addError(errors, location, `Invalid requiredTier "${manifest.requiredTier}"`);
  if (!Array.isArray(manifest.chapterOrder) || manifest.chapterOrder.length === 0) {
    addError(errors, location, 'manifest.chapterOrder must include at least one chapter');
  }

  summary.books += 1;
  summary.chapters += manifest.chapterOrder?.length || 0;

  const chapterErrors = (manifest.chapterOrder || []).flatMap((chapterEntry) => (
    validateChapter(manifestPath, manifest, chapterEntry, summary).errors
  ));

  return [...errors, ...chapterErrors];
}

const summary = {
  books: 0,
  chapters: 0,
  blocks: 0,
  boardBlocks: 0,
  quizzes: 0,
};

const manifestFiles = findManifestFiles(root);
const errors = manifestFiles.flatMap((manifestPath) => validateManifest(manifestPath, summary));

if (manifestFiles.length === 0) {
  console.error(`No v2 ebook manifests found under ${root}`);
  process.exit(1);
}

if (errors.length) {
  console.error('Ebook v2 validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Ebook v2 validation passed: ${summary.books} book(s), ${summary.chapters} chapter(s), ${summary.blocks} block(s), ${summary.boardBlocks} board block(s), ${summary.quizzes} quiz block(s).`);
