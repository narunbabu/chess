import React from 'react';

const LoadMoreButton = ({
  hasMore,
  loading,
  onLoadMore,
  currentCount,
  totalCount,
  buttonText = "Load More"
}) => {
  if (!hasMore && currentCount > 0) {
    return (
      <div className="text-center py-3 text-gray-500 text-sm">
        Showing all {currentCount} items
      </div>
    );
  }

  if (!hasMore && currentCount === 0) {
    return (
      <div className="text-center py-3 text-gray-500 text-sm">
        No items to display
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <button
        onClick={onLoadMore}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:transform-none"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          <span>
            {buttonText} ({currentCount} of {totalCount})
          </span>
        )}
      </button>
    </div>
  );
};

export default LoadMoreButton;