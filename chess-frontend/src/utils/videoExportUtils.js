// Video export utility - generates animated chess game replays as WebM video
// Uses MediaRecorder API with canvas rendering and 3D SVG pieces from pieces3d.js

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Chess } from 'chess.js';
import { pieces3dLanding } from '../assets/pieces/pieces3d';

// ═══ Opening Book ═══
const OPENING_BOOK = [
  { moves: ['e4','e5','Nf3','Nc6','Bb5'], name: 'Ruy Lopez' },
  { moves: ['e4','e5','Nf3','Nc6','Bc4'], name: 'Italian Game' },
  { moves: ['e4','e5','Nf3','Nc6','d4'], name: 'Scotch Game' },
  { moves: ['e4','c5','Nf3','d6','d4'], name: 'Sicilian Najdorf' },
  { moves: ['e4','c5','Nf3','Nc6','d4'], name: 'Sicilian Open' },
  { moves: ['d4','d5','c4','e6','Nc3'], name: "Queen's Gambit Declined" },
  { moves: ['d4','d5','c4','dxc4'], name: "Queen's Gambit Accepted" },
  { moves: ['d4','Nf6','c4','g6','Nc3'], name: "King's Indian Defense" },
  { moves: ['d4','Nf6','c4','e6','Nc3','Bb4'], name: 'Nimzo-Indian Defense' },
  { moves: ['e4','e5','Nf3','Nf6'], name: "Petrov's Defense" },
  { moves: ['e4','e5','f4'], name: "King's Gambit" },
  { moves: ['e4','e5','Nc3'], name: 'Vienna Game' },
  { moves: ['d4','Nf6','c4','c5'], name: 'Benoni Defense' },
  { moves: ['e4','c5'], name: 'Sicilian Defense' },
  { moves: ['e4','e6'], name: 'French Defense' },
  { moves: ['e4','c6'], name: 'Caro-Kann Defense' },
  { moves: ['e4','d5'], name: 'Scandinavian Defense' },
  { moves: ['e4','g6'], name: 'Modern Defense' },
  { moves: ['e4','d6'], name: 'Pirc Defense' },
  { moves: ['e4','Nf6'], name: "Alekhine's Defense" },
  { moves: ['d4','d5','c4'], name: "Queen's Gambit" },
  { moves: ['d4','f5'], name: 'Dutch Defense' },
  { moves: ['d4','Nf6','c4','g6'], name: "King's Indian" },
  { moves: ['Nf3','d5','g3'], name: "King's Indian Attack" },
  { moves: ['c4'], name: 'English Opening' },
  { moves: ['Nf3'], name: 'Reti Opening' },
  { moves: ['e4','e5'], name: "King's Pawn Game" },
  { moves: ['d4','d5'], name: "Queen's Pawn Game" },
  { moves: ['d4','Nf6'], name: 'Indian Defense' },
].sort((a, b) => b.moves.length - a.moves.length);

const detectOpening = (sanMoves) => {
  for (const opening of OPENING_BOOK) {
    if (opening.moves.length <= sanMoves.length &&
        opening.moves.every((m, i) => sanMoves[i] === m)) {
      return opening.name;
    }
  }
  return null;
};

// ═══ Move Annotation ═══
const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

const getMoveAnnotation = (moveResult, openingName, moveIndex) => {
  if (!moveResult) return '';
  const { san, captured, piece, flags } = moveResult;
  if (san.includes('#')) return 'Checkmate!';
  if (san === 'O-O') return 'Castles kingside';
  if (san === 'O-O-O') return 'Castles queenside';
  if (san.includes('=')) {
    const promoChar = san.charAt(san.indexOf('=') + 1).toLowerCase();
    return `Promotes to ${PIECE_NAMES[promoChar] || 'Queen'}!`;
  }
  if (captured) {
    const capName = PIECE_NAMES[piece] || 'Piece';
    const targName = PIECE_NAMES[captured] || 'piece';
    if (san.includes('+')) return `${capName} takes ${targName} with check!`;
    return `${capName} takes ${targName}`;
  }
  if (san.includes('+')) return 'Check!';
  if (openingName && moveIndex < 12) return openingName;
  return '';
};

// ═══ SVG Piece Rendering ═══
const PRELOAD_SIZE = 135;

