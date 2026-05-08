import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { EBOOK_BOARD_THEME, EBOOK_COLOR_ROLES, normalizeArrows, normalizeHighlights } from './utils/ebookVisuals';

const animSpeedMap = { slow: 1200, normal: 600, fast: 250 };
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function createGame(fen) {
  try { return new Chess(fen); } catch { return null; }
}

function fenToPositionObject(fen = '') {
  const placement = String(fen).split(' ')[0];
  const ranks = placement.split('/');
  if (ranks.length !== 8) return fen;

  const position = {};
  ranks.forEach((rank, rankIdx) => {
    let fileIdx = 0;
    const boardRank = 8 - rankIdx;

    [...rank].forEach((char) => {
      if (/^[1-8]$/.test(char)) {
        fileIdx += Number(char);
        return;
      }

      const file = files[fileIdx];
      const piece = char.toUpperCase();
      const color = char === char.toUpperCase() ? 'w' : 'b';
      if (file && /^[PNBRQK]$/.test(piece)) {
        position[`${file}${boardRank}`] = `${color}${piece}`;
      }
      fileIdx += 1;
    });
  });

  return position;
}

export default function EbookBoard({
  fen,
  arrows = [],
  highlights = [],
  orientation = 'white',
  interactive = false,
  animationSequence = null,
  animationSpeed = 'normal',
  animationLoop = false,
  caption = '',
  boardSize = 360,
  customArrows: externalArrows,
  acceptedMoves = [],
  successMessage = 'Correct.',
  failureMessage = 'Try that move again.',
  onMoveAccepted,
  showCoordinates = true,
}) {
  const [game, setGame] = useState(() => {
    return createGame(fen);
  });
  const [animQueue, setAnimQueue] = useState([]);
  const [animIdx, setAnimIdx] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [optSquares, setOptSquares] = useState({});
  const [feedbackSquares, setFeedbackSquares] = useState({});
  const [moveFeedback, setMoveFeedback] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const timerRef = useRef(null);
  const gameRef = useRef(game);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    const nextGame = createGame(fen);
    setGame(nextGame);
    gameRef.current = nextGame;
    setSelectedPiece(null);
    setOptSquares({});
    setFeedbackSquares({});
    setMoveFeedback(null);
  }, [fen]);

  const hlSquares = {};
  normalizeHighlights(highlights).forEach(({ square, style }) => {
    hlSquares[square] = style;
  });
  Object.assign(hlSquares, optSquares);
  Object.assign(hlSquares, feedbackSquares);

  const finalArrows = normalizeArrows([
    ...((externalArrows || arrows) || []),
    ...(animQueue.length > 0 ? animQueue : []),
  ]);

  const normalizedAcceptedMoves = useMemo(() => (
    acceptedMoves
      .map((move) => (typeof move === 'string' ? move : move?.move))
      .filter(Boolean)
  ), [acceptedMoves]);

  const clearMoveFeedback = useCallback(() => {
    setTimeout(() => {
      setFeedbackSquares({});
      setMoveFeedback(null);
    }, 1000);
  }, []);

  // --- Animation ---
  const startAnimation = useCallback(() => {
    if (!animationSequence || animationSequence.length === 0) return;
    setIsAnimating(true);
    setAnimIdx(0);
    try {
      const fresh = new Chess(fen);
      setGame(fresh);
      gameRef.current = fresh;
    } catch { /* keep current */ }
  }, [animationSequence, fen]);

  const stopAnimation = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setIsAnimating(false);
    setAnimIdx(-1);
    setAnimQueue([]);
    setOptSquares({});
  }, []);

  const stepAnimation = useCallback((idx) => {
    if (idx >= animationSequence.length) {
      if (animationLoop) {
        try {
          const fresh = new Chess(fen);
          setGame(fresh);
          gameRef.current = fresh;
          setAnimQueue([]);
          setOptSquares({});
          timerRef.current = setTimeout(() => stepAnimation(0), 400);
          setAnimIdx(0);
        } catch { stopAnimation(); }
        return;
      }
      stopAnimation();
      return;
    }
    const uciOrObj = animationSequence[idx];
    let uci, arrow;
    if (typeof uciOrObj === 'string') {
      uci = uciOrObj;
    } else {
      uci = uciOrObj.move;
      arrow = uciOrObj.arrow;
    }

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);

    // Show pre-move highlight and arrow
    if (arrow) {
      setAnimQueue([arrow]);
    } else {
      setAnimQueue([[from, to, 'rgba(129,182,76,0.7)']]);
    }
    setOptSquares({
      [from]: { backgroundColor: 'rgba(129,182,76,0.35)', borderRadius: '2px' },
      [to]: { backgroundColor: 'rgba(129,182,76,0.55)', borderRadius: '2px' },
    });

    timerRef.current = setTimeout(() => {
      try {
        const g = gameRef.current;
        const promo = uci.length > 4 ? uci.slice(4, 5) : undefined;
        const moveResult = g.move({ from, to, promotion: promo });
        if (moveResult) {
          setGame(new Chess(g.fen()));
          gameRef.current = g;
        }
      } catch { /* skip invalid moves */ }
      setAnimQueue([]);
      setOptSquares({
        [from]: { backgroundColor: 'rgba(255,221,0,0.15)', borderRadius: '2px' },
        [to]: { backgroundColor: 'rgba(255,221,0,0.25)', borderRadius: '2px' },
      });
      timerRef.current = setTimeout(() => {
        setOptSquares({});
        stepAnimation(idx + 1);
      }, animSpeedMap[animationSpeed] * 0.4);
    }, animSpeedMap[animationSpeed] * 0.6);
  }, [animationSequence, animationLoop, animationSpeed, fen, stopAnimation]);

  useEffect(() => {
    if (isAnimating) stepAnimation(animIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, animIdx]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const attemptMove = useCallback((source, target) => {
    if (!interactive) return false;
    const g = gameRef.current;
    if (!g) return false;
    try {
      const promo = g.get(source)?.type === 'p' && (target[1] === '8' || target[1] === '1') ? 'q' : undefined;
      const result = g.move({ from: source, to: target, promotion: promo });
      if (result) {
        const uci = `${source}${target}${result.promotion || promo || ''}`;
        const plainUci = `${source}${target}`;
        const accepted = normalizedAcceptedMoves.length === 0
          || normalizedAcceptedMoves.includes(uci)
          || normalizedAcceptedMoves.includes(plainUci)
          || normalizedAcceptedMoves.includes(result.san);

        if (!accepted) {
          g.undo();
          setMoveFeedback({ type: 'wrong', message: failureMessage });
          setFeedbackSquares({
            [target]: { backgroundColor: EBOOK_COLOR_ROLES.wrong, borderRadius: '4px' },
          });
          clearMoveFeedback();
          return false;
        }

        setGame(new Chess(g.fen()));
        setSelectedPiece(null);
        setOptSquares({});
        if (normalizedAcceptedMoves.length > 0) {
          setMoveFeedback({ type: 'success', message: successMessage });
          setFeedbackSquares({
            [source]: { backgroundColor: EBOOK_COLOR_ROLES.lastMove, borderRadius: '4px' },
            [target]: { backgroundColor: EBOOK_COLOR_ROLES.best, borderRadius: '4px' },
          });
          clearMoveFeedback();
        }
        if (onMoveAccepted) onMoveAccepted(result);
        return true;
      }
    } catch { /* illegal */ }
    return false;
  }, [clearMoveFeedback, failureMessage, interactive, normalizedAcceptedMoves, onMoveAccepted, successMessage]);

  // --- Interactive Play ---
  const handleSquareClick = useCallback((sq) => {
    if (!interactive) return;
    const g = gameRef.current;
    if (!g) return;
    if (selectedPiece) {
      const from = selectedPiece;
      if (attemptMove(from, sq)) return;
      // If destination has own piece, select it instead
      if (g.get(sq)?.color === g.turn()) {
        setSelectedPiece(sq);
        const moves = g.moves({ square: sq, verbose: true });
        const targets = {};
        moves.forEach(m => {
          targets[m.to] = g.get(m.to)
            ? { backgroundColor: 'rgba(220,60,60,0.3)', borderRadius: '4px' }
            : { background: 'radial-gradient(circle, rgba(129,182,76,0.5) 35%, transparent 36%)', borderRadius: '50%' };
        });
        setOptSquares({ [sq]: { backgroundColor: 'rgba(129,182,76,0.4)', borderRadius: '4px' }, ...targets });
        return;
      }
      setSelectedPiece(null);
      setOptSquares({});
    } else {
      const piece = g.get(sq);
      if (piece && piece.color === g.turn()) {
        setSelectedPiece(sq);
        const moves = g.moves({ square: sq, verbose: true });
        const targets = {};
        moves.forEach(m => {
          targets[m.to] = g.get(m.to)
            ? { backgroundColor: 'rgba(220,60,60,0.3)', borderRadius: '4px' }
            : { background: 'radial-gradient(circle, rgba(129,182,76,0.5) 35%, transparent 36%)', borderRadius: '50%' };
        });
        setOptSquares({ [sq]: { backgroundColor: 'rgba(129,182,76,0.4)', borderRadius: '4px' }, ...targets });
      }
    }
  }, [attemptMove, interactive, selectedPiece]);

  const handlePieceDrop = useCallback((source, target) => attemptMove(source, target), [attemptMove]);

  const resetBoard = useCallback(() => {
    const fresh = createGame(fen);
    setGame(fresh);
    gameRef.current = fresh;
    setSelectedPiece(null);
    setOptSquares({});
    setFeedbackSquares({});
    setMoveFeedback(null);
    stopAnimation();
  }, [fen, stopAnimation]);

  return (
    <div className="ebook-board-container" style={{ margin: '12px 0' }}>
      <div style={{ width: boardSize, maxWidth: '100%' }}>
        <Chessboard
          position={game ? game.fen() : fenToPositionObject(fen)}
          boardOrientation={orientation}
          onSquareClick={interactive ? handleSquareClick : undefined}
          onPieceDrop={interactive ? handlePieceDrop : undefined}
          arePiecesDraggable={interactive}
          customArrows={finalArrows}
          customSquareStyles={hlSquares}
          customDarkSquareStyle={{ backgroundColor: EBOOK_BOARD_THEME.dark }}
          customLightSquareStyle={{ backgroundColor: EBOOK_BOARD_THEME.light }}
          customBoardStyle={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          animationDuration={200}
          showBoardNotation={showCoordinates}
        />
      </div>

      <div className="ebook-board-controls" style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {animationSequence && animationSequence.length > 0 && (
          <button
            onClick={isAnimating ? stopAnimation : startAnimation}
            className="ebook-btn"
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #81b64c',
              background: isAnimating ? '#dc3c3c' : '#81b64c', color: '#fff',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            {isAnimating ? 'Stop' : 'Play'}
          </button>
        )}
        {interactive && (
          <button
            onClick={resetBoard}
            className="ebook-btn"
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #5b8dd9',
              background: '#5b8dd9', color: '#fff',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Reset
          </button>
        )}
        {caption && (
          <span style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>{caption}</span>
        )}
      </div>
      {moveFeedback && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          borderRadius: 6,
          background: moveFeedback.type === 'success' ? '#e8f5e9' : '#fff1f1',
          color: moveFeedback.type === 'success' ? '#2e7d32' : '#a62727',
          fontSize: 13,
          lineHeight: 1.45,
        }}>
          {moveFeedback.message}
        </div>
      )}
    </div>
  );
}
