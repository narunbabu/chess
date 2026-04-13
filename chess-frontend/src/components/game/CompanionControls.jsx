// src/components/game/CompanionControls.jsx
import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';

/**
 * CompanionControls Component
 * In-game controls for requesting companion assistance during play
 *
 * @param {Object} props
 * @param {Object} props.companion - Selected companion object
 * @param {Object} props.game - Chess.js game instance
 * @param {Function} props.onMove - Callback when companion makes a move (receives move object)
 * @param {boolean} props.isMyTurn - Whether it's the player's turn
 * @param {boolean} props.disabled - Whether controls are disabled
 */
const CompanionControls = ({ companion, game, onMove, isMyTurn, disabled = false }) => {
  const [continuousPlay, setContinuousPlay] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState(null);
  const [suggestionCount, setSuggestionCount] = useState(0);

  /**
   * Get the best move from Stockfish API
   */
  const getCompanionMove = useCallback(async () => {
    if (!game || isLoading) return null;

    setIsLoading(true);
    try {
      const fen = game.fen();
      const level = companion?.computer_level || 6;

      // Call the Stockfish API endpoint
      const response = await fetch('/api/v1/stockfish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          level,
          time: Math.max(500, level * 100), // Minimum 500ms, scales with level
        }),
      });

      if (!response.ok) throw new Error('Failed to get companion move');

      const data = await response.json();
      const bestMove = data.bestMove || data.move;

      if (bestMove) {
        // Convert UCI move to chess.js format
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

        const move = {
          from,
          to,
          promotion,
        };

        setLastSuggestion(move);
        setSuggestionCount(prev => prev + 1);
        return move;
      }
    } catch (err) {
      console.error('[CompanionControls] Failed to get move:', err);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [game, companion, isLoading]);

  /**
   * Handle one-time move suggestion
   */
  const handleSuggestMove = useCallback(async () => {
    const move = await getCompanionMove();
    if (move && onMove) {
      onMove(move);
    }
  }, [getCompanionMove, onMove]);

  /**
   * Handle continuous play - companion keeps playing until stopped
   */
  const handleContinuousPlay = useCallback(async () => {
    if (continuousPlay) {
      // Stop continuous play
      setContinuousPlay(false);
      return;
    }

    setContinuousPlay(true);

    // Play moves while it's our turn and continuous play is active
    const playNext = async () => {
      if (!continuousPlay || !isMyTurn || !game) return;

      const move = await getCompanionMove();
      if (move && onMove) {
        onMove(move);
        // Wait a bit before next move (for visual pacing)
        if (continuousPlay) {
          setTimeout(playNext, 800);
        }
      }
    };

    playNext();
  }, [continuousPlay, isMyTurn, game, getCompanionMove, onMove]);

  // Auto-stop continuous play if it's no longer our turn
  React.useEffect(() => {
    if (continuousPlay && !isMyTurn) {
      setContinuousPlay(false);
    }
  }, [isMyTurn, continuousPlay]);

  if (!companion) return null;

  return (
    <div className="companion-controls bg-purple-50 rounded-lg p-4 border border-purple-200">
      {/* Companion Info Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
            {companion.name?.charAt(0) || 'A'}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">{companion.name}</div>
            <div className="text-xs text-gray-500">Level {companion.computer_level}</div>
          </div>
        </div>
        {suggestionCount > 0 && (
          <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
            {suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSuggestMove}
          disabled={disabled || !isMyTurn || isLoading || continuousPlay}
          className={`
            flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all
            ${disabled || !isMyTurn || isLoading || continuousPlay
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white text-purple-700 border border-purple-300 hover:bg-purple-100 active:scale-95'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Thinking...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>💡</span> Suggest One Move
            </span>
          )}
        </button>

        <button
          onClick={handleContinuousPlay}
          disabled={disabled || !isMyTurn || isLoading}
          className={`
            flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all
            ${continuousPlay
              ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
              : disabled || !isMyTurn || isLoading
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600 active:scale-95'
            }
          `}
        >
          {continuousPlay ? (
            <span className="flex items-center justify-center gap-2">
              <span>⏹️</span> Stop Playing
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>▶️</span> Play Continuously
            </span>
          )}
        </button>
      </div>

      {/* Last Suggestion Display */}
      {lastSuggestion && !continuousPlay && (
        <div className="mt-3 pt-3 border-t border-purple-200">
          <div className="text-xs text-gray-500 mb-1">Last suggestion:</div>
          <div className="flex items-center gap-2">
            <code className="bg-white px-2 py-1 rounded text-sm font-mono text-purple-700">
              {lastSuggestion.from} → {lastSuggestion.to}
              {lastSuggestion.promotion && `=${lastSuggestion.promotion.toUpperCase()}`}
            </code>
            <button
              onClick={() => onMove && onMove(lastSuggestion)}
              disabled={disabled || !isMyTurn || isLoading}
              className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Helper Text */}
      {!isMyTurn && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Wait for your turn to ask for help
        </div>
      )}
    </div>
  );
};

export default CompanionControls;
