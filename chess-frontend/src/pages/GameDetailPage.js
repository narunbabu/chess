import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import BoardCustomizer, { getBoardTheme, getPieceStyle } from '../components/play/BoardCustomizer';
import { pieces3dLanding } from '../assets/pieces/pieces3d';
import { getTheme } from '../config/boardThemes';
import { detectOpening } from '../utils/openingDetection';

// ═══ Inline sub-components ═══

const PlayerBar = ({ name, rating, avatarUrl, isWhite, isTop, time }) => (
  <div className={`flex items-center gap-2 px-2 py-1.5 ${isTop ? 'mb-1' : 'mt-1'}`}>
    <div className="relative">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#3d3a37]" />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border border-[#3d3a37] ${isWhite ? 'bg-[#f0d9b5] text-[#1a1a18]' : 'bg-[#3d3a37] text-[#bababa]'}`}>
          {(name || '?')[0]?.toUpperCase()}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-white text-sm font-medium truncate">{name || 'Unknown'}</span>
        {rating && <span className="text-[#8b8987] text-xs">({rating})</span>}
      </div>
    </div>
    {time != null && (
      <div className="text-[#bababa] text-xs font-mono tabular-nums bg-[#262421] px-2 py-1 rounded">
        {Math.floor(time / 1000)}s
      </div>
    )}
  </div>
);

const MoveCell = ({ san, isActive, onClick, dataIndex }) => (
  <button
    onClick={onClick}
    data-active={isActive}
    data-index={dataIndex}
    className={`text-left px-2 py-0.5 rounded text-sm transition-colors cursor-pointer ${
      isActive
        ? 'bg-[#81b64c] text-white font-semibold'
        : 'text-[#bababa] hover:bg-[#262421] hover:text-white'
    }`}
  >
    {san}
  </button>
);

