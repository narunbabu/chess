import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import { getGameHistories } from '../services/gameHistoryService';

// Debug utility
const DEBUG_MODE = process.env.REACT_APP_DEBUG === 'true' ||
                  process.env.NODE_ENV === 'development' && localStorage.getItem('debug') === 'true';

const debugLog = (component, message, ...args) => {
  if (DEBUG_MODE || localStorage.getItem(`debug_${component}`) === 'true') {
    console.log(`[${component}] ${message}`, ...args);
  }
};

const AppDataContext = createContext();

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}

export function AppDataProvider({ children }) {
  const [gameHistory, setGameHistory] = useState(null);

  // In-flight request tracking to prevent duplicate fetches
  const historyRequestRef = useRef(null);

  // NOTE: User data fetching removed - AuthContext is the single source of truth for user data
  // This prevents duplicate /user API calls

  /**
   * Get game history with caching and deduplication
   * @param {boolean} forceRefresh - Force a fresh fetch even if cached
   * @returns {Promise<Array>} Game history data
   */
  const getGameHistory = useCallback(async (forceRefresh = false) => {
    debugLog('AppData', `🔄 getGameHistory called, forceRefresh: ${forceRefresh}`);

    // Only trace in deep debug mode
    if (DEBUG_MODE && localStorage.getItem('debug_traces') === 'true') {
      console.trace('[AppData] 📍 getGameHistory call stack');
    }

    // Return cached if available and not forcing refresh
    if (gameHistory && !forceRefresh) {
      debugLog('AppData', '📦 Returning cached game history');
      return gameHistory;
    }

    // If already fetching, wait for that request
    if (historyRequestRef.current) {
      debugLog('AppData', '⏳ Game history fetch already in-flight, waiting...');
      return historyRequestRef.current;
    }

    debugLog('AppData', '🚀 Fetching game history');
    historyRequestRef.current = getGameHistories()
      .then(data => {
        setGameHistory(data);
        debugLog('AppData', `Game history cached: ${data?.length} games`);
        return data;
      })
      .catch(err => {
        console.error('[AppData] Failed to fetch game history:', err);
        throw err;
      })
      .finally(() => {
        historyRequestRef.current = null;
      });

    return historyRequestRef.current;
  }, [gameHistory]); // Memoize with gameHistory dependency

  /**
   * Invalidate cache for game history
   */
  const invalidateGameHistory = useCallback(() => {
    debugLog('AppData', 'Invalidating game history cache');
    setGameHistory(null);
  }, []); // No dependencies needed

  const value = {
    // Data
    gameHistory,

    // Fetchers
    getGameHistory,

    // Cache invalidation
    invalidateGameHistory,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}
