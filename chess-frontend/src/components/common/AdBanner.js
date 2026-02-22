import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

/**
 * AdBanner — Self-promo placeholder for free-tier users.
 * Hidden for Silver+ subscribers. Can be swapped to real ads later.
 */
const AdBanner = () => {
  const { isStandard } = useSubscription();
  const navigate = useNavigate();

  // Hide for paying users
  if (isStandard) return null;

  return (
    <div
      className="ad-banner"
      onClick={() => navigate('/pricing')}
      style={{
        width: '100%',
        maxWidth: '728px',
        margin: '0 auto 16px',
        padding: '10px 20px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(232,169,62,0.1), rgba(232,169,62,0.04))',
        border: '1px solid rgba(232,169,62,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        minHeight: '50px',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: '18px' }}>&#9813;</span>
      <span style={{ color: '#d0d0d0', fontSize: '13px', fontWeight: 500 }}>
        Go ad-free with Silver — only &#8377;99/mo
      </span>
      <span style={{
        padding: '3px 12px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #e8a93e, #d49a2e)',
        color: '#fff',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        Upgrade
      </span>
    </div>
  );
};

export default AdBanner;
