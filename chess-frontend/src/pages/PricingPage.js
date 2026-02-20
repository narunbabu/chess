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
    features: ['Play vs computer', '5 games/day online', 'Public tournaments', 'Basic game stats', '5 undos per game'],
  }],
  standard: [
    { id: null, tier: 'standard', name: 'Standard Monthly', interval: 'monthly', price: 99,
      features: ['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Unlimited undos', 'Priority matchmaking', 'Custom board themes'] },
    { id: null, tier: 'standard', name: 'Standard Yearly', interval: 'yearly', price: 999,
      features: ['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Unlimited undos', 'Priority matchmaking', 'Custom board themes', 'Save 16% vs monthly'] },
  ],
  premium: [
    { id: null, tier: 'premium', name: 'Premium Monthly', interval: 'monthly', price: 499,
      features: ['Everything in Standard', 'Org/school affiliation', 'Priority support', 'Advanced analytics', 'AI opponent', 'Opening explorer', 'Game annotations'] },
    { id: null, tier: 'premium', name: 'Premium Yearly', interval: 'yearly', price: 4999,
      features: ['Everything in Standard', 'Org/school affiliation', 'Priority support', 'Advanced analytics', 'AI opponent', 'Opening explorer', 'Game annotations', 'Save 16% vs monthly'] },
  ],
};

const PricingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { plans, plansLoading, plansError, currentTier, loading, fetchPlans, fetchCurrentSubscription } = useSubscription();
  const [interval, setInterval] = useState('monthly');
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);
  const [fallbackRetrying, setFallbackRetrying] = useState(false);

  // Normalize API plans: backend groupBy may return objects instead of arrays
  // when collection keys are non-sequential (e.g. {1: {...}, 2: {...}})
  const normalizedPlans = useMemo(() => {
    if (!plans || Object.keys(plans).length === 0) return {};
    const result = {};
    for (const [tier, tierPlans] of Object.entries(plans)) {
      result[tier] = Array.isArray(tierPlans) ? tierPlans : Object.values(tierPlans);
    }
    return result;
  }, [plans]);

  // Use API plans if available, otherwise fall back to static plans
  const hasApiPlans = Object.keys(normalizedPlans).length > 0 &&
    Object.values(normalizedPlans).some(tierPlans => tierPlans.length > 0);
  const usingFallback = !plansLoading && !hasApiPlans;
  const effectivePlans = hasApiPlans ? normalizedPlans : FALLBACK_PLANS;

  // Build tier display data from grouped plans
  const tierData = useMemo(() => {
    const tiers = ['free', 'standard', 'premium'];
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

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      // Save the plan they clicked so we can resume checkout after login
      if (planId) {
        localStorage.setItem('pending_plan_id', planId.toString());
      }
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    if (!planId) {
      // Fallback plan — fetch live plans so the real plan IDs are available for checkout
      setFallbackRetrying(true);
      await fetchPlans();
      setFallbackRetrying(false);
      return;
    }
    setCheckoutPlanId(planId);
  };

  // Resume checkout after login redirect — check for pending plan
  React.useEffect(() => {
    if (isAuthenticated && !checkoutPlanId) {
      const pendingPlanId = localStorage.getItem('pending_plan_id');
      if (pendingPlanId) {
        localStorage.removeItem('pending_plan_id');
        // Wait for plans to load before triggering checkout
        if (hasApiPlans) {
          setCheckoutPlanId(parseInt(pendingPlanId, 10));
        }
      }
    }
  }, [isAuthenticated, hasApiPlans, checkoutPlanId]);

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

      {/* Loading indicator — shown as a banner above cards, never hides the cards */}
      {plansLoading && (
        <div className="pricing-page__status" style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>
          <div className="pricing-page__spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
          <p style={{ fontSize: '0.85rem' }}>Fetching current pricing...</p>
        </div>
      )}

      {/* Plan Cards — always render immediately using API data or fallback */}
      <div className="pricing-page__cards">
        {tierData.map((data) => (
          <PricingCard
            key={data.tier}
            plan={data}
            interval={data.tier === 'free' ? 'lifetime' : interval}
            isCurrentPlan={currentTier === data.tier}
            isPopular={data.tier === 'standard'}
            onSubscribe={handleSubscribe}
            loading={loading || fallbackRetrying}
          />
        ))}
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
                <th className="pricing-page__table-highlight">Standard</th>
                <th>Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Play vs Computer</td>
                <td>✓</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Online Games</td>
                <td>5/day</td><td>Unlimited</td><td>Unlimited</td>
              </tr>
              <tr>
                <td>Tournaments</td>
                <td>Public</td><td>All</td><td>All + Create</td>
              </tr>
              <tr>
                <td>ELO Tracking</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Full Game History</td>
                <td>—</td><td>✓</td><td>✓</td>
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
                <td>Priority Matchmaking</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Custom Board Themes</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Org/School Affiliation</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Priority Support</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Advanced Analytics</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>AI Opponent</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Opening Explorer</td>
                <td>—</td><td>—</td><td>✓</td>
              </tr>
              <tr>
                <td>Opening Trainer</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Puzzle Trainer</td>
                <td>—</td><td>✓</td><td>✓</td>
              </tr>
              <tr>
                <td>Endgame Drills</td>
                <td>—</td><td>Limited</td><td>✓</td>
              </tr>
              <tr>
                <td>Video Lessons</td>
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
