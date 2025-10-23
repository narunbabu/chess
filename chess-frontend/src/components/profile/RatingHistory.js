// src/components/profile/RatingHistory.js

import React, { useState, useEffect } from 'react';
import { getRatingHistory } from '../../services/ratingService';
import { formatRatingChange, getRatingCategory } from '../../utils/eloUtils';
import { isWin, isLoss, isDraw, getResultDetails } from '../../utils/resultStandardization';
import './RatingHistory.css';

const RatingHistory = () => {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getRatingHistory(50);

      if (response.success) {
        setHistory(response.data.history || []);
        setStats(response.data.stats || null);
      } else {
        throw new Error('Failed to fetch rating history');
      }
    } catch (err) {
      console.error('Error fetching rating history:', err);
      setError(err.message || 'Failed to load rating history');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOpponentDisplay = (game) => {
    if (game.game_type === 'computer') {
      return `Computer Lv ${game.computer_level || '?'}`;
    }
    return game.opponent?.name || 'Unknown Player';
  };

  const getResultClass = (result) => {
    if (isWin(result)) return 'result-win';
    if (isLoss(result)) return 'result-loss';
    return 'result-draw';
  };

  const getResultIcon = (result) => {
    if (isWin(result)) return '✓';
    if (isLoss(result)) return '✗';
    return '=';
  };

  if (isLoading) {
    return (
      <div className="rating-history-container">
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Loading rating history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rating-history-container">
        <div className="error-message">
          <h3>Error Loading History</h3>
          <p>{error}</p>
          <button onClick={fetchHistory} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rating-history-container">
      <h2 className="rating-history-title">Rating History</h2>

      {/* Statistics Summary */}
      {stats && (
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-label">Current Rating</div>
            <div className="stat-value current-rating">
              {stats.current_rating}
              <span className="rating-badge" style={{ backgroundColor: getRatingCategory(stats.current_rating).color }}>
                {getRatingCategory(stats.current_rating).label}
              </span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Peak Rating</div>
            <div className="stat-value">{stats.highest_rating}</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Record</div>
            <div className="stat-value record">
              <span className="win-count">{stats.wins}W</span>
              <span className="draw-count">{stats.draws}D</span>
              <span className="loss-count">{stats.losses}L</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Avg Change</div>
            <div className={`stat-value ${stats.average_rating_change >= 0 ? 'positive' : 'negative'}`}>
              {formatRatingChange(Math.round(stats.average_rating_change))}
            </div>
          </div>

          {stats.current_streak?.count > 0 && (
            <div className="stat-card">
              <div className="stat-label">Streak</div>
              <div className={`stat-value ${stats.current_streak.type}`}>
                {stats.current_streak.count} {stats.current_streak.type}
                {stats.current_streak.count > 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Table */}
      {history.length === 0 ? (
        <div className="empty-state">
          <p>No rating history yet. Play some games to see your progress!</p>
        </div>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opponent</th>
                <th>Result</th>
                <th>Rating Change</th>
                <th>New Rating</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {history.map((game) => (
                <tr key={game.id}>
                  <td className="date-cell">{formatDate(game.created_at)}</td>
                  <td className="opponent-cell">{getOpponentDisplay(game)}</td>
                  <td className={`result-cell ${getResultClass(game.result)}`}>
                    <span className="result-icon">{getResultIcon(game.result)}</span>
                    {getResultDetails(game.result)}
                  </td>
                  <td className={`change-cell ${game.rating_change >= 0 ? 'positive' : 'negative'}`}>
                    {formatRatingChange(game.rating_change)}
                  </td>
                  <td className="rating-cell">
                    {game.new_rating}
                  </td>
                  <td className="type-cell">
                    <span className={`type-badge ${game.game_type}`}>
                      {game.game_type === 'computer' ? '🤖' : '👥'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RatingHistory;
