import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';

const GamePreviewModal = ({ game, onClose }) => {
  const [chess, setChess] = useState(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [board, setBoard] = useState(null);

  useEffect(() => {
    if (!game) return;

    const newChess = new Chess();

    // Set up the board position if FEN is available
    if (game.fen) {
      try {
        newChess.load(game.fen);
      } catch (error) {
        console.warn('[GamePreviewModal] Invalid FEN:', game.fen);
      }
    }

    setChess(newChess);
    setBoard(newChess.board());
  }, [game]);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
  };

  const getResultColor = (result, playerColor) => {
    if (!result) return 'text-[#8b8987]';

    let effectiveResult;
    if (typeof result === 'object' && result.end_reason) {
      if (result.end_reason === 'draw') {
        effectiveResult = 'draw';
      } else {
        const normalizedPlayerColor = playerColor.toLowerCase();
        if (result.winner === 'player') {
          effectiveResult = normalizedPlayerColor;
        } else if (result.winner === 'opponent') {
          effectiveResult = normalizedPlayerColor === 'white' ? 'black' : 'white';
        } else {
          effectiveResult = 'unknown';
        }
      }
    } else {
      effectiveResult = typeof result === 'string' ? result.toLowerCase() : 'unknown';
    }

    const normalizedPlayerColor = playerColor.toLowerCase();

    switch (effectiveResult) {
      case 'white':
        return normalizedPlayerColor === 'white' ? 'text-green-600' : 'text-red-600';
      case 'black':
        return normalizedPlayerColor === 'black' ? 'text-green-600' : 'text-red-600';
      case 'draw':
        return 'text-yellow-600';
      default:
        return 'text-[#8b8987]';
    }
  };

  const getResultText = (result, playerColor) => {
    if (!result) return 'Unknown';

    let effectiveResult;
    if (typeof result === 'object' && result.end_reason) {
      if (result.end_reason === 'draw') {
        effectiveResult = 'draw';
      } else {
        const normalizedPlayerColor = playerColor.toLowerCase();
        if (result.winner === 'player') {
          effectiveResult = normalizedPlayerColor;
        } else if (result.winner === 'opponent') {
          effectiveResult = normalizedPlayerColor === 'white' ? 'black' : 'white';
        } else {
          effectiveResult = 'unknown';
        }
      }
    } else {
      effectiveResult = typeof result === 'string' ? result.toLowerCase() : 'unknown';
    }

    const normalizedPlayerColor = playerColor.toLowerCase();

    switch (effectiveResult) {
      case 'white':
        return normalizedPlayerColor === 'white' ? '🏆 Victory' : '❌ Defeat';
      case 'black':
        return normalizedPlayerColor === 'black' ? '🏆 Victory' : '❌ Defeat';
      case 'draw':
        return '🤝 Draw';
      default:
        return 'Unknown';
    }
  };

  const getPieceSymbol = (piece) => {
    if (!piece) return null;

    const symbols = {
      'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
      'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
    };

    return symbols[piece.color + piece.type.toUpperCase()] || null;
  };

  const getSquareColor = (row, col) => {
    return (row + col) % 2 === 0 ? 'bg-[#ebecd0]' : 'bg-[#769656]';
  };

  const getFileLabel = (index) => {
    return String.fromCharCode(97 + index); // a, b, c, h
  };

  const getRankLabel = (index) => {
    return String(8 - index); // 8, 7, 6, 1
  };

  const getGameDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'Unknown duration';

    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    const minutes = Math.floor(duration / (1000 * 60));

    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (!game) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#312e2b] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-[#3d3a37]">
        {/* Header */}
        <div className="border-b border-[#3d3a37] px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Game Preview</h2>
            <button
              onClick={onClose}
              className="text-[#8b8987] hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Game Info */}
        <div className="px-6 py-4 border-b border-[#3d3a37]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[#8b8987]">Opponent</div>
              <div className="font-semibold text-white">{game.opponentName || 'Computer'}</div>
            </div>
            <div>
              <div className="text-[#8b8987]">You Played</div>
              <div className="font-semibold text-white">
                {game.playerColor === 'white' ? 'White' : 'Black'}
              </div>
            </div>
            <div>
              <div className="text-[#8b8987]">Result</div>
              <div className={`font-semibold ${getResultColor(game.result, game.playerColor)}`}>
                {getResultText(game.result, game.playerColor)}
              </div>
            </div>
            <div>
              <div className="text-[#8b8987]">Duration</div>
              <div className="font-semibold text-white">
                {getGameDuration(game.startTime, game.endTime)}
              </div>
            </div>
          </div>
          {game.difficulty && (
            <div className="mt-3 text-sm">
              <div className="text-[#8b8987]">Difficulty</div>
              <div className="font-semibold text-white">{game.difficulty}</div>
            </div>
          )}
          <div className="mt-3 text-sm">
            <div className="text-[#8b8987]">Date</div>
            <div className="font-semibold text-white">
              {formatTime(game.endTime || game.timestamp)}
            </div>
          </div>
        </div>

        {/* Chess Board */}
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Board */}
            <div className="flex-shrink-0">
              <div className="inline-block border-4 border-[#262421] rounded-lg overflow-hidden">
                <div className="grid grid-cols-8 gap-0">
                  {/* Board squares */}
                  {board && board.map((row, rowIndex) => (
                    row.map((piece, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-4xl sm:text-5xl ${getSquareColor(rowIndex, colIndex)}`}
                      >
                        {getPieceSymbol(piece)}
                      </div>
                    ))
                  ))}
                </div>

                {/* File labels */}
                <div className="grid grid-cols-8 gap-0 bg-[#262421]">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(index => (
                    <div key={index} className="w-12 h-6 sm:w-14 sm:h-6 flex items-center justify-center text-white text-xs font-bold">
                      {getFileLabel(index)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Game Details */}
            <div className="flex-1 space-y-4">
              {/* Moves */}
              {game.moves && game.moves.length > 0 && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Moves ({game.moves.length})</h3>
                  <div className="bg-[#262421] rounded-lg p-3 border border-[#3d3a37] max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                      {game.moves.map((move, index) => {
                        const moveNotation = typeof move === 'object' && move.move && move.move.san ? move.move.san : (typeof move === 'string' ? move : 'Invalid move');
                        return (
                          <div key={index} className="font-mono text-[#bababa]">
                            {Math.floor(index / 2) + 1}. {index % 2 === 0 ? '' : '...'} {moveNotation}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Timer Info */}
              {game.timerEnabled && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Timer Settings</h3>
                  <div className="bg-[#262421] rounded-lg p-3 border border-[#3d3a37] text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[#8b8987]">White Time:</span>
                        <span className="ml-2 font-semibold">
                          {Math.floor((game.whiteMs || 600000) / 1000 / 60)} minutes
                        </span>
                      </div>
                      <div>
                        <span className="text-[#8b8987]">Black Time:</span>
                        <span className="ml-2 font-semibold">
                          {Math.floor((game.blackMs || 600000) / 1000 / 60)} minutes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Game Statistics */}
              <div>
                <h3 className="font-semibold text-white mb-2">Statistics</h3>
                <div className="bg-[#262421] rounded-lg p-3 border border-[#3d3a37]">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#8b8987]">Total Moves:</span>
                      <span className="ml-2 font-semibold">{game.moves?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-[#8b8987]">Game Mode:</span>
                      <span className="ml-2 font-semibold">
                        {game.opponentName ? 'vs Computer' : 'Computer vs Human'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opening Info (if available) */}
              {game.opening && (
                <div>
                  <h3 className="font-semibold text-white mb-2">Opening</h3>
                  <div className="bg-[#262421] rounded-lg p-3 border border-[#3d3a37] text-sm">
                    <div className="font-semibold">{game.opening.name}</div>
                    {game.opening.eco && (
                      <div className="text-[#8b8987]">ECO Code: {game.opening.eco}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#3d3a37] px-6 py-4 bg-[#262421]">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#bababa] bg-[#3d3a37] rounded-lg font-medium hover:bg-[#4a4744] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePreviewModal;
