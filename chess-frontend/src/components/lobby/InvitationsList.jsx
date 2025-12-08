import React from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
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
                    getPlayerAvatar(invitation.inviter) ||
                    `https://i.pravatar.cc/150?u=${invitation.inviter.email || `user${invitation.inviter.id}`}`
                  }
                  alt={invitation.inviter.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">{invitation.inviter.name}</h3>
                  <p className="unified-card-subtitle">{invitation.inviter.email}</p>
                  <p className="unified-card-info">
                    {invitation.type === 'resume_request'
                      ? '🔄 wants to resume the paused game!'
                      : 'wants to play chess with you!'
                    }
                  </p>
                  <p className="unified-card-meta">
                    {new Date(invitation.created_at).toLocaleTimeString()}
                    {invitation.expires_at && (
                      <span> • Expires: {new Date(invitation.expires_at).toLocaleTimeString()}</span>
                    )}
                  </p>
                </div>
                <div className="unified-card-actions">
                  <button
                    className={`unified-card-btn ${invitation.type === 'resume_request' ? 'warning' : 'primary'}`}
                    onClick={() => onAccept(invitation.id)}
                    disabled={processingInvitations.has(invitation.id)}
                  >
                    {processingInvitations.has(invitation.id)
                      ? '⏳ Accepting...'
                      : invitation.type === 'resume_request'
                        ? '▶️ Resume'
                        : '✅ Accept'
                    }
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
                    getPlayerAvatar(invitation.invited) ||
                    `https://i.pravatar.cc/150?u=${invitation.invited.email || `user${invitation.invited.id}`}`
                  }
                  alt={invitation.invited.name}
                  className="unified-card-avatar"
                />
                <div className="unified-card-content">
                  <h3 className="unified-card-title">{invitation.invited.name}</h3>
                  <p className="unified-card-subtitle">{invitation.invited.email}</p>
                  <p className="unified-card-info">
                    {invitation.type === 'resume_request'
                      ? '🔄 Resume request sent'
                      : '⏰ Waiting for response...'
                    }
                  </p>
                  <p className="unified-card-meta">
                    Sent: {new Date(invitation.created_at).toLocaleTimeString()}
                    {invitation.expires_at && (
                      <span> • Expires: {new Date(invitation.expires_at).toLocaleTimeString()}</span>
                    )}
                  </p>
                  <p className={`unified-card-status ${invitation.type === 'resume_request' ? 'paused' : 'pending'}`}>
                    {invitation.type === 'resume_request'
                      ? '⏱️ Waiting for opponent to accept...'
                      : '🔄 Waiting for acceptance...'
                    }
                  </p>
                </div>
                <div className="unified-card-actions">
                  <button
                    className="unified-card-btn neutral"
                    onClick={() => onCancel(invitation.id)}
                  >
                    {invitation.type === 'resume_request' ? '❌ Cancel Request' : '🚫 Cancel'}
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
