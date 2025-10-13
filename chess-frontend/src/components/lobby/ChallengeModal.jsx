import React from 'react';

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
  // Color Choice Modal (when sending challenge)
  if (showColorModal && selectedPlayer) {
    return (
      <div className="invitation-modal">
        <div className="modal-content">
          <h2>⚡ Challenge {selectedPlayer.name}</h2>
          <p> Your preferred color:</p>
          <div className="color-choices">
            <button
              className="color-choice white"
              onClick={() => onColorChoice('white')}
              style={{
                backgroundColor: '#f8f9fa',
                border: '2px solid #dee2e6',
                color: '#212529'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>♔ White</div>


            </button>
            <button
              className="color-choice black"
              onClick={() => onColorChoice('black')}
              style={{
                backgroundColor: '#212529',
                border: '2px solid #495057',
                color: '#f8f9fa'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>♚ Black</div>

            </button>
            <button
              className="color-choice random"
              onClick={() => onColorChoice('random')}
              style={{
                backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: '2px solid #5a67d8',
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
            <>
              <h2>✅ Invitation Sent!</h2>
              <p>
                Your challenge has been sent to {invitedPlayer.name}. They will
                be notified and can accept or decline.
              </p>
              <p>
                You can see the status in your "Sent Invitations" section below.
              </p>
            </>
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
