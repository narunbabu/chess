// RatingChangeNotification.js - Shows rating change after a game
import React, { useState, useEffect } from 'react';
import { formatRatingChange, getRatingChangeColor, getRatingCategory } from '../utils/eloUtils';
import './RatingChangeNotification.css';

const RatingChangeNotification = ({ ratingData, onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);

    // Auto-close after duration
    const closeTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(closeTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300); // Match animation duration
  };

  if (!ratingData) return null;

  const {
    old_rating,
    new_rating,
    rating_change,
    games_played,
    is_provisional,
    peak_rating,
    k_factor,
    expected_score,
  } = ratingData;

  const isPositive = rating_change > 0;
  const isNegative = rating_change < 0;
  const changeColor = getRatingChangeColor(rating_change);
  const category = getRatingCategory(new_rating);

  // Check if new peak rating
  const isNewPeak = new_rating === peak_rating && new_rating > old_rating;

  // Check if provisional status ended
  const becameEstablished = games_played === 10;

  return (
    <div className={`rating-notification-overlay ${isVisible && !isExiting ? 'visible' : ''} ${isExiting ? 'exiting' : ''}`}>
      <div className="rating-notification-card">
        {/* Close button */}
        <button className="rating-notification-close" onClick={handleClose}>
          ✕
        </button>

        {/* Header */}
        <div className="rating-notification-header">
          <h3>Rating Updated</h3>
          {is_provisional && (
            <span className="rating-provisional-badge">Provisional</span>
          )}
        </div>

        {/* Main rating display */}
        <div className="rating-change-display">
          <div className="rating-old">
            <span className="rating-label">Previous</span>
            <span className="rating-value">{old_rating}</span>
          </div>

          <div className="rating-arrow">
            {isPositive ? '→' : isNegative ? '↓' : '→'}
          </div>

          <div className="rating-new">
            <span className="rating-label">New Rating</span>
            <span className="rating-value" style={{ color: category.color }}>
              {new_rating}
            </span>
          </div>
        </div>

        {/* Rating change badge */}
        <div className="rating-change-badge" style={{ backgroundColor: changeColor }}>
          <span className="rating-change-amount">
            {formatRatingChange(rating_change)}
          </span>
          <span className="rating-change-text">points</span>
        </div>

        {/* Category badge */}
        <div className="rating-category-badge" style={{ borderColor: category.color }}>
          <span style={{ color: category.color }}>●</span> {category.label}
        </div>

        {/* Special achievements */}
        {isNewPeak && (
          <div className="rating-achievement">
            🏆 New Peak Rating!
          </div>
        )}

        {becameEstablished && (
          <div className="rating-achievement">
            ⭐ Rating is now established (10+ games)
          </div>
        )}

        {/* Additional stats */}
        <div className="rating-stats">
          <div className="rating-stat-item">
            <span className="rating-stat-label">Games Played</span>
            <span className="rating-stat-value">{games_played}</span>
          </div>
          <div className="rating-stat-item">
            <span className="rating-stat-label">Expected Win %</span>
            <span className="rating-stat-value">
              {expected_score ? Math.round(expected_score * 100) : 50}%
            </span>
          </div>
          <div className="rating-stat-item">
            <span className="rating-stat-label">Peak Rating</span>
            <span className="rating-stat-value">{peak_rating}</span>
          </div>
        </div>

        {/* Pro tip */}
        {is_provisional && (
          <div className="rating-tip">
            💡 Play {10 - games_played} more game{10 - games_played === 1 ? '' : 's'} to establish your rating
          </div>
        )}
      </div>
    </div>
  );
};

export default RatingChangeNotification;
