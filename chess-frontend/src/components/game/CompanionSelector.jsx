// src/components/game/CompanionSelector.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * CompanionSelector Component
 * Displays available synthetic players as companions for learning mode
 *
 * @param {Object} props
 * @param {Function} props.onSelect - Callback when companion is selected
 * @param {Object} props.selectedCompanion - Currently selected companion
 * @param {boolean} props.disabled - Whether selection is disabled
 */
const CompanionSelector = ({ onSelect, selectedCompanion, disabled = false }) => {
  const [companions, setCompanions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCompanions();
  }, []);

  const fetchCompanions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/v1/synthetic-players');
      setCompanions(response.data.data || response.data);
    } catch (err) {
      console.error('[CompanionSelector] Failed to fetch companions:', err);
      setError('Failed to load companions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="companion-selector p-6 bg-gray-50 rounded-lg">
        <div className="text-center text-gray-500">Loading companions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="companion-selector p-6 bg-red-50 rounded-lg">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  // Group companions by level for easier selection
  const groupedCompanions = {
    'Beginner Friendly': companions.filter(c => c.computer_level <= 6),
    'Intermediate': companions.filter(c => c.computer_level >= 7 && c.computer_level <= 10),
    'Advanced': companions.filter(c => c.computer_level >= 11),
  };

  const getPersonalityEmoji = (personality) => {
    const map = {
      'Aggressive': '⚔️',
      'Defensive': '🛡️',
      'Balanced': '⚖️',
      'Tactical': '🎯',
      'Positional': '📐',
    };
    return map[personality] || '🤖';
  };

  return (
    <div className="companion-selector">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Choose Your Companion</h3>
        <p className="text-sm text-gray-600">Select an AI companion to help you during the game</p>
      </div>

      {Object.entries(groupedCompanions).map(([groupName, group]) => (
        group.length > 0 && (
          <div key={groupName} className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 px-2">{groupName}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {group.map((companion) => (
                <button
                  key={companion.id}
                  onClick={() => !disabled && onSelect(companion)}
                  disabled={disabled}
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-200 text-left
                    ${selectedCompanion?.id === companion.id
                      ? 'border-purple-500 bg-purple-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                      {companion.name?.charAt(0) || 'A'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{companion.name}</div>
                      <div className="text-xs text-gray-500">Level {companion.computer_level}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {getPersonalityEmoji(companion.personality)} {companion.personality}
                    </span>
                    <span className="font-semibold text-purple-600">{companion.rating}</span>
                  </div>
                  {companion.bio && (
                    <div className="text-xs text-gray-500 mt-2 line-clamp-2">{companion.bio}</div>
                  )}
                  {selectedCompanion?.id === companion.id && (
                    <div className="mt-2 text-center">
                      <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded-full">
                        Selected
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
};

export default CompanionSelector;
