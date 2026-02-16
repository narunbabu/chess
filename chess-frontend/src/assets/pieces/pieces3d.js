/**
 * 3D-style Cburnett chess pieces for the landing page.
 * Enhanced with linear gradients (top-lit shading), drop shadows (elevation),
 * and radial gradient overlays (specular highlight / glossy 3D illusion).
 *
 * SVG paths: Cburnett set (Colin M.L. Burnett, CC BY-SA 3.0)
 * viewBox matches react-chessboard default: "1 1 43 43" (original 45x45)
 */
import React from 'react';

/* ── shared SVG defs builders ───────────────────────────── */

const whiteDefs = (id) => (
  <defs>
    <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fffff0" />
      <stop offset="100%" stopColor="#d4c8a0" />
    </linearGradient>
    <radialGradient id={`hl-${id}`} cx="35%" cy="25%" r="50%">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
    <filter id={`sh-${id}`}>
      <feDropShadow dx="0.6" dy="1.2" stdDeviation="1" floodColor="#3a2510" floodOpacity="0.45" />
    </filter>
  </defs>
);

const blackDefs = (id) => (
  <defs>
    <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#4a4a4a" />
      <stop offset="100%" stopColor="#1a1a1a" />
    </linearGradient>
    <radialGradient id={`hl-${id}`} cx="35%" cy="25%" r="50%">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
    <filter id={`sh-${id}`}>
      <feDropShadow dx="0.6" dy="1.2" stdDeviation="1" floodColor="#000000" floodOpacity="0.55" />
    </filter>
  </defs>
);

/* ── white fill / stroke helpers ────────────────────────── */
const wFill = (id) => `url(#bg-${id})`;
const wStroke = '#5c3d1e';
const bFill = (id) => `url(#bg-${id})`;
const bStroke = '#111111';

/* ── piece components ───────────────────────────────────── */

