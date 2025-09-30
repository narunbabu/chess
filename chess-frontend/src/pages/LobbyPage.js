import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import WebSocketGameService from '../services/WebSocketGameService';
import { BACKEND_URL } from '../config';
import './LobbyPage.css';

const LobbyPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [invitedPlayer, setInvitedPlayer] = useState(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [webSocketService, setWebSocketService] = useState(null);

  useEffect(() => {
    if (user && !webSocketService) {
      const service = new WebSocketGameService();
      service.initialize(null, user);
      setWebSocketService(service);
    }

    return () => {
      if (webSocketService) {
        webSocketService.disconnect();
      }
    };
  }, [user, webSocketService]);

  useEffect(() => {
    if (user && webSocketService) {
      const userChannel = webSocketService.subscribeToUserChannel(user);

      // Listen for invitation accepted (for inviters)
      userChannel.listen('.invitation.accepted', (data) => {
        console.log('Invitation accepted event received:', data);

        // Remove the accepted invitation from sent list immediately
        if (data.invitation && data.invitation.id) {
          setSentInvitations(prev => prev.filter(inv => inv.id !== data.invitation.id));

          // Also mark this invitation as processed to prevent it from showing up again
          const processedInvitations = JSON.parse(sessionStorage.getItem('processedInvitations') || '[]');
          if (!processedInvitations.includes(data.invitation.id)) {
            processedInvitations.push(data.invitation.id);
            sessionStorage.setItem('processedInvitations', JSON.stringify(processedInvitations));
          }
        }

        if (data.game && data.game.id) {
          console.log('Navigating to game ID:', data.game.id);

          // Set session markers for proper game access (challenger perspective)
          sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
          sessionStorage.setItem('lastInvitationTime', Date.now().toString());
          sessionStorage.setItem('lastGameId', data.game.id.toString());

          navigate(`/play/multiplayer/${data.game.id}`);
        }
      });

      // Listen for new invitations (for recipients)
      userChannel.listen('.invitation.sent', (data) => {
        console.log('New invitation received:', data);
        // Refresh data to show the new invitation
        fetchData();
      });

      // Listen for invitation cancellations (for recipients)
      userChannel.listen('.invitation.cancelled', (data) => {
        console.log('Invitation cancelled:', data);

        // Remove the cancelled invitation from pending list immediately
        if (data.invitation && data.invitation.id) {
          setPendingInvitations(prev => prev.filter(inv => inv.id !== data.invitation.id));
        }

        // Also refresh data to ensure consistency
        fetchData();
      });

      return () => {
        userChannel.stopListening('.invitation.accepted');
        userChannel.stopListening('.invitation.sent');
        userChannel.stopListening('.invitation.cancelled');
      };
    }
  }, [user, webSocketService, navigate]);

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

      // Check if user intentionally visited the lobby (e.g., clicked "Go to Lobby" button)
      const intentionalVisit = sessionStorage.getItem('intentionalLobbyVisit') === 'true';
      const intentionalVisitTime = parseInt(sessionStorage.getItem('intentionalLobbyVisitTime') || '0');
      const timeSinceIntentionalVisit = Date.now() - intentionalVisitTime;

      // If user intentionally visited lobby within the last 5 seconds, don't auto-navigate
      if (intentionalVisit && timeSinceIntentionalVisit < 5000) {
        console.log('⚠️ Intentional lobby visit detected, skipping auto-navigation');

        // Clear the flag after processing
        sessionStorage.removeItem('intentionalLobbyVisit');
        sessionStorage.removeItem('intentionalLobbyVisitTime');

        // Mark any accepted games as processed to prevent future auto-navigation
        if (acceptedRes.data && acceptedRes.data.length > 0) {
          const processedGames = JSON.parse(sessionStorage.getItem('processedGames') || '[]');
          acceptedRes.data.forEach(acceptedData => {
            const gameId = acceptedData.game?.id;
            if (gameId && !processedGames.includes(gameId)) {
              processedGames.push(gameId);
            }
          });
          sessionStorage.setItem('processedGames', JSON.stringify(processedGames));
        }
      } else {
        // Handle accepted invitations - navigate to game if any
        if (acceptedRes.data && acceptedRes.data.length > 0) {
          const acceptedData = acceptedRes.data[0]; // Get the first accepted invitation
          console.log('Found accepted invitation, checking game status:', acceptedData);

          const gameId = acceptedData.game?.id;

          if (gameId) {
            // Check actual game status from backend to determine if we should navigate
            try {
              const token = localStorage.getItem('auth_token');
              const gameResponse = await fetch(`${BACKEND_URL}/games/${gameId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (gameResponse.ok) {
                const gameData = await gameResponse.json();
                const isGameActive = gameData.status === 'active' || gameData.status === 'waiting';
                const isGameFinished = gameData.status === 'finished' || gameData.status === 'completed';

                console.log('Game status check:', {
                  gameId,
                  status: gameData.status,
                  isGameActive,
                  isGameFinished
                });

                // Only navigate if game is active/waiting (not finished)
                if (isGameActive) {
                  // Set session markers for proper game access
                  sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
                  sessionStorage.setItem('lastInvitationTime', Date.now().toString());
                  sessionStorage.setItem('lastGameId', gameId.toString());

                  console.log('Navigating to ACTIVE game from accepted invitation:', gameId);
                  navigate(`/play/multiplayer/${gameId}`);
                  return; // Exit early to prevent further processing
                } else if (isGameFinished) {
                  console.log('Game is finished, staying in lobby:', gameId);
                  // Mark game as finished to prevent future checks
                  sessionStorage.setItem('gameFinished_' + gameId, 'true');
                }
              }
            } catch (error) {
              console.error('Error checking game status:', error);
            }
          }
        }
      }

      // Filter out the current user from the list
      const otherUsers = usersRes.data.filter(p => p.id !== user.id);
      console.log('Other users after filtering:', otherUsers);

      // Get processed invitations from session storage to filter them out
      const processedInvitations = JSON.parse(sessionStorage.getItem('processedInvitations') || '[]');

      // Filter out accepted/processed invitations from sent list
      const activeSentInvitations = sentRes.data.filter(invitation => {
        // Remove invitations that have been accepted (status: 'accepted')
        // OR have been marked as processed in sessionStorage
        const isAccepted = invitation.status === 'accepted';
        const isProcessed = processedInvitations.includes(invitation.id);

        if (isAccepted || isProcessed) {
          console.log('Filtering out processed/accepted invitation:', invitation.id, { isAccepted, isProcessed });
          return false;
        }
        return true;
      });

      setPlayers(otherUsers);
      setOnlineCount(usersRes.data.length);
      setPendingInvitations(pendingRes.data);
      setSentInvitations(activeSentInvitations);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Clear old processed invitations on component mount (cleanup stale data)
  useEffect(() => {
    // Clean up processed invitations older than 24 hours
    const processedInvitations = JSON.parse(sessionStorage.getItem('processedInvitations') || '[]');
    const processedTimestamps = JSON.parse(sessionStorage.getItem('processedTimestamps') || '{}');
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    const activeProcessed = processedInvitations.filter(invId => {
      const timestamp = processedTimestamps[invId];
      return timestamp && timestamp > twentyFourHoursAgo;
    });

    if (activeProcessed.length !== processedInvitations.length) {
      sessionStorage.setItem('processedInvitations', JSON.stringify(activeProcessed));
      console.log('Cleaned up old processed invitations:', processedInvitations.length - activeProcessed.length);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();

      // Poll for lobby updates every 5 seconds
      const pollInterval = setInterval(fetchData, 5000);

      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [user]);

  const handleInvite = (player) => {
    setSelectedPlayer(player);
    setShowColorModal(true);
  };

  const sendInvitation = async (colorChoice) => {
    setShowColorModal(false);
    setInvitedPlayer(selectedPlayer);
    setInviteStatus('sending');

    try {
      const response = await api.post('/invitations/send', {
        invited_user_id: selectedPlayer.id,
        preferred_color: colorChoice
      });

      // Optimistic update: add invitation to sent list immediately
      if (response.data.invitation) {
        setSentInvitations(prev => [response.data.invitation, ...prev]);
      }

      setInviteStatus('sent');
      // Refresh data to update sent invitations
      fetchData();

      // Auto-close after 3 seconds
      setTimeout(() => {
        setInviteStatus(null);
        setInvitedPlayer(null);
        setSelectedPlayer(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      setInviteStatus('error');
      setTimeout(() => {
        setInviteStatus(null);
        setInvitedPlayer(null);
        setSelectedPlayer(null);
      }, 3000);
    }
  };

  const handleInvitationResponse = async (invitationId, action, colorChoice = null) => {
    // If accepting and no color choice provided, show modal
    if (action === 'accept' && !colorChoice) {
      const invitation = pendingInvitations.find(inv => inv.id === invitationId);
      setSelectedInvitation(invitation);
      setShowResponseModal(true);
      return;
    }

    try {
      console.log(`Attempting to ${action} invitation ${invitationId}`);
      console.log('Auth token exists:', !!localStorage.getItem('auth_token'));
      console.log('Current user:', user);
      console.log('Sending invitation response:', { invitationId, action, colorChoice });

      const requestData = { action: action };
      if (colorChoice) {
        requestData.desired_color = colorChoice;
      }

      const response = await api.post(`/invitations/${invitationId}/respond`, requestData);

      console.log('Invitation response successful:', response.data);

      // Close modal if it was open
      setShowResponseModal(false);
      setSelectedInvitation(null);

      if (action === 'accept') {
        const data = response.data;
        if (data.game) {
          console.log('Invitation accepted, navigating to game:', data.game);

          // Set session markers for proper game access
          sessionStorage.setItem('lastInvitationAction', 'accepted');
          sessionStorage.setItem('lastInvitationTime', Date.now().toString());
          sessionStorage.setItem('lastGameId', data.game.id.toString());

          navigate(`/play/multiplayer/${data.game.id}`);
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
      console.log('Cancelling invitation:', invitationId);
      const response = await api.delete(`/invitations/${invitationId}`);
      console.log('Cancellation response:', response.data);

      // Immediately update local state to remove the cancelled invitation
      setSentInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // Also refresh all data
      fetchData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      console.error('Error details:', error.response?.data);
      alert(`Failed to cancel invitation: ${error.response?.data?.error || error.message}`);
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
                    🔄 Waiting for acceptance...
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

      {showColorModal && (
        <div className="invitation-modal">
          <div className="modal-content">
            <h2>⚡ Challenge {selectedPlayer?.name}</h2>
            <p>Choose your preferred color:</p>
            <div className="color-choices">
              <button
                className="color-choice white"
                onClick={() => sendInvitation('white')}
              >
                ♔ Play as White
                <small>(Move first)</small>
              </button>
              <button
                className="color-choice black"
                onClick={() => sendInvitation('black')}
              >
                ♚ Play as Black
                <small>(Move second)</small>
              </button>
              <button
                className="color-choice random"
                onClick={() => sendInvitation('random')}
              >
                🎲 Random
                <small>(Let chance decide)</small>
              </button>
            </div>
            <button
              className="cancel-btn"
              onClick={() => setShowColorModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showResponseModal && (
        <div className="invitation-modal">
          <div className="modal-content">
            <h2>🎯 Accept Challenge from {selectedInvitation?.inviter?.name}</h2>
            <p>
              {selectedInvitation?.inviter?.name} wants to play as{' '}
              {selectedInvitation?.inviter_preferred_color === 'white' ? '♔ White' : '♚ Black'}
            </p>
            <p>Choose your response:</p>
            <div className="color-choices">
              <button
                className="color-choice accept"
                onClick={() => {
                  const inviterColor = selectedInvitation?.inviter_preferred_color;
                  const myColor = inviterColor === 'white' ? 'black' : 'white';
                  handleInvitationResponse(selectedInvitation.id, 'accept', myColor);
                }}
              >
                ✅ Accept their choice
                <small>
                  (You'll play as {
                    selectedInvitation?.inviter_preferred_color === 'white' ? '♚ Black' : '♔ White'
                  })
                </small>
              </button>
              <button
                className="color-choice opposite"
                onClick={() => {
                  const inviterColor = selectedInvitation?.inviter_preferred_color;
                  handleInvitationResponse(selectedInvitation.id, 'accept', inviterColor);
                }}
              >
                🔄 Play as {selectedInvitation?.inviter_preferred_color === 'white' ? '♔ White' : '♚ Black'}
                <small>
                  (swap colors)
                </small>
              </button>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowResponseModal(false)}
              >
                Cancel
              </button>
              <button
                className="decline-btn"
                onClick={() => handleInvitationResponse(selectedInvitation.id, 'decline')}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

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