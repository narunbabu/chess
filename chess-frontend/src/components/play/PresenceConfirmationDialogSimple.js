import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';

// Add global styles for the pulse animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.02);
    }
  }
`;
if (!document.head.querySelector('style[data-presence-dialog]')) {
  styleSheet.setAttribute('data-presence-dialog', 'true');
  document.head.appendChild(styleSheet);
}

const PresenceConfirmationDialogSimple = ({
  open,
  onConfirm,
  onCloseTimeout,
  countdownSeconds = 10
}) => {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const deadlineRef = useRef(null);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    // Log only when open actually changes
    if (prevOpenRef.current !== open) {
      console.log('[PresenceConfirmationDialogSimple] open changed:', open);
      prevOpenRef.current = open;
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      // Set deadline only once per open
      if (!deadlineRef.current) {
        deadlineRef.current = Date.now() + countdownSeconds * 1000;
        setSecondsLeft(countdownSeconds);
      }
    } else {
      // Cleanup when closed
      deadlineRef.current = null;
      setSecondsLeft(countdownSeconds);
    }
  }, [open, countdownSeconds]);

  // Drive countdown toward the deadline
  useEffect(() => {
    if (!open || !deadlineRef.current) return;

    const id = setInterval(() => {
      const remainingMs = deadlineRef.current - Date.now();
      const next = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(next);

      if (next === 0) {
        clearInterval(id);
        deadlineRef.current = null;
        onCloseTimeout?.();
      }
    }, 250); // Smooth updates

    return () => clearInterval(id);
  }, [open, onCloseTimeout]);

  if (!open) {
    return null;
  }

  // Render via portal to document.body with max z-index to avoid stacking context issues
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 2147483647, // Maximum practical z-index
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          minWidth: 320,
          maxWidth: 480,
          padding: 24,
          background: '#111',
          color: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          textAlign: 'center'
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16, color: '#fff' }}>Are you still there?</h3>
        <p style={{ marginBottom: 24, color: '#ccc' }}>
          We'll pause the game in {secondsLeft}s due to inactivity.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={onConfirm}
            style={{
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              fontSize: '16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            I'm here
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

PresenceConfirmationDialogSimple.propTypes = {
  open: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCloseTimeout: PropTypes.func.isRequired,
  countdownSeconds: PropTypes.number
};

export default PresenceConfirmationDialogSimple;