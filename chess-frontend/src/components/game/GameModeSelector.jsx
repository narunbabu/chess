// src/components/game/GameModeSelector.jsx
import React from 'react';

/**
 * GameModeSelector Component
 * Allows users to select between Rated and Casual game modes
 *
 * @param {Object} props
 * @param {string} props.selectedMode - Currently selected mode ('rated' or 'casual')
 * @param {Function} props.onModeChange - Callback when mode changes
 * @param {boolean} props.disabled - Whether the selector is disabled
 */
const GameModeSelector = ({ selectedMode, onModeChange, disabled = false }) => {
  return (
    <div className="game-mode-selector mb-6">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Select Game Mode</h3>
        <p className="text-sm text-gray-600">Choose how this game will affect your rating</p>
      </div>

      <div className="flex gap-4 max-w-2xl mx-auto">
        {/* Rated Mode Button */}
        <button
          onClick={() => !disabled && onModeChange('rated')}
          disabled={disabled}
          className={`
            flex-1 p-6 rounded-lg border-2 transition-all duration-200
            ${selectedMode === 'rated'
              ? 'border-yellow-500 bg-yellow-50 shadow-lg'
              : 'border-gray-300 bg-white hover:border-yellow-300 hover:shadow-md'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex flex-col items-center">
            <div className="text-4xl mb-3">⚔️</div>
            <div className="text-xl font-bold text-gray-800 mb-2">Rated</div>
            <div className="text-sm text-gray-600 text-center">
              Rating changes based on performance
            </div>
            {selectedMode === 'rated' && (
              <div className="mt-3 px-3 py-1 bg-yellow-500 text-white text-xs rounded-full font-medium">
                Selected
              </div>
            )}
          </div>
        </button>

        {/* Casual Mode Button */}
        <button
          onClick={() => !disabled && onModeChange('casual')}
          disabled={disabled}
          className={`
            flex-1 p-6 rounded-lg border-2 transition-all duration-200
            ${selectedMode === 'casual'
              ? 'border-blue-500 bg-blue-50 shadow-lg'
              : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-md'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex flex-col items-center">
            <div className="text-4xl mb-3">🎮</div>
            <div className="text-xl font-bold text-gray-800 mb-2">Casual</div>
            <div className="text-sm text-gray-600 text-center">
              Practice without rating impact
            </div>
            {selectedMode === 'casual' && (
              <div className="mt-3 px-3 py-1 bg-blue-500 text-white text-xs rounded-full font-medium">
                Selected
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Additional Information */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
          <span>ℹ️</span>
          <span>
            {selectedMode === 'rated'
              ? 'Your performance will be analyzed and your rating will change based on the outcome'
              : 'Play for fun without affecting your rating - perfect for practice!'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameModeSelector;
