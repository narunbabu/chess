import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { trackSocial } from '../utils/analytics';
import api from '../services/api';
import matchmakingService from '../services/matchmakingService';
import WebSocketGameService from '../services/WebSocketGameService';
import { getEcho } from '../services/echoSingleton';
import userStatusService from '../services/userStatusService';
import { BACKEND_URL } from '../config';
import './LobbyPage.css';

// Lobby components
import LobbyTabs from '../components/lobby/LobbyTabs';
import PlayersList from '../components/lobby/PlayersList';
import ActiveGamesList from '../components/lobby/ActiveGamesList';
import ChallengeModal from '../components/lobby/ChallengeModal';
import LoadMoreButton from '../components/lobby/LoadMoreButton';
import MatchmakingQueue from '../components/lobby/MatchmakingQueue';
import FriendSearch from '../components/lobby/FriendSearch';

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
  const [activeGames, setActiveGames] = useState([]);
  const [opponentOnlineStatus, setOpponentOnlineStatus] = useState({}); // Map of userId -> isOnline
  const [webSocketService, setWebSocketService] = useState(null);
  const [activeTab, setActiveTab] = useState('players');
  const [isRefreshing, setIsRefreshing] = useState(false); // Manual refresh state
  const [showMatchmaking, setShowMatchmaking] = useState(false); // Matchmaking modal
  const [showFriendSearch, setShowFriendSearch] = useState(false); // Play Friends toggle

  // Pagination state
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
        return;
      }

      console.log('[Lobby] Echo singleton available, initializing WebSocket service');
      const service = new WebSocketGameService();

      // Initialize Echo-based WebSocket service asynchronously
      service.initialize(null, user).then(() => {
        console.log('[Lobby] WebSocket service initialized successfully');
        setWebSocketService(service);

        // Set up real-time presence listeners for online players
        setupPresenceListeners(echo);
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

  // Set up real-time presence listeners to replace polling
  const setupPresenceListeners = (echo) => {
    try {
      // Join the presence.online channel
      const presenceChannel = echo.join('presence.online');

      // When someone comes online, add them to players list
      presenceChannel.joining((user) => {
        console.log('[Lobby] User came online:', user.name);
        setPlayers(prevPlayers => {
          // Check if player already exists
          const exists = prevPlayers.some(p => p.id === user.id);
          if (exists) {
            return prevPlayers; // Don't add duplicates
          }
          // Add new online player
          return [...prevPlayers, user];
        });
      });

      // When someone goes offline, remove them from players list
      presenceChannel.leaving((user) => {
        console.log('[Lobby] User went offline:', user.name);
        setPlayers(prevPlayers =>
          prevPlayers.filter(p => p.id !== user.id)
        );
      });

      console.log('[Lobby] Real-time presence listeners set up');
    } catch (error) {
      console.error('[Lobby] Failed to set up presence listeners:', error);
    }
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent double-refresh

    console.log('[Lobby] Manual refresh triggered');
    setIsRefreshing(true);

    try {
      // Reset pagination to fetch fresh data
      setGamesPagination({ page: 1, hasMore: true, total: 0, loading: false });

      // Fetch fresh data
      await fetchData(false);

      console.log('[Lobby] Manual refresh complete');
    } catch (error) {
      console.error('[Lobby] Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // NOTE: Real-time invitations and resume requests are now handled globally by GlobalInvitationContext
  console.log('[Lobby] Using global invitation system via GlobalInvitationContext');

  // Paginated data loading functions
  const loadActiveGames = async (page = 1, append = false) => {
    try {
      setGamesPagination(prev => ({ ...prev, loading: true }));

      const response = await api.get(`/games/active?limit=10&page=${page}`);

      const games = response.data.data;

      // Build opponent status map with both player_id and player.id as keys
      const opponentStatusMap = {};
      const opponentIdsToCheck = [];

      games.forEach(game => {
        const opponentId = game.white_player_id === user?.id ? game.black_player_id : game.white_player_id;

        // Add to check list if not already added
        if (opponentId && !opponentIdsToCheck.includes(opponentId)) {
          opponentIdsToCheck.push(opponentId);
        }
      });

      // Batch check opponent online statuses
      if (opponentIdsToCheck.length > 0) {
        try {
          const statusResults = await userStatusService.batchCheckStatus(opponentIdsToCheck);

          // Handle Map object (userStatusService returns a Map)
          if (statusResults instanceof Map) {
            statusResults.forEach((isOnline, userId) => {
              const userIdNum = parseInt(userId);
              opponentStatusMap[userIdNum] = isOnline;
            });
          } else if (Array.isArray(statusResults)) {
            statusResults.forEach((result, index) => {
              const userId = parseInt(opponentIdsToCheck[index]);
              opponentStatusMap[userId] = result.is_online;
            });
          }

          // Update online status state
          setOpponentOnlineStatus(prev => ({
            ...prev,
            ...opponentStatusMap
          }));

          // Sort games: online opponents first, then by last move time
          games.sort((a, b) => {
            const opponentA = a.white_player_id === user?.id ? a.black_player_id : a.white_player_id;
            const opponentB = b.white_player_id === user?.id ? b.black_player_id : b.white_player_id;

            const isOnlineA = opponentStatusMap[parseInt(opponentA)] || false;
            const isOnlineB = opponentStatusMap[parseInt(opponentB)] || false;

            // Online opponents come first
            if (isOnlineA && !isOnlineB) return -1;
            if (!isOnlineA && isOnlineB) return 1;

            // If same online status, sort by last move time (most recent first)
            const timeA = a.last_move_at ? new Date(a.last_move_at).getTime() : 0;
            const timeB = b.last_move_at ? new Date(b.last_move_at).getTime() : 0;
            return timeB - timeA;
          });
        } catch (statusError) {
          console.error('[Lobby] Error checking opponent online status:', statusError);
        }
      }

      if (append) {
        setActiveGames(prev => [...prev, ...games]);
      } else {
        setActiveGames(games);
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
  const loadMoreGames = () => {
    if (!gamesPagination.loading) {
      loadActiveGames(gamesPagination.page + 1, true);
    }
  };

  const fetchData = async (skipDebounce = false) => {
    // Global in-flight protection
    if (inFlightRef.current) {
      console.log('[Lobby] Fetch already in progress, skipping duplicate call');
      return;
    }

    try {
      inFlightRef.current = true;
      console.log('[Lobby] Fetching lobby data for user:', user?.id);

      // Fetch lobby players from new endpoint (real + synthetic)
      const lobbyPromise = matchmakingService.getLobbyPlayers().catch(err => {
        console.error('[Lobby] Failed to fetch lobby players, falling back to /users:', err);
        return null;
      });

      // Load paginated data without appending
      const [lobbyData] = await Promise.all([
        lobbyPromise,
        loadActiveGames(1, false),
      ]);

      if (lobbyData) {
        // Combine real players first, then synthetic — users see one unified list
        const realPlayers = (lobbyData.real_players || []).filter(p => p.id !== user.id);
        const bots = lobbyData.synthetic_players || [];
        setPlayers([...realPlayers, ...bots]);
      } else {
        // Fallback: use old /users endpoint
        const usersRes = await api.get('/users');
        const otherUsers = usersRes.data.filter(p => p.id !== user.id);
        setPlayers(otherUsers);
      }
    } catch (error) {
      console.error('[Lobby] Failed to fetch data:', error);
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
      const echo = webSocketService?.echo || getEcho();
      const wsState = echo?.connector?.pusher?.connection?.state;
      const wsOK = wsState === 'connected';
      const hidden = document.visibilityState === 'hidden';

      // REDUCED POLLING: Use real-time WebSocket presence events for players
      const delay = hidden
        ? (wsOK ? 300000 : 180000)  // Hidden: 5min with WS, 3min without
        : (wsOK ? 180000 : 120000); // Visible: 3min with WS, 2min without

      // Fetch data (in-flight protection is handled inside fetchData)
      try {
        await fetchData(true);
      } catch (err) {
        console.error('[Lobby] Fetch error:', err);
      }

      // Schedule next cycle
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only user dependency

  const handleInvite = (player) => {
    // Show color selection modal for all players (real and synthetic alike)
    setSelectedPlayer(player);
    setShowColorModal(true);
  };

  const sendInvitation = async (colorChoice, gameMode = 'casual') => {
    setShowColorModal(false);

    // Validate selectedPlayer before proceeding
    if (!selectedPlayer || !selectedPlayer.id) {
      console.error('Cannot send invitation: selectedPlayer is invalid', selectedPlayer);
      alert('Error: No player selected. Please try again.');
      return;
    }

    setInvitedPlayer(selectedPlayer);
    setInviteStatus('sending');

    // Synthetic player — simulate challenge acceptance then navigate to game
    if (selectedPlayer.type === 'synthetic') {
      const player = selectedPlayer;
      // Resolve 'random' to an actual color
      const resolvedColor = colorChoice === 'random'
        ? (Math.random() < 0.5 ? 'white' : 'black')
        : colorChoice;
      const delay = 2000 + Math.random() * 3000; // 2-5 seconds
      setTimeout(() => {
        setInviteStatus('sent');
        // Brief "accepted" display, then navigate
        setTimeout(() => {
          setInviteStatus(null);
          setInvitedPlayer(null);
          setSelectedPlayer(null);
          navigate('/play', {
            state: {
              gameMode: 'synthetic',
              syntheticPlayer: player,
              preferredColor: resolvedColor,
            },
          });
        }, 1200);
      }, delay);
      return;
    }

    try {
      const response = await api.post('/invitations/send', {
        invited_user_id: selectedPlayer.id,
        preferred_color: colorChoice,
        game_mode: gameMode
      });

      // Track successful challenge sent
      trackSocial('challenge_sent', {
        playerId: selectedPlayer.id,
        colorChoice,
        invitationId: response.data.invitation?.id
      });

      setInviteStatus('sent');

      // Auto-close after 3 seconds
      setTimeout(() => {
        setInviteStatus(null);
        setInvitedPlayer(null);
        setSelectedPlayer(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to send invitation:', error);

      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;

      // If it's a duplicate invitation error, refresh the data to sync state
      if (errorMessage === 'Invitation already sent') {
        fetchData(true);
        alert(`You already have a pending invitation to ${selectedPlayer.name}. The page will refresh to show the current status.`);
      } else {
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
      id: 'games',
      label: 'Active Games',
      short: 'Games',
      icon: '♟️',
      badge: activeGames.length
    },
  ];

  // Handler for resuming game (extracted for clarity)
  const handleResumeGame = (gameId, opponentId, opponentName, isOpponentOnline) => {
    if (!isOpponentOnline) {
      alert(
        `Opponent Offline\n\n` +
        `${opponentName} is currently offline.\n\n` +
        `You cannot resume the game until your opponent comes online.`
      );
      return;
    }

    sessionStorage.setItem('lastInvitationAction', 'resume_game');
    sessionStorage.setItem('lastInvitationTime', Date.now().toString());
    sessionStorage.setItem('lastGameId', gameId.toString());
    navigate(`/play/multiplayer/${gameId}`);
  };

  // Handler for deleting game
  const handleDeleteGame = async (gameId, opponentName) => {
    const confirmed = window.confirm(
      `Delete Game?\n\n` +
      `Are you sure you want to delete this game vs ${opponentName}?\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await api.delete(`/games/${gameId}/unfinished`);

      if (response.data.message) {
        setActiveGames(activeGames.filter(g => g.id !== gameId));
        alert(response.data.message);
      }
    } catch (error) {
      console.error('Failed to delete game:', error);
      const message = error.response?.data?.message || error.response?.data?.error || 'Failed to delete game';
      alert(`Error: ${message}`);
    }
  };

  return (
    <>
      <div className="lobby-container" ref={lobbyContainerRef}>
        <div className="lobby p-6 text-white">
        {/* Resume requests and invitations are now handled by GlobalInvitationDialog */}

        {/* Show redirect message for paused games */}
        {redirectMessage && (
          <div style={{
            backgroundColor: '#e8a93e',
            color: '#1a1a18',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.4)'
          }}>
            <span>{redirectMessage}</span>
            <button
              onClick={() => setRedirectMessage(null)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#1a1a18',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 8px'
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Hero Section — Play Online + Play Friends */}
        <div className="lobby-hero">
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="lobby-hero-btn"
              onClick={() => setShowMatchmaking(true)}
            >
              Play Online
            </button>
            <button
              className="lobby-hero-btn"
              onClick={() => setShowFriendSearch(prev => !prev)}
              style={{
                backgroundColor: showFriendSearch ? '#6a9e3a' : 'transparent',
                border: '2px solid #81b64c',
              }}
            >
              Play Friends
            </button>
          </div>
          <p className="lobby-hero-subtitle">Find an opponent and start playing</p>
          {showFriendSearch && (
            <div style={{ marginTop: '16px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
              <FriendSearch onChallenge={handleInvite} />
            </div>
          )}
        </div>

        <LobbyTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />

        {/* Manual refresh button */}
        {webSocketService && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="refresh-button"
            style={{
              backgroundColor: isRefreshing ? '#4a4744' : '#81b64c',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              marginBottom: '16px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isRefreshing ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isRefreshing) e.target.style.backgroundColor = '#a3d160';
            }}
            onMouseLeave={(e) => {
              if (!isRefreshing) e.target.style.backgroundColor = '#81b64c';
            }}
            title="Refresh all data"
          >
            {isRefreshing ? (
              <>
                <span className="spinner" style={{ animation: 'spin 1s linear infinite', display: 'inline-block', fontSize: '12px' }}>&#x27F3;</span>
                Refreshing...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        )}

          <div className="lobby-content" ref={lobbyContentRef}>
          {activeTab === 'players' && (
            <PlayersList
              players={players}
              onChallenge={handleInvite}
            />
          )}

          {activeTab === 'games' && (
            <>
              <ActiveGamesList
                activeGames={activeGames}
                currentUserId={user.id}
                opponentOnlineStatus={opponentOnlineStatus}
                onResumeGame={handleResumeGame}
                onDeleteGame={handleDeleteGame}
              />
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
          processingInvitations={new Set()}
          onAcceptWithColor={() => {}}
          onCancelResponse={() => setShowResponseModal(false)}
          onDeclineInvitation={() => {}}
          // Status Modal props
          inviteStatus={inviteStatus}
          invitedPlayer={invitedPlayer}
        />

        {/* Matchmaking Queue Modal */}
        <MatchmakingQueue
          isOpen={showMatchmaking}
          onClose={() => setShowMatchmaking(false)}
        />
        </div>
      </div>
    </>
  );
};

export default LobbyPage;
