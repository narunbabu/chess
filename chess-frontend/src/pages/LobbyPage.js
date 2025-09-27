import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './LobbyPage.css';

const LobbyPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [invitedPlayer, setInvitedPlayer] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [processedInvitations, setProcessedInvitations] = useState(new Set());

  const fetchData = async () => {
    try {
      console.log('Fetching lobby data for user:', user);

      const [usersRes, pendingRes, sentRes, acceptedRes] = await Promise.all([
        api.get('/users'),
        api.get('/invitations/pending'),
        api.get('/invitations/sent'),
        api.get('/invitations/accepted')
      ]);

      console.log('Users response:', usersRes.data);
      console.log('Pending invitations:', pendingRes.data);
      console.log('Sent invitations:', sentRes.data);
      console.log('Accepted invitations:', acceptedRes.data);

      // Check if any of our sent invitations were accepted and redirect to game
      console.log('Accepted invitations response:', acceptedRes.data);
      if (acceptedRes.data && acceptedRes.data.length > 0) {
        // Find the first unprocessed accepted invitation
        const unprocessedInvitation = acceptedRes.data.find(
          acceptedGame => !processedInvitations.has(acceptedGame.invitation.id)
        );

        if (unprocessedInvitation) {
          console.log('Invitation accepted! Redirecting to game:', unprocessedInvitation);
          console.log('Game object:', unprocessedInvitation.game);

          // Mark this invitation as processed
          setProcessedInvitations(prev => new Set([...prev, unprocessedInvitation.invitation.id]));

          if (unprocessedInvitation.game && unprocessedInvitation.game.id) {
            console.log('Navigating to game ID:', unprocessedInvitation.game.id);
            navigate(`/play/${unprocessedInvitation.game.id}`);
            return; // Exit early since we're redirecting
          } else {
            console.error('No valid game found in accepted invitation:', unprocessedInvitation);
          }
        } else {
          console.log('All accepted invitations have already been processed');
        }
      }

      // Filter out the current user from the list
      const otherUsers = usersRes.data.filter(p => p.id !== user.id);
      console.log('Other users after filtering:', otherUsers);

      setPlayers(otherUsers);
      setOnlineCount(usersRes.data.length);
      setPendingInvitations(pendingRes.data);
      setSentInvitations(sentRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      // Auto-refresh every 5 seconds to check for new invitations and accepted games
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleInvite = async (player) => {
    setInvitedPlayer(player);
    setInviteStatus('sending');

    try {
      await api.post('/invitations/send', {
        invited_user_id: player.id
      });

      setInviteStatus('sent');
      // Refresh data to update sent invitations
      fetchData();

      // Auto-close after 3 seconds
      setTimeout(() => {
        setInviteStatus(null);
        setInvitedPlayer(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      setInviteStatus('error');
      setTimeout(() => {
        setInviteStatus(null);
        setInvitedPlayer(null);
      }, 3000);
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    try {
      console.log(`Attempting to ${action} invitation ${invitationId}`);
      console.log('Auth token exists:', !!localStorage.getItem('auth_token'));
      console.log('Current user:', user);

      const response = await api.post(`/invitations/${invitationId}/respond`, {
        action: action
      });

      console.log('Invitation response successful:', response.data);

      if (action === 'accept') {
        const data = response.data;
        if (data.game) {
          console.log('Invitation accepted, navigating to game:', data.game);
          navigate(`/play/${data.game.id}`);
        } else {
          console.log('Invitation accepted but no game created');
        }
      }

      // Refresh data to update invitations
      fetchData();
    } catch (error) {
      console.error('Failed to respond to invitation:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error headers:', error.response?.headers);

      // Show user-friendly error message
      alert(`Failed to ${action} invitation: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    try {
      await api.delete(`/invitations/${invitationId}`);
      fetchData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
    }
  };

  if (loading) {
    return (
      <div className="lobby-container">
        <div className="loading-spinner">
          <div className="loader"></div>
          <p>Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="lobby-container">
        <h1>Authentication Required</h1>
        <p>Please log in to access the lobby.</p>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <h1>🏆 Online Chess Lobby</h1>
        <div className="user-info">
          <div className="current-user">
            <img
              src={user.avatar || `https://i.pravatar.cc/150?u=${user.email}`}
              alt={user.name}
              className="current-user-avatar"
            />
            <div className="current-user-details">
              <h3>{user.name}</h3>
              <p className="user-email">{user.email}</p>
              <p className="user-rating">Rating: {user.rating || 1200}</p>
            </div>
          </div>
          <div className="online-stats">
            <div className="stat">
              <span className="stat-number">{onlineCount}</span>
              <span className="stat-label">Players Online</span>
            </div>
            <div className="stat">
              <span className="stat-number">{players.length}</span>
              <span className="stat-label">Available to Play</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="invitations-section">
          <h2>🔔 Incoming Invitations</h2>
          <div className="invitations-list">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="invitation-card">
                <img
                  src={invitation.inviter.avatar || `https://i.pravatar.cc/150?u=${invitation.inviter.email}`}
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
                    onClick={() => handleInvitationResponse(invitation.id, 'accept')}
                  >
                    ✅ Accept
                  </button>
                  <button
                    className="decline-btn"
                    onClick={() => handleInvitationResponse(invitation.id, 'decline')}
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
                  src={invitation.invited.avatar || `https://i.pravatar.cc/150?u=${invitation.invited.email}`}
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
                    🔄 Checking every 5 seconds for acceptance...
                  </p>
                </div>
                <div className="invitation-actions">
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelInvitation(invitation.id)}
                  >
                    🚫 Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="available-players-section">
        <h2>🎯 Available Players</h2>
        <div className="player-list">
          {players.length > 0 ? players.map((player, index) => {
            const hasInvited = sentInvitations.some(inv => inv.invited_id === player.id);
            return (
              <div key={player.id || index} className="player-card">
                <img
                  src={player.avatar || `https://i.pravatar.cc/150?u=${player.email}`}
                  alt={player.name}
                  className="player-avatar"
                />
                <div className="player-info">
                  <h3>{player.name}</h3>
                  <p className="player-email">{player.email}</p>
                  <p className="player-rating">Rating: {player.rating || 1200}</p>
                  <p className="player-status">🟢 Online</p>
                </div>
                {hasInvited ? (
                  <button className="invite-btn invited" disabled>
                    ⏳ Invited
                  </button>
                ) : (
                  <button className="invite-btn" onClick={() => handleInvite(player)}>
                    ⚡ Challenge
                  </button>
                )}
              </div>
            );
          }
          ) : (
            <div className="no-players">
              <p>🤖 No other players available right now.</p>
              <p>Why not invite a friend to play?</p>
            </div>
          )}
        </div>
      </div>

      {inviteStatus && (
        <div className="invitation-modal">
          <div className="modal-content">
            {inviteStatus === 'sending' && (
              <>
                <h2>Sending Invitation...</h2>
                <p>Sending challenge to {invitedPlayer?.name}...</p>
                <div className="loader"></div>
              </>
            )}
            {inviteStatus === 'sent' && (
              <>
                <h2>✅ Invitation Sent!</h2>
                <p>Your challenge has been sent to {invitedPlayer?.name}. They will be notified and can accept or decline.</p>
                <p>You can see the status in your "Sent Invitations" section below.</p>
              </>
            )}
            {inviteStatus === 'error' && (
              <>
                <h2>❌ Error</h2>
                <p>Failed to send invitation to {invitedPlayer?.name}. Please try again.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyPage;
