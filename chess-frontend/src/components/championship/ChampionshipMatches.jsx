// ChampionshipMatches.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, getMatchResultDisplay, getMatchStatusColor, formatDeadlineWithUrgency, getMatchCardUrgencyClass } from '../../utils/championshipHelpers';
import { hasRole } from '../../utils/permissionHelpers';
import useContextualPresence from '../../hooks/useContextualPresence';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
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

  // Use contextual presence for smart, efficient status tracking
  const { opponents, loadOpponents, refreshOpponents, isUserOnline } = useContextualPresence();

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

    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = userOnly
        ? `${BACKEND_URL}/championships/${championshipId}/my-matches`
        : `${BACKEND_URL}/championships/${championshipId}/matches`;

      console.log('🔍 loadMatches Debug:', {
        championshipId,
        userOnly,
        endpoint,
        hasToken: !!token,
        userId: user?.id
      });

      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 API Response:', {
        endpoint,
        status: response.status,
        dataKeys: Object.keys(response.data),
        matchesCount: response.data.matches ? (response.data.matches.data?.length || response.data.matches.length) : response.data?.length,
        matches: response.data.matches ? (response.data.matches.data || response.data.matches) : response.data
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

  // Auto-refresh opponents every 30 seconds
  useEffect(() => {
    if (!championshipId || !userOnly) return;

    const interval = setInterval(() => {
      refreshOpponents();
    }, 30000);

    return () => clearInterval(interval);
  }, [championshipId, userOnly, refreshOpponents]);

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

  const handleSendPlayRequest = async (matchId) => {
    const match = transformedMatches.find(m => m.id === matchId);
    if (!match) {
      setError('Match not found');
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

      // Send championship match challenge (similar to regular challenge)
      // This will create a game and send WebSocket notification to opponent

      // Extract time control string from championship config
      const timeControl = typeof currentChampionship?.time_control === 'object'
        ? 'blitz' // Default if it's an object
        : (currentChampionship?.time_control || 'blitz');

      const response = await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/matches/${matchId}/challenge`,
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
        // Show success message
        alert(`🎮 Play challenge sent to ${opponent.name}! Waiting for them to accept...`);

        // Optionally navigate to a waiting screen or refresh matches
        await loadMatches();
      }
    } catch (error) {
      console.error('Failed to send play request:', error);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          'Failed to send play request. Please try again.';
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
    console.log('canUserCreateGame:', { matchId: match.id, canCreate, status: match.status, hasGame: !!match.game_id });
    return canCreate;
  };

  const canUserReportResult = (match) => {
    const canReport = isUserParticipantInMatch(match) &&
           (match.status === 'active' || match.status === 'scheduled' || match.status === 'pending') &&
           !match.result;
    console.log('canUserReportResult:', { matchId: match.id, canReport, status: match.status, hasResult: !!match.result });
    return canReport;
  };

  const canUserScheduleMatch = (match) => {
    // Can schedule if user is participant and match is pending or scheduled
    const canSchedule = isUserParticipantInMatch(match) &&
           (match.status === 'scheduled' || match.status === 'pending') &&
           !match.game_id;
    console.log('canUserScheduleMatch:', { matchId: match.id, canSchedule, status: match.status });
    return canSchedule;
  };

  const canUserRequestPlay = (match) => {
    // Can request play if user is participant, match is pending/scheduled, no game exists, and opponent is online
    const canRequest = isUserParticipantInMatch(match) &&
           (match.status === 'scheduled' || match.status === 'pending') &&
           !match.game_id &&
           !match.result;
    console.log('canUserRequestPlay:', { matchId: match.id, canRequest, status: match.status });
    return canRequest;
  };

  const getOpponent = (match) => {
    if (!user) return null;
    return match.white_player_id === user.id ? match.black_player : match.white_player;
  };

  const isOpponentOnline = (match) => {
    const opponent = getOpponent(match);
    if (!opponent) {
      console.log('❌ No opponent found for match');
      return false;
    }

    // Debug: Check opponents state
    console.log('🔍 Checking opponent online status:', {
      opponentId: opponent.id,
      opponentName: opponent.name,
      opponentsInState: opponents.length,
      opponentsData: opponents.map(o => ({ id: o.user_id, name: o.name, online: o.is_online }))
    });

    // Use contextual presence (only checks current round opponents)
    const online = isUserOnline(opponent.id);
    if (online) {
      console.log(`✅ ${opponent.name} is online`);
    } else {
      console.log(`❌ ${opponent.name} is offline`);
    }
    return online;
  };

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
  console.log('ChampionshipMatches Debug:', {
    user: user?.id,
    userRoles: user?.roles,
    isAdmin,
    championship: currentChampionship?.id,
    organizerId: currentChampionship?.organizer_id,
    isOrganizer,
    canEditMatches,
    userOnly
  });

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
                backgroundColor: '#eff6ff',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', marginBottom: '8px' }}>
                  📅 Allowed Scheduling Window
                </h4>
                <div style={{ fontSize: '13px', color: '#1e3a8a' }}>
                  <p style={{ margin: '4px 0' }}>
                    <strong>From:</strong> Now ({formatDateTime(now)})
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>To:</strong> {deadline ? formatDateTime(deadline) : 'No deadline set'}
                  </p>
                  {deadline && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#3b82f6' }}>
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
                  <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
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

    // Check online status for both players using contextual presence
    // Current user is ALWAYS online (they're viewing this page!)
    const whitePlayerOnline = match.white_player
      ? (match.white_player.id === user?.id ? true : isUserOnline(match.white_player.id))
      : false;
    const blackPlayerOnline = match.black_player
      ? (match.black_player.id === user?.id ? true : isUserOnline(match.black_player.id))
      : false;

    console.log('🎯 Player online status check:', {
      matchId: match.id,
      currentUserId: user?.id,
      whitePlayerId: match.white_player?.id,
      blackPlayerId: match.black_player?.id,
      whitePlayerOnline,
      blackPlayerOnline,
      isCurrentUserWhite: match.white_player?.id === user?.id,
      isCurrentUserBlack: match.black_player?.id === user?.id
    });

    // Get urgency-based background color
    const getCardBackgroundColor = () => {
      switch(deadlineInfo.urgency) {
        case 'danger':
        case 'critical':
          return '#fee2e2'; // Light red
        case 'high':
          return '#fed7aa'; // Light orange
        case 'moderate':
          return '#fef3c7'; // Light yellow
        case 'low':
          return '#dbeafe'; // Light blue
        default:
          return '#ffffff'; // White
      }
    };

    return (
      <div className={`match-card ${getMatchCardUrgencyClass(match.deadline)}`} style={{
        backgroundColor: getCardBackgroundColor(),
        transition: 'all 0.3s ease'
      }}>
        <div className="match-header">
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
                  whiteSpace: 'nowrap'
                }}>
                  {match.white_player ? match.white_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
                  {match.white_player_id === user?.id && <span className="you-indicator" style={{ fontSize: '12px', marginLeft: '4px' }}>(You)</span>}
                </div>
              </div>
              {match.white_player?.email && (
                <div style={{ fontSize: '11px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '14px' }}>
                  {match.white_player.email}
                </div>
              )}
              <div className="player-rating" style={{ fontSize: '12px', color: '#374151', marginTop: '2px', marginLeft: '14px' }}>
                Rating: {match.white_player?.rating || 'N/A'}
              </div>
            </div>

            {/* VS Separator */}
            <div className="vs-separator" style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af' }}>VS</div>

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
                  whiteSpace: 'nowrap'
                }}>
                  {match.black_player ? match.black_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
                  {match.black_player_id === user?.id && <span className="you-indicator" style={{ fontSize: '12px', marginLeft: '4px' }}>(You)</span>}
                </div>
              </div>
              {match.black_player?.email && (
                <div style={{ fontSize: '11px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '14px' }}>
                  {match.black_player.email}
                </div>
              )}
              <div className="player-rating" style={{ fontSize: '12px', color: '#374151', marginTop: '2px', marginLeft: '14px' }}>
                Rating: {match.black_player?.rating || 'N/A'}
              </div>
            </div>
          </div>

          <div className="match-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', fontSize: '12px' }}>
            <span className={`match-status ${getMatchStatusColor(match.status)}`} style={{ padding: '4px 8px', borderRadius: '4px' }}>
              {match.status}
            </span>
            <span className="round-info" style={{ color: '#6b7280' }}>
              Round {match.round_number || match.round || 1}
              {match.board_number && `, Board ${match.board_number}`}
            </span>
          </div>
        </div>

        <div className="match-details" style={{ marginTop: '12px' }}>
          {/* Compact deadline and time window in one row */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            padding: '8px 12px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <div style={{ flex: '1', minWidth: '0' }}>
              <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Complete by:
              </div>
              <div className={`schedule-time ${deadlineInfo.color}`} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '3px', display: 'inline-block' }}>
                {deadlineInfo.text}
              </div>
            </div>

            {match.deadline && (
              <div style={{ flex: '1', minWidth: '0', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
                <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  📅 Time Window
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>
                  Now → {formatDateTime(new Date(match.deadline))}
                </div>
                <div style={{ color: '#3b82f6', fontSize: '11px', marginTop: '2px' }}>
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

          {match.game_id && (
            <div className="game-link" style={{ marginTop: '8px' }}>
              <button
                onClick={() => navigate(`/play/multiplayer/${match.game_id}`)}
                className="btn btn-primary btn-small"
              >
                {match.status === 'active' ? 'Continue Game' : 'Review Game'}
              </button>
            </div>
          )}
        </div>

        <div className="match-actions" style={{
          borderTop: '2px solid #e5e7eb',
          paddingTop: '12px',
          marginTop: '12px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {/* Debug info */}
          {console.log('Match Actions Debug:', {
            matchId: match.id,
            userOnly,
            canSchedule: canUserScheduleMatch(match),
            canCreateGame: canUserCreateGame(match),
            canReportResult: canUserReportResult(match),
            status: match.status,
            hasGame: !!match.game_id
          })}

          {userOnly && canUserScheduleMatch(match) && (
            <button
              onClick={() => {
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
              onClick={() => handleSendPlayRequest(match.id)}
              disabled={proposingTime === match.id || !isOpponentOnline(match)}
              className="btn btn-success btn-small"
              title={isOpponentOnline(match) ? "Send play challenge to opponent (like Challenge feature)" : "Opponent is offline"}
              style={{
                fontWeight: 'bold',
                fontSize: '14px',
                opacity: isOpponentOnline(match) ? 1 : 0.5
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
    console.log('🔄 transformMatch input:', {
      matchId: match.id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      player1_name: match.player1?.name,
      player2_name: match.player2?.name,
      white_player_id: match.white_player_id,
      black_player_id: match.black_player_id,
      currentUserId: user?.id
    });

    // Map player1/player2 to white_player/black_player based on color assignments
    let white_player = null;
    let black_player = null;

    if (match.white_player_id) {
      white_player = match.white_player_id === match.player1_id
        ? match.player1
        : match.player2;
    }

    if (match.black_player_id) {
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

    console.log('✅ transformMatch output:', {
      matchId: transformed.id,
      white_player_name: transformed.white_player?.name,
      black_player_name: transformed.black_player?.name,
      isUserPlayer1: match.player1_id === user?.id,
      isUserPlayer2: match.player2_id === user?.id,
      isUserWhitePlayer: match.white_player_id === user?.id,
      isUserBlackPlayer: match.black_player_id === user?.id
    });

    return transformed;
  };

  // Group matches by round
  const matchesArray = Array.isArray(matches) ? matches : [];
  const transformedMatches = matchesArray.map(transformMatch);

  console.log('🎯 Final match counts:', {
    userOnly,
    totalRawMatches: matchesArray.length,
    totalTransformedMatches: transformedMatches.length,
    userMatches: transformedMatches.filter(m =>
      m.player1_id === user?.id || m.player2_id === user?.id
    ).length,
    currentUserId: user?.id
  });

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
                <h3 className="round-title">Round {round}</h3>
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
    </div>
  );
};

export default ChampionshipMatches;
