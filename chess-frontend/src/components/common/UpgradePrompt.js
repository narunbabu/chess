import React from 'react';
import { useNavigate } from 'react-router-dom';

const TIER_CONFIG = {
  standard: {
    label: 'Silver',
    price: '99/mo',
    color: '#e8a93e',
    icon: '\uD83D\uDD12',
    benefits: [
      'All 10 board themes unlocked',
      'Detailed game analytics & ACPL',
      'Ad-free experience',
    ],
  },
  gold: {
    label: 'Gold',
    price: '299/mo',
    color: '#a855f7',
    icon: '\uD83D\uDC51',
    benefits: [
      'Exclusive board themes (Neon, Obsidian)',
      'AI opponents matched to your skill',
      'Everything in Silver, plus more',
    ],
  },
};

const UpgradePrompt = ({ feature, requiredTier = 'standard', onDismiss, tierHighlight }) => {
  const navigate = useNavigate();
  const tier = TIER_CONFIG[requiredTier] || TIER_CONFIG.standard;

  const handleUpgrade = () => {
    const params = new URLSearchParams();
    if (tierHighlight || requiredTier) {
      params.set('highlight', tierHighlight || requiredTier);
    }
    navigate(`/pricing?${params.toString()}`);
  };

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
        maxWidth: '380px',
        width: '90%',
        textAlign: 'center',
        border: `1px solid ${tier.color}33`,
        boxShadow: `0 0 40px ${tier.color}15`,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>{tier.icon}</div>
        <h3 style={{ color: '#ffffff', marginBottom: '4px', fontSize: '18px' }}>
          {tier.label} Feature
        </h3>
        <div style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          backgroundColor: `${tier.color}22`,
          color: tier.color,
          marginBottom: '12px',
        }}>
          {tier.label} — ₹{tier.price}
        </div>
        <p style={{ color: '#bababa', marginBottom: '16px', fontSize: '14px' }}>
          "{feature}" requires a {tier.label} subscription.
        </p>

        {/* Benefits */}
        <div style={{
          textAlign: 'left',
          marginBottom: '20px',
          padding: '12px 16px',
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
          border: '1px solid #3d3a37',
        }}>
          {tier.benefits.map((b, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: i < tier.benefits.length - 1 ? '8px' : 0,
              fontSize: '13px',
              color: '#d0d0d0',
            }}>
              <span style={{ color: tier.color, flexShrink: 0 }}>&#10003;</span>
              {b}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={handleUpgrade}
            style={{
              backgroundColor: tier.color,
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px',
              flex: 1,
            }}
          >
            Upgrade to {tier.label}
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