const svgToImage = (svgString, size) => {
  return new Promise((resolve, reject) => {
    const img = new Image(size, size);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
};

const preloadPieceImages = async (squareSize) => {
  const images = {};
  const size = Math.max(squareSize, PRELOAD_SIZE);
  for (const [key, Component] of Object.entries(pieces3dLanding)) {
    try {
      let markup = renderToStaticMarkup(
        React.createElement(Component, { squareWidth: size })
      );
      if (!markup.includes('xmlns')) {
        markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      images[key] = await svgToImage(markup, size);
    } catch (err) {
      console.warn(`Failed to preload piece ${key}:`, err);
    }
  }
  return images;
};

// ═══ FEN Parsing ═══
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
        boardRow.push(color + ch.toUpperCase());
      }
    }
    board.push(boardRow);
  }
  return board;
};

// ═══ Colors ═══
const C = {
  bg: '#161512',
  headerBg: '#1a1816',
  boardLight: '#C9A96E',
  boardDark: '#6B4226',
  hlFrom: 'rgba(255, 255, 0, 0.3)',
  hlTo: 'rgba(255, 255, 0, 0.45)',
  text: '#ffffff',
  textDim: '#b0b0b0',
  textMuted: '#777',
  accent: '#FFD700',
  commentBg: '#1e1c19',
  playerBg: '#242220',
};

// ═══ Drawing Functions ═══

const drawHeader = (ctx, w, h, playerNames, isPortrait) => {
  ctx.fillStyle = C.headerBg;
  ctx.fillRect(0, 0, w, h);
  // Gold accent underline
  ctx.fillStyle = C.accent;
  ctx.fillRect(0, h - 2, w, 2);

  // Left: bold gold "CHESS99" brand
  const brandFs = isPortrait ? 28 : 22;
  ctx.font = `bold ${brandFs}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.accent;
  ctx.fillText('\u265B CHESS99', 20, h / 2);

  // Right: dim player names
  ctx.textAlign = 'right';
  ctx.fillStyle = C.textDim;
  ctx.font = `${isPortrait ? 18 : 16}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(`${playerNames.white} vs ${playerNames.black}`, w - 20, h / 2);
};

const drawPlayerBar = (ctx, y, w, h, name, isBlackSide, isActive) => {
  ctx.fillStyle = C.playerBg;
  ctx.fillRect(0, y, w, h);
  const cx = 24, cy = y + h / 2, r = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = isBlackSide ? '#333' : '#eee';
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (isActive) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = C.text;
  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 44, cy);
};

const drawBoard = (ctx, fen, bx, by, bSize, sqSz, orient, lastMove, flash, imgs) => {
  const board = parseFEN(fen);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const dRow = orient === 'white' ? row : 7 - row;
      const dCol = orient === 'white' ? col : 7 - col;
      const x = bx + col * sqSz;
      const y = by + row * sqSz;
      const isLight = (dRow + dCol) % 2 === 0;
      ctx.fillStyle = isLight ? C.boardLight : C.boardDark;
      ctx.fillRect(x, y, sqSz, sqSz);

      if (lastMove) {
        const file = dCol, rank = 7 - dRow;
        const sq = String.fromCharCode(97 + file) + (rank + 1);
        if (sq === lastMove.from) {
          ctx.fillStyle = C.hlFrom;
          ctx.fillRect(x, y, sqSz, sqSz);
        }
        if (sq === lastMove.to) {
          ctx.fillStyle = flash > 0
            ? `rgba(255,255,100,${0.3 + flash * 0.4})`
            : C.hlTo;
          ctx.fillRect(x, y, sqSz, sqSz);
        }
      }

      const piece = board[dRow][dCol];
      if (piece && imgs[piece]) {
        ctx.drawImage(imgs[piece], x, y, sqSz, sqSz);
      }

      // Coordinates
      ctx.font = `bold ${Math.round(sqSz * 0.14)}px Arial`;
      if (col === 0) {
        ctx.fillStyle = isLight ? C.boardDark : C.boardLight;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(orient === 'white' ? String(8 - row) : String(row + 1), x + 3, y + 3);
      }
      if (row === 7) {
        ctx.fillStyle = isLight ? C.boardDark : C.boardLight;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const fl = orient === 'white' ? String.fromCharCode(97 + col) : String.fromCharCode(97 + 7 - col);
        ctx.fillText(fl, x + sqSz - 3, y + sqSz - 3);
      }
    }
  }
};

