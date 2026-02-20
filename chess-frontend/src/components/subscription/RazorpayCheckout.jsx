import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * RazorpayCheckout — order-based payment flow
 *
 * Steps:
 *   init → creating_order → awaiting_payment → verifying → success | error
 *
 * Mock mode (RAZORPAY_MOCK_MODE=true on backend):
 *   Backend returns order_id='order_mock_…'. We skip the Razorpay SDK and
 *   call verify-payment directly with a synthetic payment_id so the full
 *   activation path runs in both dev and prod-mock environments.
 */
const RazorpayCheckout = ({ planId, onSuccess, onClose }) => {
  const { createOrder, verifyPayment } = useSubscription();
  const { user } = useAuth();
  const [step, setStep]         = useState('init');
  const [error, setError]       = useState(null);
  const [orderData, setOrderData] = useState(null);
  const mountedRef              = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── helpers ──────────────────────────────────────────────────────────────

  const safeSet = (setter, value) => {
    if (mountedRef.current) setter(value);
  };

  const loadRazorpaySDK = useCallback((data) => {
    if (window.Razorpay) {
      openRazorpayModal(data);
      return;
    }

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener('load', () => openRazorpayModal(data), { once: true });
      existing.addEventListener('error', () => {
        safeSet(setError, 'Failed to load payment gateway. Please check your connection.');
        safeSet(setStep, 'error');
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src   = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload  = () => openRazorpayModal(data);
    script.onerror = () => {
      safeSet(setError, 'Failed to load payment gateway. Please check your connection.');
      safeSet(setStep, 'error');
    };
    document.body.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = useCallback(async (paymentId, rzpOrderId, signature) => {
    safeSet(setStep, 'verifying');
    try {
      await verifyPayment({
        razorpay_payment_id: paymentId,
        razorpay_order_id:   rzpOrderId,
        razorpay_signature:  signature,
        plan_id:             planId,
      });
      safeSet(setStep, 'success');
    } catch (err) {
      safeSet(setError, err.response?.data?.message || 'Payment verification failed. Please contact support.');
      safeSet(setStep, 'error');
    }
  }, [verifyPayment, planId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const openRazorpayModal = useCallback((data) => {
    safeSet(setStep, 'awaiting_payment');
    try {
      const options = {
        key:         data.key_id,
        amount:      data.amount,
        currency:    data.currency || 'INR',
        order_id:    data.order_id,
        name:        'Chess99',
        description: `${data.plan?.name || 'Premium'} Subscription`,
        image:       '/logo192.png',
        prefill: {
          name:  data.prefill?.name  || user?.name  || '',
          email: data.prefill?.email || user?.email || '',
        },
        notes: {
          plan_id: planId,
        },
        handler: (response) => {
          handleVerify(
            response.razorpay_payment_id,
            response.razorpay_order_id,
            response.razorpay_signature
          );
        },
        modal: {
          ondismiss: () => {
            safeSet(setError, 'Payment was cancelled.');
            safeSet(setStep, 'error');
          },
        },
        theme: { color: '#81b64c' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('[RazorpayCheckout] Failed to open payment modal:', err);
      safeSet(setError, 'Failed to open payment form. Please try again.');
      safeSet(setStep, 'error');
    }
  }, [user, planId, handleVerify]);

  // ── main flow ─────────────────────────────────────────────────────────────

  const initiateCheckout = useCallback(async () => {
    safeSet(setError, null);
    safeSet(setStep, 'creating_order');

    try {
      const data = await createOrder(planId);
      safeSet(setOrderData, data);

      if (data.mock_mode) {
        // Mock: skip the Razorpay SDK, call verify-payment with synthetic IDs
        const mockPaymentId = 'pay_mock_' + Math.random().toString(36).substr(2, 14);
        await handleVerify(mockPaymentId, data.order_id, 'mock_signature');
        return;
      }

      loadRazorpaySDK(data);
    } catch (err) {
      safeSet(setError, err.response?.data?.message || 'Failed to initialize payment. Please try again.');
      safeSet(setStep, 'error');
    }
  }, [planId, createOrder, loadRazorpaySDK, handleVerify]);

  // kick off on mount
  useEffect(() => {
    initiateCheckout();
  }, [initiateCheckout]);

  // notify parent 1.5 s after success
  useEffect(() => {
    if (step === 'success' && onSuccess) {
      const timer = setTimeout(() => onSuccess(orderData), 1500);
      return () => clearTimeout(timer);
    }
  }, [step, onSuccess, orderData]);

  // ── render ────────────────────────────────────────────────────────────────

  const isBusy = step === 'creating_order' || step === 'verifying';

  return (
    <div
      className="razorpay-checkout-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy && step !== 'awaiting_payment') {
          onClose();
        }
      }}
    >
      <div className="razorpay-checkout-modal">

        {/* ── initialising / creating order ── */}
        {(step === 'init' || step === 'creating_order') && (
          <div className="razorpay-checkout__step">
            <div className="razorpay-checkout__spinner" />
            <p>Preparing your order…</p>
          </div>
        )}

        {/* ── Razorpay modal is open (SDK handles UI) ── */}
        {step === 'awaiting_payment' && (
          <div className="razorpay-checkout__step">
            <div className="razorpay-checkout__spinner" />
            <p>Complete payment in the Razorpay window</p>
            <p className="razorpay-checkout__note">
              Do not close this window until payment is confirmed.
            </p>
          </div>
        )}

        {/* ── verifying signature with backend ── */}
        {step === 'verifying' && (
          <div className="razorpay-checkout__step">
            <div className="razorpay-checkout__spinner" />
            <h3>Activating Subscription</h3>
            <p>Verifying your payment, please wait…</p>
          </div>
        )}

        {/* ── success ── */}
        {step === 'success' && (
          <div className="razorpay-checkout__step razorpay-checkout__step--success">
            <div className="razorpay-checkout__checkmark">✓</div>
            <h3>Subscription Activated!</h3>
            <p>
              Your <strong>{orderData?.plan?.name || 'Premium'}</strong> subscription is now active.
            </p>
          </div>
        )}

        {/* ── error ── */}
        {step === 'error' && (
          <div className="razorpay-checkout__step razorpay-checkout__step--error">
            <div className="razorpay-checkout__error-icon">!</div>
            <h3>Payment Failed</h3>
            <p>{error}</p>
            <div className="razorpay-checkout__actions">
              <button
                className="razorpay-checkout__btn razorpay-checkout__btn--retry"
                onClick={initiateCheckout}
              >
                Try Again
              </button>
              <button
                className="razorpay-checkout__btn razorpay-checkout__btn--cancel"
                onClick={onClose}
              >
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
