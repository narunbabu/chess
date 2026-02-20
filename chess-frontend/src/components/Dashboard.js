import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAppData } from "../contexts/AppDataContext";
import { getGameHistories } from "../services/gameHistoryService";
import api from "../services/api";
import userStatusService from "../services/userStatusService";
import SkillAssessmentModal from "./auth/SkillAssessmentModal";
import DetailedStatsModal from "./DetailedStatsModal";
import { getPlayerAvatar } from "../utils/playerDisplayUtils";
import { isWin, getResultDisplayText } from "../utils/resultStandardization";
import { getUnfinishedGame, getUnfinishedGames, deleteUnfinishedGame } from "../services/unfinishedGameService";
import MatchmakingQueue from "./lobby/MatchmakingQueue";
import "./Dashboard.css";
import "../styles/UnifiedCards.css"; // Import unified card styles

// Simple debug utility - compatible with Create React App
const DEBUG_MODE = process.env.REACT_APP_DEBUG === 'true' ||
                  (process.env.NODE_ENV === 'development' && localStorage.getItem('debug') === 'true');

const debugLog = (component, message, ...args) => {
  if (DEBUG_MODE || localStorage.getItem(`debug_${component}`) === 'true') {
    console.log(`[${component}] ${message}`, ...args);
  }
};

const debugError = (component, message, ...args) => {
  console.error(`[${component}] ${message}`, ...args);
};

const debugWarn = (component, message, ...args) => {
  if (DEBUG_MODE || localStorage.getItem(`debug_${component}`) === 'true') {
    console.warn(`[${component}] ${message}`, ...args);
  }
};

