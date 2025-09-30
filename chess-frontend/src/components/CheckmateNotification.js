import React, { useEffect, useState } from 'react';
import './CheckmateNotification.css';

const CheckmateNotification = ({ winner, onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        onComplete && onComplete();
      }, 500); // Wait for fade out animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`checkmate-notification ${visible ? 'visible' : 'fade-out'}`}>
      <div className="checkmate-content">
        <h2>⚔️ CHECKMATE! ⚔️</h2>
        <p>{winner === 'white' ? 'White' : 'Black'} wins!</p>
      </div>
    </div>
  );
};

export default CheckmateNotification;