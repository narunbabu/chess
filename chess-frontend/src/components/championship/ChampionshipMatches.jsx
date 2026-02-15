// ChampionshipMatches.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, getMatchResultDisplay, getMatchStatusColor, formatDeadlineWithUrgency, getMatchCardUrgencyClass } from '../../utils/championshipHelpers';
import { hasRole } from '../../utils/permissionHelpers';
import useContextualPresence from '../../hooks/useContextualPresence';
import useUserStatus from '../../hooks/useUserStatus';
import { logger } from '../../utils/logger';
import { throttle } from '../../utils/debounce';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import RoundLeaderboardModal from './RoundLeaderboardModal';
import './Championship.css';

const ChampionshipMatches = ({
  championshipId,
  championship = null,
  userOnly = false,
  matches: initialMatches = [],
  loading: initialLoading = false,
  error: initialError = null,
  onMatchDeleted = null,
  showDeleteButtons = false // Default to false now
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [localChampionship, setLocalChampionship] = useState(championship);

  const [matches, setMatches] = useState(initialMatches);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState(initialError);
  const [filterRound, setFilterRound] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [reportingMatch, setReportingMatch] = useState(null);
  const [creatingGame, setCreatingGame] = useState(null);
  const [deletingMatch, setDeletingMatch] = useState(null);
  const [schedulingMatch, setSchedulingMatch] = useState(null);
  const [proposingTime, setProposingTime] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [opponentOnlineStatus, setOpponentOnlineStatus] = useState({});
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardRound, setLeaderboardRound] = useState(null);
  const [notification, setNotification] = useState(null);

  // Track pending resume requests
  const [pendingRequests, setPendingRequests] = useState({}); // { matchId: { type: 'outgoing'|'incoming', request: {...} } }
  const [showResumeDialog, setShowResumeDialog] = useState(null); // { matchId, request }

  // Track user activity for smart polling
  const [isPollingActive, setIsPollingActive] = useState(true);
  const lastActivityTimeRef = useRef(Date.now());

  const isPollingActiveRef = useRef(true);

  useEffect(() => {
    isPollingActiveRef.current = isPollingActive;
  }, [isPollingActive]);

  // Use contextual presence for smart, efficient status tracking
  const { opponents, loadOpponents, refreshOpponents } = useContextualPresence();

  // Use user status service for reliable online checking of any user
  const { isUserOnline: isUserOnlineStatus } = useUserStatus();

  // Helper function to get opponent from match
  const getOpponent = useCallback((match) => {
    if (!user) return null;
    return match.white_player_id === user.id ? match.black_player : match.white_player;
  }, [user?.id]);

  // Check and cache opponent online status with debouncing
  const checkOpponentOnlineStatus = useCallback(async (opponentId) => {
    // Check if we already have the status cached
    const currentStatus = opponentOnlineStatus[opponentId];
    if (currentStatus !== undefined) {
      return currentStatus;
    }

    try {
      const online = await isUserOnlineStatus(opponentId);
      setOpponentOnlineStatus(prev => ({ ...prev, [opponentId]: online }));
      return online;
    } catch (error) {
      logger.error('OpponentStatus', `Failed to check status for user ${opponentId}`, error);
      setOpponentOnlineStatus(prev => ({ ...prev, [opponentId]: false }));
      return false;
    }
  }, [isUserOnlineStatus]);

  // Throttled status checking to prevent storms
  const throttledStatusCheck = throttle(async (opponentIds) => {
    const uncachedIds = opponentIds.filter(id => opponentOnlineStatus[id] === undefined);

    if (uncachedIds.length > 0) {
      logger.debug('OpponentStatus', `Checking status for ${uncachedIds.length} opponents`);

      // Process in batches to avoid overwhelming the API
      for (const id of uncachedIds) {
        await checkOpponentOnlineStatus(id);
        // Small delay between requests to prevent API flooding
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, 2000); // Only check every 2 seconds maximum

  // Check online status for all opponents when matches load (with debouncing)
  useEffect(() => {
    if (matches.length > 0) {
      // Get unique opponent IDs
      const opponentIds = [...new Set(matches.map(match => {
        const opponent = getOpponent(match);
        return opponent?.id;
      }).filter(Boolean))];

      throttledStatusCheck(opponentIds);
    }
  }, [matches, getOpponent]);

  // Load championship data to check admin/organizer status
  const loadChampionship = useCallback(async () => {
    if (!championshipId || userOnly || championship) return; // Only needed for admin view, skip if championship is already provided

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/championships/${championshipId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setLocalChampionship(response.data);
    } catch (error) {
      console.error('Failed to load championship:', error);
    }
  }, [championshipId, userOnly, championship]);

  const loadMatches = useCallback(async () => {
    if (!championshipId) {
      setError('Championship ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    // Define endpoint outside try-catch for access in error handling
    const token = localStorage.getItem('auth_token');
    const endpoint = userOnly
      ? `${BACKEND_URL}/championships/${championshipId}/my-matches`
      : `${BACKEND_URL}/championships/${championshipId}/matches`;

    try {
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      logger.api(endpoint, 'GET', {
        status: response.status,
        matchesCount: response.data.matches ? (response.data.matches.data?.length || response.data.matches.length) : response.data?.length
      });

      // Handle different response formats
      if (response.data.matches) {
        // Paginated response format
        setMatches(response.data.matches.data || response.data.matches);
      } else {
        // Direct array response
        setMatches(response.data);
      }
    } catch (error) {
      console.error('❌ Failed to load matches:', {
        endpoint,
        status: error.response?.status,
        error: error.response?.data,
        message: error.message
      });
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to load matches';
      setError(errorMsg);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [championshipId, userOnly, user?.id]); // userOnly affects which endpoint we call

  // Load championship data when needed
  useEffect(() => {
    loadChampionship();
  }, [loadChampionship]);

  // Only fetch data when we need to (not when props are provided)
  useEffect(() => {
    if (championshipId && !initialLoading && initialMatches.length === 0) {
      loadMatches();
    }
  }, [championshipId, userOnly, loadMatches]); // Fetch when championship or user mode changes

  // Update state when props change (but don't trigger new fetches)
  useEffect(() => {
    if (initialMatches.length > 0 || initialLoading) {
      setMatches(initialMatches);
      setLoading(initialLoading);
      setError(initialError);
    }
  }, [initialMatches, initialLoading, initialError]); // Only sync with prop changes

  // Load opponents when championship ID changes
  useEffect(() => {
    if (championshipId && userOnly) {
      loadOpponents();
    }
  }, [championshipId, userOnly, loadOpponents]);

  // Track user activity (mouse, keyboard, touch)
  useEffect(() => {
    const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    const updateActivity = () => {
      lastActivityTimeRef.current = Date.now();

      // Resume polling if it was paused due to inactivity
      setIsPollingActive(currentIsPolling => {
        if (!currentIsPolling) {
          logger.info('🔄 [Polling] Resumed - user activity detected');
          return true;
        }
        return currentIsPolling;
      });
    };

    // Activity event listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

    // Check for inactivity every minute
    const inactivityCheck = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityTimeRef.current;

      setIsPollingActive(currentIsPolling => {
        if (currentIsPolling && timeSinceActivity >= INACTIVITY_THRESHOLD) {
          logger.info('⏸️ [Polling] Paused - 5 minutes of inactivity detected');
          return false;
        }
        return currentIsPolling;
      });
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(inactivityCheck);
    };
  }, []); // Empty dependency array to run only once

  // Auto-refresh opponents every 30 seconds (only when active)
  useEffect(() => {
    if (!championshipId || !userOnly) return;

    const interval = setInterval(() => {
      if (isPollingActiveRef.current) {
        refreshOpponents();
        logger.debug('🔄 [Polling] Refreshing opponents (active)');
      } else {
        logger.debug('⏸️ [Polling] Skipped - user inactive');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [championshipId, userOnly, refreshOpponents]);

  // Clean up stale and expired pending requests when matches load
  useEffect(() => {
    if (matches.length > 0) {
      logger.info('🧹 [Cleanup] Checking for stale and expired pending requests');

      // Remove pending requests for matches that no longer exist or have changed status
      setPendingRequests(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(matchId => {
          const match = matches.find(m => m.id === parseInt(matchId));
          const pendingRequest = updated[matchId];

          // Check if request is expired (more than 5 minutes old)
          const isExpired = pendingRequest?.request?.expires_at &&
                           new Date(pendingRequest.request.expires_at) < new Date();

          // Remove if:
          // 1. Match doesn't exist
          // 2. Match status is active or completed
          // 3. Request is expired
          if (!match || match.status === 'active' || match.status === 'completed' || isExpired) {
            const reason = !match ? 'match not found' :
                          match.status === 'active' ? 'match active' :
                          match.status === 'completed' ? 'match completed' :
                          'request expired';
            logger.info(`🗑️ [Cleanup] Removing stale pending request for match ${matchId}: ${reason}`);
            delete updated[matchId];
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }
  }, [matches]);

  // Auto-cleanup expired requests every minute
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setPendingRequests(prev => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach(matchId => {
          const pendingRequest = updated[matchId];

          // Check if request is expired
          const isExpired = pendingRequest?.request?.expires_at &&
                           new Date(pendingRequest.request.expires_at) < new Date();

          if (isExpired) {
            logger.info(`⏰ [Cleanup] Auto-removing expired request for match ${matchId}`);
            delete updated[matchId];
            hasChanges = true;

            // Show notification that request expired
            setNotification({
              type: 'warning',
              message: `⏱️ Request expired for match #${matchId}`
            });
            setTimeout(() => setNotification(null), 3000);
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  // WebSocket listeners for resume requests - DISABLED
  // NOTE: All championship WebSocket listeners moved to GlobalInvitationContext
  // to ensure requests work on ALL pages (lobby, overview, etc.), not just My Matches
  useEffect(() => {
    // No-op - championship WebSocket listeners are now handled globally
    // This prevents duplicate subscriptions and conflicts between components
    console.log('[ChampionshipMatches] Championship WebSocket listeners DISABLED - handled by GlobalInvitationContext');
  }, [championshipId, user?.id, userOnly]);


  const handleCreateGame = async (matchId) => {
    setCreatingGame(matchId);
    setError(null);
    try {
      console.log('Creating game for match:', matchId);
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}/game`,
        {
          time_control: 'blitz',
          color: 'random'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('Game creation response:', response.data);

      if (response.data.success && response.data.game_id) {
        // Navigate to the game
        navigate(`/play/${response.data.game_id}`);
      } else if (response.data.match?.game_id) {
        // Alternative response format
        navigate(`/play/${response.data.match.game_id}`);
      } else {
        setError('Game created but no game ID returned');
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      setError(error.response?.data?.message || 'Failed to create game. Please try again.');
    } finally {
      setCreatingGame(null);
    }
  };

  const handleReportResult = async (matchId, result) => {
    setReportingMatch(matchId);
    try {
      // TODO: Implement result reporting API call
      console.log('Report result for match:', matchId, result);
      // await reportMatchResult(matchId, result);
      // await loadMatches(); // Refresh matches
    } catch (error) {
      console.error('Failed to report result:', error);
      setError('Failed to report result');
    } finally {
      setReportingMatch(null);
    }
  };

  const handleScheduleMatch = async (matchId, scheduledTime) => {
    console.log('🚀 Scheduling match:', { matchId, scheduledTime, championshipId });
    setSchedulingMatch(matchId);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // Convert datetime-local to ISO format for backend
      const scheduledTimeISO = new Date(scheduledTime).toISOString();
      console.log('📡 Sending schedule request to:', `${BACKEND_URL}/api/championships/${championshipId}/matches/${matchId}/schedule/propose`);
      console.log('⏰ Proposed time (ISO):', scheduledTimeISO);

      const response = await axios.post(
        `${BACKEND_URL}/api/championships/${championshipId}/matches/${matchId}/schedule/propose`,
        { proposed_time: scheduledTimeISO },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Schedule response:', response.data);
      if (response.data?.message || response.data?.success) {
        await loadMatches(); // Refresh matches
        setShowScheduleModal(false);
        // Show success message
        setError('Schedule proposal sent successfully!');
        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      console.error('❌ Failed to schedule match:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to schedule match';
      setError(errorMsg);
      // Also close the modal on error so user can try again
      setShowScheduleModal(false);
    } finally {
      setSchedulingMatch(null);
    }
  };

  const handlePlayNow = async (matchId, gameId) => {
    logger.info('🎯 [Play Now] Button clicked:', { matchId, gameId, championshipId });

    const match = transformedMatches.find(m => m.id === matchId);
    if (!match) {
      logger.error('❌ [Play Now] Match not found:', matchId);
      setError('Match not found');
      return;
    }

    logger.info('📋 [Play Now] Match found:', {
      id: match.id,
      status: match.status,
      game_id: match.game_id,
      white_player_id: match.white_player_id,
      black_player_id: match.black_player_id
    });

    const opponent = getOpponent(match);
    if (!opponent) {
      logger.error('❌ [Play Now] Opponent not found');
      setError('Opponent not found');
      return;
    }

    logger.info('👥 [Play Now] Opponent found:', { id: opponent.id, name: opponent.name });

    // Check if there's already a pending incoming request (must respond first)
    const pendingRequest = pendingRequests[matchId];
    logger.info('🔍 [Play Now] Pending requests check:', {
      matchId,
      hasPendingRequest: !!pendingRequest,
      pendingRequest
    });

    if (pendingRequest && pendingRequest.type === 'incoming') {
      logger.warn('📥 [Play Now] Incoming request pending - must respond first');
      setNotification({
        type: 'info',
        message: `You have an incoming request from ${opponent.name}. Please respond first.`
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // Allow sending new requests even if outgoing request exists
    // Backend will auto-replace old requests

    try {
      const token = localStorage.getItem('auth_token');

      logger.info('📤 [Play Now] Sending request to backend:', {
        url: `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}/notify-start`,
        currentUser: { id: user.id, name: user.name },
        opponent: { id: opponent.id, name: opponent.name },
        matchId,
        gameId
      });

      // Send resume request to opponent
      const response = await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}/notify-start`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('✅ [Play Now] Request sent successfully:', response.data);

      if (response.data.success) {
        // Add to pending outgoing requests
        setPendingRequests(prev => ({
          ...prev,
          [matchId]: {
            type: 'outgoing',
            request: response.data.request
          }
        }));

        logger.info('📝 [Play Now] Updated pending requests:', {
          matchId,
          type: 'outgoing',
          request: response.data.request
        });

        // Show notification that request was sent
        setNotification({
          type: 'info',
          message: `⏳ Request sent to ${opponent.name}. Waiting for response...`
        });

        // Auto-hide notification after 5 seconds
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (error) {
      logger.error('❌ [Play Now] Failed to send request:', {
        error: error.message,
        response: error.response?.data
      });

      const errorMsg = error.response?.data?.error || 'Failed to send request';

      // If error is about existing request, don't show as error
      if (errorMsg.includes('already pending')) {
        logger.warn('⏳ [Play Now] Backend says request already pending');
        setNotification({
          type: 'warning',
          message: `⏳ A request is already pending for this match`
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setError(errorMsg);
      }
    }
  };

  const handleSendPlayRequest = async (matchId) => {
    console.log('🎮 handleSendPlayRequest called with matchId:', matchId);
    const match = transformedMatches.find(m => m.id === matchId);
    if (!match) {
      console.error('❌ Match not found for ID:', matchId);
      setError('Match not found');
      return;
    }

    // Check round progression - can the user play this match?
    try {
      const token = localStorage.getItem('auth_token');
      const canPlayResponse = await axios.get(
        `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}/can-play`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!canPlayResponse.data.canPlay) {
        setError(canPlayResponse.data.reason || 'You cannot play this match yet');
        return;
      }
    } catch (error) {
      console.error('Failed to check play eligibility:', error);
      setError('Failed to verify eligibility. Please try again.');
      return;
    }

    const opponent = getOpponent(match);
    if (!opponent) {
      setError('Opponent not found');
      return;
    }

    if (!isOpponentOnline(match)) {
      setError(`${opponent.name} is offline. They need to be online to accept your play request.`);
      return;
    }

    setProposingTime(matchId);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      console.log('🎮 Making challenge request with token:', token ? 'present' : 'missing');

      // Send championship match challenge (similar to regular challenge)
      // This will create a game and send WebSocket notification to opponent

      // Extract time control string from championship config
      const timeControl = typeof currentChampionship?.time_control === 'object'
        ? 'blitz' // Default if it's an object
        : (currentChampionship?.time_control || 'blitz');

      const apiUrl = `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}/challenge`;
      console.log('🎮 Calling API:', apiUrl);
      console.log('🎮 Request data:', { color_preference: 'random', time_control: timeControl });

      const response = await axios.post(
        apiUrl,
        {
          color_preference: 'random', // Can be made configurable
          time_control: timeControl
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Show success notification
        setNotification({
          type: 'success',
          message: `🎮 Play challenge sent to ${opponent.name}! Waiting for them to accept...`
        });

        // Auto-hide notification after 5 seconds
        setTimeout(() => setNotification(null), 5000);

        // Optionally navigate to a waiting screen or refresh matches
        await loadMatches();
      }
    } catch (error) {
      console.error('❌ Failed to send play request:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          'Failed to send play request. Please try again.';
      console.error('❌ Final error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setProposingTime(null);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (!championshipId) {
      alert('Championship ID is missing');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Delete Match\n\n` +
      `Are you sure you want to delete this match?\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingMatch(matchId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.delete(
        `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.message) {
        // Refresh matches list from server
        await loadMatches();

        // Call callback if provided
        if (onMatchDeleted) {
          onMatchDeleted();
        }
      }
    } catch (error) {
      console.error('Failed to delete match:', error);
      const errorMsg = error.response?.data?.error || 'Failed to delete match';
      alert(`❌ Error: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setDeletingMatch(null);
    }
  };

  const isUserParticipantInMatch = (match) => {
    return user && (match.white_player_id === user.id || match.black_player_id === user.id);
  };

  const canUserCreateGame = (match) => {
    // Can create game if user is participant, match is pending/scheduled, and no game exists yet
    const canCreate = isUserParticipantInMatch(match) &&
           (match.status === 'scheduled' || match.status === 'pending') &&
           !match.game_id;
        return canCreate;
  };

  const canUserReportResult = (match) => {
    const canReport = isUserParticipantInMatch(match) &&
           (match.status === 'active' || match.status === 'scheduled' || match.status === 'pending') &&
           !match.result;
        return canReport;
  };

  const canUserScheduleMatch = (match) => {
    // Can schedule if user is participant and match is pending or scheduled
    const isParticipant = isUserParticipantInMatch(match);
    const hasValidStatus = (match.status === 'scheduled' || match.status === 'pending');
    const noGame = !match.game_id;
    const canSchedule = isParticipant && hasValidStatus && noGame;

    return canSchedule;
  };

  const canUserRequestPlay = (match) => {
    // Can request play if user is participant, match is pending/scheduled, no game exists, and opponent is online
    const isParticipant = isUserParticipantInMatch(match);
    const hasValidStatus = (match.status === 'scheduled' || match.status === 'pending');
    const noGame = !match.game_id;
    const noResult = !match.result;
    const canRequest = isParticipant && hasValidStatus && noGame && noResult;

    return canRequest;
  };

  const isOpponentOnline = useCallback((match) => {
    const opponent = getOpponent(match);
    if (!opponent) {
      return false;
    }

    // Use cached online status from user status service
    const online = opponentOnlineStatus[opponent.id] ?? false;
    return online;
  }, [getOpponent, opponentOnlineStatus]);

  const getUserColor = (match) => {
    if (!user) return null;
    return match.white_player_id === user.id ? 'white' : 'black';
  };

  // Check if user is admin or organizer using the proper permission helpers
  const isAdmin = hasRole(user, ['platform_admin', 'organization_admin', 'tournament_organizer']);
  const currentChampionship = championship || localChampionship;
  const isOrganizer = currentChampionship?.organizer_id === user?.id;
  const canEditMatches = (isAdmin || isOrganizer) && !userOnly;

  // Debug logging
  
  const ResultReportModal = ({ match, isOpen, onClose, onSubmit }) => {
    const [result, setResult] = useState('');
    const [details, setDetails] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!result) return;

      onSubmit(match.id, {
        result_type: result,
        details: details.trim()
      });
      onClose();
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>Report Match Result</h3>
            <button onClick={onClose} className="modal-close">×</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="result">Result *</label>
                <select
                  id="result"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Select Result</option>
                  <option value="win">I Won</option>
                  <option value="loss">I Lost</option>
                  <option value="draw">Draw</option>
                  <option value="forfeit_win">Won by Forfeit</option>
                  <option value="forfeit_loss">Lost by Forfeit</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="details">Additional Details</label>
                <textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Optional: Add any notes about the game"
                  rows={3}
                  className="form-input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={reportingMatch === match.id}
              >
                {reportingMatch === match.id ? 'Reporting...' : 'Submit Result'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ScheduleMatchModal = ({ match, isOpen, onClose, onSubmit }) => {
    const [scheduledTime, setScheduledTime] = useState('');
    const [validationError, setValidationError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!scheduledTime) return;

      // Validate time is within allowed window
      const selectedTime = new Date(scheduledTime);
      const now = new Date();
      const deadline = match.deadline ? new Date(match.deadline) : null;

      if (selectedTime < now) {
        setValidationError('Time must be in the future');
        return;
      }

      if (deadline && selectedTime > deadline) {
        setValidationError(`Time must be before the deadline: ${formatDateTime(deadline)}`);
        return;
      }

      setValidationError('');
      onSubmit(match.id, scheduledTime);
      onClose();
    };

    // Set minimum time to current time
    const now = new Date();
    const minDateTime = now.toISOString().slice(0, 16);

    // Set maximum time to match deadline
    const deadline = match.deadline ? new Date(match.deadline) : null;
    const maxDateTime = deadline ? deadline.toISOString().slice(0, 16) : null;

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>Schedule Match</h3>
            <button onClick={onClose} className="modal-close">×</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-content">
              {/* Allowed Window Info */}
              <div style={{
                padding: '12px',
                backgroundColor: '#262421',
                border: '1px solid #81b64c',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#81b64c', marginBottom: '8px' }}>
                  📅 Allowed Scheduling Window
                </h4>
                <div style={{ fontSize: '13px', color: '#bababa' }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>From:</strong> Now ({formatDateTime(now)})
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>To:</strong> {deadline ? formatDateTime(deadline) : 'No deadline set'}
                  </p>
                  {deadline && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#81b64c' }}>
                      ⏰ You have{' '}
                      {(() => {
                        const diffMs = deadline - now;
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.floor(diffHours / 24);
                        if (diffDays > 0) return `${diffDays} day(s)`;
                        if (diffHours > 0) return `${diffHours} hour(s)`;
                        return 'less than 1 hour';
                      })()}{' '}
                      to complete this match
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="scheduledTime">Propose Match Time *</label>
                <input
                  type="datetime-local"
                  id="scheduledTime"
                  value={scheduledTime}
                  onChange={(e) => {
                    setScheduledTime(e.target.value);
                    setValidationError('');
                  }}
                  min={minDateTime}
                  max={maxDateTime}
                  className="form-input"
                  required
                />
                <small className="form-help">
                  Your opponent can accept or propose an alternative time
                </small>
                {validationError && (
                  <div style={{ color: '#fa6a5b', fontSize: '12px', marginTop: '4px' }}>
                    ⚠️ {validationError}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={schedulingMatch === match.id}
              >
                {schedulingMatch === match.id ? 'Sending Proposal...' : '📤 Send Proposal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const MatchCard = ({ match }) => {
    const opponent = getOpponent(match);
    const userColor = getUserColor(match);
    const isUserTurn = false; // This would need to be determined from game state
    // Use deadline for deadline info
    const deadlineInfo = formatDeadlineWithUrgency(match.deadline);

    // Check online status for both players using cached user status
    // Current user is ALWAYS online (they're viewing this page!)
    const whitePlayerOnline = match.white_player
      ? (match.white_player.id === user?.id ? true : (opponentOnlineStatus[match.white_player.id] ?? false))
      : false;
    const blackPlayerOnline = match.black_player
      ? (match.black_player.id === user?.id ? true : (opponentOnlineStatus[match.black_player.id] ?? false))
      : false;

    
    // Get urgency-based background color
    const getCardBackgroundColor = () => {
      switch(deadlineInfo.urgency) {
        case 'danger':
        case 'critical':
          return 'rgba(231, 76, 60, 0.1)'; // Dark red tint
        case 'high':
          return 'rgba(232, 169, 62, 0.1)'; // Dark orange tint
        case 'moderate':
          return 'rgba(232, 169, 62, 0.06)'; // Dark yellow tint
        case 'low':
          return 'rgba(129, 182, 76, 0.06)'; // Dark green tint
        default:
          return '#312e2b'; // Card surface
      }
    };

    return (
      <div className={`match-card ${getMatchCardUrgencyClass(match.deadline)}`} style={{
        backgroundColor: getCardBackgroundColor(),
        transition: 'all 0.3s ease'
      }}>
        <div className="match-header">
          <div className="match-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', fontSize: '12px' }}>
            
            <span className="round-info" style={{ color: '#8b8987' }}>
              Round {match.round_number || match.round || 1}
              {match.board_number && `, Board ${match.board_number}`}
            </span>
            <span className={`match-status ${getMatchStatusColor(match.status)}`} style={{ padding: '4px 8px', borderRadius: '4px' }}>
              {match.status}
            </span>
          </div>
          <div className="match-players" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* White Player */}
            <div className="player-info" style={{ flex: '1', minWidth: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Online/Offline Indicator */}
                {match.white_player && (
                  <span
                    title={whitePlayerOnline ? 'Online' : 'Offline'}
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: whitePlayerOnline ? '#10b981' : '#ef4444',
                      flexShrink: 0
                    }}
                  />
                )}
                <div className={`player-name ${match.white_player_id === user?.id ? 'current-user' : ''}`} style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '10ch',
                  color: match.white_player_id === user?.id ? '#81b64c' : '#ffffff'
                }}>
                  {match.white_player ? match.white_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
                  {match.white_player_id === user?.id && <span className="you-indicator" style={{ fontSize: '12px', marginLeft: '4px' }}>(You)</span>}
                </div>
              </div>
              {match.white_player?.email && (
                <div style={{ fontSize: '11px', color: '#8b8987', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '14px', maxWidth: '10ch' }}>
                  {match.white_player.email}
                </div>
              )}
              <div className="player-rating" style={{ fontSize: '12px', color: '#bababa', marginTop: '2px', marginLeft: '14px' }}>
                Rating: {match.white_player?.rating || 'N/A'}
              </div>
            </div>

            {/* VS Separator */}
            <div className="vs-separator" style={{ fontSize: '12px', fontWeight: '700', color: '#5c5a57' }}>VS</div>

            {/* Black Player */}
            <div className="player-info" style={{ flex: '1', minWidth: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Online/Offline Indicator */}
                {match.black_player && (
                  <span
                    title={blackPlayerOnline ? 'Online' : 'Offline'}
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: blackPlayerOnline ? '#10b981' : '#ef4444',
                      flexShrink: 0
                    }}
                  />
                )}
                <div className={`player-name ${match.black_player_id === user?.id ? 'current-user' : ''}`} style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '10ch',
                  color: match.black_player_id === user?.id ? '#81b64c' : '#ffffff'
                }}>
                  {match.black_player ? match.black_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
                  {match.black_player_id === user?.id && <span className="you-indicator" style={{ fontSize: '12px', marginLeft: '4px' }}>(You)</span>}
                </div>
              </div>
              {match.black_player?.email && (
                <div style={{ fontSize: '11px', color: '#8b8987', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '14px', maxWidth: '10ch' }}>
                  {match.black_player.email}
                </div>
              )}
              <div className="player-rating" style={{ fontSize: '12px', color: '#bababa', marginTop: '2px', marginLeft: '14px' }}>
                Rating: {match.black_player?.rating || 'N/A'}
              </div>
            </div>
          </div>

          
        </div>

        <div className="match-details" style={{ marginTop: '12px' }}>
          {/* Compact deadline and time window in one row */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            padding: '8px 12px',
            backgroundColor: '#262421',
            border: '1px solid #3d3a37',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <div style={{ flex: '1', minWidth: '0' }}>
              <div style={{ fontWeight: '600', color: '#bababa', marginBottom: '4px' }}>
                Complete by:
              </div>
              <div className={`schedule-time ${deadlineInfo.color}`} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '3px', display: 'inline-block' }}>
                {deadlineInfo.text}
              </div>
            </div>

            {match.deadline && (
              <div style={{ flex: '1', minWidth: '0', borderLeft: '1px solid #4a4744', paddingLeft: '12px' }}>
                <div style={{ fontWeight: '600', color: '#bababa', marginBottom: '4px' }}>
                  📅 Time Window
                </div>
                <div style={{ color: '#8b8987', fontSize: '11px' }}>
                  Now → {formatDateTime(new Date(match.deadline))}
                </div>
                <div style={{ color: '#81b64c', fontSize: '11px', marginTop: '2px' }}>
                  ⏰ {(() => {
                    const now = new Date();
                    const deadline = new Date(match.deadline);
                    const diffMs = deadline - now;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffHours / 24);
                    if (diffDays > 0) return `${diffDays} day(s) remaining`;
                    if (diffHours > 0) return `${diffHours} hour(s) remaining`;
                    if (diffMs > 0) return 'less than 1 hour remaining';
                    return 'Overdue';
                  })()}
                </div>
              </div>
            )}
          </div>

          {match.result && (
            <div className="match-result" style={{ marginTop: '8px', fontSize: '12px' }}>
              <span className="result-label" style={{ fontWeight: '600' }}>Result:</span>
              <span className="result-value" style={{ marginLeft: '8px' }}>
                {getMatchResultDisplay(match)}
              </span>
            </div>
          )}

          {match.game_id && match.status === 'completed' && (
            <div className="game-link" style={{ marginTop: '8px' }}>
              <button
                onClick={() => navigate(`/play/multiplayer/${match.game_id}`)}
                className="btn btn-primary btn-small"
              >
                Review Game
              </button>
            </div>
          )}
        </div>

        <div className="match-actions" style={{
          borderTop: '2px solid #3d3a37',
          paddingTop: '12px',
          marginTop: '12px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {userOnly && canUserScheduleMatch(match) && (
            <button
              onClick={() => {
                console.log('📅 Schedule button clicked for match:', match.id);
                setSchedulingMatch(match.id);
                setShowScheduleModal(true);
              }}
              disabled={schedulingMatch === match.id}
              className="btn btn-warning btn-small"
              title="Schedule this match for a specific time"
              style={{ fontWeight: 'bold', fontSize: '14px' }}
            >
              {schedulingMatch === match.id ? 'Scheduling...' : '📅 Schedule'}
            </button>
          )}

          {userOnly && canUserRequestPlay(match) && (
            <button
              onClick={(e) => {
                try {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('═══════════════════════════════════════════════════');
                  console.log('🎮 REQUEST PLAY BUTTON CLICKED');
                  console.log('Match ID:', match.id);
                  console.log('Match Status:', match.status);
                  console.log('Game ID:', match.game_id);
                  console.log('Opponent:', getOpponent(match));
                  console.log('Opponent Online:', isOpponentOnline(match));
                  console.log('Championship ID:', championshipId);
                  console.log('═══════════════════════════════════════════════════');

                  const opponentOnline = isOpponentOnline(match);
                  if (!opponentOnline) {
                    console.warn('⚠️ Opponent appears offline, but sending request anyway (they may receive it when online)');
                  }
                  handleSendPlayRequest(match.id);
                } catch (error) {
                  console.error('❌ Error in Request Play button click:', error);
                }
              }}
              disabled={proposingTime === match.id}
              className="btn btn-success btn-small"
              title="Send play challenge to opponent (like Challenge feature)"
              style={{
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              {isOpponentOnline(match) && <span className="online-indicator" style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                marginRight: '6px'
              }}></span>}
              {proposingTime === match.id ? 'Sending...' : '🎮 Request Play'}
            </button>
          )}

          {/* Pending Resume Request Indicator */}
          {pendingRequests[match.id] && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: pendingRequests[match.id].type === 'outgoing' ? 'rgba(232, 169, 62, 0.1)' : 'rgba(129, 182, 76, 0.1)',
              border: `1px solid ${pendingRequests[match.id].type === 'outgoing' ? '#e8a93e' : '#81b64c'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              marginBottom: '8px'
            }}>
              {pendingRequests[match.id].type === 'outgoing' ? (
                <>
                  <span>⏳</span>
                  <span>Request sent - Waiting for opponent...</span>
                  <button
                    onClick={() => {
                      setPendingRequests(prev => {
                        const updated = { ...prev };
                        delete updated[match.id];
                        return updated;
                      });
                    }}
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      fontSize: '11px',
                      backgroundColor: 'transparent',
                      border: '1px solid #e8a93e',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#e8a93e'
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span>🔔</span>
                  <span>Incoming request from {pendingRequests[match.id].request?.requester?.name || 'opponent'}</span>
                  <button
                    onClick={() => {
                      setShowResumeDialog({
                        matchId: match.id,
                        request: pendingRequests[match.id].request
                      });
                    }}
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      fontSize: '11px',
                      backgroundColor: '#81b64c',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: 'white'
                    }}
                  >
                    View
                  </button>
                </>
              )}
            </div>
          )}

          {/* Play Now button for matches with game created but not started */}
          {(() => {
            const shouldShow = userOnly &&
                               isUserParticipantInMatch(match) &&
                               match.game_id &&
                               match.status === 'pending' &&
                               !match.game?.paused_at &&
                               !pendingRequests[match.id];

            return shouldShow && (
              <button
                onClick={() => {
                  logger.info('🎯 [Play Now Button] Clicked for match:', match.id);
                  handlePlayNow(match.id, match.game_id);
                }}
                className="btn btn-primary btn-small"
                title="Game created - Click to play now! Opponent will be notified."
                style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  animation: 'pulse 2s infinite'
                }}
              >
                🎮 Play Now
              </button>
            );
          })()}

          {/* Resume Game button for paused games */}
          {userOnly && isUserParticipantInMatch(match) && match.game_id && match.game?.paused_at && (
            <button
              onClick={() => handlePlayNow(match.id, match.game_id)}
              className="btn btn-warning btn-small"
              title="Game is paused - Click to resume! Opponent will be notified."
              style={{
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              ⏸️ Resume Game
            </button>
          )}

          {canUserReportResult(match) && (
            <ResultReportModal
              match={match}
              isOpen={reportingMatch === match.id}
              onClose={() => setReportingMatch(null)}
              onSubmit={handleReportResult}
            >
              <button
                onClick={() => setReportingMatch(match.id)}
                className="btn btn-primary btn-small"
              >
                📋 Report Result
              </button>
            </ResultReportModal>
          )}

          {match.status === 'active' && !match.game_id && isUserParticipantInMatch(match) && (
            <div className="action-message">
              <span className="info-text">Waiting for game to be created...</span>
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        <ScheduleMatchModal
          match={match}
          isOpen={showScheduleModal && schedulingMatch === match.id}
          onClose={() => {
            setShowScheduleModal(false);
            setSchedulingMatch(null);
          }}
          onSubmit={handleScheduleMatch}
        />
      </div>
    );
  };

  // Transform matches to ensure consistent field names
  const transformMatch = (match) => {
    // Use the already loaded white_player and black_player relationships
    // They should be loaded by the API, but fall back to player1/player2 mapping if needed
    let white_player = match.white_player || null;
    let black_player = match.black_player || null;

    // Fallback logic for championships that use player1_id/player2_id fields
    if (!white_player && match.white_player_id) {
      white_player = match.white_player_id === match.player1_id
        ? match.player1
        : match.player2;
    }

    if (!black_player && match.black_player_id) {
      black_player = match.black_player_id === match.player1_id
        ? match.player1
        : match.player2;
    }

    const transformed = {
      ...match,
      white_player,
      black_player,
      round: match.round_number || match.round || 1
    };

    return transformed;
  };

  // Group matches by round
  const matchesArray = Array.isArray(matches) ? matches : [];
  const transformedMatches = matchesArray.map(transformMatch);

  
  const matchesByRound = transformedMatches.reduce((acc, match) => {
    const roundNum = match.round_number || match.round || 1;
    if (!acc[roundNum]) {
      acc[roundNum] = [];
    }
    acc[roundNum].push(match);
    return acc;
  }, {});

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b); // Show Round 1 first, then higher rounds

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading matches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>❌ {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="championship-matches">
      <div className="matches-header">
        <div className="header-left">
          <h2>{userOnly ? 'My Matches' : 'All Matches'}</h2>
        </div>

        <div className="header-right">
          {canEditMatches && (
            <button
              onClick={() => navigate(`/championships/${championshipId}/matches/edit`)}
              className="btn btn-admin"
              title="Edit and manage matches"
            >
              <span className="btn-icon">✏️</span>
              <span className="btn-text">Edit Matches</span>
            </button>
          )}
        </div>
      </div>

      {!userOnly && (
        <div className="matches-filters">
          <select
            value={filterRound}
            onChange={(e) => setFilterRound(e.target.value)}
            className="filter-select"
          >
            <option value="">All Rounds</option>
            {rounds.map(round => (
              <option key={round} value={round}>Round {round}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      )}

      {transformedMatches.length === 0 ? (
        <div className="empty-state">
          <h3>{userOnly ? 'No matches found' : 'No matches created yet'}</h3>
          <p>
            {userOnly
              ? (championshipId && user && currentChampionship?.status === 'in_progress'
                  ? 'You don\'t have any matches yet. Matches may not have been generated, or you might not be paired for the current round. Check back later!'
                  : currentChampionship?.status === 'registration_open'
                  ? 'The tournament hasn\'t started yet. Once registration closes and matches are generated, your matches will appear here.'
                  : 'You need to be registered for this championship to see your matches.')
              : 'Click "Generate Matches for Next Round" to create the first round of matches.'
            }
          </p>
          {userOnly && championshipId && user && (
            <div className="empty-state-actions">
              <button
                onClick={() => navigate(`/championships/${championshipId}`)}
                className="btn btn-primary"
              >
                Back to Championship Overview
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="matches-content">
          {rounds.map(round => (
            (filterRound === '' || parseInt(filterRound) === round) && (
              <div key={round} className="round-section">
                <div style={{ marginBottom: '12px' }}>
                  <h3 className="round-title" style={{ margin: '0 0 8px 0' }}>Round {round}</h3>
                  <button
                    onClick={() => {
                      setLeaderboardRound(round);
                      setShowLeaderboardModal(true);
                    }}
                    className="btn btn-info btn-small"
                    style={{ fontSize: '14px', padding: '6px 12px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
                  >
                    📊 View Leaderboard
                  </button>
                </div>
                <div className="matches-grid">
                  {(matchesByRound[round] || [])
                    .filter(match => filterStatus === '' || match.status === filterStatus)
                    .map(match => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <RoundLeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        championshipId={championshipId}
        round={leaderboardRound}
      />

      {/* Resume Request Dialog */}
      {showResumeDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setShowResumeDialog(null)}
        >
          <div
            style={{
              backgroundColor: '#312e2b',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              animation: 'slideInUp 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
              🎮 Game Start Request
            </h3>

            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#bababa', lineHeight: '1.6' }}>
              <strong>{showResumeDialog.request?.requester?.name || 'Your opponent'}</strong> wants to start the championship game now.
            </p>

            <div style={{
              backgroundColor: '#262421',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '24px',
              fontSize: '13px',
              color: '#8b8987'
            }}>
              <div>⚠️ This request expires in 5 minutes</div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('auth_token');
                    await axios.post(
                      `${BACKEND_URL}/championships/${championshipId}/matches/${showResumeDialog.matchId}/resume-request/decline`,
                      {},
                      {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      }
                    );

                    // Remove from pending
                    setPendingRequests(prev => {
                      const updated = { ...prev };
                      delete updated[showResumeDialog.matchId];
                      return updated;
                    });

                    setShowResumeDialog(null);

                    setNotification({
                      type: 'info',
                      message: '❌ Request declined'
                    });
                    setTimeout(() => setNotification(null), 3000);
                  } catch (error) {
                    console.error('Failed to decline request:', error);
                    setError('Failed to decline request');
                  }
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '1px solid #4a4744',
                  backgroundColor: '#3d3a37',
                  color: '#bababa',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#4a4744'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#3d3a37'}
              >
                ❌ Decline
              </button>

              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('auth_token');
                    const response = await axios.post(
                      `${BACKEND_URL}/championships/${championshipId}/matches/${showResumeDialog.matchId}/resume-request/accept`,
                      {},
                      {
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        }
                      }
                    );

                    // Remove from pending
                    setPendingRequests(prev => {
                      const updated = { ...prev };
                      delete updated[showResumeDialog.matchId];
                      return updated;
                    });

                    setShowResumeDialog(null);

                    if (response.data.success && response.data.game_id) {
                      // Set resume flag for navigation
                      sessionStorage.setItem('lastInvitationAction', 'resume_game');
                      sessionStorage.setItem('lastGameId', response.data.game_id);
                      sessionStorage.setItem('lastInvitationTime', Date.now().toString());

                      setNotification({
                        type: 'success',
                        message: '✅ Starting game...'
                      });

                      setTimeout(() => {
                        navigate(`/play/multiplayer/${response.data.game_id}`);
                      }, 1000);
                    }
                  } catch (error) {
                    console.error('Failed to accept request:', error);
                    setError('Failed to accept request');
                  }
                }}
                style={{
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                ✅ Accept & Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            backgroundColor: notification.type === 'success' ? '#10b981' :
                            notification.type === 'warning' ? '#e8a93e' :
                            notification.type === 'info' ? '#81b64c' : '#ef4444',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            maxWidth: '400px',
            fontSize: '14px',
            fontWeight: '500',
            animation: 'slideInRight 0.3s ease-out',
            cursor: 'pointer'
          }}
          onClick={() => setNotification(null)}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default ChampionshipMatches;
