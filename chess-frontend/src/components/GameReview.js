import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getGameHistoryById } from "../services/gameHistoryService";
import api from "../services/api";
import GameEndCard from "./GameEndCard";
import { isWin, isDraw } from "../utils/resultStandardization";
import { useAuth } from "../contexts/AuthContext";
import BoardCustomizer, { getBoardTheme, getPieceStyle } from './play/BoardCustomizer';
import { pieces3dLanding } from '../assets/pieces/pieces3d';
import { getTheme } from '../config/boardThemes';
import { detectOpening } from '../utils/openingDetection';

// ═══ Image helpers (kept verbatim — battle-tested for share capture) ═══

const waitForImagesToLoad = async (element) => {
  const images = Array.from(element.querySelectorAll('img'));
  const imageLoadPromises = images.map((img) => {
    return new Promise((resolve) => {
      if (img.complete && img.naturalHeight > 0) { resolve(); return; }
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(() => resolve(), 5000);
    });
  });
  await Promise.all(imageLoadPromises);
};

const loadImageToDataURL = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else { reject(new Error('Failed to get canvas context')); }
      } catch (error) { reject(error); }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

const convertImagesToDataURLs = async (element) => {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      if (img.src.startsWith('data:')) return;
      try {
        img.src = await loadImageToDataURL(img.src);
      } catch { /* continue */ }
    })
  );
  const allElements = [...Array.from(element.querySelectorAll('*')), element];
  await Promise.all(
    allElements.map(async (el) => {
      const bgImage = window.getComputedStyle(el).backgroundImage;
      if (!bgImage || bgImage === 'none' || !bgImage.includes('url(')) return;
      const urlMatches = bgImage.match(/url\(["']?([^"')]+)["']?\)/g);
      if (!urlMatches) return;
      for (const urlMatch of urlMatches) {
        const url = urlMatch.match(/url\(["']?([^"')]+)["']?\)/)[1];
        if (url.startsWith('data:')) continue;
        try {
          const dataUrl = await loadImageToDataURL(url);
          el.style.backgroundImage = bgImage.replace(new RegExp(escapeRegExp(url), 'g'), dataUrl);
        } catch { /* continue */ }
      }
    })
  );
};

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ═══ Inline sub-components ═══

const PlayerBar = ({ name, rating, avatarUrl, isWhite, isTop, time, score }) => {
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
      {/* Avatar */}
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover border border-[#4a4744]" />
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border border-[#4a4744] ${isWhite ? 'bg-gray-200 text-gray-800' : 'bg-gray-700 text-gray-200'}`}>
          {initial}
        </div>
      )}
      {/* Name + rating */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-sm font-medium truncate max-w-[120px] lg:max-w-[180px]">{name || 'Player'}</span>
          {rating != null && <span className="text-[#8b8987] text-xs">({rating})</span>}
        </div>
      </div>
      {/* Score */}
      {score != null && (
        <span className="text-[#e8a93e] text-sm font-semibold tabular-nums">{score}</span>
      )}
      {/* Time */}
      {formattedTime && (
        <div className="bg-[#1a1a18] px-2.5 py-1 rounded border border-[#3d3a37]">
          <span className="text-white text-sm font-mono tabular-nums">{formattedTime}</span>
        </div>
      )}
    </div>
  );
};

const ResultBadge = ({ result, gameHistory }) => {
  const playerWon = isWin(result);
  const drawResult = isDraw(result);
  const rawEndReason = typeof result === 'object' ? (result?.end_reason || result?.details || '') : '';
  const endReasonMap = {
    'checkmate': 'Checkmate',
    'resignation': 'Resignation',
    'timeout': 'Time out',
    'forfeit': 'Resignation',
    'stalemate': 'Stalemate',
    'insufficient_material': 'Insufficient material',
    'threefold_repetition': 'Threefold repetition',
    'fifty_move_rule': 'Fifty move rule',
    'agreement': 'Mutual agreement',
  };
  const endReason = endReasonMap[rawEndReason] || rawEndReason;
  const resultText = playerWon ? 'Victory' : drawResult ? 'Draw' : 'Defeat';
  const bgColor = playerWon ? 'bg-[#81b64c]' : drawResult ? 'bg-[#e8a93e]' : 'bg-[#c33a3a]';
  const icon = playerWon ? '🏆' : drawResult ? '🤝' : '💔';

  return (
    <div className={`${bgColor} rounded-lg px-4 py-3 text-center`}>
      <div className="text-2xl mb-0.5">{icon}</div>
      <div className="text-white text-lg font-bold">{resultText}</div>
      {endReason && <div className="text-white/80 text-xs capitalize mt-0.5">{endReason}</div>}
    </div>
  );
};

