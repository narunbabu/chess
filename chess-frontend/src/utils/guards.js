import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import AuthGateModal from '../components/layout/AuthGateModal';

/**
 * Route guard utility for protecting routes behind authentication
 *
 * Controlled by AUTH_GATES feature flag for safe rollout:
 * - When flag disabled: Pass-through (existing behavior)
 * - When flag enabled: Show AuthGateModal for unauthenticated users
 *
 * CRITICAL: Uses existing AuthContext which handles Echo initialization
 *
 * @param {React.ReactElement} element - The route element to render
 * @param {string} reason - Reason for authentication requirement
 * @returns {React.ReactElement} - Either the element or AuthGateModal
 *
 * @example
 * <Route path="/lobby" element={requireAuth(<LobbyPage />, 'multiplayer')} />
 */
export function requireAuth(element, reason = 'this feature') {
  return <AuthGuard element={element} reason={reason} />;
}

/**
 * Internal component that handles the auth check logic
 * Separated to allow hook usage
 */
function AuthGuard({ element, reason }) {
  const { isAuthenticated, loading } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if auth gates are enabled
  const authGatesEnabled = isEnabled('AUTH_GATES');

  // Feature flag check: if AUTH_GATES disabled, pass through
  if (!authGatesEnabled) {
    return element;
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show auth gate modal
  if (!isAuthenticated) {
    const returnTo = location.pathname + location.search;
    return <AuthGateModal reason={reason} returnTo={returnTo} onClose={() => navigate('/')} />;
  }

  // User is authenticated, render the protected element
  return element;
}

/**
 * Optional: Helper function to check if a specific route requires auth
 * Useful for conditional rendering in navigation components
 *
 * @param {string} path - Route path to check
 * @returns {boolean} - Whether the route requires authentication
 */
export function isProtectedRoute(path) {
  const protectedRoutes = [
    '/lobby',
    '/play/multiplayer',
    '/dashboard',
    '/history',
    '/profile',
  ];

  return protectedRoutes.some((route) => path.startsWith(route));
}

export default requireAuth;
