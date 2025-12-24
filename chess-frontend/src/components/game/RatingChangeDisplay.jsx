// src/components/game/RatingChangeDisplay.jsx
import React, { useState } from 'react';

/**
 * RatingChangeDisplay Component
 * Displays rating changes after a rated game with detailed breakdown
 *
 * @param {Object} props
 * @param {number} props.ratingChange - The rating change (+/-)
 * @param {number} props.performanceScore - Performance score (0-100)
 * @param {number} props.oldRating - Rating before the game
 * @param {number} props.newRating - Rating after the game
 * @param {Object} props.ratingDetails - Additional rating calculation details
 */
const RatingChangeDisplay = ({
  ratingChange,
  performanceScore = 0,
  oldRating,
  newRating,
  ratingDetails = {}
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (ratingChange === undefined || ratingChange === null) {
    return null;
  }

  const isPositive = ratingChange > 0;
  const isNeutral = ratingChange === 0;

  const performanceModifier = ratingDetails.performance_modifier || (0.5 + performanceScore / 100);
  const baseChange = ratingDetails.base_rating_change || 0;
  const kFactor = ratingDetails.k_factor || 24;
  const expectedScore = ratingDetails.expected_score || 0.5;
  const actualScore = ratingDetails.actual_score || 0.5;

  // Get color classes based on rating change
  const getChangeColor = () => {
    if (isPositive) return 'text-green-600 bg-green-50 border-green-200';
    if (isNeutral) return 'text-gray-600 bg-gray-50 border-gray-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getIconColor = () => {
    if (isPositive) return 'bg-green-100';
    if (isNeutral) return 'bg-gray-100';
    return 'bg-red-100';
  };

  return (
    <div className="rating-change-display bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Rating Update</h3>
        <p className="text-sm text-gray-600">Your performance in this rated game</p>
      </div>

      {/* Main Rating Change Display */}
      <div className={`rounded-lg border-2 p-6 mb-6 ${getChangeColor()}`}>
        <div className="flex items-center justify-center gap-4">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-full ${getIconColor()} flex items-center justify-center`}>
            <span className="text-3xl">
              {isPositive ? '📈' : isNeutral ? '➡️' : '📉'}
            </span>
          </div>

          {/* Rating Change */}
          <div className="text-center">
            <div className="text-5xl font-bold mb-1">
              {isPositive ? '+' : ''}{ratingChange.toFixed(0)}
            </div>
            <div className="text-sm font-medium opacity-80">Rating Change</div>
          </div>
        </div>
      </div>

      {/* Before and After */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Previous</div>
          <div className="text-2xl font-bold text-gray-700">{oldRating}</div>
        </div>
        <div className="flex items-center justify-center">
          <span className="text-2xl">→</span>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">New Rating</div>
          <div className="text-2xl font-bold text-blue-600">{newRating}</div>
        </div>
      </div>

      {/* Performance Score */}
      <div className="bg-purple-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Performance Score</div>
            <div className="text-xs text-gray-600">Affects rating change multiplier</div>
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {performanceScore.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Show Breakdown Button */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <span>{showBreakdown ? '▲' : '▼'}</span>
        <span>{showBreakdown ? 'Hide' : 'Show'} Calculation Details</span>
      </button>

      {/* Detailed Breakdown */}
      {showBreakdown && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
          <h4 className="text-sm font-bold text-gray-800 mb-3">Rating Calculation Breakdown</h4>

          {/* Formula Explanation */}
          <div className="text-xs text-gray-600 bg-white rounded p-3 mb-3">
            <div className="font-mono font-medium mb-2">
              Final Change = Base ELO × Performance Modifier
            </div>
            <div className="text-gray-500">
              Where Performance Modifier = 0.5 + (Performance Score / 100)
            </div>
          </div>

          {/* Calculation Steps */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">K-Factor</span>
              <span className="font-medium text-gray-800">{kFactor}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Expected Score</span>
              <span className="font-medium text-gray-800">{(expectedScore * 100).toFixed(1)}%</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Actual Score</span>
              <span className="font-medium text-gray-800">{(actualScore * 100).toFixed(1)}%</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Base Rating Change</span>
              <span className="font-medium text-gray-800">
                {baseChange > 0 ? '+' : ''}{baseChange.toFixed(1)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-600">Performance Modifier</span>
              <span className="font-medium text-gray-800">{performanceModifier.toFixed(2)}x</span>
            </div>

            <div className="flex justify-between items-center py-3 bg-blue-50 rounded px-3 mt-2">
              <span className="font-bold text-gray-800">Final Rating Change</span>
              <span className="font-bold text-blue-600 text-lg">
                {isPositive ? '+' : ''}{ratingChange.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
            <p>💡 <strong>Tip:</strong> Your performance score directly affects how much your rating changes. Play better to maximize your rating gains!</p>
          </div>
        </div>
      )}

      {/* Motivational Message */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          {isPositive
            ? '🎉 Great game! Keep up the excellent performance!'
            : isNeutral
            ? '➡️ Your rating remains unchanged. Keep practicing!'
            : '💪 Don\'t give up! Learn from this game and come back stronger!'}
        </p>
      </div>
    </div>
  );
};

export default RatingChangeDisplay;
