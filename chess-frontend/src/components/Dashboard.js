import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getGameHistories } from "../services/gameHistoryService";
import "./Dashboard.css"; // Ensure this file is imported if not using index.css for these styles

const Dashboard = () => {
  const [gameHistories, setGameHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadGameHistories = async () => {
      try {
        const histories = await getGameHistories();
        setGameHistories(histories);
      } catch (error) {
        console.error("Error loading game histories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadGameHistories();
  }, []);

  const handleReviewGame = (game) => {
    navigate(`/play/review/${game.id}`);
  };

  return (
    <div className="dashboard p-6 min-h-screen text-white">
      <header className="dashboard-header text-center mb-10">
        <h1 className="text-4xl font-bold text-white">Welcome, {user?.username || "Player"}!</h1>
      </header>

      <section className="quick-actions grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <button onClick={() => navigate("/play")} className="action-button bg-accent hover:bg-accent-600 transition-colors duration-300 p-6 rounded-lg text-2xl font-semibold text-white">
          Play Chess
        </button>
        <button onClick={() => navigate("/tutorial")} className="action-button bg-primary hover:bg-primary-600 transition-colors duration-300 p-6 rounded-lg text-2xl font-semibold text-white">
          Tutorial
        </button>
        <button onClick={() => navigate("/practice")} className="action-button bg-secondary hover:bg-secondary-600 transition-colors duration-300 p-6 rounded-lg text-2xl font-semibold text-white">
          Practice
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="recent-games lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold mb-4 text-white">Recent Games</h2>
          {loading ? (
            <div className="loading">Loading game history...</div>
          ) : gameHistories.length > 0 ? (
            <div className="game-list space-y-4">
              {gameHistories.map((game) => (
                <div key={game.id} className="game-item flex justify-between items-center bg-white/10 p-4 rounded-lg">
                  <div className="game-info">
                    <span className="game-date block text-sm text-gray-300">
                      {new Date(game.played_at || game.timestamp).toLocaleDateString()}
                    </span>
                    <span className={`game-result font-bold ${game.result?.toLowerCase().includes("win") ? "text-success" : "text-error"}`}>
                      {game.result || "Unknown"}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleReviewGame(game)}
                    className="review-button bg-primary hover:bg-primary-600 transition-colors duration-300 px-4 py-2 rounded-lg text-white"
                  >
                    Review Game
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-games text-center py-10">No games played yet</div>
          )}
        </section>

        <section className="user-stats bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold mb-4 text-white">Your Statistics</h2>
          <div className="stats-grid grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="stat-item bg-white/10 p-4 rounded-lg">
              <span className="stat-value text-3xl font-bold block text-primary">{gameHistories.length}</span>
              <span className="stat-label text-gray-300">Games Played</span>
            </div>
            <div className="stat-item bg-white/10 p-4 rounded-lg">
              <span className="stat-value text-3xl font-bold block text-success">
                {gameHistories.length > 0
                  ? `${Math.round(
                      (gameHistories.filter((g) => g.result?.toLowerCase().includes("win")).length /
                        gameHistories.length) * 100
                    )}%`
                  : "0%"}
              </span>
              <span className="stat-label text-gray-300">Win Rate</span>
            </div>
            <div className="stat-item bg-white/10 p-4 rounded-lg">
              <span className="stat-value text-3xl font-bold block text-accent">
                {gameHistories.length > 0
                  ? (
                      gameHistories.reduce((sum, game) => {
                        const score = game.finalScore ?? game.score ?? 0;
                        return sum + (typeof score === 'number' ? score : 0);
                      }, 0) / gameHistories.length
                    ).toFixed(1)
                  : "0.0"}
              </span>
              <span className="stat-label text-gray-300">Average Score</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
