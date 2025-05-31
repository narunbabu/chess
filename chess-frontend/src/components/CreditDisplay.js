
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './CreditDisplay.css';

const CreditDisplay = ({ showLabel = true, size = 'normal' }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className={`credit-display ${size}`}>
      <span className="credit-icon">💰</span>
      <span className="credit-amount">{user.credits}</span>
      {showLabel && <span className="credit-label">Credits</span>}
    </div>
  );
};

export default CreditDisplay;
