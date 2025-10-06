import React from 'react';

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
        <div className="invitations-section">
          <h2>🔔 Incoming Invitations</h2>
          <div className="invitations-list">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="invitation-card">
                <img
                  src={
                    invitation.inviter.avatar ||
                    `https://i.pravatar.cc/150?u=${invitation.inviter.email}`
                  }
                  alt={invitation.inviter.name}
                  className="invitation-avatar"
                />
                <div className="invitation-info">
                  <h4>{invitation.inviter.name}</h4>
                  <p>wants to play chess with you!</p>
                  <p className="invitation-time">
                    {new Date(invitation.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="invitation-actions">
                  <button
                    className="accept-btn"
                    onClick={() => onAccept(invitation.id)}
                    disabled={processingInvitations.has(invitation.id)}
                  >
                    {processingInvitations.has(invitation.id)
                      ? '⏳ Accepting...'
                      : '✅ Accept'}
                  </button>
                  <button
                    className="decline-btn"
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
        <div className="invitations-section">
          <h2>📤 Sent Invitations</h2>
          <div className="invitations-list">
            {sentInvitations.map((invitation) => (
              <div key={invitation.id} className="invitation-card">
                <img
                  src={
                    invitation.invited.avatar ||
                    `https://i.pravatar.cc/150?u=${invitation.invited.email}`
                  }
                  alt={invitation.invited.name}
                  className="invitation-avatar"
                />
                <div className="invitation-info">
                  <h4>{invitation.invited.name}</h4>
                  <p>⏰ Waiting for response...</p>
                  <p className="invitation-time">
                    Sent: {new Date(invitation.created_at).toLocaleTimeString()}
                  </p>
                  <p className="invitation-status">
                    🔄 Waiting for acceptance...
                  </p>
                </div>
                <div className="invitation-actions">
                  <button
                    className="cancel-btn"
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
        <div className="invitations-section">
          <div className="no-players">
            <p>📭 No pending invitations</p>
            <p>Challenge a player to start a game!</p>
          </div>
        </div>
      )}
    </>
  );
};

export default InvitationsList;
