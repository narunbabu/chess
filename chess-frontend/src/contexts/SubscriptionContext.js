import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [plans, setPlans] = useState({});
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available plans (public endpoint)
  const fetchPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      setPlansError(null);
      const response = await api.get('/subscriptions/plans');
      setPlans(response.data.plans || {});
    } catch (err) {
      console.error('[Subscription] Failed to fetch plans:', err);
      setPlansError('Unable to load subscription plans. Please try again.');
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // Fetch current subscription (requires auth)
  const fetchCurrentSubscription = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await api.get('/subscriptions/current');
      setCurrentSubscription(response.data);
    } catch (err) {
      console.error('[Subscription] Failed to fetch current subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initiate checkout
  const checkout = useCallback(async (planId) => {
    setError(null);

    try {
      setLoading(true);
      const response = await api.post('/subscriptions/checkout', { plan_id: planId });
      const data = response.data;

      // In mock mode, the subscription is auto-completed
      if (data.auto_completed && data.subscription) {
        setCurrentSubscription(data.subscription);
      }

      return data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Checkout failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    setError(null);

    try {
      setLoading(true);
      const response = await api.post('/subscriptions/cancel');
      // Refresh current subscription after cancellation
      await fetchCurrentSubscription();
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Cancellation failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentSubscription]);

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Fetch subscription when auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentSubscription();
    } else {
      setCurrentSubscription(null);
    }
  }, [isAuthenticated, fetchCurrentSubscription]);

  // Derive tier from user or subscription data
  const currentTier = useMemo(() => {
    return currentSubscription?.tier || user?.subscription_tier || 'free';
  }, [currentSubscription, user]);

  const isPremium = useMemo(() => {
    return currentTier === 'premium' || currentTier === 'pro';
  }, [currentTier]);

  const isPro = useMemo(() => {
    return currentTier === 'pro';
  }, [currentTier]);

  const value = useMemo(() => ({
    plans,
    plansLoading,
    plansError,
    currentSubscription,
    currentTier,
    isPremium,
    isPro,
    loading,
    error,
    checkout,
    cancelSubscription,
    fetchPlans,
    fetchCurrentSubscription,
  }), [plans, plansLoading, plansError, currentSubscription, currentTier, isPremium, isPro, loading, error, checkout, cancelSubscription, fetchPlans, fetchCurrentSubscription]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
