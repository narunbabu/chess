// src/contexts/FeatureFlagsContext.js
import React, { createContext, useContext, useState } from 'react';

/**
 * Feature flags for progressive rollout
 * All flags default to false for safety
 */
const DEFAULT_FLAGS = {
  AUTH_GATES: false,        // PR-2: Auth-gated routing
  NEW_LANDING: false,       // PR-3: Redesigned landing page
  NEW_DASHBOARD: false,     // Future: Enhanced dashboard
  TELEMETRY: false,         // PR-7: Analytics and tracking
  EXPERIMENTAL: false,      // General experimental features

  // Game Optimization Flags (Action 1)
  GAME_OPT_COMPACT_MODE: true,     // Enable compact formats and reduced payloads
  GAME_OPT_WEBSOCKET_OPT: true,     // Enable WebSocket optimizations
  GAME_OPT_CLIENT_TIMER: true,     // Enable client-side timer batching
  GAME_OPT_COMPRESSION: true,      // Enable message compression
};

const FeatureFlagsContext = createContext(null);

export const FeatureFlagsProvider = ({ children, initialFlags = {} }) => {
  const [flags, setFlags] = useState({
    ...DEFAULT_FLAGS,
    ...initialFlags,
  });

  /**
   * Enable a specific feature flag
   * @param {string} flagName - Name of the flag to enable
   */
  const enableFlag = (flagName) => {
    setFlags(prev => ({ ...prev, [flagName]: true }));
  };

  /**
   * Disable a specific feature flag
   * @param {string} flagName - Name of the flag to disable
   */
  const disableFlag = (flagName) => {
    setFlags(prev => ({ ...prev, [flagName]: false }));
  };

  /**
   * Toggle a specific feature flag
   * @param {string} flagName - Name of the flag to toggle
   */
  const toggleFlag = (flagName) => {
    setFlags(prev => ({ ...prev, [flagName]: !prev[flagName] }));
  };

  /**
   * Check if a feature flag is enabled
   * @param {string} flagName - Name of the flag to check
   * @returns {boolean} - Whether the flag is enabled
   */
  const isEnabled = (flagName) => {
    return flags[flagName] === true;
  };

  /**
   * Check if any game optimization flags are enabled
   * @returns {boolean} - Whether any optimization is active
   */
  const isAnyGameOptEnabled = () => {
    return flags.GAME_OPT_COMPACT_MODE ||
           flags.GAME_OPT_WEBSOCKET_OPT ||
           flags.GAME_OPT_CLIENT_TIMER ||
           flags.GAME_OPT_COMPRESSION;
  };

  /**
   * Get all game optimization flags as an object
   * @returns {object} - Game optimization flags
   */
  const getGameOptFlags = () => ({
    compactMode: flags.GAME_OPT_COMPACT_MODE,
    websocketOpt: flags.GAME_OPT_WEBSOCKET_OPT,
    clientTimer: flags.GAME_OPT_CLIENT_TIMER,
    compression: flags.GAME_OPT_COMPRESSION,
  });

  const value = {
    flags,
    enableFlag,
    disableFlag,
    toggleFlag,
    isEnabled,
    isAnyGameOptEnabled,
    getGameOptFlags,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

/**
 * Hook to access feature flags
 * @returns {object} Feature flags context
 */
export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
};

export default FeatureFlagsContext;
