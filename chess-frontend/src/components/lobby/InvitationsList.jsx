import React from 'react';
import '../../styles/UnifiedCards.css';

/**
 * InvitationsList - Displays pending and sent invitations
 * Pure UI component with no business logic
 *
 * @param {array} pendingInvitations - List of received invitations
 * @param {array} sentInvitations - List of sent invitations
 * @param {Set} processingInvitations - Set of invitation IDs currently being processed
 * @param {function} onAccept - Callback when accept button is clicked
 * @param {function} onDecline - Callback when decline button is clicked
 * @param {function} onCancel - Callback when cancel button is clicked
 */
const InvitationsList = ({
  pendingInvitations,
  sentInvitations,
  processingInvitations,
  onAccept,
  onDecline,
  onCancel,
}) => {
  return (
    <>
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="unified-section">
          <h2 className="unified-section-header">🔔 Incoming Invitations</h2>
          <div className="unified-card-grid cols-2">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="unified-card horizontal">
                <img
                  src={
                    invitation.inviter.avatar ||
                    `https://i.pravatar.cc/150?u=${invitation.inviter.email}`
                  }
                  alt={invitation.inviter.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">{invitation.inviter.name}</h3>
                  <p className="unified-card-subtitle">wants to play chess with you!</p>
                  <p className="unified-card-meta">
                    {new Date(invitation.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="unified-card-actions">
                  <button
                    className="unified-card-btn primary"
                    onClick={() => onAccept(invitation.id)}
                    disabled={processingInvitations.has(invitation.id)}
                  >
                    {processingInvitations.has(invitation.id)
                      ? '⏳ Accepting...'
                      : '✅ Accept'}
                  </button>
                  <button
                    className="unified-card-btn secondary"
                    onClick={() => onDecline(invitation.id)}
                    disabled={processingInvitations.has(invitation.id)}
                  >
                    ❌ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Invitations */}
      {sentInvitations.length > 0 && (
        <div className="unified-section">
          <h2 className="unified-section-header">📤 Sent Invitations</h2>
          <div className="unified-card-grid cols-2">
            {sentInvitations.map((invitation) => (
              <div key={invitation.id} className="unified-card horizontal">
                <img
                  src={
                    invitation.invited.avatar ||
                    `https://i.pravatar.cc/150?u=${invitation.invited.email}`
                  }
                  alt={invitation.invited.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">{invitation.invited.name}</h3>
                  <p className="unified-card-subtitle">⏰ Waiting for response...</p>
                  <p className="unified-card-meta">
                    Sent: {new Date(invitation.created_at).toLocaleTimeString()}
                  </p>
                  <p className="unified-card-status paused">
                    🔄 Waiting for acceptance...
                  </p>
                </div>
                <div className="unified-card-actions">
                  <button
                    className="unified-card-btn neutral"
                    onClick={() => onCancel(invitation.id)}
                  >
                    🚫 Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingInvitations.length === 0 && sentInvitations.length === 0 && (
        <div className="unified-section">
          <div className="unified-empty-state">
            <p>📭 No pending invitations</p>
            <p>Challenge a player to start a game!</p>
          </div>
        </div>
      )}
    </>
  );
};

export default InvitationsList;
