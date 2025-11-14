import React, { useState, useEffect } from 'react';
import { getPlayerAvatar } from '../../utils/playerDisplayUtils';
import '../../styles/UnifiedCards.css';

/**
 * ChampionshipMatchInvitation - Handles tournament match invitations
 * Manages invitation lifecycle for championship matches
 */
const ChampionshipMatchInvitation = ({
  invitation,
  match,
  championship,
  onAccept,
  onDecline,
  onCancel,
  isProcessing = false
}) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState(invitation?.status || 'pending');

  useEffect(() => {
    if (!invitation?.expires_at) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setStatus('expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [invitation?.expires_at]);

  const getInviterPlayer = () => {
    if (!match) return null;

    // Use enhanced color assignment if available
    if (match.white_player_id && match.black_player_id) {
      return match.white_player;
    }

    // Fallback to legacy player1/player2
    return match.player1;
  };

  const getInvitedPlayer = () => {
    if (!match) return null;

    // Use enhanced color assignment if available
    if (match.white_player_id && match.black_player_id) {
      return match.black_player;
    }

    // Fallback to legacy player1/player2
    return match.player2;
  };

  const getPlayerColor = (userId) => {
    if (!match) return null;

    if (match.white_player_id === userId || match.player1_id === userId) {
      return 'white';
    }
    if (match.black_player_id === userId || match.player2_id === userId) {
      return 'black';
    }
    return null;
  };

  const getInvitationPriority = () => {
    switch (invitation?.priority) {
      case 'urgent':
        return { label: '🚨 URGENT', className: 'priority-urgent' };
      case 'high':
        return { label: '🔥 HIGH', className: 'priority-high' };
      case 'normal':
      default:
        return { label: '📋 NORMAL', className: 'priority-normal' };
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'accepted':
        return 'status-accepted';
      case 'declined':
        return 'status-declined';
      case 'expired':
        return 'status-expired';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-unknown';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'accepted':
        return '✅';
      case 'declined':
        return '❌';
      case 'expired':
        return '⏰';
      case 'cancelled':
        return '🚫';
      default:
        return '❓';
    }
  };

  if (!invitation || !match) {
    return null;
  }

  const inviterPlayer = getInviterPlayer();
  const invitedPlayer = getInvitedPlayer();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isRecipient = invitation.invited_id === currentUser.id;
  const priority = getInvitationPriority();
  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  const renderMatchDetails = () => (
    <div className="championship-match-details">
      <div className="match-header">
        <span className="tournament-name">🏆 {championship?.name}</span>
        <span className={`match-priority ${priority.className}`}>
          {priority.label}
        </span>
      </div>

      <div className="round-info">
        <strong>Round {match.round}</strong>
        {match.board_number && <span> • Board {match.board_number}</span>}
      </div>

      <div className="color-assignment">
        <span className="assignment-method">
          Method: {match.color_assignment_method || 'balanced'}
        </span>
      </div>

      {invitation.metadata && (
        <div className="invitation-metadata">
          {invitation.metadata.scheduled_at && (
            <div className="scheduled-time">
              📅 Scheduled: {new Date(invitation.metadata.scheduled_at).toLocaleString()}
            </div>
          )}
          {invitation.metadata.deadline && (
            <div className="deadline">
              ⏰ Deadline: {new Date(invitation.metadata.deadline).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderPlayerSection = (player, color) => (
    <div className={`player-slot ${color}`}>
      <img
        src={getPlayerAvatar(player) || `https://i.pravatar.cc/150?u=${player?.email || player?.id}`}
        alt={player?.name}
        className="player-avatar"
      />
      <div className="player-info">
        <div className="player-name">{player?.name}</div>
        <div className="player-rating">Rating: {player?.rating || 'N/A'}</div>
      </div>
      <div className="player-color">
        {color === 'white' ? '♔ White' : '♚ Black'}
      </div>
    </div>
  );

  const renderActionButtons = () => {
    if (status !== 'pending' || !isRecipient) {
      return (
        <div className="invitation-status">
          <span className={`status-badge ${statusColor}`}>
            {statusIcon} {status.toUpperCase()}
          </span>
        </div>
      );
    }

    return (
      <div className="invitation-actions">
        <button
          className={`unified-card-btn success`}
          onClick={() => onAccept?.(invitation.id)}
          disabled={isProcessing || status !== 'pending'}
        >
          {isProcessing ? '⏳ Accepting...' : '✅ Accept'}
        </button>
        <button
          className="unified-card-btn danger"
          onClick={() => onDecline?.(invitation.id)}
          disabled={isProcessing || status !== 'pending'}
        >
          {isProcessing ? '⏳ Declining...' : '❌ Decline'}
        </button>
      </div>
    );
  };

  const renderCancelOption = () => {
    if (!isRecipient && status === 'pending') {
      return (
        <button
          className="unified-card-btn secondary"
          onClick={() => onCancel?.(invitation.id)}
          disabled={isProcessing}
        >
          🚫 Cancel Invitation
        </button>
      );
    }
    return null;
  };

  return (
    <div className={`unified-card championship-invitation ${statusColor}`}>
      <div className="card-header">
        <div className="tournament-badge">
          🏆 Championship Match
        </div>
        {timeLeft && status === 'pending' && (
          <div className="time-left">
            ⏰ {timeLeft}
          </div>
        )}
      </div>

      {renderMatchDetails()}

      <div className="players-assignment">
        {inviterPlayer && renderPlayerSection(inviterPlayer, getPlayerColor(inviterPlayer.id))}
        <div className="vs-divider">VS</div>
        {invitedPlayer && renderPlayerSection(invitedPlayer, getPlayerColor(invitedPlayer.id))}
      </div>

      <div className="card-footer">
        <div className="invitation-meta">
          <small>
            Created: {new Date(invitation.created_at).toLocaleString()}
            {invitation.auto_generated && <span> • Auto-generated</span>}
          </small>
        </div>

        <div className="card-actions">
          {renderActionButtons()}
          {renderCancelOption()}
        </div>
      </div>
    </div>
  );
};

/**
 * ChampionshipInvitationsList - Lists multiple championship invitations
 */
export const ChampionshipInvitationsList = ({
  invitations,
  matches,
  championships,
  onAccept,
  onDecline,
  onCancel,
  processingIds = new Set()
}) => {
  if (!invitations || invitations.length === 0) {
    return (
      <div className="unified-empty-state">
        <p>🏆 No championship invitations</p>
        <p>Your tournament invitations will appear here</p>
      </div>
    );
  }

  return (
    <div className="unified-section">
      <h2 className="unified-section-header">🏆 Championship Invitations</h2>
      <div className="unified-card-grid cols-1">
        {invitations.map((invitation) => {
          const match = matches?.find(m => m.id === invitation.championship_match_id);
          const championship = championships?.find(c => c.id === match?.championship_id);

          return (
            <ChampionshipMatchInvitation
              key={invitation.id}
              invitation={invitation}
              match={match}
              championship={championship}
              onAccept={onAccept}
              onDecline={onDecline}
              onCancel={onCancel}
              isProcessing={processingIds.has(invitation.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ChampionshipMatchInvitation;