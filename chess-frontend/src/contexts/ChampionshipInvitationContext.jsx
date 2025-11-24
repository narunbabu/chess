import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config';
import axios from 'axios';
import { getEcho } from '../services/echoSingleton';

const ChampionshipInvitationContext = createContext(null);

export const useChampionshipInvitations = () => {
  const context = useContext(ChampionshipInvitationContext);
  if (!context) {
    throw new Error('useChampionshipInvitations must be used within ChampionshipInvitationProvider');
  }
  return context;
};

export const ChampionshipInvitationProvider = ({ children }) => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());

  // Fetch user's championship invitations
  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/invitations/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        // Filter only championship match invitations
        const championshipInvitations = response.data.data.filter(
          invitation => invitation.championship_match_id
        );
        setInvitations(championshipInvitations);
      }
    } catch (error) {
      console.error('Failed to fetch championship invitations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Accept a championship invitation
  const acceptInvitation = useCallback(async (invitationId, desiredColor = null) => {
    try {
      setProcessingIds(prev => new Set(prev).add(invitationId));

      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${BACKEND_URL}/invitations/${invitationId}/respond`,
        {
          action: 'accept',
          desired_color: desiredColor
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.game) {
        // Navigate to the game
        const gameId = response.data.game.id;
        window.location.href = `/play/${gameId}`;
      } else {
        console.error('No game data in response');
        alert('Failed to create game from invitation');
      }
    } catch (error) {
      console.error('Failed to accept championship invitation:', error);
      const errorMessage = error.response?.data?.error || 'Failed to accept invitation';
      alert(`Error: ${errorMessage}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  }, []);

  // Decline a championship invitation
  const declineInvitation = useCallback(async (invitationId) => {
    try {
      setProcessingIds(prev => new Set(prev).add(invitationId));

      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${BACKEND_URL}/invitations/${invitationId}/respond`,
        { action: 'decline' },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Remove the declined invitation from the list
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // Show success message
      alert('Invitation declined');
    } catch (error) {
      console.error('Failed to decline championship invitation:', error);
      const errorMessage = error.response?.data?.error || 'Failed to decline invitation';
      alert(`Error: ${errorMessage}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  }, []);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    const setupWebSocketListeners = () => {
      const echo = getEcho();
      const userId = localStorage.getItem('user_id');

      if (!userId || !echo) {
        console.log('[ChampionshipInvitation] No user ID or Echo instance, skipping WebSocket setup');
        return;
      }

      // Listen for new championship match invitations
      // Note: Backend broadcasts as 'invitation.sent' to 'private-App.Models.User.{id}' channel
      echo.private(`App.Models.User.${userId}`)
        .listen('InvitationSent', (e) => {
          console.log('[ChampionshipInvitation] New invitation received:', e);

          // Only process championship match invitations
          if (e.invitation && e.invitation.championship_match_id) {
            setInvitations(prev => {
              // Check if invitation already exists
              const exists = prev.some(inv => inv.id === e.invitation.id);
              if (!exists) {
                console.log('[ChampionshipInvitation] Adding new championship invitation to list:', e.invitation);
                return [...prev, e.invitation];
              }
              return prev;
            });

            // Show notification
            if ('Notification' in window && 'permission' in Notification) {
              if (Notification.permission === 'granted') {
                const inviterName = e.invitation.inviter?.name || 'an opponent';
                new Notification('New Championship Match!', {
                  body: `You have a new match invitation from ${inviterName}`,
                  icon: '/favicon.ico'
                });
              }
            }
          }
        });

      // Listen for invitation status changes
      echo.private(`App.Models.User.${userId}`).listen('ChampionshipMatchInvitationExpired', (e) => {
        console.log('[ChampionshipInvitation] Invitation expired:', e);

        if (e.invitation_id) {
          setInvitations(prev => prev.filter(inv => inv.id !== e.invitation_id));
        }
      });

      echo.private(`App.Models.User.${userId}`).listen('ChampionshipMatchInvitationCancelled', (e) => {
        console.log('[ChampionshipInvitation] Invitation cancelled:', e);

        if (e.invitation_id) {
          setInvitations(prev => prev.filter(inv => inv.id !== e.invitation_id));
        }
      });

      // NEW: Championship scheduling WebSocket listeners
      echo.private(`App.Models.User.${userId}`).listen('championship.schedule.updated', (e) => {
        console.log('[ChampionshipScheduling] Schedule updated:', e);

        // Trigger a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('championshipScheduleUpdated', {
          detail: {
            championship_match_id: e.championship_match_id,
            championship_id: e.championship_id,
            schedule: e.schedule,
            action: e.action,
            user: e.user
          }
        }));

        // Show notification for schedule updates
        if ('Notification' in window && 'permission' in Notification) {
          if (Notification.permission === 'granted') {
            let notificationTitle = 'Match Schedule Updated';
            let notificationBody = '';

            switch (e.action) {
              case 'proposed':
                notificationTitle = 'Schedule Proposal';
                notificationBody = `${e.user.name} proposed a time for your match`;
                break;
              case 'accepted':
                notificationTitle = 'Schedule Accepted';
                notificationBody = `${e.user.name} accepted your schedule proposal`;
                break;
              case 'alternative_proposed':
                notificationTitle = 'Alternative Time Proposed';
                notificationBody = `${e.user.name} proposed an alternative time`;
                break;
              default:
                notificationBody = 'Match schedule has been updated';
            }

            new Notification(notificationTitle, {
              body: notificationBody,
              icon: '/favicon.ico'
            });
          }
        }
      });

      echo.private(`App.Models.User.${userId}`).listen('championship.match.scheduled', (e) => {
        console.log('[ChampionshipScheduling] Match scheduled confirmed:', e);

        // Trigger a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('championshipMatchScheduled', {
          detail: {
            championship_match_id: e.championship_match_id,
            championship_id: e.championship_id,
            scheduled_time: e.scheduled_time,
            game_timeout: e.game_timeout,
            scheduling_status: e.scheduling_status,
            players: e.players,
            user: e.user
          }
        }));

        // Show notification for match confirmation
        if ('Notification' in window && 'permission' in Notification && Notification.permission === 'granted') {
          new Notification('Match Scheduled!', {
            body: `Your match is scheduled for ${new Date(e.scheduled_time).toLocaleString()}`,
            icon: '/favicon.ico'
          });
        }
      });

      echo.private(`App.Models.User.${userId}`).listen('championship.game.created', (e) => {
        console.log('[ChampionshipScheduling] Game created:', e);

        // Trigger a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('championshipGameCreated', {
          detail: {
            game: e.game,
            championship_match: e.championship_match,
            redirect_url: e.redirect_url,
            user: e.user
          }
        }));

        // Show notification for immediate game creation
        if ('Notification' in window && 'permission' in Notification && Notification.permission === 'granted') {
          new Notification('Game Ready!', {
            body: 'Your championship game is ready to play. Redirecting...',
            icon: '/favicon.ico'
          });
        }

        // Auto-navigate to the game after a short delay
        setTimeout(() => {
          window.location.href = e.redirect_url;
        }, 2000);
      });

      echo.private(`App.Models.User.${userId}`).listen('championship.timeout.warning', (e) => {
        console.log('[ChampionshipScheduling] Timeout warning:', e);

        // Trigger a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('championshipTimeoutWarning', {
          detail: {
            championship_match_id: e.championship_match_id,
            championship_id: e.championship_id,
            warning_type: e.warning_type,
            time_remaining_minutes: e.time_remaining_minutes,
            players: e.players
          }
        }));

        // Show timeout warning notifications
        if ('Notification' in window && 'permission' in Notification && Notification.permission === 'granted') {
          let notificationTitle = 'Match Timeout Warning';
          let notificationBody = '';

          switch (e.warning_type) {
            case 'approaching':
              notificationTitle = 'Match Starting Soon';
              notificationBody = `Your match is starting in ${e.time_remaining_minutes} minutes`;
              break;
            case 'imminent':
              notificationTitle = 'Match Starting Now';
              notificationBody = 'Your scheduled match is starting! Join immediately or risk forfeit.';
              break;
            case 'expired':
              notificationTitle = 'Match Deadline Passed';
              notificationBody = 'The scheduled time has passed. Join quickly to avoid forfeit.';
              break;
          }

          new Notification(notificationTitle, {
            body: notificationBody,
            icon: '/favicon.ico',
            requireInteraction: e.warning_type === 'imminent' || e.warning_type === 'expired'
          });
        }
      });

      echo.private(`App.Models.User.${userId}`).listen('championship.round.completed', (e) => {
        console.log('[ChampionshipScheduling] Round completed:', e);

        // Trigger a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('championshipRoundCompleted', {
          detail: {
            championship_id: e.championship_id,
            championship_title: e.championship_title,
            round_number: e.round_number,
            standings: e.standings,
            next_round_ready: e.next_round_ready,
            total_participants: e.total_participants
          }
        }));

        // Show round completion notification
        if ('Notification' in window && 'permission' in Notification && Notification.permission === 'granted') {
          new Notification('Round Completed!', {
            body: `Round ${e.round_number} is complete. ${e.next_round_ready ? 'Next round is ready!' : 'Waiting for other matches to finish.'}`,
            icon: '/favicon.ico'
          });
        }
      });
    };

    setupWebSocketListeners();

    // Cleanup function
    return () => {
      const echo = getEcho();
      const userId = localStorage.getItem('user_id');

      if (echo && userId) {
        echo.leave(`App.Models.User.${userId}`);
      }
    };
  }, []);

  // Fetch invitations on mount
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const value = {
    invitations,
    loading,
    processingIds,
    fetchInvitations,
    acceptInvitation,
    declineInvitation,
    // Convenience methods for components
    createAcceptHandler: (invitation) => (desiredColor) => acceptInvitation(invitation.id, desiredColor),
    createDeclineHandler: (invitation) => () => declineInvitation(invitation.id),
    isProcessing: (invitationId) => processingIds.has(invitationId)
  };

  return (
    <ChampionshipInvitationContext.Provider value={value}>
      {children}
    </ChampionshipInvitationContext.Provider>
  );
};

export default ChampionshipInvitationContext;