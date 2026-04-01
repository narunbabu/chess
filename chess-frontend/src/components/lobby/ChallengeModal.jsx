import React, { useState, useEffect } from 'react';
import { getPreferredGameMode } from '../../utils/gamePreferences';

const SentCountdown = ({ invitedPlayer }) => {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCancel = () => {
    if (window.__pendingInvitationCancel?.cancel) {
      window.__pendingInvitationCancel.cancel();
    }
  };

  return (
    <>
      <h2>⏳ Waiting for {invitedPlayer?.name}...</h2>
      <p>Challenge sent. Waiting for response...</p>
      <p style={{
        fontSize: '28px',
        fontWeight: 'bold',
        color: secondsLeft <= 3 ? '#e74c3c' : '#e8a93e',
        margin: '12px 0',
      }}>
        {secondsLeft}s
      </p>
      <div style={{
        width: '100%',
        height: '4px',
        background: '#3d3a37',
        borderRadius: '2px',
        overflow: 'hidden',
        margin: '8px 0 16px',
      }}>
        <div style={{
          width: `${(secondsLeft / 10) * 100}%`,
          height: '100%',
          background: secondsLeft <= 3 ? '#e74c3c' : '#81b64c',
          transition: 'width 1s linear',
          borderRadius: '2px',
        }} />
      </div>
      <button
        onClick={handleCancel}
        style={{
          padding: '8px 24px',
          background: 'transparent',
          border: '2px solid #e74c3c',
          color: '#e74c3c',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
      >
        Cancel Challenge
      </button>
    </>
  );
};

const TIME_PRESETS = [
  { minutes: 3, increment: 1, label: '3|1', category: 'Blitz' },
  { minutes: 3, increment: 2, label: '3|2', category: 'Blitz' },
  { minutes: 5, increment: 2, label: '5|2', category: 'Blitz' },
  { minutes: 5, increment: 3, label: '5|3', category: 'Blitz' },
  { minutes: 10, increment: 0, label: '10 min', category: 'Rapid' },
  { minutes: 10, increment: 5, label: '10|5', category: 'Rapid' },
  { minutes: 15, increment: 10, label: '15|10', category: 'Rapid' },
  { minutes: 30, increment: 0, label: '30 min', category: 'Classical' },
];

/**
 * ChallengeModal - Displays modals for challenge/invitation interactions
 * Pure UI component with no business logic
 *
 * Handles 3 modal types:
 * 1. Color Choice Modal (when sending challenge)
 * 2. Response Modal (when accepting invitation)
 * 3. Status Modal (showing sending/sent/error status)
 */
const ChallengeModal = ({
  // Color Choice Modal props
  showColorModal,
  selectedPlayer,
  onColorChoice,
  onCancelColorChoice,

  // Response Modal props
  showResponseModal,
  selectedInvitation,
  processingInvitations,
  onAcceptWithColor,
  onCancelResponse,
  onDeclineInvitation,

  // Status Modal props
  inviteStatus,
  invitedPlayer,
}) => {
  const [gameMode, setGameMode] = React.useState(() => getPreferredGameMode());
  const [timeControl, setTimeControl] = React.useState(10);
  const [increment, setIncrement] = React.useState(5);

  // Color Choice Modal (when sending challenge)
  if (showColorModal && selectedPlayer) {
    const categories = [...new Set(TIME_PRESETS.map(p => p.category))];

    return (
      <div className="invitation-modal">
        <div className="modal-content">
          <h2>⚡ Challenge {selectedPlayer.name}</h2>

          {/* Game Mode Selection */}
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#bababa' }}>Game Mode:</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{
                flex: 1,
                padding: '12px',
                border: `2px solid ${gameMode === 'casual' ? '#81b64c' : '#4a4744'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: gameMode === 'casual' ? 'rgba(129, 182, 76, 0.15)' : 'transparent'
              }}>
                <input
                  type="radio"
                  value="casual"
                  checked={gameMode === 'casual'}
                  onChange={(e) => setGameMode(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                <strong style={{ color: '#ffffff' }}>Casual</strong>
                <div style={{ fontSize: '12px', color: '#8b8987', marginTop: '4px' }}>
                  Undo allowed • Can pause • No rating changes
                </div>
              </label>
              <label style={{
                flex: 1,
                padding: '12px',
                border: `2px solid ${gameMode === 'rated' ? '#e8a93e' : '#4a4744'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: gameMode === 'rated' ? 'rgba(232, 169, 62, 0.15)' : 'transparent'
              }}>
                <input
                  type="radio"
                  value="rated"
                  checked={gameMode === 'rated'}
                  onChange={(e) => setGameMode(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                <strong style={{ color: '#ffffff' }}>Rated</strong>
                <div style={{ fontSize: '12px', color: '#8b8987', marginTop: '4px' }}>
                  No undo • No pause • Rating changes
                </div>
              </label>
            </div>
          </div>

          {/* Time Control Selection */}
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <p style={{ marginBottom: '10px', fontWeight: 'bold', color: '#bababa' }}>Time Control:</p>
            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '11px', color: '#8b8987', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {TIME_PRESETS.filter(p => p.category === cat).map(preset => {
                    const isSelected = timeControl === preset.minutes && increment === preset.increment;
                    return (
                      <button
                        key={`${preset.minutes}-${preset.increment}`}
                        onClick={() => { setTimeControl(preset.minutes); setIncrement(preset.increment); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '16px',
                          border: `2px solid ${isSelected ? '#81b64c' : '#4a4744'}`,
                          backgroundColor: isSelected ? 'rgba(129, 182, 76, 0.2)' : 'transparent',
                          color: isSelected ? '#81b64c' : '#bababa',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p>Choose your preferred color:</p>
          <div className="color-choices">
            <button
              className="color-choice white"
              onClick={() => onColorChoice('white', gameMode, timeControl, increment)}
              style={{
                backgroundColor: '#e0e0e0',
                border: '2px solid #4a4744',
                color: '#1a1a18'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>♔ White</div>


            </button>
            <button
              className="color-choice black"
              onClick={() => onColorChoice('black', gameMode, timeControl, increment)}
              style={{
                backgroundColor: '#1a1a18',
                border: '2px solid #4a4744',
                color: '#bababa'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>♚ Black</div>

            </button>
            <button
              className="color-choice random"
              onClick={() => onColorChoice('random', gameMode, timeControl, increment)}
              style={{
                backgroundColor: '#81b64c',
                border: '2px solid #769656',
                color: '#ffffff'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎲 Random</div>


            </button>
          </div>
          <button className="cancel-btn" onClick={onCancelColorChoice}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Response Modal (when accepting invitation)
  if (showResponseModal && selectedInvitation) {
    const isProcessing = processingInvitations.has(selectedInvitation.id);
    const inviterColor = selectedInvitation.inviter_preferred_color;

    return (
      <div className="invitation-modal">
        <div className="modal-content">
          <h2>🎯 Accept Challenge from {selectedInvitation.inviter.name}</h2>
          <p>
            {selectedInvitation.inviter.name} wants to play as{' '}
            {inviterColor === 'white' ? '♔ White' : '♚ Black'}
          </p>
          <p>Choose your response:</p>
          <div className="color-choices">
            <button
              className="color-choice accept"
              onClick={() => {
                const myColor = inviterColor === 'white' ? 'black' : 'white';
                onAcceptWithColor(selectedInvitation.id, myColor);
              }}
              disabled={isProcessing}
            >
              {isProcessing ? '⏳ Accepting...' : '✅ Accept their choice'}
              {!isProcessing && (
                <small>
                  (You'll play as{' '}
                  {inviterColor === 'white' ? '♚ Black' : '♔ White'})
                </small>
              )}
            </button>
            <button
              className="color-choice opposite"
              onClick={() => onAcceptWithColor(selectedInvitation.id, inviterColor)}
              disabled={isProcessing}
            >
              {isProcessing
                ? '⏳ Accepting...'
                : `🔄 Play as ${inviterColor === 'white' ? '♔ White' : '♚ Black'}`}
              {!isProcessing && <small>(swap colors)</small>}
            </button>
          </div>
          <div className="modal-actions">
            <button className="cancel-btn" onClick={onCancelResponse}>
              Cancel
            </button>
            <button
              className="decline-btn"
              onClick={() => onDeclineInvitation(selectedInvitation.id)}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Status Modal (showing sending/sent/error status)
  if (inviteStatus && invitedPlayer) {
    return (
      <div className="invitation-modal">
        <div className="modal-content">
          {inviteStatus === 'sending' && (
            <>
              <h2>Sending Invitation...</h2>
              <p>Sending challenge to {invitedPlayer.name}...</p>
              <div className="loader"></div>
            </>
          )}
          {inviteStatus === 'sent' && (
            <SentCountdown invitedPlayer={invitedPlayer} />
          )}
          {inviteStatus === 'error' && (
            <>
              <h2>❌ Error</h2>
              <p>
                Failed to send invitation to {invitedPlayer.name}. Please try
                again.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ChallengeModal;
