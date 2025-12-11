// src/hooks/useActiveGame.js
import { useState, useEffect } from 'react';
import { useAppData } from '../contexts/AppDataContext';

/**
 * Hook to get the user's active multiplayer game
 * Reads from cached game history in AppDataContext (no API calls)
 *
 * @returns {Object|null} Active game object or null if no active game
 */
export function useActiveGame() {
  const { gameHistory } = useAppData(); // Read from cache, no API calls
  const [activeGame, setActiveGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Derive active game from existing cached game history
    if (gameHistory && gameHistory.length > 0) {
      // Find first game with status 'in_progress' or 'active'
      const active = gameHistory.find(
        (game) => game.status === 'in_progress' || game.status === 'active'
      );

      setActiveGame(active || null);
      console.log('[useActiveGame] Active game from cache:', active ? `Game #${active.id}` : 'None');
    } else {
      setActiveGame(null);
    }
    setLoading(false);
  }, [gameHistory]); // Only re-calculate when gameHistory changes

  return { activeGame, loading };
}
