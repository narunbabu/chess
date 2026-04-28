import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.chess99.com/api'
    : 'http://localhost:8000/api');

const EVAL_BADGE_STYLES = {
  excellent: { icon: '⭐', color: '#81b64c' },
  great: { icon: '🔥', color: '#81b64c' },
  good: { icon: '✓', color: '#a3d160' },
  inaccuracy: { icon: '?!', color: '#e8a93e' },
  mistake: { icon: '?', color: '#e8a93e' },
  blunder: { icon: '??', color: '#c33a3a' },
};

const PlayerBar = ({ name, rating, avatarUrl, isWhite, isTop, time }) => {
  const initial = (name || '?')[0].toUpperCase();
  const formatTime = (ms) => {
    if (ms == null) return null;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const formattedTime = formatTime(time);
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#262421] border border-[#3d3a37] ${isTop ? 'mb-1' : 'mt-1'}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#4a4744]" />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border border-[#4a4744] ${isWhite ? 'bg-gray-200 text-gray-800' : 'bg-gray-700 text-gray-200'}`}>
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-sm font-medium truncate max-w-[120px] lg:max-w-[180px]">{name || 'Player'}</span>
          {rating != null && <span className="text-[#8b8987] text-xs">({rating})</span>}
        </div>
      </div>
      {formattedTime && (
        <div className="bg-[#1a1a18] px-2.5 py-1 rounded border border-[#3d3a37]">
          <span className="text-white text-sm font-mono tabular-nums">{formattedTime}</span>
        </div>
      )}
    </div>
  );
};