const MoveCell = ({ san, isActive, onClick, dataIndex }) => (
  <span
    onClick={onClick}
    data-active={isActive || undefined}
    data-move-index={dataIndex}
    className={`cursor-pointer px-1.5 py-0.5 rounded text-sm font-mono transition-colors
      ${isActive
        ? 'bg-[#81b64c]/25 text-[#a3d160] font-semibold'
        : 'text-[#bababa] hover:bg-[#3d3a37] hover:text-white'
      }`}
  >
    {san}
  </span>
);

// ═══ Main Component ═══

const GameReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: gameId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  // Core state
  const [gameHistory, setGameHistory] = useState({ moves: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());

  // UI state
  const [boardSize, setBoardSize] = useState(400);
  const [showEndCard, setShowEndCard] = useState(false);
  const [isTestSharing, setIsTestSharing] = useState(false);
  const [sharePlayerName, setSharePlayerName] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState(null);
  const [shareBlob, setShareBlob] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Board customization
  const [boardTheme, setBoardTheme] = useState(() => getBoardTheme(user));
  const [pieceStyle, setPieceStyle] = useState(() => getPieceStyle());

  // Auto-play
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms: 2000=slow, 1000=normal, 400=fast
  const timerRef = useRef(null);

  // FEN copy feedback
  const [copiedFen, setCopiedFen] = useState(false);

  // Refs
  const boardBoxRef = useRef(null);
  const moveListRef = useRef(null);

  // Sync board theme from user profile
  useEffect(() => {
    if (user?.board_theme) setBoardTheme(user.board_theme);
  }, [user?.board_theme]);

  // ═══ Computed values ═══

  const totalMoves = gameHistory.moves ? Math.max(0, gameHistory.moves.length - 1) : 0;

  const openingName = useMemo(() => {
    if (!gameHistory.moves || gameHistory.moves.length < 2) return null;
    const sanMoves = gameHistory.moves
      .slice(1) // skip Start entry
      .map(m => m.move?.san)
      .filter(Boolean);
    return detectOpening(sanMoves);
  }, [gameHistory.moves]);

  // Transform flat moves into pairs for two-column display: [{num, white, whiteIdx, black, blackIdx}]
  const movePairs = useMemo(() => {
    if (!gameHistory.moves || gameHistory.moves.length <= 1) return [];
    const pairs = [];
    const moves = gameHistory.moves.slice(1); // skip Start
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i]?.move?.san || '',
        whiteIdx: i + 1, // +1 because we skipped Start
        black: moves[i + 1]?.move?.san || null,
        blackIdx: moves[i + 1] ? i + 2 : null,
      });
    }
    return pairs;
  }, [gameHistory.moves]);

  // Player info derived from gameHistory
  const playerInfo = useMemo(() => {
    const playerColor = gameHistory.player_color || 'w';
    const isMultiplayer = gameHistory.game_mode === 'multiplayer';
    const whitePlayer = gameHistory.white_player;
    const blackPlayer = gameHistory.black_player;

    let topName, topRating, topAvatar, topTime, topScore, topIsWhite;
    let bottomName, bottomRating, bottomAvatar, bottomTime, bottomScore, bottomIsWhite;

    if (playerColor === 'w') {
      // Player is white → opponent (black) on top, player (white) on bottom
      topName = gameHistory.opponent_name || (isMultiplayer ? blackPlayer?.name : 'Computer');
      topRating = isMultiplayer ? blackPlayer?.rating : (gameHistory.opponent_rating || (gameHistory.computer_level ? `Level ${gameHistory.computer_level}` : null));
      topAvatar = isMultiplayer ? blackPlayer?.avatar_url : (gameHistory.opponent_avatar || gameHistory.opponent_avatar_url || null);
      topTime = gameHistory.black_time_remaining_ms;
      topScore = gameHistory.opponent_score;
      topIsWhite = false;

      bottomName = isMultiplayer ? (whitePlayer?.name || user?.name || 'You') : (user?.name || 'You');
      bottomRating = isMultiplayer ? whitePlayer?.rating : null;
      bottomAvatar = isMultiplayer ? whitePlayer?.avatar_url : (user?.avatar_url || null);
      bottomTime = gameHistory.white_time_remaining_ms;
      bottomScore = gameHistory.final_score || gameHistory.finalScore;
      bottomIsWhite = true;
    } else {
      // Player is black → opponent (white) on top, player (black) on bottom
      topName = gameHistory.opponent_name || (isMultiplayer ? whitePlayer?.name : 'Computer');
      topRating = isMultiplayer ? whitePlayer?.rating : (gameHistory.opponent_rating || (gameHistory.computer_level ? `Level ${gameHistory.computer_level}` : null));
      topAvatar = isMultiplayer ? whitePlayer?.avatar_url : (gameHistory.opponent_avatar || gameHistory.opponent_avatar_url || null);
      topTime = gameHistory.white_time_remaining_ms;
      topScore = gameHistory.opponent_score;
      topIsWhite = true;

      bottomName = isMultiplayer ? (blackPlayer?.name || user?.name || 'You') : (user?.name || 'You');
      bottomRating = isMultiplayer ? blackPlayer?.rating : null;
      bottomAvatar = isMultiplayer ? blackPlayer?.avatar_url : (user?.avatar_url || null);
      bottomTime = gameHistory.black_time_remaining_ms;
      bottomScore = gameHistory.final_score || gameHistory.finalScore;
      bottomIsWhite = false;
    }

    return { topName, topRating, topAvatar, topTime, topScore, topIsWhite, bottomName, bottomRating, bottomAvatar, bottomTime, bottomScore, bottomIsWhite };
  }, [gameHistory, user]);

  // ═══ Data loading (kept verbatim) ═══

  useEffect(() => {
    const loadGameData = async () => {
      if (location.state?.gameHistory) {
        console.log('[GameReview] Using gameHistory from navigation state (local game)');
        setGameHistory(location.state.gameHistory);
        setLoading(false);
        return;
      }

      let effectiveGameId = gameId;

      if (!effectiveGameId) {
        let history = location.state?.gameHistory;
        if (!history) {
          const stored = localStorage.getItem('lastGameHistory');
          history = stored ? JSON.parse(stored) : null;
        }
        if (history) {
          setGameHistory(history);
          setLoading(false);
          return;
        } else {
          setError('No game specified');
          setGameHistory({ moves: [] });
          setLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        setError(null);
        const mode = searchParams.get('mode');
        let gameData;
        let isMultiplayer = mode === 'multiplayer';

        if (isMultiplayer) {
          const response = await api.get(`/games/${effectiveGameId}`);
          gameData = response.data;

          if (!gameData) {
            setError('Game not found');
            setGameHistory({ moves: [] });
            setLoading(false);
            return;
          }

          const playerColor = gameData.player_color;
          const formattedGameHistory = {
            id: gameData.id,
            played_at: gameData.ended_at || new Date().toISOString(),
            player_color: playerColor,
            game_mode: 'multiplayer',
            opponent_name: playerColor === 'w' ? gameData.black_player?.name : gameData.white_player?.name,
            moves: gameData.moves,
            final_score: playerColor === 'w' ? parseFloat(gameData.white_player_score || 0) : parseFloat(gameData.black_player_score || 0),
            opponent_score: playerColor === 'w' ? parseFloat(gameData.black_player_score || 0) : parseFloat(gameData.white_player_score || 0),
            result: {
              details: gameData.end_reason,
              end_reason: gameData.end_reason,
              status: gameData.result
            },
            white_time_remaining_ms: gameData.white_time_remaining_ms,
            black_time_remaining_ms: gameData.black_time_remaining_ms,
            white_player: gameData.white_player,
            black_player: gameData.black_player,
            winner_user_id: gameData.winner_user_id,
            computer_level: 0
          };

          let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];

          if (typeof gameData.moves === 'string' && gameData.moves.length > 0) {
            const tempGame = new Chess();
            gameData.moves.split(';').forEach(moveStr => {
              const [notation, time] = moveStr.split(',');
              if (notation && notation.trim()) {
                try {
                  const move = tempGame.move(notation.trim());
                  if (move) {
                    convertedMoves.push({ move: { san: move.san }, fen: tempGame.fen(), time: parseFloat(time) || undefined });
                  }
                } catch (moveError) { console.error('Error processing move:', notation, moveError); }
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (Array.isArray(gameData.moves) && gameData.moves.length > 0 && gameData.moves[0].notation) {
            const tempGame = new Chess();
            gameData.moves.forEach(moveData => {
              try {
                const move = tempGame.move(moveData.notation);
                if (move) {
                  convertedMoves.push({ move: { san: move.san }, fen: tempGame.fen(), time: moveData.time });
                }
              } catch (moveError) { console.error('Error processing move:', moveData.notation, moveError); }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (!Array.isArray(gameData.moves)) {
            formattedGameHistory.moves = convertedMoves;
          } else {
            formattedGameHistory.moves = gameData.moves;
          }

          if (formattedGameHistory.moves && formattedGameHistory.moves.length > 0) {
            const firstEntry = formattedGameHistory.moves[0];
            if (firstEntry && firstEntry.move && firstEntry.move.san && firstEntry.move.san !== 'Start') {
              formattedGameHistory.moves.unshift({
                move: { san: 'Start' },
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
              });
            }
          }

          setGameHistory(formattedGameHistory);
        } else {
          gameData = await getGameHistoryById(effectiveGameId);
          if (!gameData) {
            setError('Game not found');
            setGameHistory({ moves: [] });
            setLoading(false);
            return;
          }

          let formattedGameHistory = { ...gameData };
          let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];

          if (typeof gameData.moves === 'string' && gameData.moves.length > 0) {
            const tempGame = new Chess();
            gameData.moves.split(';').forEach(moveStr => {
              const [notation, time] = moveStr.split(',');
              if (notation && notation.trim()) {
                try {
                  const move = tempGame.move(notation.trim());
                  if (move) {
                    convertedMoves.push({ move: { san: move.san }, fen: tempGame.fen(), time: parseFloat(time) || undefined });
                  }
                } catch (moveError) { console.error('Error processing move:', notation, moveError); }
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (Array.isArray(gameData.moves) && gameData.moves.length > 0 && gameData.moves[0].notation) {
            const tempGame = new Chess();
            gameData.moves.forEach(moveData => {
              try {
                const move = tempGame.move(moveData.notation);
                if (move) {
                  convertedMoves.push({ move: { san: move.san }, fen: tempGame.fen(), time: moveData.time });
                }
              } catch (moveError) { console.error('Error processing move:', moveData.notation, moveError); }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (!Array.isArray(gameData.moves)) {
            formattedGameHistory.moves = convertedMoves;
          } else {
            formattedGameHistory.moves = gameData.moves;
          }

          setGameHistory(formattedGameHistory);
        }
      } catch (err) {
        console.error('Error loading game data:', err);
        setError('Failed to load game data. ' + err.message);
        setGameHistory({ moves: [] });
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, location.state, searchParams]);

  // Reset board when game history changes
  useEffect(() => {
    const newGame = new Chess();
    setGame(newGame);
    setCurrentMoveIndex(0);
  }, [gameHistory]);

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
    if (!gameHistory.moves || targetIndex < 0 || targetIndex >= gameHistory.moves.length) return;
    // Stop auto-play
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsPlaying(false);

    const newGame = new Chess();
    for (let i = 1; i <= targetIndex; i++) {
      const moveEntry = gameHistory.moves[i];
      if (moveEntry?.move?.san && moveEntry.move.san !== 'Start') {
        const result = newGame.move(moveEntry.move.san);
        if (!result) {
          console.error(`Invalid replay move at index ${i}:`, moveEntry.move.san);
          return;
        }
      }
    }
    setGame(newGame);
    setCurrentMoveIndex(targetIndex);
  }, [gameHistory.moves]);

  const stepForward = useCallback(() => {
    if (!gameHistory.moves || currentMoveIndex >= gameHistory.moves.length - 1) return;
    jumpToMove(currentMoveIndex + 1);
  }, [currentMoveIndex, gameHistory.moves, jumpToMove]);

  const stepBackward = useCallback(() => {
    if (currentMoveIndex <= 0) return;
    jumpToMove(currentMoveIndex - 1);
  }, [currentMoveIndex, jumpToMove]);

  const goToStart = useCallback(() => jumpToMove(0), [jumpToMove]);
  const goToEnd = useCallback(() => {
    if (gameHistory.moves) jumpToMove(gameHistory.moves.length - 1);
  }, [gameHistory.moves, jumpToMove]);

  // ═══ Auto-play ═══

  const toggleAutoPlay = useCallback(() => {
    if (isPlaying) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsPlaying(false);
    } else {
      // If at end, restart from beginning
      if (currentMoveIndex >= (gameHistory.moves?.length || 1) - 1) {
        jumpToMove(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentMoveIndex, gameHistory.moves, jumpToMove]);

  // Auto-play interval effect
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setInterval(() => {
      setCurrentMoveIndex(prev => {
        const nextIndex = prev + 1;
        if (gameHistory?.moves && nextIndex < gameHistory.moves.length) {
          const newGame = new Chess();
          for (let i = 1; i <= nextIndex; i++) {
            const moveEntry = gameHistory.moves[i];
            if (moveEntry?.move?.san && moveEntry.move.san !== 'Start') {
              const result = newGame.move(moveEntry.move.san);
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
  }, [isPlaying, playSpeed, gameHistory.moves]);

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

  // ═══ PGN generation & download ═══

  const generatePgn = useCallback(() => {
    const pgnGame = new Chess();
    const moves = gameHistory.moves || [];
    for (let i = 1; i < moves.length; i++) {
      const san = moves[i]?.move?.san;
      if (san && san !== 'Start') {
        const result = pgnGame.move(san);
        if (!result) break;
      }
    }
    const playerColor = gameHistory.player_color || 'w';
    const isMP = gameHistory.game_mode === 'multiplayer';
    const whiteName = playerColor === 'w' ? (user?.name || 'Player') : (gameHistory.opponent_name || (isMP ? 'Opponent' : 'Computer'));
    const blackName = playerColor === 'b' ? (user?.name || 'Player') : (gameHistory.opponent_name || (isMP ? 'Opponent' : 'Computer'));
    const dateStr = gameHistory.played_at ? new Date(gameHistory.played_at).toISOString().split('T')[0].replace(/-/g, '.') : '????.??.??';

    let resultStr = '*';
    if (gameHistory.result) {
      const won = isWin(gameHistory.result);
      const draw = isDraw(gameHistory.result);
      if (draw) resultStr = '1/2-1/2';
      else if (won && playerColor === 'w') resultStr = '1-0';
      else if (won && playerColor === 'b') resultStr = '0-1';
      else if (!won && playerColor === 'w') resultStr = '0-1';
      else if (!won && playerColor === 'b') resultStr = '1-0';
    }

    const headers = [
      `[Event "Chess99 Game"]`,
      `[Site "chess99.com"]`,
      `[Date "${dateStr}"]`,
      `[White "${whiteName}"]`,
      `[Black "${blackName}"]`,
      `[Result "${resultStr}"]`,
    ];
    if (openingName) headers.push(`[Opening "${openingName}"]`);

    return headers.join('\n') + '\n\n' + pgnGame.pgn() + ' ' + resultStr + '\n';
  }, [gameHistory, user, openingName]);

  const handleDownloadPgn = useCallback(() => {
    const pgn = generatePgn();
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chess99-game-${gameHistory.id || 'local'}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generatePgn, gameHistory.id]);

  const handleCopyFen = useCallback(() => {
    const fen = game.fen();
    navigator.clipboard.writeText(fen).then(() => {
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 2000);
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = fen;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 2000);
    });
  }, [game]);

  // ═══ Share functions ═══

  // Generate share text from game result
  const getShareText = useCallback(() => {
    const opponentName = playerInfo.topName || 'opponent';
    const gameResult = gameHistory.result;
    const playerWon = isWin(gameResult);
    const gameDraw = isDraw(gameResult);
    const reviewUrl = gameHistory.id ? `https://chess99.com/play/review/${gameHistory.id}` : 'https://chess99.com';

    if (playerWon) {
      return `🏆 I defeated ${opponentName} in chess!\n\n🎯 It is fun to play chess at www.chess99.com, Join me! ♟️\n\n${reviewUrl}`;
    } else if (gameDraw) {
      return `🤝 I drew against ${opponentName} in chess!\n\n🎯 It is fun to play chess at www.chess99.com, Join me! ♟️\n\n${reviewUrl}`;
    } else {
      return `♟️ I played against ${opponentName} in chess!\n\n🎯 It is fun to play chess at www.chess99.com, Join me! ♟️\n\n${reviewUrl}`;
    }
  }, [playerInfo.topName, gameHistory.result, gameHistory.id]);

  const handleTestShare = async () => {
    try {
      setIsTestSharing(true);
      let playerName = user?.name || 'Player';
      if (!isAuthenticated) {
        const name = window.prompt('Enter your name for the share image:', playerName);
        if (name && name.trim()) playerName = name.trim();
      }
      setSharePlayerName(playerName);
      setShowEndCard(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      const cardElement = document.querySelector('.game-end-card');
      if (!cardElement) throw new Error('GameEndCard not found');
      cardElement.classList.add('share-mode');
      await waitForImagesToLoad(cardElement);
      await convertImagesToDataURLs(cardElement);
      await new Promise(resolve => setTimeout(resolve, 200));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff', scale: 2, useCORS: true, allowTaint: false, logging: false,
        foreignObjectRendering: false, removeContainer: true, imageTimeout: 15000,
      });
      cardElement.classList.remove('share-mode');

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) throw new Error('Failed to generate image');

      const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });
      const shareText = getShareText();

      // Copy message to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
      } catch { /* ignore */ }

      // Try native share first (shows OS share dialog with all apps)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          setShowEndCard(false);
          await navigator.share({
            title: 'Chess Game Result',
            text: shareText,
            files: [file]
          });
          return; // Success
        } catch (shareError) {
          if (shareError.name === 'AbortError') return; // User cancelled
          // Fall through to modal
        }
      }

      // Fallback: show share modal
      const imageUrl = URL.createObjectURL(blob);
      setShareImageUrl(imageUrl);
      setShareBlob(blob);
      setShowEndCard(false);
      setShowShareModal(true);
      setCopiedLink(false);
    } catch (error) {
      console.error('Error in share:', error);
      alert(`Failed to generate share image: ${error.message || 'Unknown error'}`);
      const cardElement = document.querySelector('.game-end-card');
      if (cardElement) cardElement.classList.remove('share-mode');
      setShowEndCard(false);
    } finally {
      setIsTestSharing(false);
    }
  };

  const reviewLink = gameHistory.id ? `https://chess99.com/play/review/${gameHistory.id}` : null;

  const handleCopyReviewLink = async () => {
    if (!reviewLink) return;
    try {
      await navigator.clipboard.writeText(reviewLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = reviewLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareModalDownload = () => {
    if (!shareImageUrl) return;
    const link = document.createElement('a');
    link.href = shareImageUrl;
    link.download = `chess99-game-${gameHistory.id || Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNativeShare = async () => {
    if (!shareImageUrl) return;
    try {
      const blob = shareBlob || await (await fetch(shareImageUrl)).blob();
      const file = new File([blob], 'chess-game-result.jpg', { type: 'image/jpeg' });
      const shareText = getShareText();

      // Copy message to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
      } catch { /* ignore */ }

      // Try native share with file (shows all apps on mobile)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Chess Game Result',
          text: shareText,
          files: [file]
        });
        return;
      }

      // Desktop fallback: open WhatsApp + auto-download image
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile) {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        const link = document.createElement('a');
        link.href = shareImageUrl;
        link.download = 'chess-game-result.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
          alert('WhatsApp opened!\n\nMessage copied to clipboard - paste it in WhatsApp\nImage downloaded - attach it to your message');
        }, 500);
      } else {
        // Mobile without native share - just download
        const link = document.createElement('a');
        link.href = shareImageUrl;
        link.download = 'chess-game-result.jpg';
        link.click();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        alert('Failed to share. Please try downloading the image instead.');
      }
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    if (shareImageUrl) {
      URL.revokeObjectURL(shareImageUrl);
      setShareImageUrl(null);
    }
    setShareBlob(null);
    setCopiedLink(false);
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

  // ═══ Speed buttons config ═══
  const speeds = [
    { label: 'Slow', value: 2000 },
    { label: 'Normal', value: 1000 },
    { label: 'Fast', value: 400 },
  ];

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
          Back
        </button>
        <h1 className="text-white font-semibold text-base flex-1 text-center">Game Review</h1>
        <div className="w-12" /> {/* Spacer for centering */}
      </div>

      {/* ─── Main Content: Two-column on lg+, stacked on mobile ─── */}
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
                score={playerInfo.topScore}
              />
            </div>

            {/* Board + Customizer */}
            <div className="w-full max-w-[600px] relative" ref={boardBoxRef}>
              {/* Board Customizer button */}
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
                boardOrientation={gameHistory.player_color === 'b' ? 'black' : 'white'}
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
                score={playerInfo.bottomScore}
              />
            </div>

            {/* ─── Navigation Controls ─── */}
            <div className="w-full max-w-[600px] mt-2 unified-card !py-2.5 !px-3">
              <div className="flex items-center gap-2">
                {/* Nav buttons */}
                <div className="flex items-center gap-1">
                  {[
                    { label: '|◀', onClick: goToStart, disabled: currentMoveIndex <= 0 },
                    { label: '◀', onClick: stepBackward, disabled: currentMoveIndex <= 0 },
                    { label: isPlaying ? '⏸' : '▶', onClick: toggleAutoPlay, disabled: totalMoves === 0, isPlay: true },
                    { label: '▶|', onClick: stepForward, disabled: currentMoveIndex >= totalMoves, flip: true },
                    { label: '▶|', onClick: goToEnd, disabled: currentMoveIndex >= totalMoves, isEnd: true },
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
                      {btn.isEnd ? '▶|' : btn.flip ? '▶' : btn.label}
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

          {/* ═══ RIGHT COLUMN: Info + Moves + Actions ═══ */}
          <div className="w-full lg:w-[340px] xl:w-[380px] flex flex-col gap-3 flex-shrink-0">

            {/* ─── Game Info Card ─── */}
            <div className="unified-card">
              <ResultBadge result={gameHistory.result} gameHistory={gameHistory} />

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
                    <div className="text-white text-sm">{gameHistory.played_at ? new Date(gameHistory.played_at).toLocaleDateString() : '—'}</div>
                  </div>
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Mode</div>
                    <div className="text-white text-sm capitalize">{gameHistory.game_mode || '—'}</div>
                  </div>
                  <div className="bg-[#262421] rounded-lg px-3 py-2">
                    <div className="text-[#8b8987] text-xs">Moves</div>
                    <div className="text-white text-sm font-semibold">{totalMoves}</div>
                  </div>
                  {gameHistory.computer_level > 0 && (
                    <div className="bg-[#262421] rounded-lg px-3 py-2">
                      <div className="text-[#8b8987] text-xs">Level</div>
                      <div className="text-white text-sm font-semibold">{gameHistory.computer_level}</div>
                    </div>
                  )}
                </div>

                {/* Time remaining */}
                {(gameHistory.white_time_remaining_ms != null && gameHistory.black_time_remaining_ms != null) && (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[#262421] rounded-lg px-3 py-2 text-center">
                      <div className="text-[#8b8987] text-xs mb-0.5">White Time</div>
                      <div className="text-white text-sm font-mono tabular-nums">{Math.floor(gameHistory.white_time_remaining_ms / 1000)}s</div>
                    </div>
                    <div className="flex-1 bg-[#262421] rounded-lg px-3 py-2 text-center">
                      <div className="text-[#8b8987] text-xs mb-0.5">Black Time</div>
                      <div className="text-white text-sm font-mono tabular-nums">{Math.floor(gameHistory.black_time_remaining_ms / 1000)}s</div>
                    </div>
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
                        <MoveCell
                          san={pair.white}
                          isActive={currentMoveIndex === pair.whiteIdx}
                          onClick={() => jumpToMove(pair.whiteIdx)}
                          dataIndex={pair.whiteIdx}
                        />
                        {pair.black ? (
                          <MoveCell
                            san={pair.black}
                            isActive={currentMoveIndex === pair.blackIdx}
                            onClick={() => jumpToMove(pair.blackIdx)}
                            dataIndex={pair.blackIdx}
                          />
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Actions Card ─── */}
            <div className="unified-card">
              <h3 className="text-white text-sm font-semibold mb-2">Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {/* Download PGN */}
                <button
                  onClick={handleDownloadPgn}
                  className="flex items-center justify-center gap-1.5 bg-[#262421] border border-[#3d3a37] hover:border-[#81b64c] hover:bg-[#81b64c]/10 rounded-lg px-3 py-2.5 text-[#bababa] hover:text-white transition-all text-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PGN
                </button>

                {/* Copy FEN */}
                <button
                  onClick={handleCopyFen}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 transition-all text-sm border ${
                    copiedFen
                      ? 'bg-[#81b64c]/20 border-[#81b64c] text-[#a3d160]'
                      : 'bg-[#262421] border-[#3d3a37] hover:border-[#81b64c] hover:bg-[#81b64c]/10 text-[#bababa] hover:text-white'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {copiedFen ? 'Copied!' : 'FEN'}
                </button>

                {/* Share */}
                <button
                  onClick={handleTestShare}
                  disabled={isTestSharing}
                  className="flex items-center justify-center gap-1.5 bg-[#81b64c] hover:bg-[#a3d160] rounded-lg px-3 py-2.5 text-white transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestSharing ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  )}
                  {isTestSharing ? 'Sharing...' : 'Share'}
                </button>

                {/* Analyze placeholder */}
                <button
                  disabled
                  className="flex items-center justify-center gap-1.5 bg-[#262421] border border-[#3d3a37] rounded-lg px-3 py-2.5 text-[#8b8987] text-sm cursor-not-allowed relative"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Analyze
                  <span className="absolute -top-1.5 -right-1.5 bg-[#e8a93e] text-[#1a1a18] text-[9px] font-bold px-1.5 py-0.5 rounded-full">Soon</span>
                </button>
              </div>
            </div>

            {/* ─── Analysis Placeholder ─── */}
            <div className="unified-card opacity-60">
              <div className="flex flex-col items-center py-4 text-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b8987" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <p className="text-[#8b8987] text-sm">Computer analysis coming soon</p>
                <p className="text-[#8b8987]/60 text-xs mt-1">Evaluate positions and find best moves</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ GameEndCard Modal (for share capture) ═══ */}
      {showEndCard && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            zIndex: 9999, minHeight: '100vh', height: '100vh',
            padding: '20px', paddingTop: '80px', paddingBottom: '140px',
            overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEndCard(false); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowEndCard(false); }}
            style={{
              position: 'fixed', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
              width: '40px', height: '40px', fontSize: '24px', cursor: 'pointer',
              zIndex: 10000, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'all 0.2s'
            }}
          >
            ×
          </button>
          <GameEndCard
            result={gameHistory}
            user={user || {}}
            sharePlayerName={sharePlayerName}
            isAuthenticated={isAuthenticated}
            playerColor={gameHistory.player_color === 'w' ? 'white' : 'black'}
            score={gameHistory.final_score || 0}
            opponentScore={gameHistory.opponent_score || 0}
            isMultiplayer={gameHistory.game_mode === 'multiplayer'}
            computerLevel={gameHistory.computer_level}
            hideShareButton={true}
          />
        </div>
      )}

      {/* ═══ Share Modal (image preview + review link) ═══ */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={closeShareModal}
        >
          <div
            style={{
              backgroundColor: '#262421',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              border: '1px solid #3d3a37',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#81b64c', margin: '0 0 4px' }}>
                Share Your Game Result
              </h2>
              <p style={{ color: '#8b8987', fontSize: '13px', margin: 0 }}>
                Share your achievement with WhatsApp, Facebook, and more!
              </p>
            </div>

            {/* Image preview */}
            {shareImageUrl && (
              <div style={{
                marginBottom: '16px', borderRadius: '12px',
                overflow: 'hidden', border: '1px solid #3d3a37',
              }}>
                <img
                  src={shareImageUrl}
                  alt="Game result"
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '240px', objectFit: 'cover' }}
                />
              </div>
            )}

            {/* Primary share button - shows all apps */}
            <button
              onClick={handleNativeShare}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px',
                border: 'none', backgroundColor: '#81b64c', color: 'white',
                fontSize: '16px', fontWeight: '700', cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '10px', marginBottom: '12px',
                boxShadow: '0 4px 12px rgba(129, 182, 76, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4e7837';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(129, 182, 76, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#81b64c';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(129, 182, 76, 0.3)';
              }}
            >
              <span style={{ fontSize: '22px' }}>🔗</span>
              <span>{navigator.share ? 'Share Your Achievement' : 'Share via WhatsApp'}</span>
            </button>

            {/* Review link */}
            {reviewLink && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', color: '#8b8987', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Review Link
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  backgroundColor: '#1a1a18', borderRadius: '8px',
                  border: '1px solid #3d3a37', padding: '8px 12px',
                }}>
                  <span style={{
                    flex: 1, color: '#bababa', fontSize: '13px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                  }}>
                    {reviewLink}
                  </span>
                  <button
                    onClick={handleCopyReviewLink}
                    style={{
                      flexShrink: 0, padding: '6px 14px', borderRadius: '6px',
                      border: 'none', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', transition: 'all 0.2s',
                      backgroundColor: copiedLink ? '#81b64c' : '#3d3a37',
                      color: copiedLink ? '#fff' : '#bababa',
                    }}
                  >
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              {/* Download image */}
              <button
                onClick={handleShareModalDownload}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid #3d3a37', backgroundColor: '#312e2b',
                  color: '#bababa', fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3d3a37'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#312e2b'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download Image
              </button>

              {/* Close */}
              <button
                onClick={closeShareModal}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px',
                  border: '1px solid #3d3a37', backgroundColor: '#1a1a18',
                  color: '#8b8987', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

export default GameReview;
