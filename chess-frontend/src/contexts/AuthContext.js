// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react";
import api from '../services/api';
import { initEcho, disconnectEcho } from '../services/echoSingleton';
import presenceService from '../services/presenceService';
import userStatusService from '../services/userStatusService';
import { logger } from '../utils/logger';
import { savePendingGame, getPendingGame } from '../services/gameHistoryService';
import { migrateGuestGame } from '../services/unfinishedGameService';
import tacticalApi from '../services/tacticalApi';
import { STORAGE_KEY } from '../components/tactical/tacticalStages';

// Create the AuthContext
const AuthContext = createContext(null);

// AuthProvider component – wrap your app with this provider
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pendingGameSavedRef = React.useRef(false); // Use ref instead of state to avoid re-renders
  const unfinishedGamesMigratedRef = React.useRef(false); // Track if unfinished games have been migrated

  // Migrate guest unfinished games to backend after login
  const migrateGuestUnfinishedGames = useCallback(async () => {
    console.log('[Auth] 🔍 Checking for guest unfinished games to migrate...');

    if (unfinishedGamesMigratedRef.current) {
      console.log('[Auth] ⏭️ Skipping unfinished games migration - already processed');
      return;
    }

    // Set flag IMMEDIATELY to prevent race condition
    unfinishedGamesMigratedRef.current = true;
    console.log('[Auth] 🔒 Set migration ref to true');

    try {
      // Get unfinished games from localStorage (guest games)
      const localStorageKey = 'chess_unfinished_games_guest';
      const guestGamesJson = localStorage.getItem(localStorageKey);

      if (!guestGamesJson) {
        console.log('[Auth] ℹ️ No guest unfinished games found');
        return;
      }

      const guestGames = JSON.parse(guestGamesJson);
      const validGames = guestGames.filter(game => {
        const age = Date.now() - game.savedAt;
        const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days
        return age < ttl && game.gameMode === 'computer'; // Only migrate computer games
      });

      if (validGames.length === 0) {
        console.log('[Auth] ℹ️ No valid guest unfinished games to migrate');
        localStorage.removeItem(localStorageKey);
        return;
      }

      console.log(`[Auth] 📦 Found ${validGames.length} guest unfinished games to migrate`);

      // Migrate each game to backend
      let migratedCount = 0;
      for (const game of validGames) {
        try {
          const success = await migrateGuestGame(game);
          if (success) {
            migratedCount++;
          }
        } catch (error) {
          console.error('[Auth] ❌ Error migrating game:', game.gameId, error);
        }
      }

      console.log(`[Auth] ✅ Migrated ${migratedCount}/${validGames.length} unfinished games`);

      // Clear guest games from localStorage after successful migration
      if (migratedCount > 0) {
        localStorage.removeItem(localStorageKey);
        console.log('[Auth] 🗑️ Cleared guest unfinished games from localStorage');
      }

    } catch (error) {
      console.error('[Auth] ❌ Error migrating guest unfinished games:', error);
      unfinishedGamesMigratedRef.current = false; // Reset flag to allow retry
    }
  }, []);

  // Check for and save any pending games after successful authentication
  const checkAndSavePendingGames = useCallback(async () => {
    console.log('[Auth] 🔍 checkAndSavePendingGames called, ref value:', pendingGameSavedRef.current);
    console.trace('[Auth] 📍 Call stack trace'); // Add trace to see where it's called from

    if (pendingGameSavedRef.current) {
      console.log('[Auth] ⏭️ Skipping pending game save - already processed');
      return;
    }

    // Set flag IMMEDIATELY to prevent race condition
    pendingGameSavedRef.current = true;
    console.log('[Auth] 🔒 Set ref to true to prevent duplicate saves');

    try {
      const pendingGame = getPendingGame();
      if (pendingGame) {
        console.log('[Auth] 📝 Found pending game, attempting to save after authentication...');

        const saveSuccess = await savePendingGame();

        if (saveSuccess) {
          console.log('[Auth] ✅ Pending game saved successfully after login!');
          // ref already set to true above
          // TODO: Show success notification to user
          // Could use a toast notification or temporary banner
        } else {
          console.warn('[Auth] ⚠️ Failed to save pending game, resetting flag for retry');
          pendingGameSavedRef.current = false; // Reset flag to allow retry
          // Game remains in localStorage for future retry attempts
        }
      } else {
        console.log('[Auth] ℹ️ No pending game found');
        // ref already set to true above
      }
    } catch (error) {
      console.error('[Auth] ❌ Error checking for pending games:', error);
      // Keep ref as true to prevent infinite retries on error
    }
  }, []); // No dependencies - this function never changes

  // Fetch current user data
  const fetchUser = useCallback(async () => {
    try {
      console.log('[AuthContext] 🔄 fetchUser called');
      console.trace('[AuthContext] 📍 fetchUser call stack');

      const token = localStorage.getItem("auth_token");
      if (!token) {
        logger.auth('Login', 'No auth token found');
        setLoading(false);
        return;
      }

      logger.auth('Login', 'Fetching user with token');

      // Set token in API headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Fetch current user from backend
      const response = await api.get('/user');
      logger.auth('Login', 'User fetched successfully');

      // Save user to localStorage for userStatusService initialization
      localStorage.setItem('user', JSON.stringify(response.data));

      const userData = response.data;

      // Initialize Echo singleton BEFORE setUser so that GlobalInvitationContext
      // can subscribe to channels immediately when its useEffect fires
      const wsConfig = {
        key: process.env.REACT_APP_REVERB_APP_KEY,
        wsHost: process.env.REACT_APP_REVERB_HOST || 'localhost',
        wsPort: parseInt(process.env.REACT_APP_REVERB_PORT) || 8080,
        scheme: process.env.REACT_APP_REVERB_SCHEME || 'http',
      };

      logger.debug('Auth', 'Initializing WebSocket connection');
      const echoInstance = initEcho({ token, wsConfig });

      // Now set user state — this triggers GlobalInvitationContext's useEffect
      // which will find Echo already initialized via getEcho()
      setUser(userData);
      setIsAuthenticated(true);

      // Check for and save any pending games after successful authentication
      await checkAndSavePendingGames();

      // Migrate guest unfinished games to backend
      await migrateGuestUnfinishedGames();

      // One-time localStorage → server tactical progress sync
      try {
        const localBlob = localStorage.getItem(STORAGE_KEY);
        if (localBlob) {
          const snapshot = JSON.parse(localBlob);
          // Only sync if user has meaningful local progress
          if (snapshot.totalAttempted > 0 || snapshot.totalSolved > 0) {
            const server = await tacticalApi.getProgress().catch(() => null);
            if (!server?.stats || server.stats.total_attempted === 0) {
              await tacticalApi.syncLocalData(snapshot);
              localStorage.removeItem(STORAGE_KEY);
              console.log('[Auth] ✅ Tactical progress synced from localStorage to server');
            }
          }
        }
      } catch (syncErr) {
        console.warn('[Auth] ⚠️ Tactical localStorage sync failed:', syncErr);
      }

      // Presence: always initialize regardless of Echo status.
      // DB write + heartbeat run immediately; if Echo is not ready the
      // WebSocket channel connect is retried internally by presenceService.
      try {
        const presenceInitialized = await presenceService.initialize(response.data, token);
        if (presenceInitialized) {
          console.log('[Auth] ✅ Presence service initialized successfully');
        } else {
          console.warn('[Auth] ⚠️ Presence service initialization returned false (WebSocket retry queued)');
        }
      } catch (presenceError) {
        console.error('[Auth] ❌ Presence service initialization failed:', presenceError);
      }

      if (echoInstance) {
        logger.websocket('initialized', 'Echo singleton ready');

        // Initialize database-backed user status service (requires Echo)
        console.log('[Auth] Initializing user status service...');
        try {
          window.userStatusService = userStatusService; // Expose for debugging
          const statusInitialized = await userStatusService.initialize();
          if (statusInitialized) {
            console.log('[Auth] ✅ User status service initialized successfully');
          } else {
            console.error('[Auth] ❌ User status service initialization failed');
          }
        } catch (statusError) {
          console.error('[Auth] ❌ User status service initialization error:', statusError);
        }
      } else {
        console.warn('[Auth] ⚠️ Echo singleton not available — user status service skipped');
      }

      return userData;
    } catch (error) {
      console.error('[Auth] Failed to fetch user:', error);
      console.error('[Auth] Error details:', error.response?.data);
      // If token is invalid, clear it
      localStorage.removeItem("auth_token");
      delete api.defaults.headers.common['Authorization'];
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [checkAndSavePendingGames, migrateGuestUnfinishedGames]);

  // Check for token presence when the provider mounts
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Login handled via social auth callbacks
  const login = useCallback(async (token) => {
    localStorage.setItem("auth_token", token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setIsAuthenticated(true);
    return await fetchUser();
  }, [fetchUser]);

  // Lightweight user-data patcher – avoids the full fetchUser() round-trip
  // which re-initialises Echo, presence, status services and causes visible remounts.
  const updateUser = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    // Disconnect presence service before logout
    presenceService.disconnect();
    console.log('[Auth] Presence service disconnected on logout');

    // Disconnect user status service
    userStatusService.destroy();
    console.log('[Auth] User status service destroyed on logout');

    // Disconnect Echo WebSocket before logout
    disconnectEcho();
    console.log('[Auth] Echo disconnected on logout');

    // Reset pending game saved flag for next login
    pendingGameSavedRef.current = false;

    localStorage.removeItem("auth_token");
    localStorage.removeItem("user"); // Also remove user data
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    user,
    login,
    logout,
    loading,
    fetchUser,
    updateUser
  }), [isAuthenticated, user, login, logout, loading, fetchUser, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