// ─── WHITE PAWN ─────────────────────────────────────────
function WhitePawn({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {whiteDefs('wP')}
      <g filter="url(#sh-wP)">
        <path
          d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
          fill={wFill('wP')} stroke={wStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="miter"
        />
        <path
          d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
          fill="url(#hl-wP)" stroke="none"
        />
      </g>
    </svg>
  );
}

// ─── WHITE ROOK ─────────────────────────────────────────
function WhiteRook({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {whiteDefs('wR')}
      <g filter="url(#sh-wR)" fill={wFill('wR')} stroke={wStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" strokeLinecap="butt" />
        <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" strokeLinecap="butt" />
        <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" strokeLinecap="butt" />
        <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
        <path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5" />
        <path d="M 11,14 L 34,14" fill="none" stroke={wStroke} strokeLinejoin="miter" />
      </g>
      <g fill="url(#hl-wR)" stroke="none">
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" />
        <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" />
        <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
        <path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" />
      </g>
    </svg>
  );
}

// ─── WHITE KNIGHT ───────────────────────────────────────
function WhiteKnight({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {whiteDefs('wN')}
      <g filter="url(#sh-wN)" fill="none" stroke={wStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill={wFill('wN')} />
        <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" fill={wFill('wN')} />
        <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" fill="#5c3d1e" stroke="#5c3d1e" />
        <path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" fill="#5c3d1e" stroke="#5c3d1e" />
      </g>
      <g fill="url(#hl-wN)" stroke="none">
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
        <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
      </g>
    </svg>
  );
}

// ─── WHITE BISHOP ───────────────────────────────────────
function WhiteBishop({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {whiteDefs('wB')}
      <g filter="url(#sh-wB)" fill="none" stroke={wStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <g fill={wFill('wB')} strokeLinecap="butt">
          <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z" />
          <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
          <path d="M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z" />
        </g>
        <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" fill="none" stroke={wStroke} strokeLinejoin="miter" />
      </g>
      <g fill="url(#hl-wB)" stroke="none">
        <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z" />
        <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
      </g>
    </svg>
  );
}

// ─── WHITE QUEEN ────────────────────────────────────────
function WhiteQueen({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {whiteDefs('wQ')}
      <g filter="url(#sh-wQ)" fill={wFill('wQ')} stroke={wStroke} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" />
        <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z" />
        <path d="M 11.5,30 C 15,29 30,29 33.5,30" fill="none" />
        <path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" fill="none" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="14" cy="9" r="2" />
        <circle cx="22.5" cy="8" r="2" />
        <circle cx="31" cy="9" r="2" />
        <circle cx="39" cy="12" r="2" />
      </g>
      <g fill="url(#hl-wQ)" stroke="none">
        <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" />
        <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z" />
      </g>
    </svg>
  );
}

// ─── WHITE KING ─────────────────────────────────────────
function WhiteKing({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {whiteDefs('wK')}
      <g filter="url(#sh-wK)" fill="none" stroke={wStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 22.5,11.63 L 22.5,6" fill="none" strokeLinejoin="miter" />
        <path d="M 20,8 L 25,8" fill="none" strokeLinejoin="miter" />
        <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" fill={wFill('wK')} strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" fill={wFill('wK')} />
        <path d="M 12.5,30 C 18,27 27,27 32.5,30" fill="none" />
        <path d="M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" fill="none" />
        <path d="M 12.5,37 C 18,34 27,34 32.5,37" fill="none" />
      </g>
      <g fill="url(#hl-wK)" stroke="none">
        <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
        <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" />
      </g>
    </svg>
  );
}

// ─── BLACK PAWN ─────────────────────────────────────────
function BlackPawn({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {blackDefs('bP')}
      <g filter="url(#sh-bP)">
        <path
          d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
          fill={bFill('bP')} stroke={bStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="miter"
        />
        <path
          d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
          fill="url(#hl-bP)" stroke="none"
        />
      </g>
    </svg>
  );
}

// ─── BLACK ROOK ─────────────────────────────────────────
function BlackRook({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {blackDefs('bR')}
      <g filter="url(#sh-bR)" fill={bFill('bR')} stroke={bStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" strokeLinecap="butt" />
        <path d="M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z" strokeLinecap="butt" />
        <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" strokeLinecap="butt" />
        <path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z" strokeLinecap="butt" />
        <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z" strokeLinecap="butt" />
        <path d="M 12,35.5 L 33,35.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinejoin="miter" />
        <path d="M 13,31.5 L 32,31.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinejoin="miter" />
        <path d="M 14,29.5 L 31,29.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinejoin="miter" />
        <path d="M 14,16.5 L 31,16.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinejoin="miter" />
        <path d="M 11,14 L 34,14" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinejoin="miter" />
      </g>
      <g fill="url(#hl-bR)" stroke="none">
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" />
        <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" />
        <path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" />
      </g>
    </svg>
  );
}

// ─── BLACK KNIGHT ───────────────────────────────────────
function BlackKnight({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {blackDefs('bN')}
      <g filter="url(#sh-bN)" fill="none" stroke={bStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill={bFill('bN')} />
        <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" fill={bFill('bN')} />
        <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" fill="#e0e0e0" stroke="#e0e0e0" />
        <path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" fill="#e0e0e0" stroke="#e0e0e0" />
        <path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z" fill="rgba(255,255,255,0.15)" stroke="none" />
      </g>
      <g fill="url(#hl-bN)" stroke="none">
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
        <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
      </g>
    </svg>
  );
}

// ─── BLACK BISHOP ───────────────────────────────────────
function BlackBishop({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {blackDefs('bB')}
      <g filter="url(#sh-bB)" fill="none" stroke={bStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <g fill={bFill('bB')} strokeLinecap="butt">
          <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z" />
          <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
          <path d="M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z" />
        </g>
        <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" fill="none" stroke="rgba(255,255,255,0.35)" strokeLinejoin="miter" />
      </g>
      <g fill="url(#hl-bB)" stroke="none">
        <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z" />
        <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
      </g>
    </svg>
  );
}

// ─── BLACK QUEEN ────────────────────────────────────────
function BlackQueen({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {blackDefs('bQ')}
      <g filter="url(#sh-bQ)" fill={bFill('bQ')} stroke={bStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" strokeLinecap="butt" />
        <path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1,2.5 -1,2.5 -1.5,1.5 0,2.5 0,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0,-2.5 0,0 0.5,-1.5 -1,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -8.5,-1.5 -18.5,-1.5 -27,0 z" />
        <path d="M 11.5,30 C 15,29 30,29 33.5,30" />
        <path d="m 12,33.5 c 6,-1 15,-1 21,0" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="14" cy="9" r="2" />
        <circle cx="22.5" cy="8" r="2" />
        <circle cx="31" cy="9" r="2" />
        <circle cx="39" cy="12" r="2" />
        <path d="M 11,38.5 A 35,35 1 0 0 34,38.5" fill="none" strokeLinecap="butt" />
        <g fill="none" stroke="rgba(255,255,255,0.25)">
          <path d="M 11,29 A 35,35 1 0 1 34,29" />
          <path d="M 12.5,31.5 L 32.5,31.5" />
          <path d="M 11.5,34.5 A 35,35 1 0 0 33.5,34.5" />
          <path d="M 10.5,37.5 A 35,35 1 0 0 34.5,37.5" />
        </g>
      </g>
      <g fill="url(#hl-bQ)" stroke="none">
        <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z" />
        <path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1,2.5 -1,2.5 -1.5,1.5 0,2.5 0,2.5 6.5,1 16.5,1 23,0 0,0 1.5,-1 0,-2.5 0,0 0.5,-1.5 -1,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -8.5,-1.5 -18.5,-1.5 -27,0 z" />
      </g>
    </svg>
  );
}

// ─── BLACK KING ─────────────────────────────────────────
function BlackKing({ squareWidth }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="1 1 43 43" width={squareWidth} height={squareWidth}>
      {blackDefs('bK')}
      <g filter="url(#sh-bK)" fill="none" stroke={bStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 22.5,11.63 L 22.5,6" fill="none" strokeLinejoin="miter" />
        <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" fill={bFill('bK')} strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" fill={bFill('bK')} />
        <path d="M 20,8 L 25,8" fill="none" strokeLinejoin="miter" />
        <path d="M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5" fill="none" stroke="rgba(255,255,255,0.25)" />
        <path d="M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37" fill="none" stroke="rgba(255,255,255,0.25)" />
      </g>
      <g fill="url(#hl-bK)" stroke="none">
        <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
        <path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" />
      </g>
    </svg>
  );
}

/* ── exported mapping for react-chessboard customPieces ── */

export const pieces3dLanding = {
  wP: ({ squareWidth }) => <WhitePawn squareWidth={squareWidth} />,
  wR: ({ squareWidth }) => <WhiteRook squareWidth={squareWidth} />,
  wN: ({ squareWidth }) => <WhiteKnight squareWidth={squareWidth} />,
  wB: ({ squareWidth }) => <WhiteBishop squareWidth={squareWidth} />,
  wQ: ({ squareWidth }) => <WhiteQueen squareWidth={squareWidth} />,
  wK: ({ squareWidth }) => <WhiteKing squareWidth={squareWidth} />,
  bP: ({ squareWidth }) => <BlackPawn squareWidth={squareWidth} />,
  bR: ({ squareWidth }) => <BlackRook squareWidth={squareWidth} />,
  bN: ({ squareWidth }) => <BlackKnight squareWidth={squareWidth} />,
  bB: ({ squareWidth }) => <BlackBishop squareWidth={squareWidth} />,
  bQ: ({ squareWidth }) => <BlackQueen squareWidth={squareWidth} />,
  bK: ({ squareWidth }) => <BlackKing squareWidth={squareWidth} />,
};
