// src/components/invitations/GlobalInvitationDialog.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useGlobalInvitation } from '../../contexts/GlobalInvitationContext';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import './GlobalInvitationDialog.css';

/**
 * GlobalInvitationDialog - App-wide dialog for game invitations and resume requests
 * Appears across all pages except during active gameplay
 */
const GlobalInvitationDialog = () => {
  console.log('[GlobalInvitationDialog] 🏗️ Dialog component rendering');

  const {
    pendingInvitation,
    resumeRequest,
    championshipResumeRequest,
    pendingMatchRequest,
    isProcessing,
    acceptInvitation,
    declineInvitation,
    acceptResumeRequest,
    declineResumeRequest,
    acceptChampionshipResumeRequest,
    declineChampionshipResumeRequest,
    acceptMatchRequest,
    declineMatchRequest,
  } = useGlobalInvitation();

  console.log('[GlobalInvitationDialog] 🔍 Dialog render state:', {
    hasPendingInvitation: !!pendingInvitation,
    hasResumeRequest: !!resumeRequest,
    hasChampionshipResumeRequest: !!championshipResumeRequest,
    hasPendingMatchRequest: !!pendingMatchRequest,
  });

  const [showColorChoice, setShowColorChoice] = useState(false);

  // Countdown timer for match requests
  const [matchRequestSecondsLeft, setMatchRequestSecondsLeft] = useState(0);
  const matchRequestTimerRef = useRef(null);

  useEffect(() => {
    if (pendingMatchRequest?.expires_at) {
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((new Date(pendingMatchRequest.expires_at) - Date.now()) / 1000));
        setMatchRequestSecondsLeft(remaining);
        if (remaining <= 0) {
          // Auto-decline when expired
          declineMatchRequest(pendingMatchRequest.token);
        }
      };
      updateCountdown();
      matchRequestTimerRef.current = setInterval(updateCountdown, 500);
      return () => clearInterval(matchRequestTimerRef.current);
    } else {
      setMatchRequestSecondsLeft(0);
      if (matchRequestTimerRef.current) clearInterval(matchRequestTimerRef.current);
    }
  }, [pendingMatchRequest, declineMatchRequest]);

  // Countdown timer for game invitations (10 seconds auto-decline)
  const [invitationSecondsLeft, setInvitationSecondsLeft] = useState(0);
  const invitationTimerRef = useRef(null);

  useEffect(() => {
    if (pendingInvitation && pendingInvitation.type !== 'new_game_request') {
      const INVITATION_TIMEOUT = 10; // seconds
      setInvitationSecondsLeft(INVITATION_TIMEOUT);
      invitationTimerRef.current = setInterval(() => {
        setInvitationSecondsLeft(prev => {
          const next = prev - 1;
          if (next <= 0) {
            clearInterval(invitationTimerRef.current);
            // Auto-decline expired invitation
            declineInvitation(pendingInvitation.id);
          }
          return Math.max(0, next);
        });
      }, 1000);
      return () => clearInterval(invitationTimerRef.current);
    } else {
      setInvitationSecondsLeft(0);
      if (invitationTimerRef.current) clearInterval(invitationTimerRef.current);
    }
  }, [pendingInvitation, declineInvitation]);

  // Debug logging
  React.useEffect(() => {
    console.log('[GlobalInvitationDialog] 🎨 State update:', {
      hasPendingInvitation: !!pendingInvitation,
      hasResumeRequest: !!resumeRequest,
      hasChampionshipResumeRequest: !!championshipResumeRequest,
      resumeRequest: resumeRequest,
      shouldRender: !!(pendingInvitation || resumeRequest || championshipResumeRequest)
    });

    if (resumeRequest) {
      console.log('[GlobalInvitationDialog] ✅ Resume request detected! Dialog should be visible now');
      console.log('[GlobalInvitationDialog] 📋 Resume request details:', {
        gameId: resumeRequest.gameId,
        requester: resumeRequest.requestingUserName,
        expiresAt: resumeRequest.expiresAt
      });
    }
  }, [pendingInvitation, resumeRequest, championshipResumeRequest]);

  // Handle initial accept click - show color choice
  const handleAcceptClick = () => {
    if (pendingInvitation) {
      // For new game requests (rematch challenges), don't show color choice - game is already created
      if (pendingInvitation.type === 'new_game_request') {
        acceptInvitation(pendingInvitation.id, null); // Color doesn't matter for new game requests
      } else {
        setShowColorChoice(true);
      }
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
      declineChampionshipResumeRequest(championshipResumeRequest.matchId, championshipResumeRequest.gameId);
    }
    setShowColorChoice(false);
  };

  // Handle cancel color choice
  const handleCancelColorChoice = () => {
    setShowColorChoice(false);
  };

  // Don't render if no invitation, resume request, or match request
  if (!pendingInvitation && !resumeRequest && !championshipResumeRequest && !pendingMatchRequest) {
    return null;
  }

  return (
    <div className="global-invitation-overlay">
      <div className="global-invitation-dialog">
        {/* Game Invitation Flow */}
        {pendingInvitation && !showColorChoice && (
          <>
            <div className="dialog-header">
              <h2>
                {pendingInvitation.type === 'new_game_request' ? '🎯 Rematch Challenge' : '🎮 Game Invitation'}
              </h2>
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
                  <p className="invitation-message">
                    {pendingInvitation.type === 'new_game_request'
                      ? 'has challenged you to a rematch! The game is ready to play.'
                      : 'wants to play chess with you!'
                    }
                  </p>
                  {pendingInvitation.type === 'new_game_request' && pendingInvitation.inviter_preferred_color && (
                    <p className="invitation-meta">
                      They want to play as {pendingInvitation.inviter_preferred_color === 'white' ? '♔ White' : '♚ Black'}
                      {pendingInvitation.inviter_preferred_color === 'random' && ' (Random colors)'}
                    </p>
                  )}
                  {/* Show game settings from invitation metadata */}
                  {pendingInvitation.metadata && (
                    <p className="invitation-meta" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {pendingInvitation.metadata.time_control_minutes && (
                        <span>⏱️ {pendingInvitation.metadata.time_control_minutes}+{pendingInvitation.metadata.increment_seconds || 0}</span>
                      )}
                      {pendingInvitation.metadata.game_mode && (
                        <span>{pendingInvitation.metadata.game_mode === 'rated' ? '⭐ Rated' : '📋 Casual'}</span>
                      )}
                    </p>
                  )}
                  {invitationSecondsLeft > 0 && (
                    <p className="invitation-meta" style={{
                      color: invitationSecondsLeft <= 3 ? '#e74c3c' : '#e8a93e',
                      fontWeight: 'bold',
                      fontSize: '16px',
                    }}>
                      ⏳ Expires in {invitationSecondsLeft}s
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-accept"
                onClick={handleAcceptClick}
                disabled={isProcessing}
              >
                {isProcessing
                  ? '⏳ Accepting...'
                  : pendingInvitation.type === 'new_game_request'
                    ? '🚀 Play Now'
                    : '✅ Accept'
                }
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
        {pendingInvitation && showColorChoice && pendingInvitation.type !== 'new_game_request' && (
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

        {/* Match Request Flow (smart matchmaking) */}
        {pendingMatchRequest && (
          <>
            <div className="dialog-header">
              <h2>&#9812; Match Request</h2>
            </div>
            <div className="dialog-body">
              <div className="invitation-info">
                <img
                  src={
                    pendingMatchRequest.requester.avatar_url ||
                    getPlayerAvatar(pendingMatchRequest.requester) ||
                    `https://i.pravatar.cc/150?u=user${pendingMatchRequest.requester.id}`
                  }
                  alt={pendingMatchRequest.requester.name}
                  className="inviter-avatar"
                />
                <div className="invitation-text">
                  <p className="inviter-name">{pendingMatchRequest.requester.name}</p>
                  <p className="invitation-message">
                    wants to play you!
                  </p>
                  <p className="invitation-meta">
                    Rating: {pendingMatchRequest.requester.rating || '?'}
                  </p>
                  <p className="invitation-meta">
                    ⏱️ {pendingMatchRequest.time_control_minutes}+{pendingMatchRequest.increment_seconds}
                    {' '}&bull;{' '}
                    {pendingMatchRequest.game_mode === 'rated' ? '⭐ Rated' : pendingMatchRequest.game_mode === 'casual' ? '📋 Casual' : '⭐ Rated'}
                  </p>
                  {matchRequestSecondsLeft > 0 && (
                    <p className="invitation-meta" style={{ color: matchRequestSecondsLeft <= 5 ? '#e74c3c' : '#f39c12', fontWeight: 'bold' }}>
                      {matchRequestSecondsLeft}s remaining
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="btn-accept"
                onClick={() => acceptMatchRequest(pendingMatchRequest.token)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Accepting...' : 'Accept'}
              </button>
              <button
                className="btn-decline"
                onClick={() => declineMatchRequest(pendingMatchRequest.token)}
                disabled={isProcessing}
              >
                Decline
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
