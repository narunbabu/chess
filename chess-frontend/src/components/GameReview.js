import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getGameHistoryById } from "../services/gameHistoryService";
import api from "../services/api";
import SocialShare from "./SocialShare";
import GameEndCard from "./GameEndCard";
import { getGameResultShareMessage, getShareableGameUrl } from "../utils/socialShareUtils";
import { isWin, isDraw } from "../utils/resultStandardization";
import { useAuth } from "../contexts/AuthContext";

const GameReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: gameId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [gameHistory, setGameHistory] = useState({ moves: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const timerRef = useRef(null);
  const boardBoxRef = useRef(null);
  const [boardSize, setBoardSize] = useState(400);
  const [searchParams] = useSearchParams();
  const [showEndCard, setShowEndCard] = useState(false);

  // Load game data when component mounts or gameId changes
  useEffect(() => {
    const loadGameData = async () => {
      let effectiveGameId = gameId;

      // If no gameId in URL, try to get from location state or localStorage
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
          // If still no history, set an error or default state
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
          // For multiplayer, fetch from games API to get correct quality scores
          const response = await api.get(`/games/${effectiveGameId}`);
          gameData = response.data;

          if (!gameData) {
            setError('Game not found');
            setGameHistory({ moves: [] });
            setLoading(false);
            return;
          }

          // Map game data to history format
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
            // Add other fields as needed
            computer_level: 0
          };

          // Handle moves conversion from different formats (reuse existing logic)
          let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];

          if (typeof gameData.moves === 'string') {
            // Parse string format: "e4,2.52;Nf6,0.98;..."
            console.log("Converting string moves format for multiplayer:", gameData.moves.substring(0, 50) + "...");
            const tempGame = new Chess();

            gameData.moves.split(';').forEach(moveStr => {
              const [notation, time] = moveStr.split(',');
              if (notation && notation.trim()) {
                try {
                  const move = tempGame.move(notation.trim());
                  if (move) {
                    convertedMoves.push({
                      move: { san: move.san },
                      fen: tempGame.fen(),
                      time: parseFloat(time) || undefined
                    });
                  }
                } catch (moveError) {
                  console.error('Error processing move:', notation, moveError);
                }
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (Array.isArray(gameData.moves) && gameData.moves.length > 0 && gameData.moves[0].notation) {
            // Convert from API format [{notation: "e4", time: 2.5}]
            console.log("Converting API moves format for multiplayer...");
            const tempGame = new Chess();

            gameData.moves.forEach(moveData => {
              try {
                const move = tempGame.move(moveData.notation);
                if (move) {
                  convertedMoves.push({
                    move: { san: move.san },
                    fen: tempGame.fen(),
                    time: moveData.time
                  });
                }
              } catch (moveError) {
                console.error('Error processing move:', moveData.notation, moveError);
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (!Array.isArray(gameData.moves)) {
              formattedGameHistory.moves = convertedMoves; // Just have the start move
          } else {
            // Already in correct format
            formattedGameHistory.moves = gameData.moves;
          }

          setGameHistory(formattedGameHistory);
        } else {
          // For non-multiplayer, use existing history fetch
          gameData = await getGameHistoryById(effectiveGameId);

          if (!gameData) {
            setError('Game not found');
            setGameHistory({ moves: [] });
            setLoading(false); // Stop loading even if not found
            return;
          }

          let formattedGameHistory = { ...gameData };

          // Handle moves conversion from different formats
          let convertedMoves = [{ move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }];

          if (typeof gameData.moves === 'string') {
            // Parse string format: "e4,2.52;Nf6,0.98;..."
            console.log("Converting string moves format:", gameData.moves.substring(0, 50) + "...");
            const tempGame = new Chess();

            gameData.moves.split(';').forEach(moveStr => {
              const [notation, time] = moveStr.split(',');
              if (notation && notation.trim()) {
                try {
                  const move = tempGame.move(notation.trim());
                  if (move) {
                    convertedMoves.push({
                      move: { san: move.san },
                      fen: tempGame.fen(),
                      time: parseFloat(time) || undefined
                    });
                  }
                } catch (moveError) {
                  console.error('Error processing move:', notation, moveError);
                }
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (Array.isArray(gameData.moves) && gameData.moves.length > 0 && gameData.moves[0].notation) {
            // Convert from API format [{notation: "e4", time: 2.5}]
            console.log("Converting API moves format...");
            const tempGame = new Chess();

            gameData.moves.forEach(moveData => {
              try {
                const move = tempGame.move(moveData.notation);
                if (move) {
                  convertedMoves.push({
                    move: { san: move.san },
                    fen: tempGame.fen(),
                    time: moveData.time
                  });
                }
              } catch (moveError) {
                console.error('Error processing move:', moveData.notation, moveError);
              }
            });
            formattedGameHistory.moves = convertedMoves;
          } else if (!Array.isArray(gameData.moves)) {
              formattedGameHistory.moves = convertedMoves; // Just have the start move
          } else {
            // Already in correct format
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

  useEffect(() => {
    // Reset the board to the initial position when the game history is loaded.
    const newGame = new Chess();
    setGame(newGame);
    setCurrentMoveIndex(0);
  }, [gameHistory]); // Reset when gameHistory changes

  // REVISED: ResizeObserver logic
  useEffect(() => {
    if (!boardBoxRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect; // Only need width
      const vh = window.innerHeight;
      
      // Size is the container's width, but no more than viewport height minus padding
      const newSize = Math.floor(Math.min(width, vh - 120)); // 120px for header/padding

      if (newSize > 0) { // Only set if valid size
        setBoardSize(newSize);
      }
    });
    ro.observe(boardBoxRef.current);
    return () => ro.disconnect();
  }, []); // Empty dependency array is correct here

  const playMoves = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentMoveIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (gameHistory && Array.isArray(gameHistory.moves) && nextIndex < gameHistory.moves.length) {
          const newGame = new Chess();
          for (let i = 1; i <= nextIndex; i++) {
            const moveEntry = gameHistory.moves[i];
            if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
              const result = newGame.move(moveEntry.move.san);
              if (!result) {
                console.error(`Invalid replay move in playMoves (Index ${i}):`, moveEntry.move.san, 'FEN:', newGame.fen());
                clearInterval(timerRef.current);
                return prevIndex;
              }
            }
          }
          setGame(newGame);
          return nextIndex;
        } else {
          clearInterval(timerRef.current);
          return prevIndex;
        }
      });
    }, 1000);
  };

  const pauseMoves = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const stepForward = () => {
    if (gameHistory && Array.isArray(gameHistory.moves) && currentMoveIndex < gameHistory.moves.length - 1) {
      const nextIndex = currentMoveIndex + 1;
      const newGame = new Chess();
      for (let i = 1; i <= nextIndex; i++) {
        const moveEntry = gameHistory.moves[i];
        if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
          const result = newGame.move(moveEntry.move.san);
          if (!result) {
            console.error(`Invalid replay move in stepForward (Index ${i}):`, moveEntry.move.san, 'FEN:', newGame.fen());
            return;
          }
        }
      }
      setGame(newGame);
      setCurrentMoveIndex(nextIndex);
    }
  };

  const stepBackward = () => {
    if (currentMoveIndex <= 0) return;
    const targetIndex = currentMoveIndex - 1;
    const newGame = new Chess();
    for (let i = 1; i <= targetIndex; i++) {
      const moveEntry = gameHistory.moves[i];
      if (moveEntry && moveEntry.move && moveEntry.move.san && moveEntry.move.san !== 'Start') {
        const result = newGame.move(moveEntry.move.san);
        if (!result) {
          console.error(`Invalid replay move during stepBackward at index ${i}:`, moveEntry.move.san, 'FEN:', newGame.fen());
          return;
        }
      }
    }
    setGame(newGame);
    setCurrentMoveIndex(targetIndex);
  };

  // Export and Share functionality
  const handleExportEndCard = async () => {
    // Show the end card first
    setShowEndCard(true);

    // Wait for card to render
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Find the end card element
      const cardElement = document.querySelector('.game-end-card');
      if (!cardElement) {
        throw new Error('End card not found');
      }

      // Add share-mode class for better rendering
      cardElement.classList.add('share-mode');

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true, // Enable CORS to capture external images (avatars)
        allowTaint: false,
        logging: false
      });

      // Remove share-mode
      cardElement.classList.remove('share-mode');

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `chess-game-${gameHistory.id || 'result'}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error exporting end card:', error);
      alert('Failed to export end card. Please try again.');
    } finally {
      // Hide the end card after export
      setTimeout(() => setShowEndCard(false), 1000);
    }
  };

  const handleShareWithImage = async () => {
    // Show the end card first
    setShowEndCard(true);

    // Wait for card to render
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Select the GameEndCard element
      const cardElement = document.querySelector('.game-end-card');
      if (!cardElement) {
        throw new Error('End card not found');
      }

      // Add share-mode class for better rendering
      cardElement.classList.add('share-mode');

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true, // Enable CORS to capture external images (avatars)
        allowTaint: false,
        logging: false
      });

      // Remove share-mode
      cardElement.classList.remove('share-mode');

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'chess-game-result.png', { type: 'image/png' });

          // Check if Web Share API is supported
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                title: 'Chess Game Result',
                text: getGameResultShareMessage({
                  result: gameHistory.result,
                  playerColor: gameHistory.player_color === 'w' ? 'white' : 'black',
                  isWin: isWin(gameHistory.result),
                  isDraw: isDraw(gameHistory.result),
                  opponentName: gameHistory.game_mode === 'computer' ? 'Computer' : 'Opponent'
                }),
                files: [file]
              });
            } catch (shareError) {
              if (shareError.name !== 'AbortError') {
                console.error('Error sharing:', shareError);
                // Fallback to download if share fails
                downloadBlob(blob, 'chess-game-result.png');
                alert('Failed to share image. Image has been downloaded instead.');
              }
            }
          } else {
            // Fallback: download the image
            downloadBlob(blob, 'chess-game-result.png');
            alert('Sharing not supported on this device. Image has been downloaded instead.');
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error sharing image:', error);
      alert('Failed to share image. Please try again.');
    } finally {
      // Hide the end card after sharing
      setTimeout(() => setShowEndCard(false), 1000);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="game-review p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <h3 className="text-2xl font-bold mb-4 text-vivid-yellow">Loading Game...</h3>
        <div className="loading-message">Please wait while we load your game data.</div>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-violet hover:bg-picton-blue rounded-lg">Back</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-review p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <h3 className="text-2xl font-bold mb-4 text-red-500">Error Loading Game</h3>
        <div className="error-message">{error}</div>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-violet hover:bg-picton-blue rounded-lg">Back</button>
      </div>
    );
  }

  return (
    <div className="game-review p-1 sm:p-2 min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <h3 className="text-xl font-bold text-center mb-2 text-vivid-yellow">Game Replay</h3>

      {/* Main Layout Container */}
      <div className="flex flex-col items-center justify-center max-w-6xl mx-auto px-2">

        {/* Chess Board Container */}
        <div className="w-full flex justify-center mb-3" ref={boardBoxRef}>
          <Chessboard position={game.fen()} boardWidth={boardSize} />
        </div>

        {/* Ultra-Compact Review Controls - Directly Below Board */}
        <div className="review-controls w-full max-w-[400px] bg-slate-800/95 backdrop-blur-lg rounded-xl p-2 mb-3 border border-slate-500/60 shadow-xl">
          {/* Control Buttons Row - Ultra Compact */}
          <div className="flex justify-center items-center gap-1 mb-1">
            <button onClick={playMoves} disabled={!gameHistory.moves || gameHistory.moves.length <= 1} className="control-button bg-ufo-green hover:bg-vivid-yellow text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs">▶</button>
            <button onClick={pauseMoves} className="control-button bg-ryb-orange hover:bg-vivid-yellow text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 text-xs">❚❚</button>
            <button onClick={stepBackward} disabled={currentMoveIndex <= 0} className="control-button bg-picton-blue hover:bg-blue-violet text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs">⏪</button>
            <button onClick={stepForward} disabled={!gameHistory.moves || currentMoveIndex >= gameHistory.moves.length - 1} className="control-button bg-picton-blue hover:bg-blue-violet text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-xs">⏩</button>
            <button onClick={() => navigate(-1)} className="control-button bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded transition-all duration-200 hover:scale-105 text-xs">✕</button>
          </div>

          {/* Move Counter - Ultra Compact */}
          <div className="text-center bg-slate-700/60 rounded px-2 py-1">
            <p className="text-white text-xs"><span className="text-yellow-300 font-semibold">Move:</span> {currentMoveIndex} / {gameHistory.moves && gameHistory.moves.length > 0 ? gameHistory.moves.length - 1 : 0}</p>
          </div>
        </div>

        {/* Game Info Section - Below Controls */}
        <div className="w-full max-w-[400px] lg:max-w-[600px] grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Game Info Card */}
          <div className="game-info bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-2xl p-3 text-white">
            <h4 className="text-yellow-300 font-semibold text-sm mb-2 text-center">Game Details</h4>

            {/* Basic Game Info - Ultra-compact */}
            <div className="space-y-1 mb-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-300">ID:</span>
                <span className="text-white font-mono">{gameHistory.id || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-300">Date:</span>
                <span className="text-white">{gameHistory.played_at ? new Date(gameHistory.played_at).toLocaleDateString() : 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-yellow-300">Mode:</span>
                <span className="text-white">{gameHistory.game_mode || 'Unknown'}</span>
              </div>
              {gameHistory.computer_level && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-yellow-300">Level:</span>
                  <span className="text-white">{gameHistory.computer_level}</span>
                </div>
              )}
              {gameHistory.player_color && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-yellow-300">Color:</span>
                  <span className="text-white">{gameHistory.player_color === 'w' ? 'White' : 'Black'}</span>
                </div>
              )}
            </div>

            {/* Result Info */}
            <div className="bg-slate-700/60 rounded p-2 text-xs">
              <p className="text-white text-center mb-1">
                <span className="text-yellow-300">Result:</span> {typeof gameHistory.result === 'object' ? (gameHistory.result?.details || gameHistory.result?.status || 'Unknown') : (gameHistory.result || 'Unknown')}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-yellow-300 font-medium">You</p>
                  <p className="text-white font-bold">{gameHistory.final_score || gameHistory.finalScore || 'N/A'}</p>
                </div>
                {gameHistory.opponent_score !== undefined && (
                  <div>
                    <p className="text-yellow-300 font-medium">Opp</p>
                    <p className="text-white font-bold">{gameHistory.opponent_score || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Info Card */}
          <div className="game-stats bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-2xl p-3 text-white">
            <h4 className="text-yellow-300 font-semibold text-sm mb-2 text-center">Statistics</h4>

            <div className="bg-slate-700/60 rounded p-2 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                {gameHistory.result?.end_reason && (
                  <div>
                    <p className="text-yellow-300 font-medium">End</p>
                    <p className="capitalize">{gameHistory.result.end_reason}</p>
                  </div>
                )}
                <div>
                  <p className="text-yellow-300 font-medium">Moves</p>
                  <p className="font-bold">{gameHistory.moves && gameHistory.moves.length > 0 ? Math.max(0, gameHistory.moves.length - 1) : 0}</p>
                </div>
              </div>

              {/* Time Remaining - Compact */}
              {(gameHistory.white_time_remaining_ms !== null && gameHistory.white_time_remaining_ms !== undefined &&
                gameHistory.black_time_remaining_ms !== null && gameHistory.black_time_remaining_ms !== undefined) && (
                <div className="text-center pt-1 border-t border-slate-600/40">
                  <p className="text-yellow-300 font-medium mb-1">Time Left</p>
                  <div className="flex justify-center gap-3">
                    <span className="text-white">W: {Math.floor((gameHistory.white_time_remaining_ms || 0) / 1000)}s</span>
                    <span className="text-white">B: {Math.floor((gameHistory.black_time_remaining_ms || 0) / 1000)}s</span>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Debug Section */}
            <div className="mt-2">
              <details className="bg-slate-800/50 rounded-lg p-1 border border-slate-600/30">
                <summary className="cursor-pointer text-white hover:text-yellow-300 transition-colors duration-200 text-xs">Debug ({gameHistory.moves?.length || 0} moves)</summary>
                <div className="bg-slate-900/70 p-1 rounded mt-1 text-xs text-slate-300 overflow-x-auto max-h-32 overflow-y-auto">
                  <div className="mb-2 text-yellow-300">
                    Total Moves: {gameHistory.moves?.length || 0} | Showing: {Math.min(10, gameHistory.moves?.length || 0)}
                  </div>
                  <pre className="text-xs">
                    {JSON.stringify(gameHistory.moves?.slice(0, 10), null, 2)}
                    {(gameHistory.moves?.length || 0) > 10 && (
                      <div className="text-yellow-300 mt-2">
                        ... and {gameHistory.moves.length - 10} more moves
                      </div>
                    )}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Moves List Section */}
        {gameHistory.moves && gameHistory.moves.length > 1 && (
          <div className="w-full max-w-[600px] mt-3">
            <details className="bg-slate-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-xl p-3">
              <summary className="cursor-pointer text-white hover:text-yellow-300 transition-colors duration-200 font-medium text-sm">
                All Moves ({Math.max(0, gameHistory.moves.length - 1)} total)
              </summary>
              <div className="mt-3 max-h-48 overflow-y-auto bg-slate-900/70 rounded-lg p-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 text-xs">
                  {gameHistory.moves.map((move, index) => (
                    <div key={index} className={`text-center p-1 rounded ${index === currentMoveIndex ? 'bg-yellow-500/20 border border-yellow-400/40' : 'bg-slate-800/50'}`}>
                      <div className="text-gray-400 mb-1">{index > 0 ? `${Math.ceil(index/2)}.` : 'Start'}</div>
                      <div className="text-white font-mono">
                        {move.move?.san || (index === 0 ? 'Start' : '?')}
                      </div>
                      {move.time && (
                        <div className="text-gray-500 text-xs">
                          {move.time.toFixed(1)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Share Section */}
        {gameHistory.id && (
          <div className="w-full max-w-[600px] mt-3">
            <div className="bg-gradient-to-r from-slate-800/95 to-gray-800/95 backdrop-blur-lg rounded-xl border border-slate-500/60 shadow-xl p-4">
              <h4 className="text-yellow-300 font-semibold text-sm mb-3 text-center">Share This Game</h4>
              <p className="text-center text-gray-300 text-xs mb-3">
                Challenge your friends to beat this result!
              </p>
              <SocialShare
                text={getGameResultShareMessage({
                  result: gameHistory.result,
                  playerColor: gameHistory.player_color === 'w' ? 'white' : 'black',
                  isWin: isWin(gameHistory.result),
                  isDraw: isDraw(gameHistory.result),
                  opponentName: gameHistory.game_mode === 'computer' ? 'Computer' : 'Opponent'
                })}
                url={getShareableGameUrl(gameHistory.id)}
                title="Check out this chess game!"
                hashtags={['chess', 'chessweb', 'chess99']}
                showLabel={false}
                className="flex justify-center"
              />

              {/* Export Buttons */}
              <div className="flex justify-center gap-2 mt-3">
                <button
                  onClick={handleExportEndCard}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 flex items-center gap-1"
                >
                  📸 Export End Card
                </button>
                <button
                  onClick={handleShareWithImage}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 flex items-center gap-1"
                >
                  🔗 Share End Card
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GameEndCard Modal for Export/Share */}
      {showEndCard && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto">
            {/* Close button */}
            <button
              onClick={() => setShowEndCard(false)}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all duration-200"
            >
              <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* GameEndCard */}
            <GameEndCard
              result={gameHistory}
              user={user || {}}
              isAuthenticated={isAuthenticated}
              playerColor={gameHistory.player_color === 'w' ? 'white' : 'black'}
              score={gameHistory.final_score || 0}
              opponentScore={gameHistory.opponent_score || 0}
              isMultiplayer={gameHistory.game_mode === 'multiplayer'}
              computerLevel={gameHistory.computer_level}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GameReview;
