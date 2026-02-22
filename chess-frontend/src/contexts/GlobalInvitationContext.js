// src/contexts/GlobalInvitationContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getEcho } from '../services/echoSingleton';
import api from '../services/api';
import matchmakingService from '../services/matchmakingService';
import globalWebSocketManager from '../services/GlobalWebSocketManager';

const GlobalInvitationContext = createContext(null);

export const GlobalInvitationProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State for managing invitations and dialogs
  const [pendingInvitation, setPendingInvitation] = useState(null);
  const [resumeRequest, setResumeRequest] = useState(null);
  const [championshipResumeRequest, setChampionshipResumeRequest] = useState(null);
  const [pendingMatchRequest, setPendingMatchRequest] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs to track current values without causing re-renders
  const pendingInvitationRef = useRef(null);
  pendingInvitationRef.current = pendingInvitation;

  const resumeRequestRef = useRef(null);
  resumeRequestRef.current = resumeRequest;

  const championshipResumeRequestRef = useRef(null);
  championshipResumeRequestRef.current = championshipResumeRequest;

  const pendingMatchRequestRef = useRef(null);
  pendingMatchRequestRef.current = pendingMatchRequest;

  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  // Check if user is currently in an active game (should NOT show dialogs)
  // Use ref to avoid stale closure in WebSocket listeners
  const isInActiveGameRef = useRef(() => false);

  const isInActiveGame = useCallback(() => {
    const path = location.pathname;
    // Only block dialogs when user is in an active multiplayer game
    // Allow dialogs on single player pages, computer games, or when just viewing a board
    return path.startsWith('/play/multiplayer/');
  }, [location.pathname]);

  // Update ref whenever callback changes
  isInActiveGameRef.current = isInActiveGame;

  // Listen to WebSocket events for invitations
  useEffect(() => {
    if (!user) {
      return;
    }

    // Try to get Echo with robust retry logic
    let echo = getEcho();

    if (!echo) {
      console.warn('[GlobalInvitation] Echo not immediately available, starting retry loop...');

      // Track cleanup state
      let cleanupCalled = false;
      let cleanupFunction = null;
      let retryCount = 0;
      const maxRetries = 10;
      let retryTimer = null;

      // Retry with increasing intervals until Echo is available
      const tryConnect = () => {
        if (cleanupCalled) return;

        retryCount++;
        echo = getEcho();

        if (echo) {
          console.log(`[GlobalInvitation] Echo available after ${retryCount} retries`);
          cleanupFunction = setupListeners(echo);
        } else if (retryCount < maxRetries) {
          // Retry: 500ms, 500ms, 1000ms, 1000ms, 2000ms... (doubles every 2 attempts)
          const delay = 500 * Math.pow(2, Math.floor(retryCount / 2));
          retryTimer = setTimeout(tryConnect, Math.min(delay, 3000));
        } else {
          console.error('[GlobalInvitation] Echo not available after', maxRetries, 'retries. Invitation dialogs will not work.');
        }
      };

      retryTimer = setTimeout(tryConnect, 300);

      return () => {
        cleanupCalled = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (cleanupFunction) {
          cleanupFunction();
        }
      };
    }

    // Echo is available immediately
    return setupListeners(echo);

    function setupListeners(echo) {
      if (!echo || !user?.id) {
        console.error('[GlobalInvitation] Cannot setup listeners - missing Echo or user ID');
        return;
      }

    // Subscribe to user-specific channel (shared for all invitation types)
    const userChannel = echo.private(`App.Models.User.${user.id}`);

    // Add subscription success confirmation
    if (userChannel) {
      // CRITICAL FIX: Register event listeners IMMEDIATELY, before checking subscription state
      // This ensures listeners are ready even if subscription completes instantly

      // Register all listeners first (before any state checks)
      registerEventListeners(userChannel);

      // Now check subscription state for logging purposes only
      const currentSubscriptionState = userChannel.subscription?.state;

      if (currentSubscriptionState === 'subscribed') {
        console.log('[GlobalInvitation] Successfully subscribed to user channel:', `App.Models.User.${user.id}`);
      } else {
        // Listen for subscription success
        userChannel.subscribed(() => {
          console.log('[GlobalInvitation] Successfully subscribed to user channel:', `App.Models.User.${user.id}`);
        });

        // Listen for subscription errors
        userChannel.error((error) => {
          console.error('[GlobalInvitation] Channel subscription error:', error);
        });
      }
    } else {
      console.error('[GlobalInvitation] Failed to create user channel');
    }

    // Function to register all event listeners
    function registerEventListeners(userChannel) {
    // Listen for new game invitations
    userChannel.listen('.invitation.sent', (data) => {
      // Don't show dialog if user is in active game
      if (isInActiveGameRef.current()) {
        return;
      }

      // Show invitation dialog for any invitation type (including championship matches)
      if (data.invitation) {
        setPendingInvitation(data.invitation);
      } else {
        console.warn('[GlobalInvitation] Invitation data missing:', data);
      }
    });

    // Listen for new game requests (rematch challenges from online players)
    userChannel.listen('.new_game.request', (data) => {
      // Don't show dialog if user is in active game
      if (isInActiveGameRef.current()) {
        return;
      }

      // Convert the new game request to invitation format for dialog display
      if (data.requesting_user && data.new_game) {
        const invitationData = {
          id: `new_game_${data.new_game_id}`, // Use a unique ID for new game requests
          type: 'new_game_request',
          inviter: data.requesting_user,
          inviter_preferred_color: data.color_preference === 'random' ? 'random' : data.color_preference,
          created_at: data.created_at,
          new_game_id: data.new_game_id,
          original_game_id: data.original_game_id,
          message: data.message
        };

        setPendingInvitation(invitationData);
      } else {
        console.warn('[GlobalInvitation] New game request data missing:', data);
      }
    });

    // Listen for resume requests
    userChannel.listen('.resume.request.sent', (data) => {
      // Note: Always show resume requests, even when on game page, since resume requests
      // are specifically for reactivating paused games that the user is already viewing

      // Show resume request dialog
      if (data.game_id && data.requesting_user) {
        const resumeRequestData = {
          gameId: data.game_id,
          requestingUserId: data.requesting_user.id,
          requestingUserName: data.requesting_user.name,
          expiresAt: data.expires_at,
          game: data.game,
          invitationId: data.invitation?.id, // Store invitation ID for removal
        };
        setResumeRequest(resumeRequestData);
      } else {
        console.warn('[GlobalInvitation] Missing required data in resume request:', {
          hasGameId: !!data.game_id,
          hasRequestingUser: !!data.requesting_user,
          rawData: data
        });
      }
    });

    // Listen for invitation accepted (for inviters - navigate to game)
    userChannel.listen('.invitation.accepted', (data) => {
      // Remove any pending invitation (cleanup)
      if (data.invitation && data.invitation.id) {
        if (pendingInvitationRef.current?.id === data.invitation.id) {
          setPendingInvitation(null);
        }
      }

      // Navigate to the game if game data is provided
      if (data.game && data.game.id) {
        // Set session markers for proper game access (challenger perspective)
        sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', data.game.id.toString());

        navigate(`/play/multiplayer/${data.game.id}`);
      } else {
        console.warn('[GlobalInvitation] Invitation accepted but no game data in event:', data);
      }
    });

    // Listen for invitation declined (for inviters)
    userChannel.listen('.invitation.declined', (data) => {
      // Remove any pending invitation (cleanup)
      if (data.invitation && data.invitation.id) {
        setPendingInvitation(null);
      }

      // Optional: Show notification in the future if needed
      // For now, just closing the dialog is enough feedback
    });

    // Listen for championship invitation accepted (for inviters - navigate to game)
    userChannel.listen('.championship.invitation.accepted', (data) => {
      // Remove any pending invitation (cleanup)
      if (data.match) {
        setPendingInvitation(null);
      }

      // Navigate to the game if game data is provided
      // Check both possible structures: data.game.id or data.match.game_id
      const gameId = data.game?.id || data.match?.game_id;

      if (gameId) {
        // Set session markers for proper game access (challenger perspective)
        sessionStorage.setItem('lastInvitationAction', 'championship_invitation_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', gameId.toString());

        navigate(`/play/multiplayer/${gameId}`);
      } else {
        console.warn('[GlobalInvitation] Championship invitation accepted but no game data in event:', data);
      }
    });

    // Listen for championship game resume requests
    userChannel.listen('.championship.game.resume.request', (data) => {
      // Don't show dialog if user is in active multiplayer game
      if (isInActiveGameRef.current()) {
        return;
      }

      // Show championship resume request dialog
      if (data.request_id && data.match_id && data.requester) {
        setChampionshipResumeRequest({
          requestId: data.request_id,
          matchId: data.match_id,
          gameId: data.game_id,
          championshipId: data.championship_id, // Include if available from backend
          requester: {
            id: data.requester.id,
            name: data.requester.name,
            avatar_url: data.requester.avatar_url,
          },
          expiresAt: data.expires_at,
        });
      }
    });

    // Listen for championship game resume request accepted (for requesters - navigate to game)
    userChannel.listen('.championship.game.resume.accepted', (data) => {
      // Remove any pending championship request (cleanup)
      if (data.match_id) {
        setChampionshipResumeRequest(null);
      }

      // Navigate to the game if game data is provided
      if (data.game_id) {
        // Set session markers for proper game access
        sessionStorage.setItem('lastInvitationAction', 'championship_resume_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', data.game_id.toString());

        navigate(`/play/multiplayer/${data.game_id}`);
      } else {
        console.warn('[GlobalInvitation] Championship resume request accepted but no game data in event:', data);
      }
    });

    // Listen for championship game resume request declined (for requesters - notification)
    userChannel.listen('.championship.game.resume.declined', (data) => {
      // Remove any pending championship request (cleanup)
      if (data.match_id) {
        setChampionshipResumeRequest(null);
      }

      // Emit a custom DOM event for championship pages to show notification
      const declineEvent = new CustomEvent('championshipResumeDeclined', {
        detail: {
          matchId: data.match_id,
          message: `${data.declining_user?.name || 'Opponent'} declined your resume request.`
        }
      });
      window.dispatchEvent(declineEvent);
    });

    // Listen for resume request expired (auto-dismiss dialog for both regular and championship games)
    userChannel.listen('.resume.request.expired', (data) => {
      // Check if it's a regular resume request
      if (data.game_id && resumeRequestRef.current?.gameId === data.game_id) {
        setResumeRequest(null);
      }

      // Check if it's a championship resume request (same game_id check)
      if (data.game_id && championshipResumeRequestRef.current?.gameId === data.game_id) {
        setChampionshipResumeRequest(null);
      }
    });

    // Listen for resume request response (handle accept/decline)
    userChannel.listen('.resume.request.response', (data) => {
      // Check if we have a pending resume request for this game
      if (data.game_id && resumeRequestRef.current?.gameId === parseInt(data.game_id)) {
        if (data.response === 'declined') {
          // Close the waiting dialog
          setResumeRequest(null);

          // Note: Notification is now handled in PlayMultiplayer.js with redirect to lobby
        } else if (data.response === 'accepted') {
          // The game will be resumed automatically, just close the waiting dialog
          setResumeRequest(null);
        }
      }
    });

    // Listen for invitation cancelled (for cleanup)
    userChannel.listen('.invitation.cancelled', (data) => {
      // Use ref to check current pending invitation
      if (data.invitation && pendingInvitationRef.current?.id === data.invitation.id) {
        setPendingInvitation(null);
      }
    });

    // ─── Smart Match Request Listeners ────────────────────────────────

    // Listen for incoming match requests (target receives this)
    userChannel.listen('.match.request.received', (data) => {
      // Don't show dialog if user is in active game
      if (isInActiveGameRef.current()) {
        return;
      }

      if (data.match_request) {
        setPendingMatchRequest(data.match_request);
      }
    });

    // Listen for match request cancelled (target receives this when requester cancels or another accepts)
    userChannel.listen('.match.request.cancelled', (data) => {
      if (data.match_request_token && pendingMatchRequestRef.current?.token === data.match_request_token) {
        setPendingMatchRequest(null);
      }
    });

    // Listen for match request accepted (requester receives this when a target accepts)
    userChannel.listen('.match.request.accepted', (data) => {
      // Dispatch DOM event for MatchmakingQueue to navigate
      if (data.game && data.game.id) {
        const acceptedEvent = new CustomEvent('matchRequestAccepted', {
          detail: {
            gameId: data.game.id,
            matchRequestToken: data.match_request?.token,
            acceptedBy: data.match_request?.accepted_by,
          }
        });
        window.dispatchEvent(acceptedEvent);
      }
    });

    // Listen for match request declined (requester receives this when a target declines)
    userChannel.listen('.match.request.declined', (data) => {
      if (data.match_request_token) {
        const declinedEvent = new CustomEvent('matchRequestDeclined', {
          detail: {
            matchRequestToken: data.match_request_token,
            remainingTargets: data.remaining_targets,
          }
        });
        window.dispatchEvent(declinedEvent);
      }
    });
    } // End of registerEventListeners function

      // Return cleanup function from setupListeners
      return () => {
        if (userChannel) {
          userChannel.stopListening('.invitation.sent');
          userChannel.stopListening('.new_game.request');
          userChannel.stopListening('.resume.request.sent');
          userChannel.stopListening('.invitation.cancelled');
          userChannel.stopListening('.championship.game.resume.request');
          userChannel.stopListening('.championship.game.resume.accepted');
          userChannel.stopListening('.championship.game.resume.declined');
          userChannel.stopListening('.resume.request.expired');
          userChannel.stopListening('.resume.request.response');
          userChannel.stopListening('.match.request.received');
          userChannel.stopListening('.match.request.cancelled');
          userChannel.stopListening('.match.request.accepted');
          userChannel.stopListening('.match.request.declined');
        }
      };
    } // End of setupListeners function
    // Re-run when user changes OR when navigating to ensure listeners are always active
    // This fixes the issue where listeners weren't set up after navigation without refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, location.pathname]);

  // Listen to global WebSocket manager for game status changes
  useEffect(() => {
    if (!user?.id) return;

    // Listen for game status changes
    const handleGameStatusChanged = (event) => {
      // If game is no longer paused, clear any resume request
      if (event.status && event.status !== 'paused') {
        setResumeRequest(null);
      }
    };

    // Subscribe to events
    globalWebSocketManager.on('gameStatusChanged', handleGameStatusChanged);

    // Cleanup
    return () => {
      globalWebSocketManager.off('gameStatusChanged', handleGameStatusChanged);
    };
  }, [user?.id]);

  // Accept game invitation
  const acceptInvitation = useCallback(async (invitationId, colorChoice) => {
    if (isProcessingRef.current) {
      return;
    }

    setIsProcessing(true);
    try {
      // Check if this is a new game request (rematch challenge)
      if (typeof invitationId === 'string' && invitationId.startsWith('new_game_')) {
        // Get the current pending invitation to extract game data
        const currentInvitation = pendingInvitationRef.current;
        if (!currentInvitation || !currentInvitation.new_game_id) {
          throw new Error('New game request data not found');
        }

        // For new game requests, the game is already created, just navigate to it
        const gameId = currentInvitation.new_game_id;

        // Clear the dialog
        setPendingInvitation(null);

        sessionStorage.setItem('lastInvitationAction', 'new_game_accepted');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', gameId.toString());

        navigate(`/play/multiplayer/${gameId}`);
        return;
      }

      // Handle regular invitation accept
      const requestData = {
        action: 'accept',
        desired_color: colorChoice,
      };

      const response = await api.post(`/invitations/${invitationId}/respond`, requestData);

      // Clear the dialog
      setPendingInvitation(null);

      // Navigate to the game
      if (response.data.game?.id) {
        const gameId = response.data.game.id;

        sessionStorage.setItem('lastInvitationAction', 'accepted');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', gameId.toString());

        navigate(`/play/multiplayer/${gameId}`);
      } else {
        console.error('[GlobalInvitation] No game ID in response!', response.data);
        alert('Game was created but we could not navigate to it. Please check your active games.');
      }
    } catch (error) {
      console.error('[GlobalInvitation] Failed to accept invitation:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      alert(`Failed to accept invitation: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [navigate]);

  // Decline game invitation
  const declineInvitation = useCallback(async (invitationId) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      // Convert invitationId to string for consistent handling
      const invitationIdStr = String(invitationId);

      // Check if this is a new game request (rematch challenge)
      if (invitationIdStr.startsWith('new_game_')) {
        // For new game requests, we don't need to call any API since the game is already created
        // The opponent will see the game in their active games if they don't accept
        // Just clear the dialog and do nothing else
        setPendingInvitation(null);
        return;
      }

      // Handle regular invitation decline
      await api.post(`/invitations/${invitationId}/respond`, { action: 'decline' });

      // Clear the dialog
      setPendingInvitation(null);
    } catch (error) {
      console.error('[GlobalInvitation] Failed to decline invitation:', error);
      alert('Failed to decline invitation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Accept resume request
  const acceptResumeRequest = useCallback(async (gameId) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      const echo = getEcho();
      const socketId = echo?.socketId();

      // Build request body, only include socket_id if it's a valid string
      const requestBody = { response: true };
      if (typeof socketId === 'string' && socketId.length > 0) {
        requestBody.socket_id = socketId;
      }

      const response = await api.post(
        `/websocket/games/${gameId}/resume-response`,
        requestBody
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Resume response failed');
      }

      // Clear the dialog
      setResumeRequest(null);

      // Navigate to the game
      sessionStorage.setItem('lastInvitationAction', 'resume_accepted');
      sessionStorage.setItem('lastInvitationTime', Date.now().toString());
      sessionStorage.setItem('lastGameId', gameId.toString());
      navigate(`/play/multiplayer/${gameId}`);
    } catch (error) {
      console.error('[GlobalInvitation] Failed to accept resume request:', error);
      alert('Failed to accept resume request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [navigate]);

  // Decline resume request
  const declineResumeRequest = useCallback(async (gameId) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      const echo = getEcho();
      const socketId = echo?.socketId();

      // Build request body, only include socket_id if it's a valid string
      const requestBody = { response: false };
      if (typeof socketId === 'string' && socketId.length > 0) {
        requestBody.socket_id = socketId;
      }

      await api.post(
        `/websocket/games/${gameId}/resume-response`,
        requestBody
      );

      // Clear the dialog
      setResumeRequest(null);
    } catch (error) {
      console.error('[GlobalInvitation] Failed to decline resume request:', error);
      alert('Failed to decline resume request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Accept championship resume request
  const acceptChampionshipResumeRequest = useCallback(async (matchId, gameId) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      // Get championship ID from the current championship resume request state
      const championshipId = championshipResumeRequestRef.current?.championshipId;

      if (!championshipId) {
        throw new Error('Championship ID not found in request data');
      }

      // Use the championship-specific accept endpoint
      const response = await api.post(
        `/championships/${championshipId}/matches/${matchId}/resume-request/accept`
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Championship resume response failed');
      }

      // Clear the dialog
      setChampionshipResumeRequest(null);

      // Navigate to the game
      sessionStorage.setItem('lastInvitationAction', 'championship_resume_accepted');
      sessionStorage.setItem('lastInvitationTime', Date.now().toString());
      sessionStorage.setItem('lastGameId', gameId.toString());
      navigate(`/play/multiplayer/${gameId}`);
    } catch (error) {
      console.error('[GlobalInvitation] Failed to accept championship resume request:', error);
      alert('Failed to accept championship resume request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [navigate]);

  // Accept match request (target player accepts)
  const acceptMatchRequest = useCallback(async (token) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      const response = await matchmakingService.acceptMatchRequest(token);

      // Clear the dialog
      setPendingMatchRequest(null);

      // Navigate to the game
      if (response.game?.id) {
        const gameId = response.game.id;
        sessionStorage.setItem('lastInvitationAction', 'match_request_accepted');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', gameId.toString());
        navigate(`/play/multiplayer/${gameId}`);
      }
    } catch (error) {
      console.error('[GlobalInvitation] Failed to accept match request:', error);
      const errorMessage = error.response?.data?.error || error.message;
      alert(`Failed to accept match request: ${errorMessage}`);
      setPendingMatchRequest(null);
    } finally {
      setIsProcessing(false);
    }
  }, [navigate]);

  // Decline match request (target player declines)
  const declineMatchRequest = useCallback(async (token) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      await matchmakingService.declineMatchRequest(token);
      setPendingMatchRequest(null);
    } catch (error) {
      console.error('[GlobalInvitation] Failed to decline match request:', error);
      setPendingMatchRequest(null);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Decline championship resume request
  const declineChampionshipResumeRequest = useCallback(async (matchId, gameId) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      // Get championship ID from the current championship resume request state
      const championshipId = championshipResumeRequestRef.current?.championshipId;

      if (!championshipId) {
        throw new Error('Championship ID not found in request data');
      }

      // Use the championship-specific decline endpoint
      await api.post(
        `/championships/${championshipId}/matches/${matchId}/resume-request/decline`
      );

      // Clear the dialog
      setChampionshipResumeRequest(null);
    } catch (error) {
      console.error('[GlobalInvitation] Failed to decline championship resume request:', error);
      alert('Failed to decline championship resume request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const value = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <GlobalInvitationContext.Provider value={value}>
      {children}
    </GlobalInvitationContext.Provider>
  );
};

export const useGlobalInvitation = () => {
  const context = useContext(GlobalInvitationContext);
  if (!context) {
    throw new Error('useGlobalInvitation must be used within GlobalInvitationProvider');
  }
  return context;
};
