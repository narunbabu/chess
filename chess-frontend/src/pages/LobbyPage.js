import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import LoadMoreButton from '../components/lobby/LoadMoreButton';

const LobbyPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [players, setPlayers] = useState([]);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [redirectMessage, setRedirectMessage] = useState(null);
  const [invitedPlayer, setInvitedPlayer] = useState(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [webSocketService, setWebSocketService] = useState(null);
  const [processingInvitations, setProcessingInvitations] = useState(new Set()); // Track processing state
  const [activeTab, setActiveTab] = useState('players');

  // Pagination state
  const [pendingPagination, setPendingPagination] = useState({ page: 1, hasMore: true, total: 0, loading: false });
  const [sentPagination, setSentPagination] = useState({ page: 1, hasMore: true, total: 0, loading: false });
  const [acceptedPagination, setAcceptedPagination] = useState({ page: 1, hasMore: true, total: 0, loading: false });
  const [gamesPagination, setGamesPagination] = useState({ page: 1, hasMore: true, total: 0, loading: false });

  // Polling control refs
  const pollTimerRef = React.useRef(null);
  const inFlightRef = React.useRef(false);
  const stopPollingRef = React.useRef(false);
  const didInitPollingRef = React.useRef(false);

  // Debug refs to inspect layout when tabs change
  const lobbyContainerRef = useRef(null);
  const lobbyTabsRef = useRef(null);
  const lobbyContentRef = useRef(null);

  // Handle redirect messages from paused game
  useEffect(() => {
    // Handle notification object from navigation state
    if (location.state?.notification) {
      const { message, duration = 2000 } = location.state.notification;
      setRedirectMessage(message);
      // Auto-clear after specified duration
      const timer = setTimeout(() => setRedirectMessage(null), duration);

      // Clear the location state to prevent message from reappearing on refresh
      navigate(location.pathname, { replace: true, state: {} });

      return () => clearTimeout(timer);
    }
    // Handle legacy message format
    else if (location.state?.message) {
      setRedirectMessage(location.state.message);
      // Auto-clear after 8 seconds
      const timer = setTimeout(() => setRedirectMessage(null), 8000);

      // Clear the location state to prevent message from reappearing on refresh
      navigate(location.pathname, { replace: true, state: {} });

      return () => clearTimeout(timer);
    }
  }, [location.state, location.pathname, navigate]);

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
        // Only leave lobby channels, preserve Echo connection for PlayMultiplayer
        webSocketService.leaveAllLobbyChannels();
      }
    };
  }, [user, webSocketService]);

  // NOTE: Real-time invitations and resume requests are now handled globally by GlobalInvitationContext
  // This prevents duplicate WebSocket subscriptions and conflicts with the global invitation system
  // The lobby UI updates are handled through periodic polling to maintain consistency
  console.log('[Lobby] Using global invitation system via GlobalInvitationContext');

  // Paginated data loading functions
  const loadPendingInvitations = async (page = 1, append = false) => {
    try {
      setPendingPagination(prev => ({ ...prev, loading: true }));

      const response = await api.get(`/invitations/pending?limit=10&page=${page}`);

      if (append) {
        setPendingInvitations(prev => [...prev, ...response.data.data]);
      } else {
        setPendingInvitations(response.data.data);
      }

      setPendingPagination({
        page: response.data.pagination.current_page,
        hasMore: response.data.pagination.has_more,
        total: response.data.pagination.total,
        loading: false
      });
    } catch (error) {
      console.error('Error loading pending invitations:', error);
      setPendingPagination(prev => ({ ...prev, loading: false }));
    }
  };

  const loadSentInvitations = async (page = 1, append = false) => {
    try {
      setSentPagination(prev => ({ ...prev, loading: true }));

      const response = await api.get(`/invitations/sent?limit=10&page=${page}`);

      if (append) {
        setSentInvitations(prev => [...prev, ...response.data.data]);
      } else {
        setSentInvitations(response.data.data);
      }

      setSentPagination({
        page: response.data.pagination.current_page,
        hasMore: response.data.pagination.has_more,
        total: response.data.pagination.total,
        loading: false
      });
    } catch (error) {
      console.error('Error loading sent invitations:', error);
      setSentPagination(prev => ({ ...prev, loading: false }));
    }
  };

  const loadAcceptedInvitations = async (page = 1, append = false) => {
    try {
      setAcceptedPagination(prev => ({ ...prev, loading: true }));

      const response = await api.get(`/invitations/accepted?limit=5&page=${page}`);

      if (append) {
        // For accepted invitations, we need to handle the navigation logic
        // So we only append without navigation
        setPendingInvitations(prev => [...prev, ...response.data.data]);
      } else {
        // Handle navigation for active games in accepted invitations
        const acceptedData = response.data.data;
        // Check if user intentionally visited the lobby
        const intentionalVisit = sessionStorage.getItem('intentionalLobbyVisit') === 'true';
        const intentionalVisitTime = parseInt(sessionStorage.getItem('intentionalLobbyVisitTime') || '0');
        const timeSinceIntentionalVisit = Date.now() - intentionalVisitTime;

        if (!intentionalVisit || timeSinceIntentionalVisit >= 5000) {
          // Check for active games and navigate if needed
          for (const acceptedItem of acceptedData) {
            if (acceptedItem.game && ['active', 'waiting'].includes(acceptedItem.game.status)) {
              // Navigate to active game
              sessionStorage.setItem('lastInvitationAction', 'invitation_accepted_by_other');
              sessionStorage.setItem('lastInvitationTime', Date.now().toString());
              sessionStorage.setItem('lastGameId', acceptedItem.game.id.toString());
              navigate(`/play/multiplayer/${acceptedItem.game.id}`);
              return;
            }
          }
        }
      }

      setAcceptedPagination({
        page: response.data.pagination.current_page,
        hasMore: response.data.pagination.has_more,
        total: response.data.pagination.total,
        loading: false
      });
    } catch (error) {
      console.error('Error loading accepted invitations:', error);
      setAcceptedPagination(prev => ({ ...prev, loading: false }));
    }
  };

  const loadActiveGames = async (page = 1, append = false) => {
    try {
      setGamesPagination(prev => ({ ...prev, loading: true }));

      const response = await api.get(`/games/active?limit=10&page=${page}`);

      if (append) {
        setActiveGames(prev => [...prev, ...response.data.data]);
      } else {
        setActiveGames(response.data.data);
      }

      setGamesPagination({
        page: response.data.pagination.current_page,
        hasMore: response.data.pagination.has_more,
        total: response.data.pagination.total,
        loading: false
      });
    } catch (error) {
      console.error('Error loading active games:', error);
      setGamesPagination(prev => ({ ...prev, loading: false }));
    }
  };

  // Load more handlers
  const loadMorePending = () => {
    if (!pendingPagination.loading) {
      loadPendingInvitations(pendingPagination.page + 1, true);
    }
  };

  const loadMoreSent = () => {
    if (!sentPagination.loading) {
      loadSentInvitations(sentPagination.page + 1, true);
    }
  };

  const loadMoreGames = () => {
    if (!gamesPagination.loading) {
      loadActiveGames(gamesPagination.page + 1, true);
    }
  };

  const fetchData = async (skipDebounce = false) => {
    // Global in-flight protection
    if (inFlightRef.current) {
      console.log('[Lobby] ⚠️ Fetch already in progress, skipping duplicate call');
      return;
    }

    try {
      inFlightRef.current = true;
      console.log('[Lobby] 📊 Fetching lobby data for user:', user?.id);

      // Load data using paginated functions (only first page for polling)
      const [usersRes] = await Promise.all([
        api.get('/users')
      ]);

      // Load paginated data without appending
      await Promise.all([
        loadPendingInvitations(1, false),
        loadSentInvitations(1, false),
        loadAcceptedInvitations(1, false),
        loadActiveGames(1, false)
      ]);

      // Handle users
      const otherUsers = usersRes.data.filter(p => p.id !== user.id);
      const computerPlayer = {
        id: 'computer',
        name: 'Computer',
        email: 'Play against AI',
        rating: 1200,
        isComputer: true
      };
      const allPlayers = [computerPlayer, ...otherUsers];
      setPlayers(allPlayers);
    } catch (error) {
      console.error('[Lobby] ❌ Failed to fetch data:', error);
      console.error('[Lobby] Error details:', error.response?.data);
    } finally {
      inFlightRef.current = false;
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
        ? (wsOK ? 180000 : 90000)  // Hidden: 3min with WS, 1.5min without (further optimized)
        : (wsOK ? 120000 : 60000); // Visible: 2min with WS, 1min without (optimized for pagination)

      // Fetch data (in-flight protection is handled inside fetchData)
      console.log(`[Lobby] 🔄 Polling cycle (WS: ${wsOK ? '✅' : '❌'}, Hidden: ${hidden}, Delay: ${delay}ms)`);
      try {
        await fetchData(true);
      } catch (err) {
        console.error('[Lobby] Fetch error:', err);
      }

      // Schedule next cycle
      console.log(`[Lobby] ⏱️ Next poll in ${(delay / 1000).toFixed(0)}s`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only user dependency - avoid restarting polling unnecessarily
  // Note: fetchData and webSocketService.echo are intentionally excluded to prevent polling restarts

  // Debug layout measurements when activeTab changes
  useEffect(() => {
    // run a tick after render so layout has settled
    const t = setTimeout(() => {
      const c = lobbyContainerRef.current;
      const tabs = lobbyTabsRef.current || document.querySelector('.lobby-tabs');
      const content = lobbyContentRef.current;
      try {
        console.log('[LAYOUT DEBUG] activeTab =>', activeTab);
        if (c) {
          const r = c.getBoundingClientRect();
          console.log('[LAYOUT DEBUG] container rect:', r);
        }
        if (tabs) {
          const r = tabs.getBoundingClientRect();
          console.log('[LAYOUT DEBUG] tabs rect:', r, 'scrollWidth:', tabs.scrollWidth, 'clientWidth:', tabs.clientWidth);
        }
        if (content) {
          const r = content.getBoundingClientRect();
          console.log('[LAYOUT DEBUG] content rect:', r, 'scrollWidth:', content.scrollWidth, 'clientWidth:', content.clientWidth);
        }
        // Also list any immediate children that exceed container width
        if (content && c) {
          Array.from(content.children).forEach((ch, i) => {
            const b = ch.getBoundingClientRect();
            if (b.right - b.left > c.getBoundingClientRect().width - 1) {
              console.warn('[LAYOUT DEBUG] child too wide:', i, ch, 'rect:', b);
            }
          });
        }
      } catch (err) {
        console.error('[LAYOUT DEBUG] error measuring layout', err);
      }
    }, 60);

    return () => clearTimeout(t);
  }, [activeTab]);

  const handleInvite = (player) => {
    // Check if there's already a pending invitation to this player
    const existingInvitation = sentInvitations.find(inv =>
      inv.invited_id === player.id && inv.status === 'pending'
    );

    if (existingInvitation) {
      alert(`You already have a pending invitation to ${player.name}. Please wait for them to respond or cancel the existing invitation first.`);
      return;
    }

    setSelectedPlayer(player);
    setShowColorModal(true);
  };

  const handleComputerChallenge = () => {
    navigate('/play');
  };

  const sendInvitation = async (colorChoice) => {
    setShowColorModal(false);

    // Validate selectedPlayer before proceeding
    if (!selectedPlayer || !selectedPlayer.id) {
      console.error('❌ Cannot send invitation: selectedPlayer is invalid', selectedPlayer);
      alert('Error: No player selected. Please try again.');
      return;
    }

    setInvitedPlayer(selectedPlayer);
    setInviteStatus('sending');

    try {
      console.log('📤 Sending invitation with data:', {
        invited_user_id: selectedPlayer.id,
        preferred_color: colorChoice,
        current_user_id: user?.id
      });

      const response = await api.post('/invitations/send', {
        invited_user_id: selectedPlayer.id,
        preferred_color: colorChoice
      });

      console.log('✅ Invitation sent successfully:', response.data);

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
      console.error('❌ Failed to send invitation:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);

      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;

      // If it's a duplicate invitation error, refresh the data to sync state
      if (errorMessage === 'Invitation already sent') {
        console.log('🔄 Duplicate invitation detected - refreshing data...');
        fetchData(true);
        alert(`You already have a pending invitation to ${selectedPlayer.name}. The page will refresh to show the current status.`);
      } else {
        // Show specific error message for other errors
        alert(`Failed to send invitation: ${errorMessage}`);
      }

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
      console.log('[LobbyPage] Already processing invitation', invitationId);
      return;
    }

    // Find the invitation to determine its type
    const invitation = pendingInvitations.find(inv => inv.id === invitationId);
    if (!invitation) {
      console.warn('[LobbyPage] Invitation not found in local state:', invitationId);
      console.log('[LobbyPage] This invitation may have been handled by GlobalInvitationContext');
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
        const response = await api.post(`/api/websocket/games/${invitation.game_id}/resume-response`, requestData);
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


  return (
    <div className="lobby-container" ref={lobbyContainerRef}>
      <div className="lobby p-6 text-white">
      {/* Resume requests and invitations are now handled by GlobalInvitationDialog */}
      {/* Header now handled globally in Header.js */}

      {/* Show redirect message for paused games */}
      {redirectMessage && (
        <div style={{
          backgroundColor: '#ffa726',
          color: '#000',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <span>⏸️ {redirectMessage}</span>
          <button
            onClick={() => setRedirectMessage(null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#000',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <LobbyTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

        <div className="lobby-content" ref={lobbyContentRef}>
        {activeTab === 'players' && (
          <>
            <PlayersList
              players={players}
              sentInvitations={sentInvitations}
              onChallenge={handleInvite}
              onComputerChallenge={handleComputerChallenge}
            />
          </>
        )}

        {activeTab === 'invitations' && (
          <>
            <InvitationsList
              pendingInvitations={pendingInvitations}
              sentInvitations={sentInvitations}
              processingInvitations={processingInvitations}
              onAccept={(invitationId) => handleInvitationResponse(invitationId, 'accept')}
              onDecline={(invitationId) => handleInvitationResponse(invitationId, 'decline')}
              onCancel={handleCancelInvitation}
            />
            {/* Load More for Pending Invitations */}
            <LoadMoreButton
              hasMore={pendingPagination.hasMore}
              loading={pendingPagination.loading}
              onLoadMore={loadMorePending}
              currentCount={pendingInvitations.length}
              totalCount={pendingPagination.total}
              buttonText="Load More Pending Invitations"
            />
            {/* Load More for Sent Invitations */}
            <LoadMoreButton
              hasMore={sentPagination.hasMore}
              loading={sentPagination.loading}
              onLoadMore={loadMoreSent}
              currentCount={sentInvitations.length}
              totalCount={sentPagination.total}
              buttonText="Load More Sent Invitations"
            />
          </>
        )}

        {activeTab === 'games' && (
          <>
            <ActiveGamesList
              activeGames={activeGames}
              currentUserId={user.id}
              onResumeGame={handleResumeGame}
            />
            {/* Load More for Active Games */}
            <LoadMoreButton
              hasMore={gamesPagination.hasMore}
              loading={gamesPagination.loading}
              onLoadMore={loadMoreGames}
              currentCount={activeGames.length}
              totalCount={gamesPagination.total}
              buttonText="Load More Games"
            />
          </>
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