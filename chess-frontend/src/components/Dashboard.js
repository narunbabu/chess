// export default Dashboard; 
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
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Welcome, {user?.username || "Player"}!</h1>
      </header>

      <section className="quick-actions">
        <button onClick={() => navigate("/play")} className="action-button play">
          Play Chess
        </button>
        <button onClick={() => navigate("/tutorial")} className="action-button tutorial">
          Tutorial
        </button>
        <button onClick={() => navigate("/practice")} className="action-button practice">
          Practice
        </button>
      </section>

      <section className="recent-games">
        <h2>Recent Games</h2>
        {loading ? (
          <div className="loading">Loading game history...</div>
        ) : gameHistories.length > 0 ? (
          <div className="game-list">
            {gameHistories.map((game) => (
              <div key={game.id} className="game-item">
                <div className="game-info">
                  <span className="game-date">
                    {new Date(game.timestamp).toLocaleDateString()}
                  </span>
                  <span className={`game-result ${game.result.toLowerCase().includes("win") ? "win" : "loss"}`}>
                    {game.result}
                  </span>
                  <span className="game-score">
                    Score: {game.score.toFixed(1)}
                  </span>
                </div>
                <button 
                  onClick={() => handleReviewGame(game)}
                  className="review-button"
                >
                  Review Game
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-games">No games played yet</div>
        )}
      </section>

      <section className="user-stats">
        <h2>Your Statistics</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{gameHistories.length}</span>
            <span className="stat-label">Games Played</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {gameHistories.length > 0
                ? `${Math.round(
                    (gameHistories.filter((g) => g.result.toLowerCase().includes("win")).length /
                      gameHistories.length) * 100
                  )}%`
                : "0%"}
            </span>
            <span className="stat-label">Win Rate</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">
              {gameHistories.length > 0
                ? (
                    gameHistories.reduce((sum, game) => sum + game.score, 0) / gameHistories.length
                  ).toFixed(1)
                : "0.0"}
            </span>
            <span className="stat-label">Average Score</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
