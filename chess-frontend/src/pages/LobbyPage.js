import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackSocial } from '../utils/analytics';
import api from '../services/api';
import WebSocketGameService from '../services/WebSocketGameService';
import { getEcho } from '../services/echoSingleton';
import { BACKEND_URL } from '../config';
import './LobbyPage.css';

// Lobby components
import LobbyTabs from '../components/lobby/LobbyTabs';
import PlayersList from '../components/lobby/PlayersList';
import InvitationsList from '../components/lobby/InvitationsList';
import ActiveGamesList from '../components/lobby/ActiveGamesList';
import ChallengeModal from '../components/lobby/ChallengeModal';

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
  const [activeGames, setActiveGames] = useState([]);
  const [webSocketService, setWebSocketService] = useState(null);
  const [hasFinishedGame, setHasFinishedGame] = useState(false);
  const [processingInvitations, setProcessingInvitations] = useState(new Set()); // Track processing state
  const [activeTab, setActiveTab] = useState('players');
  const [resumeRequestData, setResumeRequestData] = useState(null); // Track incoming resume requests

  // Polling control refs
  const pollTimerRef = React.useRef(null);
  const inFlightRef = React.useRef(false);
  const stopPollingRef = React.useRef(false);
  const didInitPollingRef = React.useRef(false);

  useEffect(() => {
    if (user && !webSocketService) {
      // Get the Echo singleton that was initialized in AuthContext
      const echo = getEcho();

      if (!echo) {
        console.error('[Lobby] Echo singleton not initialized! Cannot set up real-time invitations.');
        console.error('[Lobby] User:', user);
        console.error('[Lobby] Token:', localStorage.getItem('auth_token') ? 'exists' : 'missing');
        return;
      }

      console.log('[Lobby] Echo singleton available, initializing WebSocket service');
      const service = new WebSocketGameService();

      // Initialize Echo-based WebSocket service asynchronously
      service.initialize(null, user).then(() => {
        console.log('[Lobby] WebSocket service initialized successfully');
        setWebSocketService(service);
      }).catch(err => {
        console.error('[Lobby] WebSocket initialization failed:', err);
        // Still set the service to allow polling mode as fallback
        setWebSocketService(service);
      });
    }

    return () => {
      if (webSocketService) {
        webSocketService.disconnect();
      }
    };
  }, [user, webSocketService]);

  useEffect(() => {
    if (user && webSocketService) {
      console.log('[Lobby] Setting up user channel listeners for user:', user.id);

      // Get Echo instance to verify connection
      const echo = webSocketService.echo || getEcho();
      if (!echo) {
        console.warn('[Lobby] Echo not available yet, real-time invitations will not work until connected');
        return; // Exit early if Echo not available
      }

      console.log('[Lobby] Echo is available, subscribing to user channel');
      const userChannel = webSocketService.subscribeToUserChannel(user);

      if (!userChannel) {
        console.error('[Lobby] Failed to subscribe to user channel!');
        return;
      }

      // Add subscription success/error handlers (only if methods exist)
      if (typeof userChannel.subscribed === 'function') {
        userChannel.subscribed(() => {
          console.log(`[Lobby] ✅ Successfully subscribed to user channel: App.Models.User.${user.id}`);
        });
      }

      if (typeof userChannel.error === 'function') {
        userChannel.error((error) => {
          console.error('[Lobby] ❌ Failed to subscribe to user channel:', error);
        });
      }

      console.log('[Lobby] User channel object type:', typeof userChannel, 'Has listen:', typeof userChannel.listen);

      // Listen for invitation accepted (for inviters)
      userChannel.listen('.invitation.accepted', (data) => {
        console.log('[Lobby] 🎉 Invitation accepted event received:', data);

        // Remove the accepted invitation from sent list immediately
        if (data.invitation && data.invitation.id) {
          console.log('[Lobby] Removing accepted invitation from sent list:', data.invitation.id);
          setSentInvitations(prev => prev.filter(inv => inv.id !== data.invitation.id));

          // Also mark this invitation as processed to prevent it from showing up again
          const processedInvitations = JSON.parse(sessionStorage.getItem('processedInvitations') || '[]');
          if (!processedInvitations.includes(data.invitation.id)) {
            processedInvitations.push(data.invitation.id);
            sessionStorage.setItem('processedInvitations', JSON.stringify(processedInvitations));
          }
        }

        if (data.game && data.game.id) {
          console.log('[Lobby] 🎮 Navigating to game ID:', data.game.id);

          // Set session markers for proper game access (challenger perspective)
          sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
          sessionStorage.setItem('lastInvitationTime', Date.now().toString());
          sessionStorage.setItem('lastGameId', data.game.id.toString());

          navigate(`/play/multiplayer/${data.game.id}`);
        } else {
          console.warn('[Lobby] ⚠️ Invitation accepted but no game data in event:', data);
        }
      });

      // Listen for new invitations (for recipients)
      userChannel.listen('.invitation.sent', (data) => {
        console.log('[Lobby] 📨 New invitation received:', data);

        // Immediately add to pending invitations for instant UI update
        if (data.invitation) {
          setPendingInvitations(prev => {
            // Avoid duplicates
            const exists = prev.some(inv => inv.id === data.invitation.id);
            if (exists) {
              console.log('[Lobby] Invitation already in pending list, skipping');
              return prev;
            }

            console.log('[Lobby] Adding new invitation to pending list');
            return [data.invitation, ...prev];
          });
        }
      });

      // Listen for invitation cancellations (for recipients)
      userChannel.listen('.invitation.cancelled', (data) => {
        console.log('[Lobby] 🚫 Invitation cancelled:', data);

        // Remove the cancelled invitation from pending list immediately
        if (data.invitation && data.invitation.id) {
          console.log('[Lobby] Removing cancelled invitation from pending list:', data.invitation.id);
          setPendingInvitations(prev => prev.filter(inv => inv.id !== data.invitation.id));
        }
      });

      // Listen for resume requests
      userChannel.listen('.resume.request.sent', (data) => {
        console.log('[Lobby] 🔄 Resume request received:', data);

        // Show resume request dialog
        if (data.game_id && data.requesting_user) {
          // Create resume request data similar to PlayMultiplayer
          const resumeData = {
            gameId: data.game_id,
            requestingUserId: data.requesting_user.id,
            requestingUserName: data.requesting_user.name,
            expiresAt: data.expires_at,
            game: data.game
          };

          // Store in state to show dialog
          setResumeRequestData(resumeData);
        }
      });

      console.log('[Lobby] All user channel listeners registered');

      return () => {
        console.log('[Lobby] Cleaning up user channel listeners');
        userChannel.stopListening('.invitation.accepted');
        userChannel.stopListening('.invitation.sent');
        userChannel.stopListening('.invitation.cancelled');
        userChannel.stopListening('.resume.request.sent');
      };
    }
  }, [user, webSocketService, navigate]);

  const fetchData = async (skipDebounce = false) => {
    try {
      console.log('Fetching lobby data for user:', user);

      const [usersRes, pendingRes, sentRes, acceptedRes, activeGamesRes] = await Promise.all([
        api.get('/users'),
        api.get('/invitations/pending'),
        api.get('/invitations/sent'),
        api.get('/invitations/accepted'),
        api.get('/games/active')
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
          // Get processed invitation IDs to prevent duplicate navigation
          const processedInvitationIds = JSON.parse(sessionStorage.getItem('processedInvitationIds') || '[]');

          // Sort by updated_at DESC (newest first) - backend already sorts, but ensure it
          const sortedAccepted = [...acceptedRes.data].sort((a, b) =>
            new Date(b.updated_at) - new Date(a.updated_at)
          );

          console.log('Found accepted invitations:', sortedAccepted.length);

          // Loop through accepted invitations to find first active game
          for (const acceptedData of sortedAccepted) {
            const invitationId = acceptedData.id;
            const gameId = acceptedData.game?.id;

            // Skip already processed invitations
            if (processedInvitationIds.includes(invitationId)) {
              console.log('Skipping already processed invitation:', invitationId);
              continue;
            }

            // Skip invitations without linked games
            if (!gameId) {
              console.log('Skipping invitation without game:', invitationId);
              continue;
            }

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
                const isGameFinished = gameData.status === 'finished';

                console.log('Game status check:', {
                  invitationId,
                  gameId,
                  status: gameData.status,
                  isGameActive,
                  isGameFinished
                });

                // Skip finished games
                if (isGameFinished) {
                  console.log('Skipping finished game:', gameId);
                  sessionStorage.setItem('gameFinished_' + gameId, 'true');
                  setHasFinishedGame(true);

                  // Mark invitation as processed
                  if (!processedInvitationIds.includes(invitationId)) {
                    processedInvitationIds.push(invitationId);
                    sessionStorage.setItem('processedInvitationIds', JSON.stringify(processedInvitationIds));
                  }
                  continue; // Check next invitation
                }

                // Found active game - navigate to it
                if (isGameActive) {
                  // Set session markers for proper game access
                  sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
                  sessionStorage.setItem('lastInvitationTime', Date.now().toString());
                  sessionStorage.setItem('lastGameId', gameId.toString());

                  // Mark invitation as processed
                  if (!processedInvitationIds.includes(invitationId)) {
                    processedInvitationIds.push(invitationId);
                    sessionStorage.setItem('processedInvitationIds', JSON.stringify(processedInvitationIds));
                  }

                  console.log('Navigating to ACTIVE game from accepted invitation:', { invitationId, gameId });
                  navigate(`/play/multiplayer/${gameId}`);
                  return; // Exit early to prevent further processing
                }
              }
            } catch (error) {
              console.error('Error checking game status for invitation:', invitationId, error);
              continue; // Check next invitation
            }
          }

          console.log('No active games found in accepted invitations');
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
      setActiveGames(activeGamesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Clear old processed invitations on component mount (cleanup stale data)
  useEffect(() => {
    // Reset polling guard on mount
    didInitPollingRef.current = false;

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

  // Debounced fetchData for polling only
  // Single self-scheduled polling with in-flight lock
  useEffect(() => {
    if (!user) return;

    // Guard against React StrictMode double-mount in development
    if (didInitPollingRef.current) {
      console.log('[Lobby] Polling already initialized, skipping duplicate mount');
      return;
    }
    didInitPollingRef.current = true;
    stopPollingRef.current = false;

    console.log('[Lobby] Initializing single poller');

    const cycle = async () => {
      if (stopPollingRef.current) {
        console.log('[Lobby] Polling stopped');
        return;
      }

      // Calculate adaptive delay based on current state
      // Check if Echo singleton is connected (more reliable than service instance)
      const echo = webSocketService?.echo || getEcho();
      const wsState = echo?.connector?.pusher?.connection?.state;
      const wsOK = wsState === 'connected';

      // Debug logging for WebSocket state
      if (!wsOK && echo) {
        console.log(`[Lobby] WebSocket not connected. Current state: ${wsState}`);
      }
      const hidden = document.visibilityState === 'hidden';
      const delay = hidden
        ? (wsOK ? 60000 : 10000)  // Hidden: 60s with WS, 10s without
        : (wsOK ? 30000 : 5000);   // Visible: 30s with WS, 5s without

      // Only fetch if not already in-flight
      if (!inFlightRef.current) {
        inFlightRef.current = true;
        console.log(`[Lobby] Fetching data (WS: ${wsOK}, Hidden: ${hidden})`);
        try {
          await fetchData(true);
        } catch (err) {
          console.error('[Lobby] Fetch error:', err);
        } finally {
          inFlightRef.current = false;
        }
      } else {
        console.log('[Lobby] Skipping fetch (already in-flight)');
      }

      // Schedule next cycle
      console.log(`[Lobby] Next poll in ${delay}ms`);
      pollTimerRef.current = setTimeout(cycle, delay);
    };

    // Initial immediate fetch + start cycle
    cycle();

    // Quick resync when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Lobby] Tab visible - quick resync in 250ms');
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
        }
        pollTimerRef.current = setTimeout(cycle, 250);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('[Lobby] Cleaning up poller');
      stopPollingRef.current = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      // Don't reset didInitPollingRef here - keep the guard active
    };
  }, [user, hasFinishedGame]); // Minimal dependencies - no webSocketService

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

      // Track successful challenge sent
      trackSocial('challenge_sent', {
        playerId: selectedPlayer.id,
        colorChoice,
        invitationId: response.data.invitation?.id
      });

      // Optimistic update: add invitation to sent list immediately
      if (response.data.invitation) {
        setSentInvitations(prev => [response.data.invitation, ...prev]);
      }

      setInviteStatus('sent');

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
    // Prevent double-click: Check if already processing this invitation
    if (processingInvitations.has(invitationId)) {
      console.log('Already processing invitation', invitationId);
      return;
    }

    // Find the invitation to determine its type
    const invitation = pendingInvitations.find(inv => inv.id === invitationId);
    if (!invitation) {
      console.error('Invitation not found:', invitationId);
      return;
    }

    // Handle resume requests differently
    if (invitation.type === 'resume_request') {
      console.log(`Processing resume request ${invitationId} with action: ${action}`);
      setProcessingInvitations(prev => new Set(prev).add(invitationId));

      try {
        if (!invitation.game_id) {
          throw new Error('Resume request missing game_id');
        }

        const requestData = { response: action === 'accept' };
        const response = await api.post(`/api/websocket/games/${invitation.game_id}/respond-resume-request`, requestData);
        console.log('Resume request response successful:', response.data);

        // Remove from pending list
        setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));

        if (action === 'accept' && response.data.success) {
          // Navigate to the game
          navigate(`/play/multiplayer/${invitation.game_id}`);
        }

      } catch (error) {
        console.error('Failed to respond to resume request:', error);
        // Add it back to pending if there was an error
        setPendingInvitations(prev => {
          if (!prev.find(inv => inv.id === invitationId)) {
            return [...prev, invitation];
          }
          return prev;
        });
      } finally {
        setProcessingInvitations(prev => {
          const newSet = new Set(prev);
          newSet.delete(invitationId);
          return newSet;
        });
      }
      return;
    }

    // If accepting and no color choice provided, show modal (for game invitations)
    if (action === 'accept' && !colorChoice) {
      setSelectedInvitation(invitation);
      setShowResponseModal(true);
      return;
    }

    // Mark invitation as processing
    setProcessingInvitations(prev => new Set(prev).add(invitationId));

    // Optimistic update: Remove from pending list immediately for better UX
    if (action === 'accept') {
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
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
        // Track successful invitation acceptance
        trackSocial('invitation_accepted', {
          invitationId,
          colorChoice,
          gameId: response.data.game?.id
        });

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
      } else if (action === 'decline') {
        // Track invitation decline
        trackSocial('invitation_declined', { invitationId });

        // Remove from pending list
        setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      }
    } catch (error) {
      console.error('Failed to respond to invitation:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error headers:', error.response?.headers);

      // If error occurred, restore invitation to list (rollback optimistic update)
      if (action === 'accept' && error.response?.status === 409) {
        console.log('Invitation already processed, refreshing list');
        fetchData(true);
      }

      // Show user-friendly error message
      alert(`Failed to ${action} invitation: ${error.response?.data?.message || error.message}`);
    } finally {
      // Always remove from processing set
      setProcessingInvitations(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    try {
      console.log('Cancelling invitation:', invitationId);
      const response = await api.delete(`/invitations/${invitationId}`);
      console.log('Cancellation response:', response.data);

      // Track invitation cancellation
      trackSocial('invitation_cancelled', { invitationId });

      // Immediately update local state to remove the cancelled invitation
      setSentInvitations(prev => prev.filter(inv => inv.id !== invitationId));
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

  // Tab configuration
  const tabs = [
    {
      id: 'players',
      label: 'Players',
      short: 'Players',
      icon: '👥',
      badge: players.length
    },
    {
      id: 'invitations',
      label: 'Invitations',
      short: 'Invites',
      icon: '✉️',
      badge: pendingInvitations.length
    },
    {
      id: 'games',
      label: 'Active Games',
      short: 'Games',
      icon: '♟️',
      badge: activeGames.length
    },
  ];

  // Handler for resuming game (extracted for clarity)
  const handleResumeGame = (gameId) => {
    sessionStorage.setItem('lastInvitationAction', 'resume_game');
    sessionStorage.setItem('lastInvitationTime', Date.now().toString());
    sessionStorage.setItem('lastGameId', gameId.toString());
    navigate(`/play/multiplayer/${gameId}`);
  };

  // Handler for responding to resume requests
  const handleResumeRequestResponse = async (accepted) => {
    if (!resumeRequestData) return;

    try {
      console.log(`[Lobby] ${accepted ? 'Accepting' : 'Declining'} resume request for game ${resumeRequestData.gameId}`);

      // Make direct API call instead of using WebSocketGameService
      // (WebSocketService in lobby isn't connected to the game channel)
      const token = localStorage.getItem('auth_token');
      const echo = getEcho();
      const socketId = echo?.socketId();

      const response = await api.post(
        `/websocket/games/${resumeRequestData.gameId}/resume-response`,
        {
          socket_id: socketId,
          response: accepted,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Resume response failed');
      }

      console.log('[Lobby] Resume response sent successfully:', response.data);

      if (accepted) {
        console.log('[Lobby] Resume request accepted - navigating to game');
        // Navigate to the game
        sessionStorage.setItem('lastInvitationAction', 'resume_accepted');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', resumeRequestData.gameId.toString());
        navigate(`/play/multiplayer/${resumeRequestData.gameId}`);
      } else {
        console.log('[Lobby] Resume request declined');
        // Clear the resume request
        setResumeRequestData(null);
      }
    } catch (error) {
      console.error('[Lobby] Failed to respond to resume request:', error);
      alert('Failed to respond to resume request. Please try again.');
    }
  };

  return (
    <div className="lobby-container">
      <div className="lobby p-6 text-white">
      {/* Resume Request Modal */}
      {resumeRequestData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#2c2c2c',
            padding: '32px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#ffa726', marginBottom: '16px', fontSize: '24px' }}>
              🔄 Resume Game Request
            </h2>
            <p style={{ color: '#fff', marginBottom: '24px', fontSize: '16px' }}>
              <strong>{resumeRequestData.requestingUserName}</strong> wants to resume the game!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => handleResumeRequestResponse(true)}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
              >
                ✅ Accept
              </button>
              <button
                onClick={() => handleResumeRequestResponse(false)}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#da190b'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#f44336'}
              >
                ❌ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header now handled globally in Header.js */}

      <LobbyTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      <div className="lobby-content">
        {activeTab === 'players' && (
          <PlayersList
            players={players}
            sentInvitations={sentInvitations}
            onChallenge={handleInvite}
          />
        )}

        {activeTab === 'invitations' && (
          <InvitationsList
            pendingInvitations={pendingInvitations}
            sentInvitations={sentInvitations}
            processingInvitations={processingInvitations}
            onAccept={(invitationId) => handleInvitationResponse(invitationId, 'accept')}
            onDecline={(invitationId) => handleInvitationResponse(invitationId, 'decline')}
            onCancel={handleCancelInvitation}
          />
        )}

        {activeTab === 'games' && (
          <ActiveGamesList
            activeGames={activeGames}
            currentUserId={user.id}
            onResumeGame={handleResumeGame}
          />
        )}
      </div>

      <ChallengeModal
        // Color Choice Modal props
        showColorModal={showColorModal}
        selectedPlayer={selectedPlayer}
        onColorChoice={sendInvitation}
        onCancelColorChoice={() => setShowColorModal(false)}
        // Response Modal props
        showResponseModal={showResponseModal}
        selectedInvitation={selectedInvitation}
        processingInvitations={processingInvitations}
        onAcceptWithColor={(invitationId, colorChoice) =>
          handleInvitationResponse(invitationId, 'accept', colorChoice)
        }
        onCancelResponse={() => setShowResponseModal(false)}
        onDeclineInvitation={(invitationId) =>
          handleInvitationResponse(invitationId, 'decline')
        }
        // Status Modal props
        inviteStatus={inviteStatus}
        invitedPlayer={invitedPlayer}
      />
      </div>
    </div>
  );
};

export default LobbyPage;