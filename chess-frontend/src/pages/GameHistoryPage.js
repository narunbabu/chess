import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackUI } from '../utils/analytics';
import {
  getUnfinishedGames,
  deleteUnfinishedGame,
  saveCompletedGame,
  getCompletedGames
} from '../services/unfinishedGameService';
import GamePreviewModal from '../components/GamePreviewModal';
import '../styles/UnifiedCards.css';

const GameHistoryPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [unfinishedGames, setUnfinishedGames] = useState([]);
  const [completedGames, setCompletedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState('unfinished'); // 'unfinished' | 'completed'

  useEffect(() => {
    if (isAuthenticated) {
      // Redirect authenticated users to their profile/dashboards
      navigate('/profile');
      return;
    }

    loadGames();
  }, [isAuthenticated, navigate]);

  const loadGames = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load unfinished games
      const unfinished = await getUnfinishedGames(false);
      const normalizedUnfinished = (unfinished || []).map(game => ({
        ...game,
        playerColor: game.playerColor === 'w' ? 'white' : (game.playerColor === 'b' ? 'black' : game.playerColor),
      }));
      setUnfinishedGames(normalizedUnfinished);

      // Load completed games
      const completed = await getCompletedGames(false);
      console.log('[GameHistoryPage] Loaded completed games:', completed);
      const normalizedCompleted = (completed || []).map(game => ({
        ...game,
        playerColor: game.playerColor === 'w' ? 'white' : (game.playerColor === 'b' ? 'black' : game.playerColor),
        moves: Array.isArray(game.moves) ? game.moves : [],
        startTime: typeof game.startTime === 'number' ? game.startTime : Date.now(),
        endTime: typeof game.endTime === 'number' ? game.endTime : Date.now(),
      }));
      setCompletedGames(normalizedCompleted);

      // Auto-switch to completed tab if no unfinished games
      if ((!unfinished || unfinished.length === 0) && completed && completed.length > 0) {
        setActiveTab('completed');
      }
    } catch (err) {
      console.error('[GameHistoryPage] Error loading games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeGame = (game) => {
    console.log('[GameHistoryPage] Resume button clicked for game:', game.id, game);
    trackUI('game_resume', 'click', {
      source: 'game_history',
      gameId: game.id,
      opponent: game.opponentName || 'Computer'
    });

    // Navigate to play page with resume state
    navigate('/play', {
      state: {
        gameState: {
          ...game,
          isResume: true
        }
      }
    });
    console.log('[GameHistoryPage] Navigated to /play with state:', { gameState: { ...game, isResume: true } });
  };

  const handleDiscardGame = async (gameId) => {
    try {
      console.log('[GameHistoryPage] Discard button clicked for game:', gameId);
      await deleteUnfinishedGame(gameId, false);
      setUnfinishedGames(prev => prev.filter(game => game.id !== gameId));
      trackUI('game_discard', 'click', {
        source: 'game_history',
        gameId: gameId
      });
    } catch (err) {
      console.error('[GameHistoryPage] Error discarding game:', err);
      setError('Failed to discard game. Please try again.');
    }
  };

  const handlePreviewGame = (game) => {
    trackUI('game_preview', 'click', {
      source: 'game_history',
      gameId: game.id,
      opponent: game.opponentName || 'Computer'
    });

    if (game.status === 'completed') {
      // For completed games, navigate to GameReview with formatted data
      const formattedGameHistory = {
        id: game.id,
        played_at: new Date(game.endTime).toISOString(),
        player_color: game.playerColor,
        game_mode: 'computer',
        opponent_name: game.opponentName || 'Computer',
        moves: [
          { move: { san: 'Start' }, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }
        ].concat(
          (game.moves || []).map(move => ({
            move: { san: move.move?.san || 'Unknown' },
            fen: move.fen,
            time: move.timeSpent || 0
          }))
        ),
        final_score: game.playerScore || 0,
        opponent_score: game.opponentScore || 0,
        result: game.result,
        computer_level: game.computerLevel || parseInt(game.difficulty?.replace('Level ', '')) || 1,
        difficulty: game.difficulty,
        white_time_remaining_ms: game.whiteMs,
        black_time_remaining_ms: game.blackMs,
        timestamp: game.endTime
      };

      navigate(`/play/review/${game.id}`, {
        state: { gameHistory: formattedGameHistory }
      });
    } else {
      // For unfinished games, use modal
      setSelectedGame(game);
      setShowPreviewModal(true);
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Unknown time';

    const now = Date.now();
    const gameTime = new Date(timestamp).getTime();
    const diffMs = now - gameTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const formatGameDuration = (startTime, endTime) => {
    if (!startTime || !endTime || isNaN(new Date(startTime).getTime()) || isNaN(new Date(endTime).getTime())) return 'Unknown duration';

    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    const minutes = Math.floor(duration / (1000 * 60));

    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getResultDisplay = (result, playerColor) => {
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
        return normalizedPlayerColor === 'white' ? 'text-[#81b64c]' : 'text-[#e74c3c]';
      case 'black':
        return normalizedPlayerColor === 'black' ? 'text-[#81b64c]' : 'text-[#e74c3c]';
      case 'draw':
        return 'text-[#e8a93e]';
      default:
        return 'text-[#8b8987]';
    }
  };

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <>
      <div className="min-h-screen bg-[#1a1a18]">
        {/* Header */}
        <header className="bg-[#262421] border-b border-[#3d3a37]">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  to="/"
                  className="text-[#8b8987] hover:text-white transition-colors"
                >
                  ← Back to Home
                </Link>
                <h1 className="text-2xl font-bold text-white">Game History</h1>
              </div>
              <button
                onClick={() => navigate('/play')}
                className="bg-[#81b64c] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors shadow"
              >
                <span className="mr-2">🤖</span>
                New Game
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 xl:px-12 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#81b64c]"></div>
              <p className="mt-4 text-[#8b8987]">Loading your games...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-[#fa6a5b] mb-4">{error}</div>
              <button
                onClick={loadGames}
                className="bg-[#81b64c] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="mb-8">
                <div className="border-b border-[#3d3a37]">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setActiveTab('unfinished')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'unfinished'
                          ? 'border-[#81b64c] text-[#81b64c]'
                          : 'border-transparent text-[#8b8987] hover:text-[#bababa] hover:border-[#4a4744]'
                      }`}
                    >
                      <span className="mr-2">🔄</span>
                      Unfinished Games
                      {unfinishedGames.length > 0 && (
                        <span className="ml-2 bg-[#4e7837]/30 text-[#81b64c] px-2 py-1 rounded-full text-xs">
                          {unfinishedGames.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('completed')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'completed'
                          ? 'border-[#81b64c] text-[#81b64c]'
                          : 'border-transparent text-[#8b8987] hover:text-[#bababa] hover:border-[#4a4744]'
                      }`}
                    >
                      <span className="mr-2">✅</span>
                      Completed Games
                      {completedGames.length > 0 && (
                        <span className="ml-2 bg-[#4e7837]/30 text-[#81b64c] px-2 py-1 rounded-full text-xs">
                          {completedGames.length}
                        </span>
                      )}
                    </button>
                  </nav>
                </div>
              </div>

              {/* Unfinished Games Tab */}
              {activeTab === 'unfinished' && (
                <div>
                  {unfinishedGames.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-[#8b8987] mb-4 text-6xl">♟️</div>
                      <h3 className="text-lg font-medium text-white mb-2">No unfinished games</h3>
                      <p className="text-[#8b8987] mb-6">Start playing to create games that you can resume later</p>
                      <button
                        onClick={() => navigate('/play')}
                        className="bg-[#81b64c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors shadow"
                      >
                        <span className="mr-2">🤖</span>
                        Start New Game
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {unfinishedGames.map((game) => (
                        <div key={game.id} className="unified-card light-theme accented">
                          <div className="unified-card-header">
                            <div className="unified-card-avatar">
                              {game.playerColor === 'white' ? '♔' : '♚'}
                            </div>
                            <div>
                              <div className="font-semibold text-white">
                                vs {game.opponentName || 'Computer'}
                              </div>
                              <div className="text-sm text-[#8b8987]">
                                {formatTimeAgo(game.timestamp)}
                              </div>
                            </div>
                          </div>
                          <div className="unified-card-body">
                            <div className="flex items-center justify-between text-sm text-[#bababa] mb-3">
                              <span>You play: {game.playerColor === 'white' ? 'White' : 'Black'}</span>
                              <span>Difficulty: {game.difficulty || 'Medium'}</span>
                            </div>
                            {game.timerEnabled && (
                              <div className="flex items-center justify-between text-sm text-[#bababa] mb-3">
                                <span>White: {Math.floor((game.whiteMs || 600000) / 1000 / 60)}min</span>
                                <span>Black: {Math.floor((game.blackMs || 600000) / 1000 / 60)}min</span>
                              </div>
                            )}
                            <div className="unified-card-actions vertical">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('[GameHistoryPage] Resume button click event triggered:', e);
                                  handleResumeGame(game);
                                }}
                                className="unified-card-btn primary text-sm"
                              >
                                <span className="mr-2">▶️</span>
                                Resume Game
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('[GameHistoryPage] Discard button click event triggered:', e);
                                  handleDiscardGame(game.id);
                                }}
                                className="unified-card-btn secondary text-sm"
                              >
                                <span className="mr-2">🗑️</span>
                                Discard
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Completed Games Tab */}
              {activeTab === 'completed' && (
                <div>
                  {completedGames.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-[#8b8987] mb-4 text-6xl">🏆</div>
                      <h3 className="text-lg font-medium text-white mb-2">No completed games</h3>
                      <p className="text-[#8b8987] mb-6">Finish some games to see them here</p>
                      <button
                        onClick={() => navigate('/play')}
                        className="bg-[#81b64c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#a3d160] transition-colors shadow"
                      >
                        <span className="mr-2">🤖</span>
                        Start New Game
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {completedGames.map((game) => {
                        const safeGame = {
                          ...game,
                          result: game.result || 'unknown',
                          playerColor: (game.playerColor || 'white').toLowerCase(),
                          opponentName: game.opponentName || 'Unknown',
                          endTime: game.endTime || Date.now(),
                          startTime: game.startTime || Date.now(),
                          moves: Array.isArray(game.moves) ? game.moves : [],
                          difficulty: game.difficulty || 'Medium'
                        };
                        const displayText = getResultDisplay(safeGame.result, safeGame.playerColor);
                        const isVictory = displayText.includes('Victory');
                        const isDraw = displayText.includes('Draw');
                        const avatarIcon = isVictory ? '🏆' : (isDraw ? '🤝' : '❌');
                        const normalizedPlayerColor = safeGame.playerColor;
                        return (
                          <div key={safeGame.id || 'unknown'} className="unified-card light-theme">
                            <div className="unified-card-header">
                              <div className="unified-card-avatar">
                                {avatarIcon}
                              </div>
                              <div>
                                <div className="font-semibold text-white">
                                  vs {safeGame.opponentName}
                                </div>
                                <div className="text-sm text-[#8b8987]">
                                  {formatTimeAgo(safeGame.endTime)}
                                </div>
                              </div>
                            </div>
                            <div className="unified-card-body">
                              <div className={`text-center font-semibold mb-3 ${getResultColor(safeGame.result, safeGame.playerColor)}`}>
                                {getResultDisplay(safeGame.result, safeGame.playerColor)}
                              </div>
                              <div className="flex items-center justify-between text-sm text-[#bababa] mb-3">
                                <span>You played: {normalizedPlayerColor === 'white' ? 'White' : 'Black'}</span>
                                <span>Duration: {formatGameDuration(safeGame.startTime, safeGame.endTime)}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm text-[#bababa] mb-3">
                                <span>Moves: {safeGame.moves.length}</span>
                                <span>Difficulty: {safeGame.difficulty}</span>
                              </div>
                              <div className="unified-card-actions vertical">
                                <button
                                  onClick={() => handlePreviewGame(safeGame)}
                                  className="unified-card-btn neutral text-sm"
                                >
                                  <span className="mr-2">👁️</span>
                                  Preview Game
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Game Preview Modal - Only for unfinished games */}
        {showPreviewModal && selectedGame && selectedGame.status !== 'completed' && (
          <GamePreviewModal
            game={selectedGame}
            onClose={() => {
              setShowPreviewModal(false);
              setSelectedGame(null);
            }}
          />
        )}
      </div>
    </>
  );
};

export default GameHistoryPage;
