import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnfinishedGames, deleteUnfinishedGame } from '../services/unfinishedGameService';
import { track } from '../utils/analytics';
import '../styles/UnifiedCards.css';

const UnfinishedGamesSection = ({ isAuthenticated = false }) => {
  const [unfinishedGames, setUnfinishedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnfinishedGames = async () => {
      try {
        setLoading(true);
        const games = await getUnfinishedGames(isAuthenticated);
        setUnfinishedGames(games);
        setError(null);
      } catch (err) {
        console.error('[UnfinishedGamesSection] ❌ Error fetching unfinished games:', err);
        setError('Unable to load unfinished games');
      } finally {
        setLoading(false);
      }
    };

    fetchUnfinishedGames();
  }, [isAuthenticated]);

  const handleResumeGame = (game) => {
    console.log('[UnfinishedGamesSection] 🔄 Resuming game:', game);

    // Track the resume action
    track('ui_interaction', 'click', {
      element: 'unfinished_game_resume',
      action: 'resume',
      gameMode: game.gameMode,
      source: game.source,
      location: 'landing_page'
    });

    // Navigate to play page with game state
    const gameState = {
      fen: game.fen,
      pgn: game.pgn,
      moves: game.moves || [],
      playerColor: game.playerColor || 'white',
      opponentName: game.opponentName,
      syntheticOpponent: game.syntheticOpponent || null,
      gameMode: game.gameMode,
      computerLevel: game.computerLevel,
      timerState: game.timerState,
      turn: game.turn,
      gameId: game.gameId,
      isResume: true,
      source: game.source
    };

    // Navigate to play page with state
    navigate('/play', { state: { gameState } });
  };

  const handleDiscardGame = async (game) => {
    console.log('[UnfinishedGamesSection] 🗑️ Discarding game:', game);

    try {
      await deleteUnfinishedGame(game.gameId, isAuthenticated);

      // Track the discard action
      track('ui_interaction', 'click', {
        element: 'unfinished_game_discard',
        action: 'discard',
        gameMode: game.gameMode,
        source: game.source,
        location: 'landing_page'
      });

      // Remove from local state
      setUnfinishedGames(unfinishedGames.filter(g => g.gameId !== game.gameId));
    } catch (err) {
      console.error('[UnfinishedGamesSection] ❌ Error discarding game:', err);
      setError('Unable to discard game');
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatTimer = (timerState) => {
    if (!timerState) return '';
    const whiteMinutes = Math.floor(timerState.whiteMs / 60000);
    const whiteSeconds = Math.floor((timerState.whiteMs % 60000) / 1000);
    const blackMinutes = Math.floor(timerState.blackMs / 60000);
    const blackSeconds = Math.floor((timerState.blackMs % 60000) / 1000);
    return `⏱️ ${whiteMinutes}:${whiteSeconds.toString().padStart(2, '0')} / ${blackMinutes}:${blackSeconds.toString().padStart(2, '0')}`;
  };

  // Don't render anything if no unfinished games
  if (loading) {
    return (
      <div className="unified-card w-full max-w-sm sm:max-w-md mx-auto mb-6">
        <h3 className="unified-card-title centered text-lg sm:text-xl">Loading...</h3>
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-card w-full max-w-sm sm:max-w-md mx-auto mb-6">
      <h3 className="unified-card-title centered text-lg sm:text-xl mb-4">
        🔄 Your Unfinished Games
      </h3>

      {error ? (
        <div className="text-center text-sm text-gray-500 py-4">
          Unable to load unfinished games. Start a new game to save progress!
        </div>
      ) : unfinishedGames.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-4">
          No unfinished games found. Start playing to save your progress automatically!
        </div>
      ) : (
        <div className="space-y-3">
          {unfinishedGames.map((game) => (
            <div key={game.gameId || 'localStorage'} className="unified-card-content bg-gray-50 rounded-lg p-3">
              {/* Game Header */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 flex items-center gap-2">
                  {game.syntheticOpponent?.avatar_url ? (
                    <img
                      src={game.syntheticOpponent.avatar_url}
                      alt={game.syntheticOpponent.name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    game.gameMode === 'computer' && (
                      <span className="text-lg flex-shrink-0">🤖</span>
                    )
                  )}
                  <div>
                    <div className="font-semibold text-sm text-gray-800">
                      {game.syntheticOpponent?.name || game.opponentName || 'Computer'}
                      {game.syntheticOpponent?.rating && (
                        <span className="ml-1 text-xs font-normal text-gray-500">
                          ({game.syntheticOpponent.rating})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(game.timestamp)} • {game.source === 'localStorage' ? 'Local' : 'Online'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                  {game.playerColor === 'white' ? '⬜' : '⬛'} {game.playerColor}
                </div>
              </div>

              {/* Game Details */}
              <div className="text-xs text-gray-600 mb-3">
                {game.timerState && formatTimer(game.timerState)}
                {game.savedReason && ` • ${game.savedReason}`}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleResumeGame(game)}
                  className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-green-600 transition-colors shadow-sm"
                >
                  <span className="mr-1">▶️</span>
                  Resume
                </button>
                <button
                  onClick={() => handleDiscardGame(game)}
                  className="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-red-600 transition-colors shadow-sm"
                >
                  <span className="mr-1">🗑️</span>
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unfinishedGames.length > 0 && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Games are saved for 7 days. Resume any game to continue playing!
        </div>
      )}
    </div>
  );
};

export default UnfinishedGamesSection;
