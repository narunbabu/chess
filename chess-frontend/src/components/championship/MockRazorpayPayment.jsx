// MockRazorpayPayment.jsx
// Mock Razorpay payment component for testing championship registrations with entry fees
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Championship.css';

const MockRazorpayPayment = ({ championship, onSuccess, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('init'); // init, processing, success, error
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    // Auto-initiate payment when component mounts
    initiatePayment();
  }, []);

  const initiatePayment = async () => {
    setLoading(true);
    setError(null);
    setStep('init');

    try {
      // Call the payment registration endpoint
      const response = await api.post(`/championships/${championship.id}/register-with-payment`);

      console.log('Payment initiated:', response.data);
      setOrderDetails(response.data.order_details);

      // For mock testing, automatically proceed to payment after 1 second
      setTimeout(() => {
        if (response.data.payment_required) {
          processMockPayment(response.data);
        } else {
          // Free championship
          setStep('success');
          setTimeout(() => {
            onSuccess(response.data);
          }, 1000);
        }
      }, 1000);

    } catch (err) {
      console.error('Payment initiation failed:', err);

      // Handle already registered error
      if (err.response?.status === 409 || err.response?.data?.code === 'ALREADY_REGISTERED') {
        setError('You are already registered for this championship');
      } else {
        setError(err.response?.data?.message || 'Failed to initiate payment');
      }

      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const processMockPayment = async (paymentData) => {
    setStep('processing');
    setLoading(true);

    // Simulate payment processing delay (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Generate mock payment details
      const mockPaymentId = 'pay_mock_' + Date.now();
      const mockSignature = 'mock_signature_' + Date.now();

      // Call the payment callback endpoint (note: route is /payment/callback not /payment-callback)
      const response = await api.post('/championships/payment/callback', {
        razorpay_payment_id: mockPaymentId,
        razorpay_order_id: paymentData.order_details.order_id,
        razorpay_signature: mockSignature,
      });

      console.log('Mock payment processed:', response.data);
      setStep('success');

      // Call success callback after showing success message
      setTimeout(() => {
        onSuccess(response.data);
      }, 1500);

    } catch (err) {
      console.error('Mock payment processing failed:', err);
      setError(err.response?.data?.message || 'Payment processing failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setStep('init');
    initiatePayment();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💳 Mock Payment Gateway</h2>
          <button className="modal-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        <div className="modal-body">
          {/* Championship Details */}
          <div className="payment-championship-info">
            <h3>{championship.name}</h3>
            <div className="payment-details">
              <div className="payment-row">
                <span className="payment-label">Entry Fee:</span>
                <span className="payment-value">
                  ₹{parseFloat(championship.entry_fee).toFixed(2)}
                </span>
              </div>
              {orderDetails && (
                <div className="payment-row">
                  <span className="payment-label">Order ID:</span>
                  <span className="payment-value mock-text">{orderDetails.order_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Steps */}
          <div className="payment-steps">
            {step === 'init' && (
              <div className="payment-step">
                <div className="spinner"></div>
                <p>Initiating payment...</p>
              </div>
            )}

            {step === 'processing' && (
              <div className="payment-step">
                <div className="spinner"></div>
                <p>Processing mock payment...</p>
                <p className="payment-note">
                  🧪 This is a test payment that will auto-complete
                </p>
              </div>
            )}

            {step === 'success' && (
              <div className="payment-step payment-success">
                <div className="success-icon">✅</div>
                <h3>Payment Successful!</h3>
                <p>You are now registered for the championship</p>
              </div>
            )}

            {step === 'error' && (
              <div className="payment-step payment-error">
                <div className="error-icon">❌</div>
                <h3>Payment Failed</h3>
                <p>{error}</p>
                <button onClick={handleRetry} className="btn btn-primary">
                  Retry Payment
                </button>
              </div>
            )}
          </div>

          {/* Mock Payment Info */}
          <div className="mock-payment-info">
            <p>🧪 <strong>Test Mode:</strong> This is a mock payment system for testing.</p>
            <p>Real payments will use Razorpay integration.</p>
          </div>
        </div>

        <div className="modal-footer">
          {step !== 'processing' && step !== 'init' && (
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MockRazorpayPayment;
