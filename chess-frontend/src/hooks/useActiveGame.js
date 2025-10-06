// src/hooks/useActiveGame.js
import { useState, useEffect } from 'react';
import { useAppData } from '../contexts/AppDataContext';

/**
 * Hook to get the user's active multiplayer game
 * Uses cached game history from AppDataContext (no forced refresh)
 *
 * @returns {Object|null} Active game object or null if no active game
 */
export function useActiveGame() {
  const { getGameHistory } = useAppData();
  const [activeGame, setActiveGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchActiveGame = async () => {
      try {
        // ✅ USE EXISTING CACHE (don't force refresh)
        const games = await getGameHistory(false);

        if (isMounted && games && games.length > 0) {
          // Find first game with status 'in_progress' or 'active'
          const active = games.find(
            (game) => game.status === 'in_progress' || game.status === 'active'
          );

          setActiveGame(active || null);
          console.log('[useActiveGame] Active game:', active ? `Game #${active.id}` : 'None');
        }
      } catch (error) {
        console.error('[useActiveGame] Error fetching active game:', error);
        setActiveGame(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchActiveGame();

    return () => {
      isMounted = false;
    };
  }, [getGameHistory]);

  return { activeGame, loading };
}