const drawCommentaryPortrait = (ctx, y, w, h, info) => {
  const { moveNumber, san, annotation, openingName, isWhiteMove, moveIndex, totalMoves } = info;
  ctx.fillStyle = C.commentBg;
  ctx.fillRect(0, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, y, w, 1);
  const cx = w / 2;

  if (moveNumber === 0) {
    ctx.fillStyle = C.textMuted;
    ctx.font = 'italic 22px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Starting Position', cx, y + h * 0.25);
    if (openingName) {
      ctx.fillStyle = C.accent;
      ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
      ctx.fillText(openingName, cx, y + h * 0.45);
    }
  } else {
    ctx.fillStyle = C.textMuted;
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Move ${moveNumber}${isWhiteMove ? '.' : '...'}`, cx, y + 30);

    ctx.fillStyle = C.text;
    ctx.font = 'bold 56px "Segoe UI", Arial, sans-serif';
    ctx.fillText(san || '', cx, y + 90);

    if (annotation) {
      const exciting = annotation.includes('!') || annotation.includes('Check') || annotation.includes('Checkmate');
      ctx.fillStyle = exciting ? '#FF6B6B' : C.textDim;
      ctx.font = `${exciting ? 'bold ' : ''}22px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(annotation, cx, y + 145);
    }

    if (openingName && moveIndex < 12) {
      ctx.fillStyle = C.accent;
      ctx.font = 'italic 18px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`\u2014 ${openingName} \u2014`, cx, y + 195);
    }

    // Progress bar
    const progress = (moveIndex + 1) / totalMoves;
    const barX = 40, barW = w - 80, barH = 4, barY = y + h - 50;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 2); ctx.fill();
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, barH, 2); ctx.fill();
  }

};

