import React, { Suspense, Component } from 'react';

// Error boundary for lazy-loaded components
class LazyLoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isChunkError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = error.name === 'ChunkLoadError' ||
      (error.message && error.message.includes('Loading chunk'));
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LazyLoad Error:', error, errorInfo);

    const isChunkError = error.name === 'ChunkLoadError' ||
      (error.message && error.message.includes('Loading chunk'));

    // Only retry chunk load errors up to 3 times
    if (this.state.retryCount < 3 && isChunkError) {
      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          isChunkError: false,
          retryCount: prevState.retryCount + 1
        }));
      }, 2000 * (this.state.retryCount + 1)); // Exponential backoff: 2s, 4s, 6s
    }
  }

  render() {
    if (this.state.hasError) {
      // Chunk load errors: show retry UI
      if (this.state.isChunkError && this.state.retryCount < 3) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#262421]">
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#81b64c] mx-auto mb-4"></div>
              <p className="text-[#bababa] text-lg mb-2">Loading component...</p>
              <p className="text-[#8b8987] text-sm">Retry attempt {this.state.retryCount + 1} of 3</p>
            </div>
          </div>
        );
      }

      // Chunk load error after all retries failed
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#262421]">
            <div className="text-center p-8 max-w-md">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Unable to Load Component
              </h2>
              <p className="text-[#bababa] mb-4">
                We're having trouble loading this page. This might be due to a network issue or an outdated browser cache.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-[#81b64c] text-white px-4 py-2 rounded-lg hover:bg-[#a3d160] transition-colors"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                      });
                    }
                    window.location.reload();
                  }}
                  className="w-full bg-[#4a4744] text-white px-4 py-2 rounded-lg hover:bg-[#5c5a57] transition-colors"
                >
                  Clear Cache & Refresh
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Non-chunk render error: show a simple recovery UI instead of the
      // misleading "Unable to Load Component" message
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#262421]">
          <div className="text-center p-8 max-w-md">
            <div className="text-[#ff9800] mb-4" style={{ fontSize: '48px' }}>
              &#9888;
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-[#bababa] mb-4">
              An unexpected error occurred. Please refresh to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#81b64c] text-white px-4 py-2 rounded-lg hover:bg-[#a3d160] transition-colors"
            >
              Refresh Page
            </button>
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
    <div className="min-h-screen flex items-center justify-center bg-[#262421]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#81b64c] mx-auto mb-4"></div>
        <p className="text-[#bababa] text-lg">Loading...</p>
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
