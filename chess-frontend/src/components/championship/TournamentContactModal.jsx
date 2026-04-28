import React, { useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import './TournamentContactModal.css';

const TournamentContactModal = ({ isOpen, onClose, onSuccess }) => {
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const normalizeNumber = (num) => num.replace(/[\s\-()]/g, '');

  const validate = () => {
    const digits = normalizeNumber(mobileNumber);
    if (!digits) return 'Please enter your mobile number.';
    if (countryCode === '+91') {
      if (!/^\d{10}$/.test(digits)) return 'Indian numbers must be 10 digits.';
    } else if (!/^\d{6,15}$/.test(digits)) {
      return 'Mobile number must be 6-15 digits.';
    }
    if (!consent) return 'Please accept the consent to proceed.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`${BACKEND_URL}/profile/tournament-contact`, {
        mobile_country_code: countryCode,
        mobile_number: normalizeNumber(mobileNumber),
        tournament_contact_consent: consent,
        whatsapp_updates_opt_in: whatsappOptIn,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save contact details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="tournament-contact-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tournament contact number</h2>
          <button className="modal-close" onClick={handleCancel}>&times;</button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Your number is used for coordination, venue details, prize distribution,
            and learning materials. It is never shown publicly on your profile or leaderboard.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mobile-input-row">
              <input
                type="text"
                className="country-code-input"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="+91"
                maxLength={8}
              />
              <input
                type="tel"
                className="mobile-number-input"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Mobile number"
                autoFocus
              />
            </div>

            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I consent to Chess99 using my mobile number for tournament communication
              </span>
            </label>

            <label className="consent-checkbox whatsapp-checkbox">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
              />
              <span>Send me tournament updates via WhatsApp</span>
            </label>

            {error && <div className="contact-error">{error}</div>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TournamentContactModal;
