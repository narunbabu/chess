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
  silver: [
    { id: null, tier: 'silver', name: 'Silver Monthly', interval: 'monthly', price: 99,
      features: ['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Unlimited undos', 'Priority matchmaking', 'Custom board themes'] },
    { id: null, tier: 'silver', name: 'Silver Yearly', interval: 'yearly', price: 999,
      features: ['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Unlimited undos', 'Priority matchmaking', 'Custom board themes', 'Save 16% vs monthly'] },
  ],
  gold: [
    { id: null, tier: 'gold', name: 'Gold Monthly', interval: 'monthly', price: 499,
      features: ['Everything in Silver', 'Org/school affiliation', 'Priority support', 'Advanced analytics', 'AI opponent', 'Opening explorer', 'Game annotations'] },
    { id: null, tier: 'gold', name: 'Gold Yearly', interval: 'yearly', price: 4999,
      features: ['Everything in Silver', 'Org/school affiliation', 'Priority support', 'Advanced analytics', 'AI opponent', 'Opening explorer', 'Game annotations', 'Save 16% vs monthly'] },
  ],
};

const PricingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { plans, plansLoading, plansError, currentTier, loading, fetchPlans, fetchCurrentSubscription } = useSubscription();
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);
  const [fallbackRetrying, setFallbackRetrying] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  // Stores { tier, interval } when user clicks Subscribe on a fallback plan (id: null).
  // Cleared once real plan IDs load and checkout is triggered automatically.
  const [pendingIntent, setPendingIntent] = useState(null);

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
    const tiers = ['free', 'silver', 'gold'];
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

  const handleSubscribe = async (planId, tier, planInterval) => {
    setCheckoutError(null);
    if (!isAuthenticated) {
      // Save the plan they clicked so we can resume checkout after login
      if (planId) {
        localStorage.setItem('pending_plan_id', planId.toString());
      } else if (tier) {
        // Fallback plan clicked before login — save intent as tier+interval
        localStorage.setItem('pending_plan_tier', tier);
        localStorage.setItem('pending_plan_interval', planInterval || billingInterval);
      }
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    if (!planId) {
      // Fallback plan — remember which tier+interval they wanted, then fetch live plans.
      // A useEffect below will auto-open checkout once real plan IDs arrive.
      setPendingIntent({ tier, interval: planInterval || billingInterval });
      setFallbackRetrying(true);
      await fetchPlans();
      setFallbackRetrying(false);
      return;
    }
    setCheckoutPlanId(planId);
  };

  // Auto-open checkout when live plans load after a fallback-plan click
  React.useEffect(() => {
    if (!pendingIntent || !hasApiPlans) return;
    const { tier: wantedTier, interval: wantedInterval } = pendingIntent;
    const tierPlans = normalizedPlans[wantedTier] || [];
    const match = tierPlans.find(p => p.interval === wantedInterval) || tierPlans[0];
    if (match?.id) {
      setPendingIntent(null);
      setCheckoutPlanId(match.id);
    }
  }, [pendingIntent, hasApiPlans, normalizedPlans]);

  // Detect when a fallback-plan checkout attempt fails because plans are still unavailable.
  // Fires after fetchPlans() resolves with no plan data and fallbackRetrying has cleared.
  React.useEffect(() => {
    if (!pendingIntent) return;
    if (fallbackRetrying || plansLoading) return; // still in-flight
    if (hasApiPlans) return;                       // success case handled by the other effect
    // Plans fetched but still empty — show a helpful error
    setCheckoutError(
      'Subscription plans are temporarily unavailable. ' +
      'Please refresh the page or contact support@chess99.com to upgrade.'
    );
    setPendingIntent(null);
  }, [pendingIntent, fallbackRetrying, plansLoading, hasApiPlans]);

  // Resume checkout after login redirect — check for pending plan (by ID or by tier+interval)
  React.useEffect(() => {
    if (isAuthenticated && !checkoutPlanId && !pendingIntent) {
      const pendingPlanId = localStorage.getItem('pending_plan_id');
      if (pendingPlanId) {
        localStorage.removeItem('pending_plan_id');
        if (hasApiPlans) {
          setCheckoutPlanId(parseInt(pendingPlanId, 10));
        }
        return;
      }
      // Handle post-login fallback-plan intent saved as tier+interval
      const pendingTier = localStorage.getItem('pending_plan_tier');
      const pendingInterval = localStorage.getItem('pending_plan_interval');
      if (pendingTier) {
        localStorage.removeItem('pending_plan_tier');
        localStorage.removeItem('pending_plan_interval');
        if (hasApiPlans) {
          const tierPlans = normalizedPlans[pendingTier] || [];
          const match = tierPlans.find(p => p.interval === pendingInterval) || tierPlans[0];
          if (match?.id) setCheckoutPlanId(match.id);
        } else {
          // Plans not loaded yet — store as pendingIntent for the other useEffect to handle
          setPendingIntent({ tier: pendingTier, interval: pendingInterval || 'monthly' });
        }
      }
    }
  }, [isAuthenticated, hasApiPlans, checkoutPlanId, normalizedPlans, pendingIntent]);

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
          className={`pricing-page__toggle-btn ${billingInterval === 'monthly' ? 'active' : ''}`}
          onClick={() => setBillingInterval('monthly')}
        >
          Monthly
        </button>
        <button
          className={`pricing-page__toggle-btn ${billingInterval === 'yearly' ? 'active' : ''}`}
          onClick={() => setBillingInterval('yearly')}
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

      {/* Checkout error — shown when subscribe attempt fails (e.g., plans unavailable in DB) */}
      {checkoutError && (
        <div className="pricing-page__status" style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <p style={{ color: 'var(--danger)', fontSize: '0.9rem', margin: 0 }}>{checkoutError}</p>
          <button className="pricing-page__retry-btn" style={{ marginTop: '0.5rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setCheckoutError(null)}>
            Dismiss
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
            interval={data.tier === 'free' ? 'lifetime' : billingInterval}
            isCurrentPlan={currentTier === data.tier}
            isPopular={data.tier === 'silver'}
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
                <th className="pricing-page__table-highlight">Silver</th>
                <th>Gold</th>
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
