// src/components/routing/RouteGuard.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useTelemetry } from '../../hooks/useTelemetry';

/**
 * RouteGuard wrapper for protected routes
 * Currently transparent pass-through
 * Will be activated when AUTH_GATES feature flag is enabled (PR-2)
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {boolean} props.requireAuth - Whether route requires authentication
 * @param {string} props.redirectTo - Where to redirect if auth check fails
 */
const RouteGuard = ({
  children,
  requireAuth = false,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, loading } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { trackEvent } = useTelemetry();
  const location = useLocation();

  // Feature flag check - if AUTH_GATES is disabled, always allow access
  const authGatesEnabled = isEnabled('AUTH_GATES');

  // If auth gates are disabled, pass through (Phase 1 behavior)
  if (!authGatesEnabled) {
    return <>{children}</>;
  }

  // Loading state - show nothing while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth check - redirect if required auth is missing
  if (requireAuth && !isAuthenticated) {
    // Track unauthorized access attempt
    trackEvent('route_guard_blocked', {
      path: location.pathname,
      redirectTo,
      reason: 'not_authenticated',
    });

    // Redirect to login with return URL
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Track successful route access
  trackEvent('route_guard_passed', {
    path: location.pathname,
    requireAuth,
    authenticated: isAuthenticated,
  });

  // Render children if all checks pass
  return <>{children}</>;
};

export default RouteGuard;
