import React, { createContext, useContext, useState, useRef } from 'react';
import api from '../services/api';
import { getGameHistories } from '../services/gameHistoryService';

const AppDataContext = createContext();

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}

export function AppDataProvider({ children }) {
  const [me, setMe] = useState(null);
  const [gameHistory, setGameHistory] = useState(null);

  // In-flight request tracking to prevent duplicate fetches
  const meRequestRef = useRef(null);
  const historyRequestRef = useRef(null);

  /**
   * Get current user info with caching and deduplication
   * @param {boolean} forceRefresh - Force a fresh fetch even if cached
   * @returns {Promise<Object>} User data
   */
  const getMe = async (forceRefresh = false) => {
    // Return cached if available and not forcing refresh
    if (me && !forceRefresh) {
      console.log('[AppData] Returning cached user');
      return me;
    }

    // If already fetching, wait for that request
    if (meRequestRef.current) {
      console.log('[AppData] User fetch already in-flight, waiting...');
      return meRequestRef.current;
    }

    console.log('[AppData] Fetching user data');
    meRequestRef.current = api.get('/user')
      .then(response => {
        const data = response.data;
        setMe(data);
        console.log('[AppData] User data cached');
        return data;
      })
      .catch(err => {
        console.error('[AppData] Failed to fetch user:', err);
        throw err;
      })
      .finally(() => {
        meRequestRef.current = null;
      });

    return meRequestRef.current;
  };

  /**
   * Get game history with caching and deduplication
   * @param {boolean} forceRefresh - Force a fresh fetch even if cached
   * @returns {Promise<Array>} Game history data
   */
  const getGameHistory = async (forceRefresh = false) => {
    // Return cached if available and not forcing refresh
    if (gameHistory && !forceRefresh) {
      console.log('[AppData] Returning cached game history');
      return gameHistory;
    }

    // If already fetching, wait for that request
    if (historyRequestRef.current) {
      console.log('[AppData] Game history fetch already in-flight, waiting...');
      return historyRequestRef.current;
    }

    console.log('[AppData] Fetching game history');
    historyRequestRef.current = getGameHistories()
      .then(data => {
        setGameHistory(data);
        console.log('[AppData] Game history cached:', data?.length, 'games');
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
  };

  /**
   * Invalidate cache for user data
   */
  const invalidateMe = () => {
    console.log('[AppData] Invalidating user cache');
    setMe(null);
  };

  /**
   * Invalidate cache for game history
   */
  const invalidateGameHistory = () => {
    console.log('[AppData] Invalidating game history cache');
    setGameHistory(null);
  };

  /**
   * Clear all caches
   */
  const clearCache = () => {
    console.log('[AppData] Clearing all caches');
    setMe(null);
    setGameHistory(null);
  };

  const value = {
    // Data
    me,
    gameHistory,

    // Fetchers
    getMe,
    getGameHistory,

    // Cache invalidation
    invalidateMe,
    invalidateGameHistory,
    clearCache,
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}
