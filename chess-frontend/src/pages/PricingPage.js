import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import PricingCard from '../components/subscription/PricingCard';
import RazorpayCheckout from '../components/subscription/RazorpayCheckout';
import '../styles/Subscription.css';

const PricingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { plans, plansLoading, plansError, currentTier, loading, fetchPlans, fetchCurrentSubscription } = useSubscription();
  const [interval, setInterval] = useState('monthly');
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);

  // Build tier display data from grouped plans
  const tierData = useMemo(() => {
    const tiers = ['free', 'premium', 'pro'];
    return tiers.map(tier => {
      const tierPlans = plans[tier] || [];
      if (tierPlans.length === 0) return null;

      return {
        tier,
        tierLabel: tier.charAt(0).toUpperCase() + tier.slice(1),
        plans: tierPlans,
      };
    }).filter(Boolean);
  }, [plans]);

  const handleSubscribe = (planId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/pricing' } });
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

      {/* Plan Cards — with loading, error, and empty states */}
      <div className="pricing-page__cards">
        {plansLoading ? (
          <div className="pricing-page__status">
            <div className="pricing-page__spinner" />
            <p>Loading plans...</p>
          </div>
        ) : plansError ? (
          <div className="pricing-page__status">
            <p>{plansError}</p>
            <button className="pricing-page__retry-btn" onClick={fetchPlans}>
              Retry
            </button>
          </div>
        ) : tierData.length === 0 ? (
          <div className="pricing-page__status">
            <p>No plans available at the moment. Please check back later.</p>
            <button className="pricing-page__retry-btn" onClick={fetchPlans}>
              Refresh
            </button>
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
