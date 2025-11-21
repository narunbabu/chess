import React from 'react';

const FeedbackCard = ({ feedback, onDismiss, autoDismiss = true }) => {
  const { type, message, scoreChange, subtext } = feedback;

  React.useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        onDismiss && onDismiss();
      }, 3000); // Auto-dismiss after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          subtext: 'text-green-700',
          icon: '✅',
          title: 'Excellent!'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          subtext: 'text-red-700',
          icon: '❌',
          title: 'Try Again'
        };
      case 'partial':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          subtext: 'text-yellow-700',
          icon: '👍',
          title: 'Good Try!'
        };
      case 'hint':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          subtext: 'text-blue-700',
          icon: '💡',
          title: 'Hint'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          subtext: 'text-gray-700',
          icon: 'ℹ️',
          title: 'Info'
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.bg} ${styles.border} border-2 rounded-lg p-4 shadow-sm relative`}>
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss feedback"
        >
          ×
        </button>
      )}

      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="text-2xl flex-shrink-0">
          {styles.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className={`font-bold ${styles.text} mb-1`}>
            {styles.title}
          </h4>

          {/* Main message */}
          <p className={`${styles.subtext} text-sm font-medium leading-relaxed`}>
            {message}
          </p>

          {/* Score change */}
          {scoreChange !== undefined && (
            <div className={`mt-2 text-sm font-medium ${
              scoreChange > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {scoreChange > 0 ? '+' : ''}{scoreChange} points
            </div>
          )}

          {/* Additional subtext */}
          {subtext && (
            <div className={`mt-2 text-xs ${styles.subtext} opacity-80`}>
              {subtext}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackCard;