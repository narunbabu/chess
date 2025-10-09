/**
 * Analytics Utility for Chess99
 *
 * Provides a unified tracking interface for user events and analytics.
 * Integrates with Google Analytics (gtag) when available.
 * Non-blocking and non-invasive implementation.
 *
 * Usage:
 *   import { track } from '../utils/analytics';
 *   track('button_click', { button: 'play_computer', location: 'landing_page' });
 */

/**
 * Track a user event
 *
 * @param {string} event - Event name (e.g., 'login_success', 'game_started')
 * @param {object} payload - Additional event data (e.g., { method: 'email', location: 'auth_gate' })
 *
 * @example
 * track('auth_action', { action: 'login', method: 'email' });
 * track('navigation', { from: 'landing', to: 'play' });
 * track('game_action', { action: 'start', mode: 'multiplayer' });
 */
export const track = (event, payload = {}) => {
  try {
    // Google Analytics Integration (if available)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, payload);
    }

    // Development Console Logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, payload);
    }

    // Future integrations can be added here:
    // - Mixpanel: mixpanel.track(event, payload)
    // - Amplitude: amplitude.getInstance().logEvent(event, payload)
    // - Custom analytics endpoint: fetch('/api/analytics', { method: 'POST', ... })
  } catch (error) {
    // Silent fail - analytics should never break the app
    if (process.env.NODE_ENV === 'development') {
      console.error('[Analytics] Error tracking event:', error);
    }
  }
};

/**
 * Track page view
 *
 * @param {string} pageName - Page identifier
 * @param {object} metadata - Additional page metadata
 *
 * @example
 * trackPageView('landing', { referrer: document.referrer });
 */
export const trackPageView = (pageName, metadata = {}) => {
  track('page_view', {
    page_name: pageName,
    page_location: window.location.href,
    page_path: window.location.pathname,
    ...metadata
  });
};

/**
 * Track authentication events
 *
 * @param {string} action - Auth action (login, register, logout)
 * @param {string} method - Auth method (email, google, github)
 * @param {object} metadata - Additional metadata
 *
 * @example
 * trackAuth('login', 'email');
 * trackAuth('register', 'google');
 */
export const trackAuth = (action, method, metadata = {}) => {
  track('auth_action', {
    action,
    method,
    ...metadata
  });
};

/**
 * Track navigation events
 *
 * @param {string} destination - Navigation destination
 * @param {string} source - Navigation source
 * @param {object} metadata - Additional metadata
 *
 * @example
 * trackNavigation('dashboard', 'header');
 * trackNavigation('game', 'resume_button', { gameId: 123 });
 */
export const trackNavigation = (destination, source, metadata = {}) => {
  track('navigation', {
    destination,
    source,
    ...metadata
  });
};

/**
 * Track game events
 *
 * @param {string} action - Game action (start, resume, complete)
 * @param {string} mode - Game mode (computer, multiplayer)
 * @param {object} metadata - Additional metadata
 *
 * @example
 * trackGame('start', 'computer');
 * trackGame('resume', 'multiplayer', { gameId: 123 });
 */
export const trackGame = (action, mode, metadata = {}) => {
  track('game_action', {
    action,
    mode,
    ...metadata
  });
};

/**
 * Track social/lobby events
 *
 * @param {string} action - Social action (challenge_sent, invitation_accepted)
 * @param {object} metadata - Additional metadata
 *
 * @example
 * trackSocial('challenge_sent', { playerId: 456 });
 * trackSocial('invitation_accepted', { gameId: 789 });
 */
export const trackSocial = (action, metadata = {}) => {
  track('social_action', {
    action,
    ...metadata
  });
};

/**
 * Track UI interactions
 *
 * @param {string} element - UI element identifier
 * @param {string} action - Action performed (click, hover, etc.)
 * @param {object} metadata - Additional metadata
 *
 * @example
 * trackUI('feature_card', 'click', { feature: 'puzzles' });
 * trackUI('cta_button', 'click', { button: 'play_computer' });
 */
export const trackUI = (element, action, metadata = {}) => {
  track('ui_interaction', {
    element,
    action,
    ...metadata
  });
};

const analytics = {
  track,
  trackPageView,
  trackAuth,
  trackNavigation,
  trackGame,
  trackSocial,
  trackUI
};

export default analytics;
