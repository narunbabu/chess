import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useAppData } from "../contexts/AppDataContext";
import { getGameHistories } from "../services/gameHistoryService";
import api from "../services/api";
import "./Dashboard.css";
import "../styles/UnifiedCards.css"; // Import unified card styles

const Dashboard = () => {
  const [gameHistories, setGameHistories] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const { getGameHistory } = useAppData();
  const navigate = useNavigate();
  const didFetchRef = useRef(false); // Guard against StrictMode double-mount

  useEffect(() => {
    // Prevent duplicate fetches in StrictMode
    if (didFetchRef.current) {
      console.log('[Dashboard] Already fetched game histories, skipping');
      return;
    }
    didFetchRef.current = true;

    const loadGameHistories = async () => {
      try {
        // Fetch both game histories and active games in parallel
        const [histories, activeGamesResponse] = await Promise.all([
          getGameHistory().catch(() => getGameHistories()),
          api.get('/games/active').catch(err => {
            console.error("[Dashboard] Error loading active games:", err);
            return { data: [] };
          })
        ]);

        setGameHistories(histories || []);
        setActiveGames(activeGamesResponse.data || []);
      } catch (error) {
        console.error("[Dashboard] Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadGameHistories();

    return () => {
      didFetchRef.current = false;
    };
  }, [getGameHistory]);

  const handleReviewGame = (game) => {
    navigate(`/play/review/${game.id}`);
  };

  return (
    <div className="dashboard p-6 min-h-screen text-white">
      <header className="dashboard-header text-center mb-10">
        <h1 className="text-4xl font-bold text-white">Welcome, {user?.username || "Player"}!</h1>
      </header>

      <div className="dashboard-grid">
        {/* Active Games Section */}
        <section className="unified-section">
          <h2 className="unified-section-header">🎮 Active Games</h2>
          {activeGames.length > 0 ? (
            <div className="unified-card-grid cols-1">
              {activeGames.map((game) => {
                const opponent =
                  game.white_player_id === user.id
                    ? game.blackPlayer
                    : game.whitePlayer;
                const playerColor =
                  game.white_player_id === user.id ? 'white' : 'black';
                const statusClass =
                  game.status === 'active'
                    ? 'active'
                    : game.status === 'paused'
                    ? 'paused'
                    : '';

                return (
                  <div key={game.id} className="unified-card horizontal">
                    <img
                      src={
                        opponent?.avatar ||
                        `https://i.pravatar.cc/150?u=${opponent?.email}`
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
          ) : (
            <div className="unified-empty-state">
              <p>🎮 No active games</p>
              <p>Start a new game from the lobby!</p>
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
            <div className="unified-card-grid cols-1">
              {gameHistories.map((game) => (
                <div key={game.id} className="unified-card horizontal">
                  <div className="unified-card-content">
                    <h3 className="unified-card-title">
                      {new Date(
                        game.played_at || game.timestamp
                      ).toLocaleDateString()}
                    </h3>
                    <p
                      className={`unified-card-subtitle ${
                        game.result?.toLowerCase().includes("win")
                          ? "text-success"
                          : "text-error"
                      }`}
                      style={{
                        color: game.result?.toLowerCase().includes("win")
                          ? "#43b581"
                          : "#f04747",
                      }}
                    >
                      {game.result || "Unknown"}
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
          ) : (
            <div className="unified-empty-state">
              <p>📜 No games played yet</p>
              <p>Play your first game to see your history!</p>
            </div>
          )}
        </section>

        {/* User Stats Section */}
        <section className="unified-section">
          <h2 className="unified-section-header">📊 Your Statistics</h2>
          <div className="unified-card-grid cols-3">
            <div className="unified-card">
              <div className="unified-card-content" style={{ textAlign: 'center' }}>
                <h3 className="unified-card-title" style={{ fontSize: '2rem', color: '#7289da' }}>
                  {gameHistories.length}
                </h3>
                <p className="unified-card-subtitle">Games Played</p>
              </div>
            </div>
            <div className="unified-card">
              <div className="unified-card-content" style={{ textAlign: 'center' }}>
                <h3 className="unified-card-title" style={{ fontSize: '2rem', color: '#43b581' }}>
                  {gameHistories.length > 0
                    ? `${Math.round(
                        (gameHistories.filter((g) =>
                          g.result?.toLowerCase().includes("win")
                        ).length /
                          gameHistories.length) *
                          100
                      )}%`
                    : "0%"}
                </h3>
                <p className="unified-card-subtitle">Win Rate</p>
              </div>
            </div>
            <div className="unified-card">
              <div className="unified-card-content" style={{ textAlign: 'center' }}>
                <h3 className="unified-card-title" style={{ fontSize: '2rem', color: '#FFA640' }}>
                  {gameHistories.length > 0
                    ? (
                        gameHistories.reduce((sum, game) => {
                          const score = game.finalScore ?? game.score ?? 0;
                          return sum + (typeof score === 'number' ? score : 0);
                        }, 0) / gameHistories.length
                      ).toFixed(1)
                    : "0.0"}
                </h3>
                <p className="unified-card-subtitle">Average Score</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions Section */}
        <section className="unified-section">
          <h2 className="unified-section-header">⚡ Quick Actions</h2>
          <div className="unified-card-grid cols-3">
            <button
              onClick={() => navigate("/play")}
              className="unified-card"
              style={{ cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #FFA640, #FF7C2A)' }}
            >
              <div className="unified-card-content" style={{ textAlign: 'center' }}>
                <h3 className="unified-card-title">♟️ Play Chess</h3>
                <p className="unified-card-subtitle">Start a new game</p>
              </div>
            </button>
            <button
              onClick={() => navigate("/tutorial")}
              className="unified-card"
              style={{ cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #7289da, #5f73bc)' }}
            >
              <div className="unified-card-content" style={{ textAlign: 'center' }}>
                <h3 className="unified-card-title">📚 Tutorial</h3>
                <p className="unified-card-subtitle">Learn chess basics</p>
              </div>
            </button>
            <button
              onClick={() => navigate("/practice")}
              className="unified-card"
              style={{ cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #43b581, #3ca374)' }}
            >
              <div className="unified-card-content" style={{ textAlign: 'center' }}>
                <h3 className="unified-card-title">🎯 Practice</h3>
                <p className="unified-card-subtitle">Improve your skills</p>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