const GameReplayPage = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();

  const [gameData, setGameData] = useState(null);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const [boardSize, setBoardSize] = useState(400);
  const [copied, setCopied] = useState(false);

  const timerRef = useRef(null);
  const boardBoxRef = useRef(null);
  const moveListRef = useRef(null);

  // Load game data from public API
  useEffect(() => {
    const loadGame = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/public/games/${gameId}`);
        const data = res.data;
        setGameData(data);

        // Convert moves to standardized format
        let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];
        const rawMoves = data.moves;

        if (typeof rawMoves === 'string' && rawMoves.length > 0) {
          const tempGame = new Chess();
          rawMoves.split(';').forEach(moveStr => {
            const fields = moveStr.split(',');
            const notation = fields[0];
            const time = fields[1];
            const evalTotal = fields.length > 2 && fields[2] !== '' ? parseFloat(fields[2]) : null;
            const moveClass = fields.length > 3 ? fields[3] : null;
            if (notation && notation.trim()) {
              try {
                const move = tempGame.move(notation.trim());
                if (move) {
                  convertedMoves.push({
                    move: { san: move.san },
                    fen: tempGame.fen(),
                    time: parseFloat(time) || undefined,
                    evaluation: evalTotal != null ? { total: evalTotal, moveClassification: moveClass } : null,
                  });
                }
              } catch { /* skip invalid move */ }
            }
          });
        } else if (Array.isArray(rawMoves) && rawMoves.length > 0) {
          const tempGame = new Chess();
          rawMoves.forEach(m => {
            const notation = m.san || m.notation || (typeof m === 'string' ? m : null);
            if (notation && notation.trim()) {
              try {
                const move = tempGame.move(notation.trim());
                if (move) {
                  convertedMoves.push({
                    move: { san: move.san },
                    fen: tempGame.fen(),
                    time: m.time || m.move_time_ms,
                    evaluation: m.evaluation || null,
                  });
                }
              } catch { /* skip invalid move */ }
            }
          });
        }

        setMoves(convertedMoves);
      } catch (err) {
        console.error('Error loading public game:', err);
        setError(err.response?.status === 404 ? 'Game not found or not yet completed.' : 'Failed to load game.');
      } finally {
        setLoading(false);
      }
    };
    loadGame();
  }, [gameId]);

  const totalMoves = Math.max(0, moves.length - 1);

  // Player info
  const whitePlayer = gameData?.white_player || { name: 'White', rating: null, avatar_url: null };
  const blackPlayer = gameData?.black_player || { name: 'Black', rating: null, avatar_url: null };

  // Determine result text
  const resultInfo = useMemo(() => {
    if (!gameData) return { text: '', icon: '', color: '' };
    const wp = gameData.winner_player;
    const endReason = gameData.end_reason || '';
    if (wp === 'white') return { text: `${whitePlayer.name} wins`, icon: '🏆', color: '#81b64c' };
    if (wp === 'black') return { text: `${blackPlayer.name} wins`, icon: '🏆', color: '#81b64c' };
    if (gameData.result === '1/2-1/2' || gameData.result === 'draw') return { text: 'Draw', icon: '🤝', color: '#e8a93e' };
    return { text: 'Game over', icon: '🏁', color: '#8b8987' };
  }, [gameData, whitePlayer.name, blackPlayer.name]);

  // Move pairs for display
  const movePairs = useMemo(() => {
    if (moves.length <= 1) return [];
    const pairs = [];
    const m = moves.slice(1);
    for (let i = 0; i < m.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: m[i]?.move?.san || '',
        whiteIdx: i + 1,
        whiteEval: m[i]?.evaluation || null,
        black: m[i + 1]?.move?.san || null,
        blackIdx: m[i + 1] ? i + 2 : null,
        blackEval: m[i + 1]?.evaluation || null,
      });
    }
    return pairs;
  }, [moves]);

  // Navigation
  const jumpToMove = useCallback((targetIndex) => {
    if (targetIndex < 0 || targetIndex >= moves.length) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsPlaying(false);
    const newGame = new Chess();
    for (let i = 1; i <= targetIndex; i++) {
      const san = moves[i]?.move?.san;
      if (san && san !== 'Start') {
        const result = newGame.move(san);
        if (!result) return;
      }
    }
    setGame(newGame);
    setCurrentMoveIndex(targetIndex);
  }, [moves]);

  const stepForward = useCallback(() => {
    if (currentMoveIndex >= moves.length - 1) return;
    jumpToMove(currentMoveIndex + 1);
  }, [currentMoveIndex, moves.length, jumpToMove]);

  const stepBackward = useCallback(() => {
    if (currentMoveIndex <= 0) return;
    jumpToMove(currentMoveIndex - 1);
  }, [currentMoveIndex, jumpToMove]);

  const goToStart = useCallback(() => jumpToMove(0), [jumpToMove]);
  const goToEnd = useCallback(() => jumpToMove(moves.length - 1), [moves.length, jumpToMove]);

  const toggleAutoPlay = useCallback(() => {
    if (isPlaying) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsPlaying(false);
    } else {
      if (currentMoveIndex >= moves.length - 1) jumpToMove(0);
      setIsPlaying(true);
    }
  }, [isPlaying, currentMoveIndex, moves.length, jumpToMove]);

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setCurrentMoveIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex < moves.length) {
          const newGame = new Chess();
          for (let i = 1; i <= nextIndex; i++) {
            const san = moves[i]?.move?.san;
            if (san && san !== 'Start') {
              const result = newGame.move(san);
              if (!result) { clearInterval(timerRef.current); timerRef.current = null; setIsPlaying(false); return prev; }
            }
          }
          setGame(newGame);
          return nextIndex;
        } else {
          clearInterval(timerRef.current); timerRef.current = null; setIsPlaying(false);
          return prev;
        }
      });
    }, playSpeed);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [isPlaying, playSpeed, moves]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); stepBackward(); break;
        case 'ArrowRight': e.preventDefault(); stepForward(); break;
        case 'Home': e.preventDefault(); goToStart(); break;
        case 'End': e.preventDefault(); goToEnd(); break;
        case ' ': e.preventDefault(); toggleAutoPlay(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepBackward, stepForward, goToStart, goToEnd, toggleAutoPlay]);

  // Auto-scroll move list
  useEffect(() => {
    if (!moveListRef.current) return;
    const activeEl = moveListRef.current.querySelector('[data-active="true"]');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMoveIndex]);

  // Board sizing
  useEffect(() => {
    if (!boardBoxRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      const vh = window.innerHeight;
      const newSize = Math.floor(Math.min(width, vh - 200));
      if (newSize > 0) setBoardSize(newSize);
    });
    ro.observe(boardBoxRef.current);
    return () => ro.disconnect();
  }, []);

  // Share replay link
  const replayUrl = `${window.location.origin}/games/${gameId}/replay`;
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(replayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = replayUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const speeds = [
    { label: 'Slow', value: 2000 },
    { label: 'Normal', value: 1000 },
    { label: 'Fast', value: 400 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a18] flex flex-col items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#81b64c] border-t-transparent rounded-full mb-4" />
        <p className="text-[#bababa] text-sm">Loading game replay...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a18] flex flex-col items-center justify-center">
        <div className="text-[#c33a3a] text-lg font-semibold mb-2">Error</div>
        <p className="text-[#bababa] text-sm mb-4">{error}</p>
        <a href="/" className="px-4 py-2 bg-[#81b64c] hover:bg-[#a3d160] text-white rounded-lg text-sm transition-colors font-medium">
          Go to Chess99.com
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a18] text-white">
      {/* Header */}
      <div className="bg-[#262421] border-b border-[#3d3a37] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-[#bababa] hover:text-white transition-colors text-sm flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Chess99
          </a>
          <span className="text-[#3d3a37]">|</span>
          <span className="text-[#bababa] text-sm">Game Replay</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              copied
                ? 'bg-[#81b64c]/20 border border-[#81b64c] text-[#a3d160]'
                : 'bg-[#312e2b] border border-[#3d3a37] hover:border-[#81b64c] text-[#bababa] hover:text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            {copied ? 'Copied!' : 'Share Replay'}
          </button>
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#81b64c] hover:bg-[#a3d160] rounded-lg text-white text-sm font-medium transition-all"
          >
            Play Chess
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 py-4 lg:px-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

          {/* LEFT: Board + Controls */}
          <div className="flex-1 flex flex-col items-center lg:items-start min-w-0">
            {/* Top player (Black) */}
            <div className="w-full max-w-[600px]">
              <PlayerBar
                name={blackPlayer.name}
                rating={blackPlayer.rating}
                avatarUrl={blackPlayer.avatar_url}
                isWhite={false}
                isTop={true}
                time={gameData?.black_time_remaining_ms}
              />
            </div>

            {/* Board */}
            <div className="w-full max-w-[600px] relative" ref={boardBoxRef}>
              <Chessboard
                position={game.fen()}
                boardWidth={boardSize}
                boardOrientation="white"
                arePiecesDraggable={false}
                customDarkSquareStyle={{ backgroundColor: '#779556' }}
                customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
                customBoardStyle={{ borderRadius: '8px', overflow: 'hidden' }}
              />
            </div>

            {/* Bottom player (White) */}
            <div className="w-full max-w-[600px]">
              <PlayerBar
                name={whitePlayer.name}
                rating={whitePlayer.rating}
                avatarUrl={whitePlayer.avatar_url}
                isWhite={true}
                isTop={false}
                time={gameData?.white_time_remaining_ms}
              />
            </div>

            {/* Navigation Controls */}
            <div className="w-full max-w-[600px] mt-2 unified-card !py-2.5 !px-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[
                    { label: '|◀', onClick: goToStart, disabled: currentMoveIndex <= 0 },
                    { label: '◀', onClick: stepBackward, disabled: currentMoveIndex <= 0 },
                    { label: isPlaying ? '⏸' : '▶', onClick: toggleAutoPlay, disabled: totalMoves === 0, isPlay: true },
                    { label: '▶', onClick: stepForward, disabled: currentMoveIndex >= totalMoves },
                    { label: '▶|', onClick: goToEnd, disabled: currentMoveIndex >= totalMoves },
                  ].map((btn, i) => (
                    <button
                      key={i}
                      onClick={btn.onClick}
                      disabled={btn.disabled}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all
                        ${btn.isPlay
                          ? 'bg-[#81b64c] hover:bg-[#a3d160] text-white'
                          : 'bg-[#262421] border border-[#3d3a37] hover:border-[#4a4744] text-[#bababa] hover:text-white'
                        }
                        disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-0.5 ml-2 bg-[#262421] rounded-lg p-0.5 border border-[#3d3a37]">
                  {speeds.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setPlaySpeed(s.value)}
                      className={`px-2 py-1 text-xs rounded-md transition-all ${
                        playSpeed === s.value
                          ? 'bg-[#81b64c] text-white font-semibold'
                          : 'text-[#8b8987] hover:text-[#bababa]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="ml-auto text-[#8b8987] text-xs tabular-nums">
                  <span className="text-[#bababa]">{currentMoveIndex}</span> / {totalMoves}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Info + Moves */}
          <div className="w-full lg:w-[340px] xl:w-[380px] flex flex-col gap-3 flex-shrink-0">

            {/* Result Card */}
            <div className="unified-card">
              <div className="text-center py-3">
                <div className="text-3xl mb-1">{resultInfo.icon}</div>
                <div className="text-lg font-bold" style={{ color: resultInfo.color }}>{resultInfo.text}</div>
                {gameData?.end_reason && (
                  <div className="text-[#8b8987] text-xs mt-1 capitalize">{gameData.end_reason.replace(/_/g, ' ')}</div>
                )}
              </div>
              <div className="space-y-2 mt-2">
                {gameData?.opening_name && (
                  <div className="flex items-center gap-2 bg-[#262421] rounded-lg px-3 py-2">
                    <span className="text-[#8b8987] text-xs">Opening</span>
                    <span className="text-white text-sm font-medium ml-auto">{gameData.opening_name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {gameData?.played_at && (
                    <div className="bg-[#262421] rounded-lg px-3 py-2">
                      <div className="text-[#8b8987] text-xs">Date</div>
                      <div className="text-white text-sm">{new Date(gameData.played_at).toLocaleDateString()}</div>
                    </div>
                  )}
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Moves</div>
                    <div className="text-white text-sm font-semibold">{totalMoves}</div>
                  </div>
                  {gameData?.time_control && (
                    <div className="bg-[#262421] rounded-lg px-3 py-2">
                      <div className="text-[#8b8987] text-xs">Time</div>
                      <div className="text-white text-sm">{gameData.time_control.minutes}+{gameData.time_control.increment}</div>
                    </div>
                  )}
                  {gameData?.computer_level > 0 && (
                    <div className="bg-[#262421] rounded-lg px-3 py-2">
                      <div className="text-[#8b8987] text-xs">Level</div>
                      <div className="text-white text-sm font-semibold">{gameData.computer_level}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Moves Card */}
            {totalMoves > 0 && (
              <div className="unified-card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white text-sm font-semibold">Moves</h3>
                  <span className="text-[#8b8987] text-xs">{totalMoves} moves</span>
                </div>
                <div
                  ref={moveListRef}
                  className="max-h-[300px] lg:max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar"
                >
                  <div className="grid gap-px">
                    {movePairs.map(pair => (
                      <div key={pair.num} className="grid grid-cols-[36px_1fr_1fr] items-center">
                        <span className="text-[#8b8987] text-xs text-right pr-2 tabular-nums">{pair.num}.</span>
                        <span
                          onClick={() => jumpToMove(pair.whiteIdx)}
                          data-active={currentMoveIndex === pair.whiteIdx || undefined}
                          className={`cursor-pointer px-1.5 py-0.5 rounded text-sm font-mono transition-colors ${
                            currentMoveIndex === pair.whiteIdx
                              ? 'bg-[#81b64c]/25 text-[#a3d160] font-semibold'
                              : 'text-[#bababa] hover:bg-[#3d3a37] hover:text-white'
                          }`}
                        >
                          {pair.white}
                        </span>
                        {pair.black ? (
                          <span
                            onClick={() => jumpToMove(pair.blackIdx)}
                            data-active={currentMoveIndex === pair.blackIdx || undefined}
                            className={`cursor-pointer px-1.5 py-0.5 rounded text-sm font-mono transition-colors ${
                              currentMoveIndex === pair.blackIdx
                                ? 'bg-[#81b64c]/25 text-[#a3d160] font-semibold'
                                : 'text-[#bababa] hover:bg-[#3d3a37] hover:text-white'
                            }`}
                          >
                            {pair.black}
                          </span>
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CTA Card */}
            <div className="unified-card text-center py-4">
              <div className="text-lg mb-2">♟️</div>
              <h3 className="text-white font-semibold text-sm mb-1">Play Chess Online</h3>
              <p className="text-[#8b8987] text-xs mb-3">Challenge players worldwide at Chess99.com</p>
              <a
                href="/"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#81b64c] hover:bg-[#a3d160] rounded-lg text-white text-sm font-medium transition-all"
              >
                Start Playing
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3d3a37; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a4744; }
      `}</style>
    </div>
  );
};

export default GameReplayPage;
