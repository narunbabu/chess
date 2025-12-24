// src/components/game/PerformanceDisplay.jsx
import React from 'react';

/**
 * PerformanceDisplay Component
 * Displays performance metrics for rated games
 *
 * @param {Object} props
 * @param {Object} props.performanceData - Performance data from API
 * @param {boolean} props.showRealtime - Whether to show real-time updates
 * @param {boolean} props.compact - Whether to show compact view
 */
const PerformanceDisplay = ({ performanceData, showRealtime = false, compact = false }) => {
  if (!performanceData) {
    return null;
  }

  const {
    performance_score = 0,
    move_accuracy = 0,
    acpl = 0,
    brilliant_moves = 0,
    excellent_moves = 0,
    good_moves = 0,
    inaccuracies = 0,
    mistakes = 0,
    blunders = 0,
    grade = 'Average',
    feedback_message = ''
  } = performanceData;

  // Calculate color based on performance score
  const getPerformanceColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Calculate progress bar color
  const getProgressBarColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Calculate grade color
  const getGradeColor = (grade) => {
    if (grade === 'Excellent') return 'bg-green-100 text-green-800';
    if (grade === 'Strong') return 'bg-blue-100 text-blue-800';
    if (grade === 'Average') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (compact) {
    return (
      <div className="performance-display-compact bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold {getPerformanceColor(performance_score)}">
              {performance_score.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">
              <div className="font-medium">Performance Score</div>
              <div className="text-xs">{grade}</div>
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            {brilliant_moves > 0 && <span title="Brilliant moves">💎 {brilliant_moves}</span>}
            {excellent_moves > 0 && <span title="Excellent moves">⭐ {excellent_moves}</span>}
            {mistakes > 0 && <span title="Mistakes">⚠️ {mistakes}</span>}
            {blunders > 0 && <span title="Blunders">❌ {blunders}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-display bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800">Performance Metrics</h3>
        {showRealtime && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
            Live
          </span>
        )}
      </div>

      {/* Performance Score Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">Performance Score</label>
          <span className={`text-2xl font-bold ${getPerformanceColor(performance_score)}`}>
            {performance_score.toFixed(1)}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full ${getProgressBarColor(performance_score)} transition-all duration-500`}
            style={{ width: `${Math.min(performance_score, 100)}%` }}
          ></div>
        </div>
        {grade && (
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(grade)}`}>
              {grade}
            </span>
          </div>
        )}
      </div>

      {/* Move Accuracy and ACPL */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="text-xs font-medium text-gray-600 block mb-1">Move Accuracy</label>
          <div className="text-2xl font-bold text-blue-600">{move_accuracy.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="text-xs font-medium text-gray-600 block mb-1">Avg Centipawn Loss</label>
          <div className="text-2xl font-bold text-purple-600">{acpl.toFixed(1)}</div>
        </div>
      </div>

      {/* Move Quality Breakdown */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mb-3 block">Move Quality</label>
        <div className="grid grid-cols-2 gap-3">
          {/* Positive Moves */}
          <div className="space-y-2">
            {brilliant_moves > 0 && (
              <div className="flex items-center justify-between bg-purple-50 rounded px-3 py-2">
                <span className="text-sm text-gray-700">💎 Brilliant</span>
                <span className="text-sm font-bold text-purple-600">{brilliant_moves}</span>
              </div>
            )}
            {excellent_moves > 0 && (
              <div className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                <span className="text-sm text-gray-700">⭐ Excellent</span>
                <span className="text-sm font-bold text-green-600">{excellent_moves}</span>
              </div>
            )}
            {good_moves > 0 && (
              <div className="flex items-center justify-between bg-blue-50 rounded px-3 py-2">
                <span className="text-sm text-gray-700">✓ Good</span>
                <span className="text-sm font-bold text-blue-600">{good_moves}</span>
              </div>
            )}
          </div>

          {/* Negative Moves */}
          <div className="space-y-2">
            {inaccuracies > 0 && (
              <div className="flex items-center justify-between bg-yellow-50 rounded px-3 py-2">
                <span className="text-sm text-gray-700">⚡ Inaccuracy</span>
                <span className="text-sm font-bold text-yellow-600">{inaccuracies}</span>
              </div>
            )}
            {mistakes > 0 && (
              <div className="flex items-center justify-between bg-orange-50 rounded px-3 py-2">
                <span className="text-sm text-gray-700">⚠️ Mistake</span>
                <span className="text-sm font-bold text-orange-600">{mistakes}</span>
              </div>
            )}
            {blunders > 0 && (
              <div className="flex items-center justify-between bg-red-50 rounded px-3 py-2">
                <span className="text-sm text-gray-700">❌ Blunder</span>
                <span className="text-sm font-bold text-red-600">{blunders}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback_message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">💡 Tip:</span> {feedback_message}
          </p>
        </div>
      )}
    </div>
  );
};

export default PerformanceDisplay;