const ResultBadge = ({ result, endReason }) => {
  if (!result) return null;
  const r = String(result).toLowerCase();
  const isWin = ['won', 'win', 'checkmate'].some(w => r.includes(w));
  const isDraw = ['draw', 'stalemate', '1/2'].some(w => r.includes(w));
  const bgClass = isWin ? 'bg-[#81b64c]/20 text-[#a3d160]' : isDraw ? 'bg-[#e8a93e]/20 text-[#e8a93e]' : 'bg-[#c33a3a]/20 text-[#e06464]';
  const label = isWin ? 'Victory' : isDraw ? 'Draw' : 'Defeat';

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 ${bgClass}`}>
      <span className="text-lg font-bold">{label}</span>
      {endReason && <span className="text-xs opacity-75">({endReason})</span>}
    </div>
  );
};

// ═══ Main Component ═══

const GameDetailPage = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Game data
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Board state
  const [game, setGame] = useState(new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [boardSize, setBoardSize] = useState(400);
  const [boardTheme, setBoardTheme] = useState(() => getBoardTheme());
  const [pieceStyle, setPieceStyle] = useState(() => getPieceStyle());

  // Auto-play
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const timerRef = useRef(null);

  // Refs
  const boardBoxRef = useRef(null);
  const moveListRef = useRef(null);

  // ═══ Fetch game data ═══

  useEffect(() => {
    const fetchGame = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/games/${gameId}`);
        setGameData(response.data);
      } catch (err) {
        console.error('Error loading game:', err);
        if (err.response?.status === 404) {
          setError('Game not found.');
        } else if (err.response?.status === 403) {
          setError('You do not have permission to view this game.');
        } else {
          setError('Failed to load game data.');
        }
      } finally {
        setLoading(false);
      }
    };
    if (gameId) fetchGame();
  }, [gameId]);

  // ═══ Process moves into replay format ═══

  const processedMoves = useMemo(() => {
    if (!gameData?.moves) return [];

    const startEntry = { san: 'Start', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };
    const moves = [startEntry];

    if (Array.isArray(gameData.moves)) {
      const tempGame = new Chess();
      for (const moveData of gameData.moves) {
        const notation = moveData.san || moveData.move || moveData.notation;
        if (!notation) continue;
        try {
          const result = tempGame.move(notation);
          if (result) {
            moves.push({
              san: result.san,
              fen: tempGame.fen(),
              time: moveData.time ?? moveData.timestamp ?? undefined,
            });
          }
        } catch (e) {
          console.error('Error processing move:', notation, e);
        }
      }
    }

    return moves;
  }, [gameData?.moves]);

  const totalMoves = processedMoves.length - 1; // Exclude 'Start'

  // ═══ Move pairs for display ═══

  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 1; i < processedMoves.length; i += 2) {
      const white = processedMoves[i];
      const black = processedMoves[i + 1];
      pairs.push({
        num: Math.ceil(i / 2),
        white: white?.san,
        whiteIdx: i,
        whiteTime: white?.time,
        black: black?.san || null,
        blackIdx: black ? i + 1 : null,
        blackTime: black?.time,
      });
    }
    return pairs;
  }, [processedMoves]);

  // ═══ Opening detection ═══

  const openingName = useMemo(() => {
    // Prefer backend-detected opening
    if (gameData?.opening_name) return gameData.opening_name;
    // Fallback to frontend detection
    const sans = processedMoves.slice(1).map(m => m.san);
    return detectOpening(sans);
  }, [gameData?.opening_name, processedMoves]);

  // ═══ Player info ═══

  const playerInfo = useMemo(() => {
    if (!gameData) return { topName: '', topRating: '', bottomName: '', bottomRating: '' };

    const playerColor = gameData.player_color || 'white';
    const isWhite = playerColor === 'white';

    const wp = gameData.white_player || {};
    const bp = gameData.black_player || {};

    return {
      topName: isWhite ? (bp.name || 'Opponent') : (wp.name || 'Opponent'),
      topRating: isWhite ? bp.rating : wp.rating,
      topAvatar: isWhite ? bp.avatar : wp.avatar,
      topIsWhite: !isWhite,
      topTime: isWhite ? gameData.black_time_remaining_ms : gameData.white_time_remaining_ms,
      bottomName: isWhite ? (wp.name || user?.name || 'You') : (bp.name || user?.name || 'You'),
      bottomRating: isWhite ? wp.rating : bp.rating,
      bottomAvatar: isWhite ? wp.avatar : bp.avatar,
      bottomIsWhite: isWhite,
      bottomTime: isWhite ? gameData.white_time_remaining_ms : gameData.black_time_remaining_ms,
    };
  }, [gameData, user]);

  // ═══ Reset board when game loads ═══

  useEffect(() => {
    if (processedMoves.length > 0) {
      setGame(new Chess());
      setCurrentMoveIndex(0);
    }
  }, [processedMoves]);

  // ═══ Board sizing ═══

  useEffect(() => {
    if (!boardBoxRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      const vh = window.innerHeight;
      const newSize = Math.floor(Math.min(width, vh - 180));
      if (newSize > 0) setBoardSize(newSize);
    });
    ro.observe(boardBoxRef.current);
    return () => ro.disconnect();
  }, []);

  // ═══ Navigation functions ═══

  const jumpToMove = useCallback((targetIndex) => {
    if (targetIndex < 0 || targetIndex >= processedMoves.length) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsPlaying(false);

    const newGame = new Chess();
    for (let i = 1; i <= targetIndex; i++) {
      const entry = processedMoves[i];
      if (entry?.san && entry.san !== 'Start') {
        const result = newGame.move(entry.san);
        if (!result) {
          console.error(`Invalid replay move at index ${i}:`, entry.san);
          return;
        }
      }
    }
    setGame(newGame);
    setCurrentMoveIndex(targetIndex);
  }, [processedMoves]);

  const stepForward = useCallback(() => {
    if (currentMoveIndex >= processedMoves.length - 1) return;
    jumpToMove(currentMoveIndex + 1);
  }, [currentMoveIndex, processedMoves.length, jumpToMove]);

  const stepBackward = useCallback(() => {
    if (currentMoveIndex <= 0) return;
    jumpToMove(currentMoveIndex - 1);
  }, [currentMoveIndex, jumpToMove]);

  const goToStart = useCallback(() => jumpToMove(0), [jumpToMove]);
  const goToEnd = useCallback(() => jumpToMove(processedMoves.length - 1), [processedMoves.length, jumpToMove]);

  // ═══ Auto-play ═══

  const toggleAutoPlay = useCallback(() => {
    if (isPlaying) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsPlaying(false);
    } else {
      if (currentMoveIndex >= processedMoves.length - 1) jumpToMove(0);
      setIsPlaying(true);
    }
  }, [isPlaying, currentMoveIndex, processedMoves.length, jumpToMove]);

  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setCurrentMoveIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex < processedMoves.length) {
          const newGame = new Chess();
          for (let i = 1; i <= nextIndex; i++) {
            const entry = processedMoves[i];
            if (entry?.san && entry.san !== 'Start') {
              const result = newGame.move(entry.san);
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
  }, [isPlaying, playSpeed, processedMoves]);

  // ═══ Keyboard shortcuts ═══

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

  // ═══ Auto-scroll move list ═══

  useEffect(() => {
    if (!moveListRef.current) return;
    const activeEl = moveListRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentMoveIndex]);

  // ═══ Time formatting ═══

  const formatTimeControl = (tc) => {
    if (!tc) return null;
    const mins = tc.minutes;
    const inc = tc.increment;
    if (mins == null) return null;
    return inc ? `${mins}+${inc}` : `${mins} min`;
  };

  const formatTimestamp = (seconds) => {
    if (seconds == null) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // ═══ Loading & Error states ═══

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a18] flex flex-col items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#81b64c] border-t-transparent rounded-full mb-4" />
        <p className="text-[#bababa] text-sm">Loading game...</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-[#312e2b] border border-[#3d3a37] hover:border-[#4a4744] text-white rounded-lg text-sm transition-colors">Back</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a18] flex flex-col items-center justify-center">
        <div className="text-[#c33a3a] text-lg font-semibold mb-2">Error</div>
        <p className="text-[#bababa] text-sm mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-[#312e2b] border border-[#3d3a37] hover:border-[#4a4744] text-white rounded-lg text-sm transition-colors">Back</button>
      </div>
    );
  }

  if (!gameData) return null;

  // Speed buttons
  const speeds = [
    { label: 'Slow', value: 2000 },
    { label: 'Normal', value: 1000 },
    { label: 'Fast', value: 400 },
  ];

  const boardOrientation = gameData.player_color === 'black' ? 'black' : 'white';

  // ═══ JSX ═══

  return (
    <div className="min-h-screen bg-[#1a1a18] text-white">
      {/* ─── Header ─── */}
      <div className="bg-[#262421] border-b border-[#3d3a37] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-[#bababa] hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back to Games
        </button>
        <h1 className="text-white font-semibold text-base flex-1 text-center">Game Details</h1>
        <div className="w-24" /> {/* Spacer for centering */}
      </div>

      {/* ─── Main Content ─── */}
      <div className="max-w-7xl mx-auto px-3 py-4 lg:px-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

          {/* ═══ LEFT COLUMN: Board + Controls ═══ */}
          <div className="flex-1 flex flex-col items-center lg:items-start min-w-0">

            {/* Opponent PlayerBar (top) */}
            <div className="w-full max-w-[600px]">
              <PlayerBar
                name={playerInfo.topName}
                rating={playerInfo.topRating}
                avatarUrl={playerInfo.topAvatar}
                isWhite={playerInfo.topIsWhite}
                isTop={true}
                time={playerInfo.topTime}
              />
            </div>

            {/* Board */}
            <div className="w-full max-w-[600px] relative" ref={boardBoxRef}>
              <div className="absolute top-1 right-1 z-10">
                <BoardCustomizer
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  onThemeChange={setBoardTheme}
                  onPieceStyleChange={setPieceStyle}
                />
              </div>
              <Chessboard
                position={game.fen()}
                boardWidth={boardSize}
                boardOrientation={boardOrientation}
                arePiecesDraggable={false}
                customDarkSquareStyle={{ backgroundColor: getTheme(boardTheme).dark }}
                customLightSquareStyle={{ backgroundColor: getTheme(boardTheme).light }}
                customBoardStyle={{ borderRadius: '8px', overflow: 'hidden' }}
                {...(pieceStyle === '3d' ? { customPieces: pieces3dLanding } : {})}
              />
            </div>

            {/* Player PlayerBar (bottom) */}
            <div className="w-full max-w-[600px]">
              <PlayerBar
                name={playerInfo.bottomName}
                rating={playerInfo.bottomRating}
                avatarUrl={playerInfo.bottomAvatar}
                isWhite={playerInfo.bottomIsWhite}
                isTop={false}
                time={playerInfo.bottomTime}
              />
            </div>

            {/* ─── Navigation Controls ─── */}
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

                {/* Speed selector */}
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

                {/* Move counter */}
                <div className="ml-auto text-[#8b8987] text-xs tabular-nums">
                  <span className="text-[#bababa]">{currentMoveIndex}</span> / {totalMoves}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT COLUMN: Info + Moves ═══ */}
          <div className="w-full lg:w-[340px] xl:w-[380px] flex flex-col gap-3 flex-shrink-0">

            {/* ─── Game Info Card ─── */}
            <div className="unified-card">
              <ResultBadge result={gameData.result} endReason={gameData.end_reason || gameData.endReasonRelation?.name} />

              <div className="space-y-2 mt-3">
                {openingName && (
                  <div className="flex items-center gap-2 bg-[#262421] rounded-lg px-3 py-2">
                    <span className="text-[#8b8987] text-xs">Opening</span>
                    <span className="text-white text-sm font-medium ml-auto">{openingName}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Date</div>
                    <div className="text-white text-sm">{gameData.created_at ? new Date(gameData.created_at).toLocaleDateString() : '—'}</div>
                  </div>
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Mode</div>
                    <div className="text-white text-sm capitalize">{gameData.game_mode || '—'}</div>
                  </div>
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Moves</div>
                    <div className="text-white text-sm font-semibold">{totalMoves}</div>
                  </div>
                  {formatTimeControl(gameData.time_control) && (
                    <div className="bg-[#262421] rounded-lg px-3 py-2">
                      <div className="text-[#8b8987] text-xs">Time Control</div>
                      <div className="text-white text-sm font-semibold">{formatTimeControl(gameData.time_control)}</div>
                    </div>
                  )}
                </div>

                {/* Players */}
                <div className="bg-[#262421] rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#f0d9b5] border border-[#3d3a37]" />
                      <span className="text-white text-sm">{gameData.white_player?.name || 'White'}</span>
                      {gameData.white_player?.rating && <span className="text-[#8b8987] text-xs">({gameData.white_player.rating})</span>}
                    </div>
                    <span className="text-[#8b8987] text-xs">vs</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm">{gameData.black_player?.name || 'Black'}</span>
                      {gameData.black_player?.rating && <span className="text-[#8b8987] text-xs">({gameData.black_player.rating})</span>}
                      <div className="w-3 h-3 rounded-full bg-[#3d3a37] border border-[#4a4744]" />
                    </div>
                  </div>
                </div>

                {/* Status */}
                {gameData.status && (
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Status</div>
                    <div className="text-white text-sm capitalize">{gameData.status}</div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Moves Card ─── */}
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
                        <div className="flex items-center gap-1">
                          <MoveCell
                            san={pair.white}
                            isActive={currentMoveIndex === pair.whiteIdx}
                            onClick={() => jumpToMove(pair.whiteIdx)}
                            dataIndex={pair.whiteIdx}
                          />
                          {pair.whiteTime != null && (
                            <span className="text-[#8b8987] text-[10px] tabular-nums">{formatTimestamp(pair.whiteTime)}</span>
                          )}
                        </div>
                        {pair.black ? (
                          <div className="flex items-center gap-1">
                            <MoveCell
                              san={pair.black}
                              isActive={currentMoveIndex === pair.blackIdx}
                              onClick={() => jumpToMove(pair.blackIdx)}
                              dataIndex={pair.blackIdx}
                            />
                            {pair.blackTime != null && (
                              <span className="text-[#8b8987] text-[10px] tabular-nums">{formatTimestamp(pair.blackTime)}</span>
                            )}
                          </div>
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Review Link ─── */}
            <div className="unified-card">
              <button
                onClick={() => navigate(`/play/review/${gameId}`)}
                className="w-full flex items-center justify-center gap-2 bg-[#81b64c] hover:bg-[#a3d160] rounded-lg px-4 py-2.5 text-white transition-all text-sm font-medium"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Full Game Review
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3d3a37; border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a4744; }
      `}</style>
    </div>
  );
};

export default GameDetailPage;
