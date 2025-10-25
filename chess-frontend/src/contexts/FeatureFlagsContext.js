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

  const value = {
    flags,
    enableFlag,
    disableFlag,
    toggleFlag,
    isEnabled,
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
