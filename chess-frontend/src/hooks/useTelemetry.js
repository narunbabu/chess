// src/hooks/useTelemetry.js
import { useCallback } from 'react';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';

/**
 * Telemetry hook for analytics and tracking
 * Currently a no-op placeholder
 * Will be activated when TELEMETRY feature flag is enabled (PR-7)
 *
 * @returns {object} Telemetry functions
 */
export const useTelemetry = () => {
  const { isEnabled } = useFeatureFlags();

  /**
   * Track an event
   * @param {string} eventName - Name of the event
   * @param {object} properties - Event properties
   */
  const trackEvent = useCallback((eventName, properties = {}) => {
    if (!isEnabled('TELEMETRY')) {
      // No-op when telemetry is disabled
      return;
    }

    // Future implementation will send to analytics service
    console.log('[Telemetry]', eventName, properties);
  }, [isEnabled]);

  /**
   * Track a page view
   * @param {string} pageName - Name of the page
   * @param {object} properties - Page properties
   */
  const trackPageView = useCallback((pageName, properties = {}) => {
    if (!isEnabled('TELEMETRY')) {
      return;
    }

    console.log('[Telemetry] Page View:', pageName, properties);
  }, [isEnabled]);

  /**
   * Track an error
   * @param {Error} error - Error object
   * @param {object} context - Error context
   */
  const trackError = useCallback((error, context = {}) => {
    if (!isEnabled('TELEMETRY')) {
      return;
    }

    console.error('[Telemetry] Error:', error, context);
  }, [isEnabled]);

  /**
   * Track user interaction
   * @param {string} element - UI element interacted with
   * @param {object} properties - Interaction properties
   */
  const trackInteraction = useCallback((element, properties = {}) => {
    if (!isEnabled('TELEMETRY')) {
      return;
    }

    console.log('[Telemetry] Interaction:', element, properties);
  }, [isEnabled]);

  return {
    trackEvent,
    trackPageView,
    trackError,
    trackInteraction,
  };
};

export default useTelemetry;
