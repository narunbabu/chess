import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

const tierBadgeColors = {
  free: { bg: '#4a4744', text: '#bababa' },
  premium: { bg: '#4a3a1a', text: '#e8a93e' },
  pro: { bg: '#2d1a4a', text: '#a855f7' },
};

const SubscriptionManagement = () => {
  const navigate = useNavigate();
  const { currentSubscription, currentTier, cancelSubscription, loading } = useSubscription();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const badgeColors = tierBadgeColors[currentTier] || tierBadgeColors.free;
  const isFreeTier = currentTier === 'free';

  const handleCancel = async () => {
    try {
      setCancelLoading(true);
      await cancelSubscription();
      setShowCancelConfirm(false);
    } catch {
      // Error handled by context
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="subscription-mgmt">
      <div className="subscription-mgmt__header">
        <h2>Subscription</h2>
        <span
          className="subscription-mgmt__badge"
          style={{ backgroundColor: badgeColors.bg, color: badgeColors.text }}
        >
          {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
        </span>
      </div>

      {!isFreeTier && currentSubscription && (
        <div className="subscription-mgmt__details">
          <div className="subscription-mgmt__row">
            <span className="subscription-mgmt__label">Status</span>
            <span className={`subscription-mgmt__value ${currentSubscription.is_active ? 'active' : 'expired'}`}>
              {currentSubscription.is_active ? 'Active' : 'Expired'}
            </span>
          </div>
          <div className="subscription-mgmt__row">
            <span className="subscription-mgmt__label">Renewal Date</span>
            <span className="subscription-mgmt__value">
              {formatDate(currentSubscription.expires_at)}
            </span>
          </div>
          <div className="subscription-mgmt__row">
            <span className="subscription-mgmt__label">Days Remaining</span>
            <span className="subscription-mgmt__value">
              {currentSubscription.days_remaining} days
            </span>
          </div>
          <div className="subscription-mgmt__row">
            <span className="subscription-mgmt__label">Auto-Renew</span>
            <span className="subscription-mgmt__value">
              {currentSubscription.auto_renew ? 'Yes' : 'No (cancelling)'}
            </span>
          </div>
        </div>
      )}

      <div className="subscription-mgmt__actions">
        <button
          className="subscription-mgmt__btn subscription-mgmt__btn--upgrade"
          onClick={() => navigate('/pricing')}
        >
          {isFreeTier ? 'Upgrade Now' : 'Change Plan'}
        </button>

        {!isFreeTier && currentSubscription?.auto_renew && (
          <>
            {!showCancelConfirm ? (
              <button
                className="subscription-mgmt__btn subscription-mgmt__btn--cancel"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel Subscription
              </button>
            ) : (
              <div className="subscription-mgmt__cancel-confirm">
                <p>Your subscription will remain active until {formatDate(currentSubscription.expires_at)}. Are you sure?</p>
                <div className="subscription-mgmt__cancel-actions">
                  <button
                    className="subscription-mgmt__btn subscription-mgmt__btn--confirm-cancel"
                    onClick={handleCancel}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
                  </button>
                  <button
                    className="subscription-mgmt__btn subscription-mgmt__btn--keep"
                    onClick={() => setShowCancelConfirm(false)}
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagement;
