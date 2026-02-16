import React from 'react';

const tierColors = {
  free: { badge: '#8b8987', border: '#4a4744', gradient: 'linear-gradient(135deg, #3d3a37, #312e2b)' },
  premium: { badge: '#e8a93e', border: '#e8a93e', gradient: 'linear-gradient(135deg, #4a3a1a, #312e2b)' },
  pro: { badge: '#a855f7', border: '#a855f7', gradient: 'linear-gradient(135deg, #2d1a4a, #312e2b)' },
};

const PricingCard = ({ plan, isCurrentPlan, isPopular, onSubscribe, loading, interval }) => {
  const colors = tierColors[plan.tier] || tierColors.free;
  const isFree = plan.tier === 'free';

  // Find the plan matching the selected interval
  const displayPlan = Array.isArray(plan.plans)
    ? plan.plans.find(p => p.interval === interval) || plan.plans[0]
    : plan;

  const price = displayPlan.price || 0;
  const features = displayPlan.features || [];
  const planId = displayPlan.id;

  return (
    <div
      className="pricing-card"
      style={{
        background: colors.gradient,
        borderColor: isPopular ? colors.border : 'var(--border-subtle)',
        borderWidth: isPopular ? '2px' : '1px',
      }}
    >
      {isPopular && (
        <div className="pricing-card__popular-badge" style={{ backgroundColor: colors.badge }}>
          Most Popular
        </div>
      )}

      {isCurrentPlan && (
        <div className="pricing-card__current-badge">
          Current Plan
        </div>
      )}

      <div className="pricing-card__header">
        <h3 className="pricing-card__tier" style={{ color: colors.badge }}>
          {plan.tierLabel || displayPlan.tier?.charAt(0).toUpperCase() + displayPlan.tier?.slice(1)}
        </h3>
        <div className="pricing-card__price">
          {isFree ? (
            <span className="pricing-card__amount">Free</span>
          ) : (
            <>
              <span className="pricing-card__currency">₹</span>
              <span className="pricing-card__amount">{Math.floor(price)}</span>
              <span className="pricing-card__interval">
                /{interval === 'yearly' ? 'year' : 'month'}
              </span>
            </>
          )}
        </div>
        {!isFree && interval === 'yearly' && (
          <div className="pricing-card__savings">
            Save 16% vs monthly
          </div>
        )}
      </div>

      <ul className="pricing-card__features">
        {features.map((feature, idx) => (
          <li key={idx} className="pricing-card__feature">
            <span className="pricing-card__feature-check">✓</span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="pricing-card__action">
        {isFree ? (
          <button className="pricing-card__btn pricing-card__btn--free" disabled>
            Free Forever
          </button>
        ) : isCurrentPlan ? (
          <button className="pricing-card__btn pricing-card__btn--current" disabled>
            Current Plan
          </button>
        ) : (
          <button
            className="pricing-card__btn pricing-card__btn--subscribe"
            style={{ backgroundColor: colors.badge }}
            onClick={() => onSubscribe(planId)}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Subscribe'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PricingCard;
