import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import PricingCard from '../components/subscription/PricingCard';
import RazorpayCheckout from '../components/subscription/RazorpayCheckout';
import '../styles/Subscription.css';

// Static fallback plans shown when the API is unavailable or returns empty data
const FALLBACK_PLANS = {
  free: [{
    id: null, tier: 'free', name: 'Free', interval: 'lifetime', price: 0,
    features: ['Basic game stats', 'Play vs computer', 'Online multiplayer', '5 undos per game'],
  }],
  premium: [
    { id: null, tier: 'premium', name: 'Premium Monthly', interval: 'monthly', price: 99,
      features: ['Ad-free experience', 'Unlimited undos', 'Full game statistics', 'Priority matchmaking', 'Custom board themes'] },
    { id: null, tier: 'premium', name: 'Premium Yearly', interval: 'yearly', price: 999,
      features: ['Ad-free experience', 'Unlimited undos', 'Full game statistics', 'Priority matchmaking', 'Custom board themes', 'Save 16% vs monthly'] },
  ],
  pro: [
    { id: null, tier: 'pro', name: 'Pro Monthly', interval: 'monthly', price: 499,
      features: ['Everything in Premium', 'Create tournaments', 'Advanced analytics', 'Synthetic AI opponents', 'Opening explorer', 'Game annotations'] },
    { id: null, tier: 'pro', name: 'Pro Yearly', interval: 'yearly', price: 4999,
      features: ['Everything in Premium', 'Create tournaments', 'Advanced analytics', 'Synthetic AI opponents', 'Opening explorer', 'Game annotations', 'Save 16% vs monthly'] },
  ],
};

const PricingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { plans, plansLoading, plansError, currentTier, loading, fetchPlans, fetchCurrentSubscription } = useSubscription();
  const [interval, setInterval] = useState('monthly');
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);

  // Use API plans if available, otherwise fall back to static plans
  const hasApiPlans = plans && Object.keys(plans).length > 0 &&
    Object.values(plans).some(tierPlans => Array.isArray(tierPlans) && tierPlans.length > 0);
  const usingFallback = !plansLoading && !hasApiPlans;
  const effectivePlans = hasApiPlans ? plans : FALLBACK_PLANS;

  // Build tier display data from grouped plans
  const tierData = useMemo(() => {
    const tiers = ['free', 'premium', 'pro'];
    return tiers.map(tier => {
      const tierPlans = effectivePlans[tier] || [];
      if (tierPlans.length === 0) return null;

      return {
        tier,
        tierLabel: tier.charAt(0).toUpperCase() + tier.slice(1),
        plans: tierPlans,
      };
    }).filter(Boolean);
  }, [effectivePlans]);

  const handleSubscribe = (planId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    if (!planId) {
      // Fallback plan clicked — try refreshing live plans first
      fetchPlans();
      return;
    }
    setCheckoutPlanId(planId);
  };

  const handleCheckoutSuccess = () => {
    setCheckoutPlanId(null);
    fetchCurrentSubscription();
  };

  return (
    <div className="pricing-page">
      <div className="pricing-page__header">
        <h1 className="pricing-page__title">Choose Your Plan</h1>
        <p className="pricing-page__subtitle">
          Upgrade your chess experience with premium features
        </p>
      </div>

      {/* Interval Toggle */}
      <div className="pricing-page__toggle">
        <button
          className={`pricing-page__toggle-btn ${interval === 'monthly' ? 'active' : ''}`}
          onClick={() => setInterval('monthly')}
        >
          Monthly
        </button>
        <button
          className={`pricing-page__toggle-btn ${interval === 'yearly' ? 'active' : ''}`}
          onClick={() => setInterval('yearly')}
        >
          Yearly
          <span className="pricing-page__toggle-badge">Save 16%</span>
        </button>
      </div>

      {/* Fallback notice when using static plans */}
      {usingFallback && !plansLoading && (
        <div className="pricing-page__status" style={{ paddingBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.85rem' }}>
            {plansError || 'Showing standard pricing. Live pricing will load shortly.'}
          </p>
          <button className="pricing-page__retry-btn" onClick={fetchPlans}>
            Refresh Plans
          </button>
        </div>
      )}

      {/* Plan Cards — always render (using API data or fallback) */}
      <div className="pricing-page__cards">
        {plansLoading ? (
          <div className="pricing-page__status">
            <div className="pricing-page__spinner" />
            <p>Loading plans...</p>
          </div>
        ) : (
          tierData.map((data) => (
            <PricingCard
              key={data.tier}
              plan={data}
              interval={data.tier === 'free' ? 'lifetime' : interval}
              isCurrentPlan={currentTier === data.tier}
              isPopular={data.tier === 'premium'}
              onSubscribe={handleSubscribe}
              loading={loading}
            />
          ))
        )}
      </div>

      {/* Feature Comparison */}
      <div className="pricing-page__comparison">
        <h2 className="pricing-page__comparison-title">Feature Comparison</h2>
        <div className="pricing-page__table-wrapper">
          <table className="pricing-page__table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th className="pricing-page__table-highlight">Premium</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Play vs Computer</td>
                <td>✓</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Online Multiplayer</td>
                <td>✓</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Ad-Free Experience</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Undos per Game</td>
                <td>5</td><td>Unlimited</td><td>Unlimited</td>
              </tr>
              <tr>
                <td>Game Statistics</td>
                <td>Basic</td><td>Full</td><td>Full</td>
              </tr>
              <tr>
                <td>Priority Matchmaking</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Custom Board Themes</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Create Tournaments</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Advanced Analytics</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Synthetic AI Opponents</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Opening Explorer</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutPlanId && (
        <RazorpayCheckout
          planId={checkoutPlanId}
          onSuccess={handleCheckoutSuccess}
          onClose={() => setCheckoutPlanId(null)}
        />
      )}
    </div>
  );
};

export default PricingPage;
