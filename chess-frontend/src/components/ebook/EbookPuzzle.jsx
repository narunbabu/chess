import React, { useState, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { computeCCTFromPuzzle, isGenuineNewCheck } from '../../utils/computeCCT';

const CCT_COLORS = {
  check: '#ef4444',
  capture: '#5b8dd9',
  threat: '#c9882a',
};
const CCT_COLORS_DIM = {
  check: 'rgba(239,68,68,0.35)',
  capture: 'rgba(91,141,217,0.35)',
  threat: 'rgba(201,136,42,0.35)',
};

export default function EbookPuzzle({
  puzzle,
  boardSize = 340,
  onSolved,
}) {
  const { fen, moves, playerColor = 'w', themes = [] } = puzzle;
  const solutionMoves = moves || [];
  const playerIsWhite = playerColor === 'w';

  const [game] = useState(() => {
    try { return new Chess(fen); } catch { return new Chess(); }
  });
  const [currentFen, setCurrentFen] = useState(fen);
  const gameRef = useRef(new Chess(fen));
  const [moveIdx, setMoveIdx] = useState(0);
  const [status, setStatus] = useState('playing'); // playing | success | failed
  const [message, setMessage] = useState('');
  const [wrongSq, setWrongSq] = useState(null);
  const [correctSq, setCorrectSq] = useState(null);
  const [cctData, setCctData] = useState(null);
  const [showCCT, setShowCCT] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);

  // Compute CCT data on mount
  useState(() => {
    try {
      const data = computeCCTFromPuzzle({ fen, moves: solutionMoves, playerColor });
      setCctData(data);
    } catch { /* CCT computation may fail on some positions */ }
  }, []);

  const getExpectedMove = (idx) => {
    if (idx >= solutionMoves.length) return null;
    return solutionMoves[idx];
  };

  const clearHighlights = useCallback(() => {
    setTimeout(() => { setCorrectSq(null); setWrongSq(null); }, 600);
  }, []);

  const checkSolution = useCallback((from, to) => {
    const expected = getExpectedMove(moveIdx);
    if (!expected) return false;
    const uci = from + to;
    if (uci === expected) {
      setCorrectSq(to);
      clearHighlights();
      const g = gameRef.current;
      try {
        g.move({ from, to });
        setCurrentFen(g.fen());
        const nextIdx = moveIdx + 1;
        setMoveIdx(nextIdx);

        if (nextIdx < solutionMoves.length) {
          // Auto-play opponent response
          setTimeout(() => {
            const oppMove = getExpectedMove(nextIdx);
            if (oppMove) {
              try {
                g.move({ from: oppMove.slice(0, 2), to: oppMove.slice(2, 4) });
                setCurrentFen(g.fen());
                setMoveIdx(nextIdx + 1);
                if (nextIdx + 1 >= solutionMoves.length) {
                  setStatus('success');
                  setMessage('Solved!');
                  if (onSolved) onSolved(true, wrongCount);
                }
              } catch { /* skip */ }
            }
          }, 300);
        } else {
          setStatus('success');
          setMessage('Solved!');
          if (onSolved) onSolved(true, wrongCount);
        }
      } catch { /* skip */ }
    } else {
      setWrongSq(to);
      setWrongCount(c => c + 1);
      clearHighlights();
      setMessage('Not quite — try again');
    }
  }, [moveIdx, solutionMoves, clearHighlights, onSolved, wrongCount]);

  const handlePieceDrop = useCallback((source, target) => {
    if (status !== 'playing') return false;
    const piece = gameRef.current.get(source);
    if (!piece || piece.color !== (playerIsWhite ? 'w' : 'b')) return false;
    checkSolution(source, target);
    return true;
  }, [status, playerIsWhite, checkSolution]);

  const handleSquareClick = useCallback((sq) => {
    if (status !== 'playing') return;
    // Not implemented for click-based moves in puzzle mode
  }, [status]);

  const resetPuzzle = useCallback(() => {
    const fresh = new Chess(fen);
    gameRef.current = fresh;
    setCurrentFen(fen);
    setMoveIdx(0);
    setStatus('playing');
    setMessage('');
    setWrongCount(0);
    setWrongSq(null);
    setCorrectSq(null);
  }, [fen]);

  // Build CCT arrows for display
  const cctArrows = [];
  if (showCCT && cctData) {
    const addArrows = (items, colorSet) => {
      items?.forEach(item => {
        cctArrows.push([item.from, item.to, colorSet[item.type] || colorSet.threat]);
      });
    };
    addArrows(cctData.my?.checks, CCT_COLORS);
    addArrows(cctData.my?.captures, CCT_COLORS);
    addArrows(cctData.my?.threats, CCT_COLORS);
    addArrows(cctData.opponent?.checks, CCT_COLORS_DIM);
    addArrows(cctData.opponent?.captures, CCT_COLORS_DIM);
    addArrows(cctData.opponent?.threats, CCT_COLORS_DIM);
  }

  const sqStyles = {};
  if (correctSq) sqStyles[correctSq] = { backgroundColor: 'rgba(129,182,76,0.45)', borderRadius: '4px' };
  if (wrongSq) sqStyles[wrongSq] = { backgroundColor: 'rgba(220,60,60,0.45)', borderRadius: '4px' };

  const themeTag = themes.join(', ');
  const moveLabel = playerIsWhite ? 'White to move' : 'Black to move';

  return (
    <div className="ebook-puzzle" style={{ margin: '16px 0', padding: '12px', border: '1px solid #e0e0e0', borderRadius: 10, background: '#fafafa' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: boardSize, maxWidth: '100%', flexShrink: 0 }}>
          <Chessboard
            position={currentFen}
            boardOrientation={playerIsWhite ? 'white' : 'black'}
            onPieceDrop={handlePieceDrop}
            onSquareClick={handleSquareClick}
            arePiecesDraggable={status === 'playing'}
            customArrows={cctArrows}
            customSquareStyles={sqStyles}
            customDarkSquareStyle={{ backgroundColor: '#779556' }}
            customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
            customBoardStyle={{ borderRadius: '8px', overflow: 'hidden' }}
            animationDuration={200}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{moveLabel}</div>
          {themeTag && <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Themes: {themeTag}</div>}
          {message && (
            <div style={{
              fontSize: 14, padding: '6px 12px', borderRadius: 6, marginBottom: 8,
              background: status === 'success' ? '#e8f5e9' : status === 'failed' ? '#fce4ec' : '#fff3e0',
              color: status === 'success' ? '#2e7d32' : status === 'failed' ? '#c62828' : '#e65100',
            }}>
              {message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowCCT(!showCCT)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #c9882a',
                background: showCCT ? '#c9882a' : 'transparent',
                color: showCCT ? '#fff' : '#c9882a',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {showCCT ? 'Hide CCT' : 'Show CCT Hints'}
            </button>
            <button
              onClick={resetPuzzle}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #5b8dd9',
                background: '#5b8dd9', color: '#fff',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              Reset
            </button>
          </div>
          {showCCT && cctData && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
              <div style={{ color: CCT_COLORS.check }}>Checks: {cctData.my?.checks?.length || 0}</div>
              <div style={{ color: CCT_COLORS.capture }}>Captures: {cctData.my?.captures?.length || 0}</div>
              <div style={{ color: CCT_COLORS.threat }}>Threats: {cctData.my?.threats?.length || 0}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
