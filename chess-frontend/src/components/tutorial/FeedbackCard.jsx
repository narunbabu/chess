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
          bg: 'bg-[#4e7837]/20',
          border: 'border-[#81b64c]',
          text: 'text-[#a3d160]',
          subtext: 'text-[#81b64c]',
          icon: '✅',
          title: 'Excellent!'
        };
      case 'error':
        return {
          bg: 'bg-[#e74c3c]/15',
          border: 'border-[#e74c3c]',
          text: 'text-[#fa6a5b]',
          subtext: 'text-[#fa6a5b]',
          icon: '❌',
          title: 'Try Again'
        };
      case 'partial':
        return {
          bg: 'bg-[#e8a93e]/15',
          border: 'border-[#e8a93e]',
          text: 'text-[#f4c66a]',
          subtext: 'text-[#e8a93e]',
          icon: '👍',
          title: 'Good Try!'
        };
      case 'hint':
        return {
          bg: 'bg-[#81b64c]/15',
          border: 'border-[#81b64c]',
          text: 'text-[#a3d160]',
          subtext: 'text-[#81b64c]',
          icon: '💡',
          title: 'Hint'
        };
      default:
        return {
          bg: 'bg-[#3d3a37]',
          border: 'border-[#4a4744]',
          text: 'text-[#bababa]',
          subtext: 'text-[#8b8987]',
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