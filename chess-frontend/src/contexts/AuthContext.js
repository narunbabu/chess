// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react";
import api from '../services/api';
import { initEcho, disconnectEcho } from '../services/echoSingleton';
import presenceService from '../services/presenceService';
import userStatusService from '../services/userStatusService';
import { logger } from '../utils/logger';

// Create the AuthContext
const AuthContext = createContext(null);

// AuthProvider component – wrap your app with this provider
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user data
  const fetchUser = useCallback(async () => {
    try {
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

      setUser(response.data);
      setIsAuthenticated(true);

      // Initialize Echo singleton after successful auth
      const wsConfig = {
        key: process.env.REACT_APP_REVERB_APP_KEY,
        wsHost: process.env.REACT_APP_REVERB_HOST || 'localhost',
        wsPort: parseInt(process.env.REACT_APP_REVERB_PORT) || 8080,
        scheme: process.env.REACT_APP_REVERB_SCHEME || 'http',
      };

      logger.debug('Auth', 'Initializing WebSocket connection');
      const echoInstance = initEcho({ token, wsConfig });
      if (echoInstance) {
        logger.websocket('initialized', 'Echo singleton ready');

        // Initialize presence service after Echo is ready
        try {
          const presenceInitialized = await presenceService.initialize(response.data, token);
          if (presenceInitialized) {
            console.log('[Auth] ✅ Presence service initialized successfully');
          } else {
            console.warn('[Auth] ⚠️ Presence service initialization returned false');
          }
        } catch (presenceError) {
          console.error('[Auth] ❌ Presence service initialization failed:', presenceError);
        }

        // Initialize database-backed user status service
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
        console.error('[Auth] ❌ Echo singleton initialization failed!');
      }

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
  }, []);

  // Check for token presence when the provider mounts
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Login handled via social auth callbacks
  const login = useCallback(async (token) => {
    localStorage.setItem("auth_token", token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setIsAuthenticated(true);
    await fetchUser();
  }, [fetchUser]);

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
    fetchUser
  }), [isAuthenticated, user, login, logout, loading, fetchUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