const drawCommentaryLandscape = (ctx, y, w, h, info) => {
  const { moveNumber, san, annotation, isWhiteMove } = info;
  ctx.fillStyle = C.commentBg;
  ctx.fillRect(0, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, y, w, 1);

  if (moveNumber === 0) {
    ctx.fillStyle = C.textMuted;
    ctx.font = 'italic 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Starting Position', w / 2, y + h / 2);
  } else {
    ctx.fillStyle = C.text;
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${moveNumber}${isWhiteMove ? '.' : '...'} ${san || ''}`, 20, y + h / 2);
    if (annotation) {
      ctx.fillStyle = C.textDim;
      ctx.font = '20px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(annotation, w - 20, y + h / 2);
    }
  }
};

const drawResultScreen = (ctx, w, h, config) => {
  const { resultText, playerNames, isWin, isDraw } = config;
  ctx.fillStyle = isDraw ? '#7a5a00' : (isWin ? '#1a5c1a' : '#2d1b69');
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  ctx.font = `${Math.round(w * 0.12)}px "Segoe UI Symbol", "Noto Color Emoji", Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isDraw ? '\u{1F91D}' : (isWin ? '\u{1F3C6}' : '\u{1F494}'), cx, cy - h * 0.12);

  ctx.font = `bold ${Math.round(w * 0.06)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(resultText, cx, cy + h * 0.02);

  ctx.font = `${Math.round(w * 0.03)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${playerNames.white} vs ${playerNames.black}`, cx, cy + h * 0.1);

  ctx.font = `bold ${Math.round(w * 0.04)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = C.accent;
  ctx.fillText('\u265B CHESS99.COM', cx, cy + h * 0.2);

  ctx.font = `${Math.round(w * 0.022)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Play chess online free at chess99.com', cx, cy + h * 0.27);
};

// ═══ MediaRecorder Helpers ═══
const getSupportedMimeType = () => {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
};

// ═══ Main Entry Point ═══
export const generateGameVideo = async (gameData, options = {}) => {
  const { format = 'portrait', onProgress = null } = options;
  const isPortrait = format === 'portrait';
  const W = isPortrait ? 720 : 1280;
  const H = isPortrait ? 1280 : 720;

  // Layout
  const headerH = isPortrait ? 80 : 60;
  const pBarH = isPortrait ? 50 : 0;
  const boardSz = isPortrait ? W : 600;
  const sqSz = boardSz / 8;
  const boardX = isPortrait ? 0 : (W - boardSz) / 2;
  const boardY = headerH + pBarH;
  const commY = boardY + boardSz + pBarH;
  const commH = H - commY;

  const orient = gameData.playerColor === 'b' ? 'black' : 'white';
  const pNames = {
    white: gameData.playerColor === 'w' ? gameData.playerName : gameData.opponentName,
    black: gameData.playerColor === 'b' ? gameData.playerName : gameData.opponentName,
  };

  // Parse moves
  const moveEntries = (gameData.moves || '').split(';').filter(Boolean);
  const totalMoves = moveEntries.length;

  // Timing: target 12-35s total
  const targetMs = Math.max(12000, Math.min(35000, totalMoves * 500 + 5000));
  const initHold = 1500;
  const resultHold = 2500;
  const flashMs = 100;
  const availMs = targetMs - initHold - resultHold;
  const perMoveMs = Math.max(250, Math.min(1200, availMs / Math.max(1, totalMoves)));
  const holdMs = Math.max(100, perMoveMs - flashMs);

  // Preload 3D piece images
  if (onProgress) onProgress(0);
  const pieceImgs = await preloadPieceImages(sqSz);

  // Detect opening
  const sanMoves = moveEntries.map(e => e.split(',')[0]);
  const openingName = detectOpening(sanMoves);

  // Canvas setup
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // MediaRecorder
  const stream = canvas.captureStream(30);
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Full frame drawer
  const frame = (fen, lastMove, flash, moveInfo) => {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    drawHeader(ctx, W, headerH, pNames, isPortrait);

    if (isPortrait) {
      const topName = orient === 'white' ? pNames.black : pNames.white;
      const botName = orient === 'white' ? pNames.white : pNames.black;
      const wTurn = !moveInfo || moveInfo.isWhiteMove;
      drawPlayerBar(ctx, headerH, W, pBarH, topName, orient === 'white', orient === 'white' ? !wTurn : wTurn);
      drawPlayerBar(ctx, boardY + boardSz, W, pBarH, botName, orient !== 'white', orient === 'white' ? wTurn : !wTurn);
    }

    drawBoard(ctx, fen, boardX, boardY, boardSz, sqSz, orient, lastMove, flash, pieceImgs);

    const ci = { ...moveInfo, openingName, totalMoves };
    if (isPortrait) drawCommentaryPortrait(ctx, commY, W, commH, ci);
    else drawCommentaryLandscape(ctx, commY, W, commH, ci);
  };

  // Start recording
  recorder.start(100);

  try {
    const chess = new Chess();

    // Initial position
    frame(chess.fen(), null, 0, { moveNumber: 0, san: '', annotation: '', isWhiteMove: true, moveIndex: 0 });
    await wait(initHold);

    // Process each move
    for (let i = 0; i < moveEntries.length; i++) {
      const san = moveEntries[i].split(',')[0];
      try {
        const mr = chess.move(san, { sloppy: true });
        if (mr) {
          const moveNum = Math.ceil((i + 1) / 2);
          const isW = i % 2 === 0;
          const ann = getMoveAnnotation(mr, openingName, i);
          const lm = { from: mr.from, to: mr.to };
          const mi = { moveNumber: moveNum, san: mr.san, annotation: ann, isWhiteMove: isW, moveIndex: i };

          // Flash highlight (3 frames ~100ms)
          for (let f = 0; f < 3; f++) {
            frame(chess.fen(), lm, 1 - f / 3, mi);
            await wait(33);
          }
          // Hold
          frame(chess.fen(), lm, 0, mi);
          await wait(holdMs);
        }
      } catch (err) {
        console.warn(`Video: skipping move ${i}: ${san}`, err);
      }
      if (onProgress) onProgress((i + 1) / totalMoves);
    }

    // Result frame
    drawResultScreen(ctx, W, H, {
      resultText: gameData.resultText || 'Game Over',
      playerNames: pNames,
      isWin: gameData.isWin,
      isDraw: gameData.isDraw,
    });
    await wait(resultHold);

  } catch (error) {
    recorder.stop();
    throw error;
  }

  recorder.stop();

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      console.log(`\u2705 Video: ${(blob.size / 1024 / 1024).toFixed(1)} MB, ${mimeType}`);
      resolve(blob);
    };
    recorder.onerror = reject;
  });
};

export const isVideoSupported = () => {
  return typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';
};
