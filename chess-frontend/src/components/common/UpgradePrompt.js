import React from 'react';
import { useNavigate } from 'react-router-dom';

const UpgradePrompt = ({ feature, requiredTier = 'Premium', onDismiss }) => {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }} onClick={onDismiss}>
      <div style={{
        backgroundColor: '#2b2927',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '360px',
        textAlign: 'center',
        border: '1px solid #4a4744',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
        <h3 style={{ color: '#ffffff', marginBottom: '8px', fontSize: '18px' }}>Premium Feature</h3>
        <p style={{ color: '#bababa', marginBottom: '20px', fontSize: '14px' }}>
          "{feature}" requires a {requiredTier} subscription.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{
              backgroundColor: '#81b64c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Upgrade Now
          </button>
          <button
            onClick={onDismiss}
            style={{
              backgroundColor: 'transparent',
              color: '#bababa',
              border: '1px solid #4a4744',
              borderRadius: '8px',
              padding: '10px 24px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
