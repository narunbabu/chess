// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from "react";
import api from '../services/api';
import { initEcho } from '../services/echoSingleton';

// Create the AuthContext
const AuthContext = createContext(null);

// AuthProvider component – wrap your app with this provider
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user data
  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.log('[Auth] No auth token found');
        setLoading(false);
        return;
      }

      console.log('[Auth] Fetching user with token:', token.substring(0, 10) + '...');

      // Set token in API headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Fetch current user from backend
      const response = await api.get('/user');
      console.log('[Auth] User fetched successfully:', response.data);
      setUser(response.data);
      setIsAuthenticated(true);

      // Initialize Echo singleton after successful auth
      const wsConfig = {
        key: process.env.REACT_APP_REVERB_APP_KEY,
        wsHost: process.env.REACT_APP_REVERB_HOST || 'localhost',
        wsPort: parseInt(process.env.REACT_APP_REVERB_PORT) || 8080,
        scheme: process.env.REACT_APP_REVERB_SCHEME || 'http',
      };

      initEcho({ token, wsConfig });
      console.log('[Auth] Echo singleton initialized');

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
  };

  // Check for token presence when the provider mounts
  useEffect(() => {
    fetchUser();
  }, []);

  // Login handled via social auth callbacks
  const login = async (token) => {
    localStorage.setItem("auth_token", token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setIsAuthenticated(true);
    await fetchUser();
  };

  // Logout function
  const logout = async () => {
    localStorage.removeItem("auth_token");
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
