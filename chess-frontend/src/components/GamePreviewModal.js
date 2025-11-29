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
    if (!result) return 'text-gray-500';

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
        return 'text-gray-500';
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
    return (row + col) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-700';
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
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Game Preview</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Game Info */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Opponent</div>
              <div className="font-semibold text-gray-900">{game.opponentName || 'Computer'}</div>
            </div>
            <div>
              <div className="text-gray-500">You Played</div>
              <div className="font-semibold text-gray-900">
                {game.playerColor === 'white' ? 'White' : 'Black'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Result</div>
              <div className={`font-semibold ${getResultColor(game.result, game.playerColor)}`}>
                {getResultText(game.result, game.playerColor)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Duration</div>
              <div className="font-semibold text-gray-900">
                {getGameDuration(game.startTime, game.endTime)}
              </div>
            </div>
          </div>
          {game.difficulty && (
            <div className="mt-3 text-sm">
              <div className="text-gray-500">Difficulty</div>
              <div className="font-semibold text-gray-900">{game.difficulty}</div>
            </div>
          )}
          <div className="mt-3 text-sm">
            <div className="text-gray-500">Date</div>
            <div className="font-semibold text-gray-900">
              {formatTime(game.endTime || game.timestamp)}
            </div>
          </div>
        </div>

        {/* Chess Board */}
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Board */}
            <div className="flex-shrink-0">
              <div className="inline-block border-4 border-gray-800 rounded-lg overflow-hidden">
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
                <div className="grid grid-cols-8 gap-0 bg-gray-800">
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
                  <h3 className="font-semibold text-gray-900 mb-2">Moves ({game.moves.length})</h3>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                      {game.moves.map((move, index) => {
                        const moveNotation = typeof move === 'object' && move.move && move.move.san ? move.move.san : (typeof move === 'string' ? move : 'Invalid move');
                        return (
                          <div key={index} className="font-mono text-gray-700">
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
                  <h3 className="font-semibold text-gray-900 mb-2">Timer Settings</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-500">White Time:</span>
                        <span className="ml-2 font-semibold">
                          {Math.floor((game.whiteMs || 600000) / 1000 / 60)} minutes
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Black Time:</span>
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
                <h3 className="font-semibold text-gray-900 mb-2">Statistics</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Total Moves:</span>
                      <span className="ml-2 font-semibold">{game.moves?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Game Mode:</span>
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
                  <h3 className="font-semibold text-gray-900 mb-2">Opening</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="font-semibold">{game.opening.name}</div>
                    {game.opening.eco && (
                      <div className="text-gray-500">ECO Code: {game.opening.eco}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition-colors"
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
