import React, { useState, useRef, useCallback } from 'react';
import matchmakingService from '../../services/matchmakingService';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

/**
 * FriendSearch — Debounced user search for challenging specific players
 */
const FriendSearch = ({ onChallenge }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  const handleSearch = useCallback((value) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await matchmakingService.searchUsers(value.trim());
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[FriendSearch] Error:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  return (
    <div className="friend-search">
      <div className="friend-search-input-wrapper">
        <span className="friend-search-icon">🔍</span>
        <input
          type="text"
          className="friend-search-input"
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {isSearching && <span className="friend-search-spinner">⟳</span>}
      </div>

      {results.length > 0 && (
        <div className="friend-search-results">
          {results.map((player) => (
            <div key={player.id} className="unified-card horizontal" style={{ marginBottom: '8px' }}>
              <img
                src={
                  getPlayerAvatar(player) ||
                  `https://i.pravatar.cc/150?u=${player.email || `user${player.id}`}`
                }
                alt={player.name}
                className="unified-card-avatar"
              />
              <div className="unified-card-content">
                <h3 className="unified-card-title">{player.name}</h3>
                <p className="unified-card-info">Rating: {player.rating || 1200}</p>
              </div>
              <div className="unified-card-actions">
                <button
                  className="unified-card-btn primary"
                  onClick={() => onChallenge(player)}
                >
                  Challenge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !isSearching && results.length === 0 && (
        <p className="friend-search-empty">No players found matching "{query}"</p>
      )}
    </div>
  );
};

export default FriendSearch;
