import React, { useState, useEffect, useCallback } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';

const RazorpayCheckout = ({ planId, onSuccess, onClose }) => {
  const { checkout } = useSubscription();
  const [step, setStep] = useState('init'); // init | processing | success | error
  const [error, setError] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);

  const initiateCheckout = useCallback(async () => {
    try {
      setStep('processing');
      const data = await checkout(planId);
      setCheckoutData(data);

      // Mock mode: auto-completed by backend
      if (data.mock_mode && data.auto_completed) {
        setStep('success');
        return;
      }

      // Mock mode but not auto-completed: treat as success (test environment)
      if (data.mock_mode) {
        setStep('success');
        return;
      }

      // Real mode: load Razorpay SDK and open checkout
      if (data.checkout?.subscription_id) {
        loadRazorpaySDK(data);
        return;
      }

      // Fallback: no valid checkout data received
      setError('Unable to initialize payment. Please try again.');
      setStep('error');
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
      setStep('error');
    }
  }, [planId, checkout]);

  const loadRazorpaySDK = (data) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => openRazorpayModal(data);
    script.onerror = () => {
      setError('Failed to load payment gateway. Please try again.');
      setStep('error');
    };
    document.body.appendChild(script);
  };

  const openRazorpayModal = (data) => {
    const options = {
      key: data.checkout.key_id,
      subscription_id: data.checkout.subscription_id,
      name: 'Chess99',
      description: `${data.checkout.plan.name} Subscription`,
      handler: (response) => {
        setStep('success');
      },
      modal: {
        ondismiss: () => {
          setStep('error');
          setError('Payment was cancelled.');
        },
      },
      theme: {
        color: '#81b64c',
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  useEffect(() => {
    initiateCheckout();
  }, [initiateCheckout]);

  useEffect(() => {
    if (step === 'success' && onSuccess) {
      const timer = setTimeout(() => onSuccess(checkoutData), 1500);
      return () => clearTimeout(timer);
    }
  }, [step, onSuccess, checkoutData]);

  return (
    <div className="razorpay-checkout-overlay" onClick={(e) => e.target === e.currentTarget && step !== 'processing' && onClose()}>
      <div className="razorpay-checkout-modal">
        {step === 'init' && (
          <div className="razorpay-checkout__step">
            <div className="razorpay-checkout__spinner" />
            <p>Initializing payment...</p>
          </div>
        )}

        {step === 'processing' && (
          <div className="razorpay-checkout__step">
            <div className="razorpay-checkout__spinner" />
            <p>Processing your subscription...</p>
            {checkoutData?.mock_mode && (
              <p className="razorpay-checkout__note">Test mode — payment will be simulated</p>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="razorpay-checkout__step razorpay-checkout__step--success">
            <div className="razorpay-checkout__checkmark">✓</div>
            <h3>Subscription Activated!</h3>
            <p>Your {checkoutData?.checkout?.plan?.name} subscription is now active.</p>
          </div>
        )}

        {step === 'error' && (
          <div className="razorpay-checkout__step razorpay-checkout__step--error">
            <div className="razorpay-checkout__error-icon">!</div>
            <h3>Payment Failed</h3>
            <p>{error}</p>
            <div className="razorpay-checkout__actions">
              <button className="razorpay-checkout__btn razorpay-checkout__btn--retry" onClick={initiateCheckout}>
                Try Again
              </button>
              <button className="razorpay-checkout__btn razorpay-checkout__btn--cancel" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RazorpayCheckout;
