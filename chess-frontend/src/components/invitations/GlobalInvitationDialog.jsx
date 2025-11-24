// src/components/invitations/GlobalInvitationDialog.jsx
import React, { useState } from 'react';
import { useGlobalInvitation } from '../../contexts/GlobalInvitationContext';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import './GlobalInvitationDialog.css';

/**
 * GlobalInvitationDialog - App-wide dialog for game invitations and resume requests
 * Appears across all pages except during active gameplay
 */
const GlobalInvitationDialog = () => {
  const {
    pendingInvitation,
    resumeRequest,
    championshipResumeRequest,
    isProcessing,
    acceptInvitation,
    declineInvitation,
    acceptResumeRequest,
    declineResumeRequest,
    acceptChampionshipResumeRequest,
    declineChampionshipResumeRequest,
  } = useGlobalInvitation();

  const [showColorChoice, setShowColorChoice] = useState(false);

  // Handle initial accept click - show color choice
  const handleAcceptClick = () => {
    if (pendingInvitation) {
      setShowColorChoice(true);
    } else if (resumeRequest) {
      acceptResumeRequest(resumeRequest.gameId);
    } else if (championshipResumeRequest) {
      acceptChampionshipResumeRequest(championshipResumeRequest.matchId, championshipResumeRequest.gameId);
    }
  };

  // Handle color choice for game invitation
  const handleColorChoice = (color) => {
    if (!pendingInvitation) return;

    const inviterColor = pendingInvitation.inviter_preferred_color;
    let myColor = color;

    // If user wants to accept inviter's choice, assign opposite color
    if (color === 'accept') {
      myColor = inviterColor === 'white' ? 'black' : 'white';
    }

    acceptInvitation(pendingInvitation.id, myColor);
    setShowColorChoice(false);
  };

  // Handle decline
  const handleDeclineClick = () => {
    if (pendingInvitation) {
      declineInvitation(pendingInvitation.id);
    } else if (resumeRequest) {
      declineResumeRequest(resumeRequest.gameId);
    } else if (championshipResumeRequest) {
      declineChampionshipResumeRequest(championshipResumeRequest.matchId);
    }
    setShowColorChoice(false);
  };

  // Handle cancel color choice
  const handleCancelColorChoice = () => {
    setShowColorChoice(false);
  };

  // Don't render if no invitation or resume request
  if (!pendingInvitation && !resumeRequest && !championshipResumeRequest) {
    return null;
  }

  return (
    <div className="global-invitation-overlay">
      <div className="global-invitation-dialog">
        {/* Game Invitation Flow */}
        {pendingInvitation && !showColorChoice && (
          <>
            <div className="dialog-header">
              <h2>🎮 Game Invitation</h2>
            </div>
            <div className="dialog-body">
              <div className="invitation-info">
                <img
                  src={
                    getPlayerAvatar(pendingInvitation.inviter) ||
                    `https://i.pravatar.cc/150?u=${pendingInvitation.inviter.email || `user${pendingInvitation.inviter.id}`}`
                  }
                  alt={pendingInvitation.inviter.name}
                  className="inviter-avatar"
                />
                <div className="invitation-text">
                  <p className="inviter-name">{pendingInvitation.inviter.name}</p>
                  <p className="invitation-message">wants to play chess with you!</p>
                  <p className="invitation-meta">
                    {new Date(pendingInvitation.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-accept"
                onClick={handleAcceptClick}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Accepting...' : '✅ Accept'}
              </button>
              <button
                className="btn-decline"
                onClick={handleDeclineClick}
                disabled={isProcessing}
              >
                ❌ Decline
              </button>
            </div>
          </>
        )}

        {/* Color Choice Flow for Game Invitation */}
        {pendingInvitation && showColorChoice && (
          <>
            <div className="dialog-header">
              <h2>🎯 Choose Your Color</h2>
            </div>
            <div className="dialog-body">
              <p className="color-choice-intro">
                {pendingInvitation.inviter.name} wants to play as{' '}
                {pendingInvitation.inviter_preferred_color === 'white' ? '♔ White' : '♚ Black'}
              </p>
              <div className="color-choices">
                <button
                  className="color-choice-btn accept"
                  onClick={() => handleColorChoice('accept')}
                  disabled={isProcessing}
                >
                  {isProcessing ? '⏳ Accepting...' : '✅ Accept their choice'}
                  {!isProcessing && (
                    <small>
                      (You'll play as{' '}
                      {pendingInvitation.inviter_preferred_color === 'white' ? '♚ Black' : '♔ White'})
                    </small>
                  )}
                </button>
                <button
                  className="color-choice-btn opposite"
                  onClick={() => handleColorChoice(pendingInvitation.inviter_preferred_color)}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? '⏳ Accepting...'
                    : `🔄 Play as ${pendingInvitation.inviter_preferred_color === 'white' ? '♔ White' : '♚ Black'}`}
                  {!isProcessing && <small>(swap colors)</small>}
                </button>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-cancel"
                onClick={handleCancelColorChoice}
                disabled={isProcessing}
              >
                ← Back
              </button>
              <button
                className="btn-decline"
                onClick={handleDeclineClick}
                disabled={isProcessing}
              >
                ❌ Decline
              </button>
            </div>
          </>
        )}

        {/* Resume Request Flow */}
        {resumeRequest && (
          <>
            <div className="dialog-header">
              <h2>🔄 Resume Game Request</h2>
            </div>
            <div className="dialog-body">
              <div className="resume-info">
                <p className="resume-message">
                  <strong>{resumeRequest.requestingUserName}</strong> wants to resume the paused game!
                </p>
                {resumeRequest.expiresAt && (
                  <p className="resume-meta">
                    Expires: {new Date(resumeRequest.expiresAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-accept resume"
                onClick={handleAcceptClick}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Resuming...' : '▶️ Resume'}
              </button>
              <button
                className="btn-decline"
                onClick={handleDeclineClick}
                disabled={isProcessing}
              >
                ❌ Decline
              </button>
            </div>
          </>
        )}

        {/* Championship Resume Request Flow */}
        {championshipResumeRequest && (
          <>
            <div className="dialog-header">
              <h2>🏆 Championship Game Request</h2>
            </div>
            <div className="dialog-body">
              <div className="resume-info">
                <div className="invitation-info">
                  <img
                    src={
                      championshipResumeRequest.requester.avatar_url ||
                      `https://i.pravatar.cc/150?u=championship${championshipResumeRequest.requester.id}`
                    }
                    alt={championshipResumeRequest.requester.name}
                    className="inviter-avatar"
                  />
                  <div className="invitation-text">
                    <p className="inviter-name">{championshipResumeRequest.requester.name}</p>
                    <p className="invitation-message">wants to start your championship match!</p>
                    <p className="invitation-meta">
                      🏆 Championship Match #{championshipResumeRequest.matchId}
                    </p>
                    {championshipResumeRequest.expiresAt && (
                      <p className="invitation-meta">
                        ⏰ Expires: {new Date(championshipResumeRequest.expiresAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-accept championship"
                onClick={handleAcceptClick}
                disabled={isProcessing}
              >
                {isProcessing ? '⏳ Starting...' : '🏆 Accept & Play'}
              </button>
              <button
                className="btn-decline"
                onClick={handleDeclineClick}
                disabled={isProcessing}
              >
                ❌ Decline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GlobalInvitationDialog;
