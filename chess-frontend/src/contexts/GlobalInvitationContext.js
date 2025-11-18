// src/contexts/GlobalInvitationContext.js
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getEcho } from '../services/echoSingleton';
import api from '../services/api';

const GlobalInvitationContext = createContext(null);

export const GlobalInvitationProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State for managing invitations and dialogs
  const [pendingInvitation, setPendingInvitation] = useState(null);
  const [resumeRequest, setResumeRequest] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs to track current values without causing re-renders
  const pendingInvitationRef = useRef(null);
  pendingInvitationRef.current = pendingInvitation;

  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  // Check if user is currently in an active game (should NOT show dialogs)
  const isInActiveGame = useCallback(() => {
    const path = location.pathname;
    // Block dialogs when user is on a multiplayer game page
    return path.startsWith('/play/multiplayer/') || path.startsWith('/play/');
  }, [location.pathname]);

  // Listen to WebSocket events for invitations
  useEffect(() => {
    if (!user) return;

    const echo = getEcho();
    if (!echo) {
      console.warn('[GlobalInvitation] Echo not available, invitation dialogs will not work');
      return;
    }

    console.log('[GlobalInvitation] Setting up listeners for user:', user.id);

    // Subscribe to user-specific channel
    const userChannel = echo.private(`App.Models.User.${user.id}`);

    // Listen for new game invitations
    userChannel.listen('.invitation.sent', (data) => {
      console.log('[GlobalInvitation] New invitation received:', data);

      // Don't show dialog if user is in active game
      if (isInActiveGame()) {
        console.log('[GlobalInvitation] User in active game, skipping dialog');
        return;
      }

      // Show invitation dialog
      if (data.invitation) {
        setPendingInvitation(data.invitation);
      }
    });

    // Listen for resume requests
    userChannel.listen('.resume.request.sent', (data) => {
      console.log('[GlobalInvitation] Resume request received:', data);

      // Don't show dialog if user is in active game
      if (isInActiveGame()) {
        console.log('[GlobalInvitation] User in active game, skipping resume dialog');
        return;
      }

      // Show resume request dialog
      if (data.game_id && data.requesting_user) {
        setResumeRequest({
          gameId: data.game_id,
          requestingUserId: data.requesting_user.id,
          requestingUserName: data.requesting_user.name,
          expiresAt: data.expires_at,
          game: data.game,
          invitationId: data.invitation?.id, // Store invitation ID for removal
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
      if (data.game && data.game.id) {
        console.log('[GlobalInvitation] 🎮 Navigating to championship game ID:', data.game.id);

        // Set session markers for proper game access (challenger perspective)
        sessionStorage.setItem('lastInvitationAction', 'championship_invitation_accepted_by_other');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', data.game.id.toString());

        navigate(`/play/multiplayer/${data.game.id}`);
      } else {
        console.warn('[GlobalInvitation] ⚠️ Championship invitation accepted but no game data in event:', data);
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

    return () => {
      console.log('[GlobalInvitation] Cleaning up listeners');
      userChannel.stopListening('.invitation.sent');
      userChannel.stopListening('.resume.request.sent');
      userChannel.stopListening('.invitation.cancelled');
    };
    // Only re-run when user changes, not on every route change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Accept game invitation
  const acceptInvitation = useCallback(async (invitationId, colorChoice) => {
    if (isProcessingRef.current) return;

    setIsProcessing(true);
    try {
      console.log('[GlobalInvitation] Accepting invitation:', invitationId, 'with color:', colorChoice);

      const requestData = {
        action: 'accept',
        desired_color: colorChoice,
      };

      const response = await api.post(`/invitations/${invitationId}/respond`, requestData);

      console.log('[GlobalInvitation] Invitation accepted:', response.data);

      // Clear the dialog
      setPendingInvitation(null);

      // Navigate to the game
      if (response.data.game?.id) {
        sessionStorage.setItem('lastInvitationAction', 'accepted');
        sessionStorage.setItem('lastInvitationTime', Date.now().toString());
        sessionStorage.setItem('lastGameId', response.data.game.id.toString());
        navigate(`/play/multiplayer/${response.data.game.id}`);
      }
    } catch (error) {
      console.error('[GlobalInvitation] Failed to accept invitation:', error);
      alert('Failed to accept invitation. Please try again.');
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

  const value = useMemo(() => ({
    pendingInvitation,
    resumeRequest,
    isProcessing,
    acceptInvitation,
    declineInvitation,
    acceptResumeRequest,
    declineResumeRequest,
  }), [
    pendingInvitation,
    resumeRequest,
    isProcessing,
    acceptInvitation,
    declineInvitation,
    acceptResumeRequest,
    declineResumeRequest,
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
