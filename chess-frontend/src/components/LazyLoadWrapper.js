import React, { Suspense, Component } from 'react';

// Error boundary for lazy-loaded components
class LazyLoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    // Check if it's a chunk loading error
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return { hasError: true };
    }
    return { hasError: false };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LazyLoad Error:', error, errorInfo);

    // Only retry chunk load errors up to 3 times
    if (this.state.retryCount < 3 &&
        (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk'))) {
      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          retryCount: prevState.retryCount + 1
        }));
      }, 2000 * (this.state.retryCount + 1)); // Exponential backoff: 2s, 4s, 6s
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.retryCount < 3) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg mb-2">Loading component...</p>
              <p className="text-gray-500 text-sm">Retry attempt {this.state.retryCount + 1} of 3</p>
            </div>
          </div>
        );
      }

      // Final error state after 3 retries
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
          <div className="text-center p-8 max-w-md">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Unable to Load Component
            </h2>
            <p className="text-gray-600 mb-4">
              We're having trouble loading this page. This might be due to a network issue or an outdated browser cache.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  // Clear cache and reload
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  window.location.reload();
                }}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Cache & Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for lazy-loaded components
export const LazyLoadWrapper = ({ children, fallback = null }) => {
  const defaultFallback = (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-50 to-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    </div>
  );

  return (
    <LazyLoadErrorBoundary>
      <Suspense fallback={fallback || defaultFallback}>
        {children}
      </Suspense>
    </LazyLoadErrorBoundary>
  );
};

export default LazyLoadWrapper;