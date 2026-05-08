import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const defaultState = {
  loading: false,
  error: null,
  summary: null,
  capabilities: {},
  limits: {},
  effectiveTier: 'free',
  personalTier: 'free',
  school: null,
  can: () => false,
  refreshEntitlements: async () => {},
};

const EntitlementContext = createContext(defaultState);

export const EntitlementProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshEntitlements = useCallback(async () => {
    if (!isAuthenticated) {
      setSummary(null);
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/entitlements/me');
      const nextSummary = response.data?.data || null;
      setSummary(nextSummary);
      return nextSummary;
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to load feature access.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshEntitlements();
  }, [refreshEntitlements, user?.subscription_tier, user?.organization_id]);

  const capabilities = summary?.capabilities || {};
  const limits = summary?.limits || {};

  const can = useCallback((capability) => {
    return Boolean(capabilities?.[capability]);
  }, [capabilities]);

  const value = useMemo(() => ({
    loading,
    error,
    summary,
    capabilities,
    limits,
    effectiveTier: summary?.effective_tier || user?.subscription_tier || 'free',
    personalTier: summary?.personal_tier || user?.subscription_tier || 'free',
    school: summary?.school || null,
    can,
    refreshEntitlements,
  }), [
    loading,
    error,
    summary,
    capabilities,
    limits,
    user?.subscription_tier,
    can,
    refreshEntitlements,
  ]);

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlements = () => useContext(EntitlementContext);

