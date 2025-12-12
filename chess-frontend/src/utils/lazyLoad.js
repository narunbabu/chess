import { lazy } from 'react';
import LazyLoadWrapper from '../components/LazyLoadWrapper';

// Enhanced lazy function with retry logic
export const lazyWithRetry = (importFunc, retries = 3) => {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptLoad = (attempt) => {
        importFunc()
          .then(resolve)
          .catch(error => {
            // Only retry for chunk load errors
            if (attempt < retries &&
                (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk'))) {
              console.warn(`Chunk load failed, retrying (${attempt + 1}/${retries})...`);
              setTimeout(() => attemptLoad(attempt + 1), 1000 * attempt);
            } else {
              reject(error);
            }
          });
        };
      attemptLoad(0);
    });
  });
};

// HOC to wrap lazy components with error boundary
export const withLazyErrorBoundary = (LazyComponent, customFallback = null) => {
  return () => (
    <LazyLoadWrapper fallback={customFallback}>
      <LazyComponent />
    </LazyLoadWrapper>
  );
};

// Factory function to create lazy components with built-in error handling
export const createLazyComponent = (importFunc, options = {}) => {
  const {
    retries = 3,
    fallback = null,
    componentName = 'Component'
  } = options;

  const LazyComponent = lazyWithRetry(importFunc, retries);
  const WrappedComponent = withLazyErrorBoundary(LazyComponent, fallback);

  // Add display name for debugging
  WrappedComponent.displayName = `Lazy${componentName}`;

  return WrappedComponent;
};