const Dashboard = () => {
  const [gameHistories, setGameHistories] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [unfinishedGames, setUnfinishedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSkillAssessment, setShowSkillAssessment] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [visibleActiveGames, setVisibleActiveGames] = useState(3);
  const [visibleRecentGames, setVisibleRecentGames] = useState(3);
  const { user } = useAuth();
  const { currentTier } = useSubscription();
  const { getGameHistory } = useAppData();
  const navigate = useNavigate();

  // Performance guards: Prevent duplicate API calls across multiple mounts
  // Note: Dashboard may mount 2-3 times in development due to:
  // 1. Initial render when route matches
  // 2. Re-render when auth state updates (user data loads)
  // 3. Re-render when context providers stabilize
  // The didFetchRef ensures we only fetch data once regardless of mount count
  const didFetchRef = useRef(false); // Guard against multiple mounts
  const mountCountRef = useRef(0); // Track mount count for debugging
  const activeGamesRequestRef = useRef(null); // Track in-flight active games request

  // Active games fetch with deduplication
  const fetchActiveGames = useCallback(async () => {
    // If request already in-flight, wait for it
    if (activeGamesRequestRef.current) {
      console.log('[Dashboard] ⏳ Active games fetch already in-flight, waiting...');
      return activeGamesRequestRef.current;
    }

    console.log('[Dashboard] 🚀 Fetching active games');
    activeGamesRequestRef.current = api.get('/games/active')
      .then(response => {
        console.log('[Dashboard] ✅ Active games fetched');
        return response;
      })
      .catch(err => {
        console.error("[Dashboard] ❌ Error loading active games:", err);
        return { data: [] };
      })
      .finally(() => {
        activeGamesRequestRef.current = null;
      });

    return activeGamesRequestRef.current;
  }, []);

  useEffect(() => {
    // Component mount logging
    mountCountRef.current += 1;
    debugLog('Dashboard', `🔄 Component mounted (mount #${mountCountRef.current})`);

    // Initialize UserStatusService to maintain online status
    const initializeStatusService = async () => {
      try {
        debugLog('Dashboard', '👤 Initializing user status service...');
        // UserStatusService is a singleton - use the exported instance directly
        await userStatusService.initialize();
        debugLog('Dashboard', '✅ User status service initialized successfully');
      } catch (error) {
        debugError('Dashboard', '❌ Failed to initialize user status service', error);
      }
    };

    // Initialize status service immediately
    initializeStatusService();

    // Only log trace on first mount to reduce noise (conditional debug)
    if (mountCountRef.current === 1 && DEBUG_MODE) {
      console.trace('[Dashboard] 📍 First mount call stack');
    }

    // Prevent duplicate fetches across mounts
    if (didFetchRef.current) {
      debugLog('Dashboard', `⏭️ Already fetched data, skipping (mount #${mountCountRef.current})`);
      return;
    }
    didFetchRef.current = true;

    const loadGameHistories = async () => {
      let histories = [];
      let activeGamesResponse = { data: [] };
      let unfinishedGamesData = [];

      try {
        debugLog('Dashboard', '📊 Loading game histories, active games, and unfinished games...');
        // Fetch game histories, active games, and unfinished games in parallel
        // Use AppDataContext's cached version first, only force refresh if it fails
        const [fetchedHistories, fetchedActiveGames, fetchedUnfinishedGames] = await Promise.all([
          getGameHistory(false).catch(() => {
            console.log('[Dashboard] ⚠️ Cache miss, fetching directly');
            return getGameHistories();
          }),
          fetchActiveGames(),
          getUnfinishedGames(!!user).catch(err => {
            console.error("[Dashboard] ❌ Error loading unfinished games:", err);
            return [];
          })
        ]);

        histories = fetchedHistories || [];
        activeGamesResponse = fetchedActiveGames;
        unfinishedGamesData = fetchedUnfinishedGames || [];

        // Deduplicate unfinished games by gameId to prevent duplicate key errors
        const uniqueUnfinishedGames = unfinishedGamesData.reduce((acc, game) => {
          const existingIndex = acc.findIndex(g => g.gameId === game.gameId);
          if (existingIndex === -1) {
            acc.push(game);
          } else {
            // Keep the one with more recent lastMoveAt
            const existing = acc[existingIndex];
            const existingTime = existing.lastMoveAt ? new Date(existing.lastMoveAt).getTime() : 0;
            const currentTime = game.lastMoveAt ? new Date(game.lastMoveAt).getTime() : 0;
            if (currentTime > existingTime) {
              acc[existingIndex] = game;
            }
          }
          return acc;
        }, []);

        if (unfinishedGamesData.length !== uniqueUnfinishedGames.length) {
          console.warn('[Dashboard] ⚠️ Found duplicate unfinished games. Before:', unfinishedGamesData.length, 'After:', uniqueUnfinishedGames.length);
        }

        debugLog('Dashboard', `✅ Loaded ${histories.length} game histories`);
        debugLog('Dashboard', `✅ Loaded ${activeGamesResponse.data.length} active games`);
        debugLog('Dashboard', `✅ Loaded ${uniqueUnfinishedGames.length} unfinished games`);

        // Correct multiplayer history scores and results
        const correctedHistories = await correctMultiplayerHistories(histories);
        setGameHistories(correctedHistories);
        setActiveGames(activeGamesResponse.data || []);
        setUnfinishedGames(uniqueUnfinishedGames);
      } catch (error) {
        console.error("[Dashboard] ❌ Error loading data:", error);
        setGameHistories([]);
        setActiveGames([]);
        setUnfinishedGames([]);
      } finally {
        setLoading(false);
      }
    };

    const correctMultiplayerHistories = async (histories) => {
      if (!user?.id || !histories || histories.length === 0) return histories;

      const multiplayerHistories = histories.filter(h => h.game_mode === 'multiplayer');
      if (multiplayerHistories.length === 0) return histories;

      try {
        // Fetch recent finished games for this user
        const gamesResponse = await api.get('/games', {
          params: {
            status: 'finished',
            limit: 50, // Enough for recent games
            user_id: user.id
          }
        });
        const recentGames = gamesResponse.data || [];

        debugLog('Dashboard', `🔧 Correcting ${multiplayerHistories.length} multiplayer histories`);

        return histories.map(history => {
          if (history.game_mode !== 'multiplayer' || history.final_score !== history.opponent_score) {
            return history; // No correction needed
          }

          // Find matching game by moves preview and date (within 2 minutes)
          const historyDate = new Date(history.played_at);
          const matchingGame = recentGames.find(game => {
            const gameDate = new Date(game.ended_at || game.played_at);
            const dateDiff = Math.abs(historyDate - gameDate) / 1000 / 60; // minutes
            const movesMatch = String(history.moves || '').substring(0, 100) === String(game.moves || '').substring(0, 100);
            return dateDiff < 2 && movesMatch && (game.white_player_id === parseInt(user.id) || game.black_player_id === parseInt(user.id));
          });

          if (!matchingGame) {
            console.warn(`[Dashboard] ⚠️ No matching game found for history ${history.id}`);
            return history;
          }

          const playerColor = history.player_color;
          const whiteScore = parseFloat(matchingGame.white_player_score || 0);
          const blackScore = parseFloat(matchingGame.black_player_score || 0);
          const isPlayerWin = matchingGame.winner_user_id === parseInt(user.id);
          const opponentName = playerColor === 'w' ? matchingGame.black_player?.name : matchingGame.white_player?.name;

          const correctedHistory = {
            ...history,
            final_score: playerColor === 'w' ? whiteScore : blackScore,
            opponent_score: playerColor === 'w' ? blackScore : whiteScore,
            result: {
              ...history.result,
              status: isPlayerWin ? 'won' : 'lost',
              details: isPlayerWin 
                ? `You won by ${matchingGame.end_reason}!` 
                : `${opponentName} won by ${matchingGame.end_reason}`,
              end_reason: matchingGame.end_reason,
              winner: isPlayerWin ? 'player' : 'opponent'
            }
          };

          console.log(`[Dashboard] ✅ Corrected history ${history.id}:`, {
            oldPlayer: history.final_score,
            oldOpp: history.opponent_score,
            newPlayer: correctedHistory.final_score,
            newOpp: correctedHistory.opponent_score,
            newResult: correctedHistory.result.status
          });

          return correctedHistory;
        });
      } catch (error) {
        // Non-critical error - multiplayer history correction failed, but continue with original data
        debugWarn('Dashboard', '⚠️ Could not correct multiplayer histories, using original data', error.message);
        return histories;
      }
    };

    loadGameHistories();

    // Cleanup function to properly stop UserStatusService
    return () => {
      debugLog('Dashboard', '🧹 Component unmounting, stopping user status service...');
      // The UserStatusService will handle cleanup automatically when page unloads
      // but we should stop the interval when the component unmounts
      try {
        if (userStatusService) {
          userStatusService.stopHeartbeat();
        }
      } catch (error) {
        debugError('Dashboard', '⚠️ Error stopping user status service', error);
      }
    };
  }, [getGameHistory, user?.id]);

  const handleReviewGame = (game) => {
    navigate(`/play/review/${game.id}`);
  };

  const handleResumeUnfinishedGame = async (game) => {
    console.log('[Dashboard] 📂 Resuming unfinished game:', game);
    try {
      // Calculate actual remaining time from move history
      const calculateRemainingTime = (moves, initialTimeMs = 10 * 60 * 1000) => {
        if (!moves || !Array.isArray(moves)) {
          return { whiteMs: initialTimeMs, blackMs: initialTimeMs };
        }

        let whiteTimeSpent = 0;
        let blackTimeSpent = 0;

        moves.forEach(moveEntry => {
          const timeSpent = (moveEntry.timeSpent || 0) * 1000; // Convert to ms
          if (moveEntry.playerColor === 'w') {
            whiteTimeSpent += timeSpent;
          } else if (moveEntry.playerColor === 'b') {
            blackTimeSpent += timeSpent;
          }
        });

        return {
          whiteMs: Math.max(0, initialTimeMs - whiteTimeSpent),
          blackMs: Math.max(0, initialTimeMs - blackTimeSpent)
        };
      };

      // Calculate remaining time if timerState exists
      let updatedTimerState = game.timerState;
      if (game.timerState && game.moves) {
        const calculatedTimes = calculateRemainingTime(
          game.moves,
          game.timerState.whiteMs || 10 * 60 * 1000
        );
        updatedTimerState = {
          ...game.timerState,
          whiteMs: calculatedTimes.whiteMs,
          blackMs: calculatedTimes.blackMs
        };
        console.log('[Dashboard] ⏱️ Calculated remaining times:', calculatedTimes);
      }

      if (game.gameMode === 'computer') {
        // For computer games, navigate to PlayComputer with state
        // PlayComputer expects location.state.gameState with isResume: true
        navigate('/play', {
          state: {
            gameState: {
              ...game,
              timerState: updatedTimerState,
              isResume: true
            }
          }
        });
      } else if (game.gameMode === 'multiplayer') {
        // For multiplayer games, navigate to PlayMultiplayer with game ID
        if (game.gameId) {
          navigate(`/play/multiplayer/${game.gameId}`, { state: { resumeGame: game } });
        } else {
          console.error('[Dashboard] ❌ Cannot resume multiplayer game without gameId');
        }
      }
    } catch (error) {
      console.error('[Dashboard] ❌ Error resuming game:', error);
    }
  };

  const handleDiscardUnfinishedGame = async (game) => {
    console.log('[Dashboard] 🗑️ Discarding unfinished game:', game);
    try {
      await deleteUnfinishedGame(game.gameId, !!user);
      // Reload unfinished games
      const updatedGames = await getUnfinishedGames(!!user);
      setUnfinishedGames(updatedGames || []);
    } catch (error) {
      console.error('[Dashboard] ❌ Error discarding game:', error);
    }
    // Removed setSelectedUnfinishedGame(null) - state variable no longer exists
  };

  const handleSkillAssessmentComplete = async (rating) => {
    console.log('Skill assessment completed with rating:', rating);
    setShowSkillAssessment(false);
    // Refresh user data to show updated rating
    window.location.reload();
  };

  const handleSkillAssessmentSkip = () => {
    console.log('Skill assessment skipped');
    setShowSkillAssessment(false);
  };

  // Check if user should be prompted to set their rating
  const shouldShowRatingPrompt = user && user.rating === 1200 && (user.games_played === 0 || !user.games_played);

  // Memoize stats calculations to prevent repetitive computation
  const stats = useMemo(() => {
    const totalGames = gameHistories.length;

    if (totalGames === 0) {
      return {
        totalGames: 0,
        winRate: "0%",
        averageScore: "0.0"
      };
    }

    const wins = gameHistories.filter((g) => isWin(g.result)).length;
    const winRate = `${Math.round((wins / totalGames) * 100)}%`;

    const scores = gameHistories.map(game => {
      const score = game.finalScore ?? game.final_score ?? game.score ?? 0;
      return typeof score === 'number' ? score : parseFloat(score) || 0;
    });
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / totalGames;
    const averageScore = avg.toFixed(1);

    debugLog('Stats', `Calculated once - Total games: ${totalGames}, Wins: ${wins}, Average: ${averageScore}`);

    return {
      totalGames,
      winRate,
      averageScore
    };
  }, [gameHistories]); // Only recalculate when gameHistories changes

  return (
    <>
      <SkillAssessmentModal
        isOpen={showSkillAssessment}
        onComplete={handleSkillAssessmentComplete}
        onSkip={handleSkillAssessmentSkip}
      />

      <DetailedStatsModal
        isOpen={showDetailedStats}
        onClose={() => setShowDetailedStats(false)}
        gameHistories={gameHistories}
        user={user}
      />

      <MatchmakingQueue
        isOpen={showMatchmaking}
        onClose={() => setShowMatchmaking(false)}
        autoStart={true}
      />

      <div className="dashboard-container">
        <div className="dashboard p-6 text-white">
          <header className="dashboard-header text-center mb-10">
            <h1 className="text-4xl font-bold text-white">Welcome, {user?.name || user?.email?.split('@')[0] || "Player"}!</h1>

            {/* Upgrade Banner for free-tier users */}
            {currentTier === 'free' && (
              <div style={{
                margin: '16px auto 0',
                maxWidth: '640px',
                padding: '12px 20px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(129,182,76,0.12), rgba(129,182,76,0.06))',
                border: '1px solid rgba(129,182,76,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                <p style={{ margin: 0, color: '#bababa', fontSize: '14px', textAlign: 'left' }}>
                  You're on the <strong style={{ color: '#e5e7eb' }}>Free plan</strong>.
                  Upgrade to <strong style={{ color: '#81b64c' }}>Standard ₹99/mo</strong> for unlimited games, tournaments & premium features.
                </p>
                <button
                  onClick={() => navigate('/pricing')}
                  style={{
                    flexShrink: 0,
                    padding: '6px 18px',
                    borderRadius: '20px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #81b64c, #a3d160)',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Upgrade Now
                </button>
              </div>
            )}

            {/* Skill Assessment Prompt */}
            {shouldShowRatingPrompt && (
              <div className="rating-prompt-banner">
                <p className="rating-prompt-text">
                  ⭐ You're using the default rating (1200). Take a quick skill assessment to get a personalized rating!
                </p>
                <button
                  className="rating-prompt-btn"
                  onClick={() => setShowSkillAssessment(true)}
                >
                  Set My Skill Level
                </button>
              </div>
            )}
          </header>

        <div className="dashboard-grid">
        {/* Quick Actions Section — single primary CTA with secondaries */}
        <section className="unified-section">
          <h2 className="unified-section-header">⚡ Quick Actions</h2>

          {/* Primary CTA: Play Now */}
          <button
            onClick={() => user ? setShowMatchmaking(true) : navigate('/play')}
            style={{
              display: 'block',
              width: '100%',
              padding: '18px 24px',
              marginBottom: '12px',
              background: 'linear-gradient(135deg, #81b64c, #5d8a35)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
              letterSpacing: '0.3px',
              boxShadow: '0 4px 16px rgba(129,182,76,0.35)',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(129,182,76,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(129,182,76,0.35)'; }}
          >
            ▶ Play Now
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 'normal', opacity: 0.85, marginTop: '2px' }}>
              Find an opponent — falls back to AI if none available
            </span>
          </button>

          {/* Secondary CTAs */}
          <div className="unified-card-grid cols-2" style={{ marginBottom: '12px' }}>
            <button
              onClick={() => navigate('/play')}
              className="unified-card centered"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #3d3a37' }}
            >
              <div className="unified-card-content">
                <h3 className="unified-card-title" style={{ fontSize: '15px' }}>🤖 vs Computer</h3>
                <p className="unified-card-subtitle">Play against AI directly</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/lobby')}
              className="unified-card centered"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #3d3a37' }}
            >
              <div className="unified-card-content">
                <h3 className="unified-card-title" style={{ fontSize: '15px' }}>👥 vs Friend</h3>
                <p className="unified-card-subtitle">Challenge from lobby</p>
              </div>
            </button>
          </div>

          {/* Tertiary row */}
          <div className="unified-card-grid cols-2">
            <button
              onClick={() => navigate('/tutorial')}
              className="unified-card centered"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #3d3a37' }}
            >
              <div className="unified-card-content">
                <h3 className="unified-card-title" style={{ fontSize: '14px' }}>🎓 Learn Chess</h3>
                <p className="unified-card-subtitle">Lessons & practice</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/championships')}
              className="unified-card centered"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #3d3a37' }}
            >
              <div className="unified-card-content">
                <h3 className="unified-card-title" style={{ fontSize: '14px' }}>🏆 Championships</h3>
                <p className="unified-card-subtitle">Join tournaments</p>
              </div>
            </button>
          </div>
        </section>

        {/* Active Games Section */}
        <section className="unified-section">
          <h2 className="unified-section-header">🎮 Active Games</h2>
          {!user ? (
            <div className="unified-empty-state">
              <p>Loading user data...</p>
            </div>
          ) : activeGames.length > 0 ? (
            <>
            <div className="unified-card-grid cols-1">
              {activeGames.slice(0, visibleActiveGames).map((game) => {
                const opponent =
                  game.white_player_id === user?.id
                    ? game.black_player
                    : game.white_player;
                const playerColor =
                  game.white_player_id === user?.id ? 'white' : 'black';
                const statusClass =
                  game.status === 'active'
                    ? 'active'
                    : game.status === 'paused'
                    ? 'paused'
                    : '';

                return (
                  <div key={`active-${game.id}`} className="unified-card horizontal">
                    <img
                      src={
                        getPlayerAvatar(opponent) ||
                        `https://i.pravatar.cc/150?u=${opponent?.email || `user${opponent?.id}`}`
                      }
                      alt={opponent?.name}
                      className="unified-card-avatar"
                    />
                    <div className="unified-card-content">
                      <h3 className="unified-card-title">vs {opponent?.name}</h3>
                      <p className="unified-card-subtitle">
                        <span className={`unified-card-status ${statusClass}`}>
                          {game.status}
                        </span>
                        {' • '}Playing as {playerColor}
                      </p>
                      <p className="unified-card-meta">
                        Last move:{' '}
                        {game.last_move_at
                          ? new Date(game.last_move_at).toLocaleString()
                          : 'No moves yet'}
                      </p>
                    </div>
                    <div className="unified-card-actions">
                      <button
                        onClick={() => {
                          sessionStorage.setItem(
                            'lastInvitationAction',
                            'resume_game'
                          );
                          sessionStorage.setItem(
                            'lastInvitationTime',
                            Date.now().toString()
                          );
                          sessionStorage.setItem(
                            'lastGameId',
                            game.id.toString()
                          );
                          navigate(`/play/multiplayer/${game.id}`);
                        }}
                        className="unified-card-btn secondary"
                      >
                        ▶️ Resume Game
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {activeGames.length > visibleActiveGames && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={() => setVisibleActiveGames(prev => prev + 10)}
                  className="unified-card-btn primary"
                >
                  📂 Load 10 More ({activeGames.length - visibleActiveGames} remaining)
                </button>
              </div>
            )}
            </>
          ) : (
            <div className="unified-empty-state">
              <p>🎮 No active games</p>
              <p>Start a new game from the lobby!</p>
              <button
                onClick={() => navigate('/lobby')}
                className="unified-card-btn primary"
                style={{ marginTop: '0.75rem' }}
              >
                Create Game
              </button>
            </div>
          )}
        </section>

        {/* Unfinished Games Section */}
        <section className="unified-section">
          <h2 className="unified-section-header">⏸️ Unfinished Games</h2>
          {unfinishedGames.length > 0 ? (
            <div className="unified-card-grid cols-1">
              {unfinishedGames.map((game, index) => {
                const gameMode = game.gameMode === 'computer' ? '🤖 vs Computer' : '👥 vs Human';
                const opponent = game.opponentName || (game.gameMode === 'computer' ? 'Computer' : 'Opponent');
                const moveCount = game.moves ? game.moves.length : 0;
                const lastMoveTime = game.lastMoveAt ? new Date(game.lastMoveAt).toLocaleString() : 'Unknown';

                return (
                  <div key={`unfinished-${game.gameId}-${index}`} className="unified-card horizontal">
                    <div className="unified-card-content">
                      <h3 className="unified-card-title">{gameMode} - vs {opponent}</h3>
                      <p className="unified-card-subtitle">
                        {moveCount} moves • Last played: {lastMoveTime}
                      </p>
                      <p className="unified-card-meta">
                        Playing as {game.playerColor === 'w' ? 'White' : 'Black'}
                        {game.turn && ` • ${game.turn === game.playerColor ? "Your turn" : "Opponent's turn"}`}
                      </p>
                    </div>
                    <div className="unified-card-actions">
                      <button
                        onClick={() => handleResumeUnfinishedGame(game)}
                        className="unified-card-btn primary"
                      >
                        ▶️ Resume
                      </button>
                      <button
                        onClick={() => handleDiscardUnfinishedGame(game)}
                        className="unified-card-btn secondary"
                      >
                        🗑️ Discard
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="unified-empty-state">
              <p>⏸️ No unfinished games</p>
              <p>Games you leave will appear here for quick resuming!</p>
            </div>
          )}
        </section>

        {/* Recent Games Section */}
        <section className="unified-section">
          <h2 className="unified-section-header">📜 Recent Games</h2>
          {loading ? (
            <div className="unified-empty-state">
              <p>Loading game history...</p>
            </div>
          ) : gameHistories.length > 0 ? (
            <>
            <div className="unified-card-grid cols-1">
              {gameHistories.slice(0, visibleRecentGames).map((game) => (
                <div key={`history-${game.id}`} className="unified-card horizontal">
                  <div className="unified-card-content">
                    <h3 className="unified-card-title">
                      {new Date(
                        game.played_at || game.timestamp
                      ).toLocaleDateString()}
                    </h3>
                    <p
                      className={`unified-card-subtitle ${
                        isWin(game.result)
                          ? "title-success"
                          : "title-error"
                      }`}
                    >
                      {getResultDisplayText(game.result)}
                    </p>
                  </div>
                  <div className="unified-card-actions">
                    <button
                      onClick={() => handleReviewGame(game)}
                      className="unified-card-btn primary"
                    >
                      Review Game
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {gameHistories.length > visibleRecentGames && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={() => setVisibleRecentGames(prev => prev + 10)}
                  className="unified-card-btn primary"
                >
                  📂 Load 10 More ({gameHistories.length - visibleRecentGames} remaining)
                </button>
              </div>
            )}
            </>
          ) : (
            <div className="unified-empty-state">
              <p>📜 No games played yet</p>
              <p>Play your first game to see your history!</p>
            </div>
          )}
        </section>

        {/* User Stats Section */}
        <section className="unified-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="unified-section-header" style={{ margin: 0 }}>📊 Your Statistics</h2>
            {gameHistories.length > 0 && (
              <button
                onClick={() => setShowDetailedStats(true)}
                className="unified-card-btn primary"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                📋 View Details
              </button>
            )}
          </div>
            <div className="unified-card-grid cols-4">
              <div className="unified-card centered">
                <div className="unified-card-content">
                  <h3 className="unified-card-title title-large title-primary">
                    {stats.totalGames}
                  </h3>
                  <p className="unified-card-subtitle">Games Played</p>
                </div>
              </div>
              <div className="unified-card centered">
                <div className="unified-card-content">
                  <h3 className="unified-card-title title-large title-success">
                    {stats.winRate}
                  </h3>
                  <p className="unified-card-subtitle">Win Rate</p>
                </div>
              </div>
              <div className="unified-card centered">
                <div className="unified-card-content">
                  <h3 className="unified-card-title title-large title-accent">
                    {stats.averageScore}
                  </h3>
                  <p className="unified-card-subtitle">Average Score</p>
                </div>
              </div>
              <div className="unified-card centered">
                <div className="unified-card-content">
                  <h3 className="unified-card-title title-large title-info">
                    {user?.rating || 1200}
                  </h3>
                  <p className="unified-card-subtitle">Rating</p>
                </div>
              </div>
            </div>
        </section>
        </div>
      </div>
    </div>
    </>
  );
};

export default Dashboard;
