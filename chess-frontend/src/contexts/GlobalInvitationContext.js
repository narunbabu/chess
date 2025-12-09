// src/contexts/GlobalInvitationContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getEcho } from '../services/echoSingleton';
import api from '../services/api';
import globalWebSocketManager from '../services/GlobalWebSocketManager';

const GlobalInvitationContext = createContext(null);

export const GlobalInvitationProvider = ({ children }) => {
  // CRITICAL: This log should ALWAYS appear if the provider is rendering
  console.log('[GlobalInvitation] 🏗️ Provider component rendering - ENTRY POINT', {
    timestamp: new Date().toISOString(),
    location: window.location.pathname
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  console.log('[GlobalInvitation] 🔍 Provider render state:', {
    hasUser: !!user,
    userId: user?.id,
    userName: user?.username || user?.name,
    userEmail: user?.email,
    pathname: location.pathname,
    hasAuthContext: !!useAuth
  });

  // State for managing invitations and dialogs
  const [pendingInvitation, setPendingInvitation] = useState(null);
  const [resumeRequest, setResumeRequest] = useState(null);
  const [championshipResumeRequest, setChampionshipResumeRequest] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs to track current values without causing re-renders
  const pendingInvitationRef = useRef(null);
  pendingInvitationRef.current = pendingInvitation;

  const resumeRequestRef = useRef(null);
  resumeRequestRef.current = resumeRequest;

  const championshipResumeRequestRef = useRef(null);
  championshipResumeRequestRef.current = championshipResumeRequest;

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
    console.log('[GlobalInvitation] 🔄 Provider useEffect triggered', {
      hasUser: !!user,
      userId: user?.id,
      userName: user?.username,
      pathname: location.pathname,
      timestamp: new Date().toISOString()
    });

    if (!user) {
      console.log('[GlobalInvitation] ⏭️ No user yet, skipping listener setup');
      return;
    }

    // Try to get Echo with retry logic
    let echo = getEcho();
    console.log('[GlobalInvitation] 🔍 Initial Echo check:', {
      hasEcho: !!echo,
      hasWindow: typeof window !== 'undefined',
      windowEcho: !!window.Echo,
      socketId: echo?.socketId?.()
    });

    if (!echo) {
      console.warn('[GlobalInvitation] ⚠️ Echo not immediately available, will retry in 500ms...');

      // Track cleanup state
      let cleanupCalled = false;
      let cleanupFunction = null;

      // Retry after a short delay to allow Echo to initialize
      const retryTimeout = setTimeout(() => {
        if (cleanupCalled) {
          console.log('[GlobalInvitation] ⏭️ Component unmounted, skipping retry');
          return;
        }

        echo = getEcho();
        console.log('[GlobalInvitation] 🔄 Retry Echo check:', {
          hasEcho: !!echo,
          socketId: echo?.socketId?.()
        });

        if (echo) {
          console.log('[GlobalInvitation] ✅ Echo available after retry, setting up listeners');
          cleanupFunction = setupListeners(echo);
        } else {
          console.error('[GlobalInvitation] ❌ Echo still not available after retry, invitation dialogs will not work');
        }
      }, 500);

      return () => {
        cleanupCalled = true;
        clearTimeout(retryTimeout);
        if (cleanupFunction) {
          cleanupFunction();
        }
      };
    }

    // Echo is available immediately
    return setupListeners(echo);

    function setupListeners(echo) {
      if (!echo || !user?.id) {
        console.error('[GlobalInvitation] ❌ Cannot setup listeners - missing Echo or user ID');
        return;
      }

    console.log('[GlobalInvitation] ✅ Setting up listeners for user:', user.id);
    console.log('[GlobalInvitation] 🔌 Echo available:', !!echo);
    console.log('[GlobalInvitation] 📍 Current location:', location.pathname);
    console.log('[GlobalInvitation] 🕐 Setup timestamp:', new Date().toISOString());

    // Subscribe to user-specific channel (shared for all invitation types)
    const userChannel = echo.private(`App.Models.User.${user.id}`);
    console.log('[GlobalInvitation] 📡 Subscribing to channel:', `App.Models.User.${user.id}`);
    console.log('[GlobalInvitation] 🔌 Echo available:', !!echo);
    console.log('[GlobalInvitation] 📍 User location:', location.pathname);
    console.log('[GlobalInvitation] ℹ️ This channel handles ALL invitation types (regular + championship)');
    console.log('[GlobalInvitation] ⏰ Timestamp:', new Date().toISOString());

    // Check Pusher connection state
    const pusherState = echo?.connector?.pusher?.connection?.state;
    console.log('[GlobalInvitation] 🔗 Pusher connection state:', pusherState);
    console.log('[GlobalInvitation] 🔗 Pusher socket ID:', echo.socketId?.());

    // Add subscription success confirmation
    if (userChannel) {
      console.log('[GlobalInvitation] ✅ Channel object created successfully');

      // CRITICAL FIX: Register event listeners IMMEDIATELY, before checking subscription state
      // This ensures listeners are ready even if subscription completes instantly
      console.log('[GlobalInvitation] 🎯 Registering event listeners IMMEDIATELY...');

      // Register all listeners first (before any state checks)
      registerEventListeners(userChannel);

      console.log('[GlobalInvitation] ✅ All event listeners registered');

      // Now check subscription state for logging purposes only
      const currentSubscriptionState = userChannel.subscription?.state;
      console.log('[GlobalInvitation] 🔍 Current subscription state:', currentSubscriptionState);

      if (currentSubscriptionState === 'subscribed') {
        console.log('[GlobalInvitation] 🎉 Already subscribed to user channel:', `App.Models.User.${user.id}`);
        console.log('[GlobalInvitation] ✅ Resume request listener is now ACTIVE and waiting for events');
      } else {
        console.log('[GlobalInvitation] ⏳ Subscription pending, waiting for confirmation...');

        // Listen for subscription success
        userChannel.subscribed(() => {
          console.log('[GlobalInvitation] 🎉 Successfully subscribed to user channel:', `App.Models.User.${user.id}`);
          console.log('[GlobalInvitation] ✅ Resume request listener is now ACTIVE and waiting for events');
        });

        // Listen for subscription errors
        userChannel.error((error) => {
          console.error('[GlobalInvitation] ❌ Channel subscription error:', error);
        });
      }
    } else {
      console.error('[GlobalInvitation] ❌ Failed to create user channel');
    }

    // Function to register all event listeners
    function registerEventListeners(userChannel) {
      console.log('[GlobalInvitation] 📝 Starting event listener registration...');

    // Listen for new game invitations
    userChannel.listen('.invitation.sent', (data) => {
      console.log('[GlobalInvitation] 📨 New invitation received:', data);
      console.log('[GlobalInvitation] 🎯 Invitation type:', data.invitation?.type);
      console.log('[GlobalInvitation] 📍 Current location:', window.location.pathname);
      console.log('[GlobalInvitation] 👤 User in active game?', isInActiveGameRef.current());

      // Don't show dialog if user is in active game
      if (isInActiveGameRef.current()) {
        console.log('[GlobalInvitation] User in active game, skipping dialog');
        return;
      }

      // Show invitation dialog for any invitation type (including championship matches)
      if (data.invitation) {
        console.log('[GlobalInvitation] ✅ Setting pending invitation:', data.invitation.id, data.invitation.type);
        setPendingInvitation(data.invitation);
      } else {
        console.warn('[GlobalInvitation] ⚠️ Invitation data missing:', data);
      }
    });

    // Listen for new game requests (rematch challenges from online players)
    userChannel.listen('.new_game.request', (data) => {
      console.log('[GlobalInvitation] 🎯 New game request received:', data);
      console.log('[GlobalInvitation] 📍 Current location:', window.location.pathname);
      console.log('[GlobalInvitation] 👤 User in active game?', isInActiveGameRef.current());

      // Don't show dialog if user is in active game
      if (isInActiveGameRef.current()) {
        console.log('[GlobalInvitation] User in active game, skipping new game request dialog');
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

        console.log('[GlobalInvitation] ✅ Setting pending new game request:', invitationData.id);
        setPendingInvitation(invitationData);
      } else {
        console.warn('[GlobalInvitation] ⚠️ New game request data missing:', data);
      }
    });

    // Listen for resume requests
    userChannel.listen('.resume.request.sent', (data) => {
      console.log('[GlobalInvitation] 🎯 Resume request received via WebSocket:', data);
      console.log('[GlobalInvitation] 👤 My user ID:', user.id, 'Request from user:', data.requesting_user?.id, 'Game ID:', data.game_id);
      console.log('[GlobalInvitation] 🕐 Resume request timestamp:', new Date().toISOString());
      console.log('[GlobalInvitation] 📋 Resume request details:', {
        gameId: data.game_id,
        requestingUserId: data.requesting_user?.id,
        requestingUserName: data.requesting_user?.name,
        myUserId: user?.id,
        expiresAt: data.expires_at,
        currentPath: window.location.pathname
      });

      // Note: Always show resume requests, even when on game page, since resume requests
      // are specifically for reactivating paused games that the user is already viewing

      // Show resume request dialog
      if (data.game_id && data.requesting_user) {
        console.log('[GlobalInvitation] ✅ Setting resume request state');
        const resumeRequestData = {
          gameId: data.game_id,
          requestingUserId: data.requesting_user.id,
          requestingUserName: data.requesting_user.name,
          expiresAt: data.expires_at,
          game: data.game,
          invitationId: data.invitation?.id, // Store invitation ID for removal
        };
        console.log('[GlobalInvitation] 📦 Resume request data being set:', resumeRequestData);
        console.log('[GlobalInvitation] 🔍 Current resumeRequest state before update:', resumeRequestRef.current);
        setResumeRequest(resumeRequestData);
        console.log('[GlobalInvitation] 🔄 setResumeRequest() called - dialog should appear now');
        console.log('[GlobalInvitation] 💡 If dialog does not appear:');
        console.log('[GlobalInvitation] 1. Check GlobalInvitationDialog logs for state update');
        console.log('[GlobalInvitation] 2. Verify GlobalInvitationDialog is mounted in React DevTools');
        console.log('[GlobalInvitation] 3. Check if CSS is hiding the dialog');
      } else {
        console.warn('[GlobalInvitation] ❌ Missing required data in resume request:', {
          hasGameId: !!data.game_id,
          hasRequestingUser: !!data.requesting_user,
          rawData: data
        });
      }
    });

    // Listen for invitation accepted (for inviters - navigate to game)
    userChannel.listen('.invitation.accepted', (data) => {
      console.log('[GlobalInvitation] 🎉 Invitation accepted event received:', data);

      // Remove any pending invitation (cleanup)
      if (data.invitation && data.invitation.id) {
        console.log('[GlobalInvitation] Removing accepted invitation from pending:', data.invitation.id);
        if (pendingInvitationRef.current?.id === data.invitation.id) {
          setPendingInvitation(null);
        }
      }

      // Navigate to the game if game data is provided
      if (data.game && data.game.id) {
        console.log('[GlobalInvitation] 🎮 Navigating to game ID:', data.game.id);

        // Set session markers for proper game access (challenger perspective)
        sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', data.game.id.toString());

        navigate(`/play/multiplayer/${data.game.id}`);
      } else {
        console.warn('[GlobalInvitation] ⚠️ Invitation accepted but no game data in event:', data);
      }
    });

    // Listen for championship invitation accepted (for inviters - navigate to game)
    userChannel.listen('.championship.invitation.accepted', (data) => {
      console.log('[GlobalInvitation] 🏆 Championship invitation accepted event received:', data);

      // Remove any pending invitation (cleanup)
      if (data.match) {
        console.log('[GlobalInvitation] Removing championship match from pending');
        setPendingInvitation(null);
      }

      // Navigate to the game if game data is provided
      // Check both possible structures: data.game.id or data.match.game_id
      const gameId = data.game?.id || data.match?.game_id;

      if (gameId) {
        console.log('[GlobalInvitation] 🎮 Navigating to championship game ID:', gameId);

        // Set session markers for proper game access (challenger perspective)
        sessionStorage.setItem('lastInvitationAction', 'championship_invitation_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', gameId.toString());

        navigate(`/play/multiplayer/${gameId}`);
      } else {
        console.warn('[GlobalInvitation] ⚠️ Championship invitation accepted but no game data in event:', data);
      }
    });

    // Listen for championship game resume requests
    userChannel.listen('.championship.game.resume.request', (data) => {
      console.log('[GlobalInvitation] 🏆 Championship game resume request received:', data);

      // Don't show dialog if user is in active multiplayer game
      if (isInActiveGameRef.current()) {
        console.log('[GlobalInvitation] User in active multiplayer game, skipping championship request dialog');
        return;
      }

      // Show championship resume request dialog
      if (data.request_id && data.match_id && data.requester) {
        // Extract championship ID from the match or game data if available
        let championshipId = null;

        // Try to get championship ID from match data or game data
        // The backend might not include this directly, so we'll handle it in the API calls

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
      console.log('[GlobalInvitation] 🏆 Championship resume request accepted event received:', data);
      console.log('[GlobalInvitation] 👤 Current user ID:', user?.id);
      console.log('[GlobalInvitation] 📍 Current location:', location.pathname);

      // Remove any pending championship request (cleanup)
      if (data.match_id) {
        console.log('[GlobalInvitation] Removing championship match request from pending');
        setChampionshipResumeRequest(null);
      }

      // Navigate to the game if game data is provided
      if (data.game_id) {
        console.log('[GlobalInvitation] 🎮 Navigating to championship game ID:', data.game_id);

        // Set session markers for proper game access
        sessionStorage.setItem('lastInvitationAction', 'championship_resume_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', data.game_id.toString());

        navigate(`/play/multiplayer/${data.game_id}`);
      } else {
        console.warn('[GlobalInvitation] ⚠️ Championship resume request accepted but no game data in event:', data);
      }
    });

    // Listen for championship game resume request declined (for requesters - notification)
    userChannel.listen('.championship.game.resume.declined', (data) => {
      console.log('[GlobalInvitation] 🏆 Championship resume request declined event received:', data);

      // Remove any pending championship request (cleanup)
      if (data.match_id) {
        console.log('[GlobalInvitation] Removing declined championship match request from pending');
        setChampionshipResumeRequest(null);
      }

      // Note: Could show a notification here that the request was declined, but keeping it simple for now
    });

    // Listen for resume request expired (auto-dismiss dialog for both regular and championship games)
    userChannel.listen('.resume.request.expired', (data) => {
      console.log('[GlobalInvitation] ⏰ Resume request expired event received:', data);

      // Check if it's a regular resume request
      if (data.game_id && resumeRequestRef.current?.gameId === data.game_id) {
        console.log('[GlobalInvitation] Auto-dismissing expired resume request');
        setResumeRequest(null);
      }

      // Check if it's a championship resume request (same game_id check)
      if (data.game_id && championshipResumeRequestRef.current?.gameId === data.game_id) {
        console.log('[GlobalInvitation] Auto-dismissing expired championship resume request');
        setChampionshipResumeRequest(null);
      }
    });

    // Listen for resume request response (handle accept/decline)
    userChannel.listen('.resume.request.response', (data) => {
      console.log('[GlobalInvitation] 📨 Resume request response received:', data);
      console.log('[GlobalInvitation] 📊 Response type:', data.response);
      console.log('[GlobalInvitation] 🎮 Game ID:', data.game_id);
      console.log('[GlobalInvitation] 👤 Responding user:', data.responding_user?.name);

      // Check if we have a pending resume request for this game
      if (data.game_id && resumeRequestRef.current?.gameId === parseInt(data.game_id)) {
        if (data.response === 'declined') {
          console.log('[GlobalInvitation] ❌ Resume request was declined');

          // Create a notification for the declined request
          const declinedNotification = {
            id: `resume-declined-${data.game_id}-${Date.now()}`,
            type: 'resume_declined',
            title: 'Resume Request Declined',
            message: `${data.responding_user?.name || 'Opponent'} declined your resume request`,
            timestamp: new Date(),
            gameId: data.game_id,
            read: false
          };

          // Add to notifications
          setNotifications(prev => [declinedNotification, ...prev.slice(0, 49)]); // Keep max 50 notifications

          // Close the waiting dialog
          setResumeRequest(null);

          console.log('[GlobalInvitation] ✅ Decline notification added and dialog closed');
        } else if (data.response === 'accepted') {
          console.log('[GlobalInvitation] ✅ Resume request was accepted');

          // The game will be resumed automatically, just close the waiting dialog
          setResumeRequest(null);

          console.log('[GlobalInvitation] ✅ Resume request accepted, dialog closed');
        }
      }
    });

    // Listen for invitation cancelled (for cleanup)
    userChannel.listen('.invitation.cancelled', (data) => {
      console.log('[GlobalInvitation] Invitation cancelled:', data);

      // Use ref to check current pending invitation
      if (data.invitation && pendingInvitationRef.current?.id === data.invitation.id) {
        setPendingInvitation(null);
      }
    });

      console.log('[GlobalInvitation] ✅ All 8 event listeners registered successfully');
    } // End of registerEventListeners function

      // Return cleanup function from setupListeners
      return () => {
        console.log('[GlobalInvitation] Cleaning up listeners for user:', user.id);
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

    console.log('[GlobalInvitation] 🌐 Setting up global WebSocket manager listeners');

    // Listen for game status changes
    const handleGameStatusChanged = (event) => {
      console.log('[GlobalInvitation] 🌐 Game status changed from global manager:', event);

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
      console.log('[GlobalInvitation] Already processing, preventing duplicate request');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[GlobalInvitation] ✅ Accepting invitation:', invitationId, 'with color:', colorChoice);

      // Check if this is a new game request (rematch challenge)
      if (typeof invitationId === 'string' && invitationId.startsWith('new_game_')) {
        console.log('[GlobalInvitation] 🎯 This is a new game request, using WebSocket accept');

        // Get the current pending invitation to extract game data
        const currentInvitation = pendingInvitationRef.current;
        if (!currentInvitation || !currentInvitation.new_game_id) {
          throw new Error('New game request data not found');
        }

        // For new game requests, the game is already created, just navigate to it
        const gameId = currentInvitation.new_game_id;
        console.log('[GlobalInvitation] 🚀 Navigating to new game:', gameId);

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

      console.log('[GlobalInvitation] 📤 Sending POST request to /invitations/' + invitationId + '/respond');
      const response = await api.post(`/invitations/${invitationId}/respond`, requestData);

      console.log('[GlobalInvitation] 🎉 Invitation accepted successfully:', response.data);
      console.log('[GlobalInvitation] 🎮 Game created:', response.data.game);

      // Clear the dialog
      setPendingInvitation(null);

      // Navigate to the game
      if (response.data.game?.id) {
        const gameId = response.data.game.id;
        console.log('[GlobalInvitation] 🚀 Navigating to game:', gameId);

        sessionStorage.setItem('lastInvitationAction', 'accepted');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', gameId.toString());

        navigate(`/play/multiplayer/${gameId}`);
      } else {
        console.error('[GlobalInvitation] ❌ No game ID in response!', response.data);
        alert('Game was created but we could not navigate to it. Please check your active games.');
      }
    } catch (error) {
      console.error('[GlobalInvitation] ❌ Failed to accept invitation:', error);
      console.error('[GlobalInvitation] Error response:', error.response?.data);
      console.error('[GlobalInvitation] Error status:', error.response?.status);

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
      console.log('[GlobalInvitation] Declining invitation:', invitationId);

      // Check if this is a new game request (rematch challenge)
      if (invitationId.startsWith('new_game_')) {
        console.log('[GlobalInvitation] 🎯 This is a new game request, just dismissing dialog');

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
      console.log('[GlobalInvitation] Accepting resume request for game:', gameId);

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

      console.log('[GlobalInvitation] Resume request accepted, navigating to game');

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
      console.log('[GlobalInvitation] Declining resume request for game:', gameId);

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
      console.log('[GlobalInvitation] Accepting championship resume request for match:', matchId, 'game:', gameId);

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

      console.log('[GlobalInvitation] Championship resume request accepted, navigating to game');

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

  // Decline championship resume request
  const declineChampionshipResumeRequest = useCallback(async (matchId, gameId) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      console.log('[GlobalInvitation] Declining championship resume request for match:', matchId, 'game:', gameId);

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
    isProcessing,
    acceptInvitation,
    declineInvitation,
    acceptResumeRequest,
    declineResumeRequest,
    acceptChampionshipResumeRequest,
    declineChampionshipResumeRequest,
  }), [
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
