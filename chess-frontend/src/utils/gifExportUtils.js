// Utility functions for exporting chess games as animated GIF
// Uses canvas-based rendering (no React component rendering needed)
import GIF from 'gif.js';
import { Chess } from 'chess.js';
import { getTheme } from '../config/boardThemes';

// Piece unicode characters for canvas rendering
const PIECE_CHARS = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F'
};

const HIGHLIGHT_SQ = 'rgba(255, 255, 0, 0.35)';

// Animation helpers
const squareToPixel = (sq, boardX, boardY, sqSz, orient) => {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  const col = orient === 'white' ? file : 7 - file;
  const row = orient === 'white' ? 7 - rank : rank;
  return { x: boardX + col * sqSz, y: boardY + row * sqSz };
};

const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * Parse FEN position into a 2D array of pieces
 */
const parseFEN = (fen) => {
  const rows = fen.split(' ')[0].split('/');
  const board = [];
  for (const row of rows) {
    const boardRow = [];
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) boardRow.push(null);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const piece = ch.toUpperCase();
        boardRow.push(color + piece);
      }
    }
    board.push(boardRow);
  }
  return board;
};

/**
 * Draw a single chess board frame onto a canvas context
 */
const drawBoardFrame = (ctx, fen, boardSize, orientation, lastMove, moveInfo, playerNames, branding, themeColors, movingPiece = null) => {
  const LIGHT_SQ = themeColors?.light || '#C9A96E';
  const DARK_SQ = themeColors?.dark || '#6B4226';
  const sqSize = boardSize / 8;
  const headerHeight = 48;
  const moveBarHeight = 44;
  const footerHeight = 32;
  const board = parseFEN(fen);

  // --- Header: Player names ---
  ctx.fillStyle = '#1a1a18';
  ctx.fillRect(0, 0, boardSize, headerHeight);

  ctx.font = `bold ${Math.round(sqSize * 0.22)}px "Segoe UI", Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  // Top player (opponent from perspective)
  ctx.fillStyle = '#e0e0e0';
  const topPlayer = orientation === 'white' ? (playerNames.black || 'Black') : (playerNames.white || 'White');
  const bottomPlayer = orientation === 'white' ? (playerNames.white || 'White') : (playerNames.black || 'Black');
  ctx.fillText(topPlayer, 12, headerHeight / 2);

  // --- Board ---
  const boardY = headerHeight;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const displayRow = orientation === 'white' ? row : 7 - row;
      const displayCol = orientation === 'white' ? col : 7 - col;

      const x = col * sqSize;
      const y = boardY + row * sqSize;

      // Square color
      const isLight = (displayRow + displayCol) % 2 === 0;
      ctx.fillStyle = isLight ? LIGHT_SQ : DARK_SQ;
      ctx.fillRect(x, y, sqSize, sqSize);

      // Last move highlight
      if (lastMove) {
        const file = displayCol;
        const rank = 7 - displayRow;
        const sq = String.fromCharCode(97 + file) + (rank + 1);
        if (sq === lastMove.from || sq === lastMove.to) {
          ctx.fillStyle = HIGHLIGHT_SQ;
          ctx.fillRect(x, y, sqSize, sqSize);
        }
      }

      // Piece
      const piece = board[displayRow][displayCol];
      if (piece) {
        const sq = String.fromCharCode(97 + displayCol) + (8 - displayRow);
        // Skip piece that is being animated (drawn separately at interpolated position)
        if (!(movingPiece && movingPiece.fromSquare === sq)) {
          const ch = PIECE_CHARS[piece];
          if (ch) {
            ctx.font = `${Math.round(sqSize * 0.82)}px "Segoe UI Symbol", "Noto Color Emoji", Arial`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';

            // Shadow for depth
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillText(ch, x + sqSize / 2 + 1.5, y + sqSize / 2 + 2);

            // Piece
            ctx.fillStyle = piece[0] === 'w' ? '#FFFFFF' : '#222222';
            ctx.fillText(ch, x + sqSize / 2, y + sqSize / 2);
          }
        }
      }

      // Coordinate labels on edges
      ctx.font = `bold ${Math.round(sqSize * 0.14)}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (col === 0) {
        const rankLabel = orientation === 'white' ? String(8 - row) : String(row + 1);
        ctx.fillStyle = isLight ? DARK_SQ : LIGHT_SQ;
        ctx.fillText(rankLabel, x + 3, y + 3);
      }
      if (row === 7) {
        const fileLabel = orientation === 'white'
          ? String.fromCharCode(97 + col)
          : String.fromCharCode(97 + 7 - col);
        ctx.fillStyle = isLight ? DARK_SQ : LIGHT_SQ;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fileLabel, x + sqSize - 3, y + sqSize - 3);
      }
    }
  }

  // Draw animated piece on top of board at interpolated position
  if (movingPiece) {
    const ch = PIECE_CHARS[movingPiece.piece];
    if (ch) {
      ctx.font = `${Math.round(sqSize * 0.82)}px "Segoe UI Symbol", "Noto Color Emoji", Arial`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillText(ch, movingPiece.x + sqSize / 2 + 1.5, movingPiece.y + sqSize / 2 + 2);
      ctx.fillStyle = movingPiece.piece[0] === 'w' ? '#FFFFFF' : '#222222';
      ctx.fillText(ch, movingPiece.x + sqSize / 2, movingPiece.y + sqSize / 2);
    }
  }

  // --- Move bar ---
  const moveBarY = boardY + boardSize;
  ctx.fillStyle = '#2a2a28';
  ctx.fillRect(0, moveBarY, boardSize, moveBarHeight);

  ctx.font = `bold ${Math.round(sqSize * 0.2)}px "Segoe UI", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  if (moveInfo && moveInfo.moveNumber > 0) {
    // Move number badge
    const badgeText = `${moveInfo.moveNumber}.`;
    ctx.fillStyle = moveInfo.isWhite ? '#f0d9b5' : '#8B8B8B';
    const badgeW = ctx.measureText(badgeText).width + 16;
    const badgeH = 28;
    const badgeX = 12;
    const badgeY = moveBarY + (moveBarHeight - badgeH) / 2;

    // Badge background
    ctx.fillStyle = moveInfo.isWhite ? 'rgba(240,217,181,0.2)' : 'rgba(139,139,139,0.2)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    // Badge text
    ctx.fillStyle = moveInfo.isWhite ? '#f0d9b5' : '#bababa';
    ctx.fillText(badgeText, badgeX + 8, moveBarY + moveBarHeight / 2);

    // SAN
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(sqSize * 0.22)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(moveInfo.san, badgeX + badgeW + 8, moveBarY + moveBarHeight / 2);

    // Time spent
    if (moveInfo.time) {
      ctx.fillStyle = '#888';
      ctx.font = `${Math.round(sqSize * 0.16)}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`${moveInfo.time}s`, boardSize - 12, moveBarY + moveBarHeight / 2);
    }
  } else {
    ctx.fillStyle = '#888';
    ctx.font = `italic ${Math.round(sqSize * 0.18)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText('Starting Position', 12, moveBarY + moveBarHeight / 2);
  }

  // --- Footer: Bottom player + branding ---
  const footerY = moveBarY + moveBarHeight;
  ctx.fillStyle = '#1a1a18';
  ctx.fillRect(0, footerY, boardSize, footerHeight);

  ctx.font = `bold ${Math.round(sqSize * 0.18)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText(bottomPlayer, 12, footerY + footerHeight / 2);

  // Branding
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFD700';
  ctx.font = `bold ${Math.round(sqSize * 0.17)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(branding || 'chess99.com', boardSize - 12, footerY + footerHeight / 2);
};

/**
 * Draw a result frame (shown at end of GIF)
 */
const drawResultFrame = (ctx, resultText, boardSize, playerNames, isWin, isDraw) => {
  const totalH = boardSize + 48 + 44 + 32; // header + board + movebar + footer

  // Dark background
  let bgColor;
  if (isDraw) {
    bgColor = '#7a5a00';
  } else if (isWin) {
    bgColor = '#1a5c1a';
  } else {
    bgColor = '#2d1b69';
  }
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, boardSize, totalH);

  // Result icon
  const icon = isDraw ? '\u{1F91D}' : (isWin ? '\u{1F3C6}' : '\u{1F494}');
  ctx.font = `${Math.round(boardSize * 0.18)}px "Segoe UI Symbol", "Noto Color Emoji", Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, boardSize / 2, totalH * 0.35);

  // Result text
  ctx.font = `bold ${Math.round(boardSize * 0.08)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(resultText, boardSize / 2, totalH * 0.52);

  // Player names
  ctx.font = `${Math.round(boardSize * 0.04)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(
    `${playerNames.white || 'White'} vs ${playerNames.black || 'Black'}`,
    boardSize / 2, totalH * 0.63
  );

  // Branding
  ctx.font = `bold ${Math.round(boardSize * 0.045)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('chess99.com', boardSize / 2, totalH * 0.78);
};

/**
 * Generate an animated GIF from a chess game
 * @param {object} gameData - Game data
 * @param {string} gameData.moves - Semicolon-separated moves string "e4,2.52;Nf6,0.98;..."
 * @param {string} gameData.playerColor - 'w' or 'b'
 * @param {string} gameData.playerName - Player name
 * @param {string} gameData.opponentName - Opponent name
 * @param {string} gameData.resultText - e.g. "White wins!", "Draw", "Black wins!"
 * @param {boolean} gameData.isWin - Whether player won
 * @param {boolean} gameData.isDraw - Whether it's a draw
 * @param {object} options - Additional options
 * @param {number} options.boardSize - Board pixel size (default 400)
 * @param {number} options.quality - GIF quality 1-30 (default 10, lower=better)
 * @param {Function} options.onProgress - Progress callback (0-1)
 * @param {boolean} options.autoSpeed - Auto-calculate delay for ~60s total (default true)
 * @returns {Promise<Blob>} GIF blob
 */
export const generateGameGIF = async (gameData, options = {}) => {
  const {
    boardSize = 400,
    quality = 10,
    workers = 2,
    onProgress = null,
    autoSpeed = true,
    boardTheme = 'classic'
  } = options;

  const themeColors = getTheme(boardTheme);

  const headerHeight = 48;
  const moveBarHeight = 44;
  const footerHeight = 32;
  const totalHeight = headerHeight + boardSize + moveBarHeight + footerHeight;

  // Parse moves
  const movesStr = gameData.moves || '';
  const moveEntries = movesStr ? movesStr.split(';').filter(Boolean) : [];

  // Animation settings for smooth piece movement
  const GIF_ANIM_FRAMES = 4;
  const GIF_ANIM_DELAY = 40; // ms per animation frame
  const animTimePerMove = (GIF_ANIM_FRAMES - 1) * GIF_ANIM_DELAY; // 120ms

  // Calculate hold delay: target ~60s total playback
  const totalMoveFrames = moveEntries.length + 1; // +1 for initial position
  let delay;
  if (autoSpeed && totalMoveFrames > 1) {
    const availableMs = Math.max(57000, 60000 - 3000);
    const totalAnimMs = moveEntries.length * animTimePerMove;
    delay = Math.round((availableMs - totalAnimMs) / totalMoveFrames);
    delay = Math.max(150, Math.min(2000, delay));
  } else {
    delay = 500;
  }

  const orientation = gameData.playerColor === 'b' ? 'black' : 'white';

  const playerNames = {
    white: gameData.playerColor === 'w' ? gameData.playerName : gameData.opponentName,
    black: gameData.playerColor === 'b' ? gameData.playerName : gameData.opponentName
  };

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = boardSize;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  const gif = new GIF({
    workers,
    quality,
    width: boardSize,
    height: totalHeight,
    workerScript: '/gif.worker.js'
  });

  try {
    const chess = new Chess();

    // Frame 1: Initial position (hold longer)
    drawBoardFrame(ctx, chess.fen(), boardSize, orientation, null, { moveNumber: 0 }, playerNames, 'chess99.com', themeColors);
    gif.addFrame(ctx, { copy: true, delay: Math.min(delay * 2, 3000) });

    // Move frames with smooth piece animation
    const sqSize = boardSize / 8;
    for (let i = 0; i < moveEntries.length; i++) {
      const parts = moveEntries[i].split(',');
      const san = parts[0];
      const time = parts[1] ? parseFloat(parts[1]).toFixed(1) : null;

      try {
        const fenBefore = chess.fen();
        const moveResult = chess.move(san, { sloppy: true });
        if (moveResult) {
          const moveNumber = Math.ceil((i + 1) / 2);
          const isWhite = i % 2 === 0;
          const pieceKey = moveResult.color + moveResult.piece.toUpperCase();
          const mi = { moveNumber, san, isWhite, time };

          // Animate piece sliding from source to destination
          const fromPix = squareToPixel(moveResult.from, 0, headerHeight, sqSize, orientation);
          const toPix = squareToPixel(moveResult.to, 0, headerHeight, sqSize, orientation);

          for (let f = 1; f < GIF_ANIM_FRAMES; f++) {
            const t = f / GIF_ANIM_FRAMES;
            const eased = easeInOut(t);
            drawBoardFrame(ctx, fenBefore, boardSize, orientation,
              null, mi, playerNames, 'chess99.com', themeColors,
              {
                piece: pieceKey,
                fromSquare: moveResult.from,
                x: fromPix.x + (toPix.x - fromPix.x) * eased,
                y: fromPix.y + (toPix.y - fromPix.y) * eased
              }
            );
            gif.addFrame(ctx, { copy: true, delay: GIF_ANIM_DELAY });
          }

          // Final position with highlight
          drawBoardFrame(ctx, chess.fen(), boardSize, orientation,
            { from: moveResult.from, to: moveResult.to },
            mi, playerNames, 'chess99.com', themeColors
          );
          gif.addFrame(ctx, { copy: true, delay });
        }
      } catch (err) {
        console.warn(`GIF: skipping invalid move ${i}: ${san}`, err);
      }

      // Report progress for frame generation phase (0-0.5)
      if (onProgress) {
        onProgress((i + 1) / moveEntries.length * 0.5);
      }
    }

    // Result frame (hold 3 seconds)
    drawResultFrame(ctx, gameData.resultText || 'Game Over', boardSize, playerNames, gameData.isWin, gameData.isDraw);
    gif.addFrame(ctx, { copy: true, delay: 3000 });

    // Render GIF
    return new Promise((resolve, reject) => {
      gif.on('finished', (blob) => {
        resolve(blob);
      });

      gif.on('progress', (p) => {
        // GIF encoding progress (0.5-1.0)
        if (onProgress) onProgress(0.5 + p * 0.5);
      });

      gif.on('error', (error) => {
        reject(error);
      });

      gif.render();
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Download a blob as a file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
