import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDateTime, formatDateTimeShort, getMatchStatusColor } from '../../utils/championshipHelpers';
import './Championship.css';

const MatchSchedulingCard = ({ match, championship, onMatchUpdate }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    proposed_time: '',
    message: ''
  });
  const [scheduleProposals, setScheduleProposals] = useState([]);
  const [championshipInstructions, setChampionshipInstructions] = useState(null);

  // Load schedule proposals and championship instructions
  useEffect(() => {
    loadScheduleProposals();
    loadChampionshipInstructions();
  }, [match.id, championship.id]);

  // Set up real-time WebSocket event listeners
  useEffect(() => {
    const handleScheduleUpdate = (event) => {
      const { championship_match_id, championship_id } = event.detail;

      // Only update if this event is for the current match
      if (championship_match_id === match.id && championship_id === championship.id) {
        console.log('Schedule update received for this match:', event.detail);
        loadScheduleProposals();
        if (onMatchUpdate) onMatchUpdate();
      }
    };

    const handleMatchScheduled = (event) => {
      const { championship_match_id, championship_id } = event.detail;

      // Only update if this event is for the current match
      if (championship_match_id === match.id && championship_id === championship.id) {
        console.log('Match scheduled event received for this match:', event.detail);
        if (onMatchUpdate) onMatchUpdate();
      }
    };

    const handleGameCreated = (event) => {
      const { championship_match } = event.detail;

      // Only update if this event is for the current match
      if (championship_match.id === match.id) {
        console.log('Game created event received for this match:', event.detail);
        if (onMatchUpdate) onMatchUpdate();
      }
    };

    const handleTimeoutWarning = (event) => {
      const { championship_match_id, championship_id } = event.detail;

      // Only show warning if this event is for the current match
      if (championship_match_id === match.id && championship_id === championship.id) {
        console.log('Timeout warning received for this match:', event.detail);
        // You could show a warning in the UI here
      }
    };

    // Add event listeners
    window.addEventListener('championshipScheduleUpdated', handleScheduleUpdate);
    window.addEventListener('championshipMatchScheduled', handleMatchScheduled);
    window.addEventListener('championshipGameCreated', handleGameCreated);
    window.addEventListener('championshipTimeoutWarning', handleTimeoutWarning);

    // Cleanup
    return () => {
      window.removeEventListener('championshipScheduleUpdated', handleScheduleUpdate);
      window.removeEventListener('championshipMatchScheduled', handleMatchScheduled);
      window.removeEventListener('championshipGameCreated', handleGameCreated);
      window.removeEventListener('championshipTimeoutWarning', handleTimeoutWarning);
    };
  }, [match.id, championship.id, onMatchUpdate]);

  const loadScheduleProposals = async () => {
    try {
      const response = await api.get(`/championships/${championship.id}/matches/${match.id}/schedule/proposals`);
      setScheduleProposals(response.data.proposals || []);
    } catch (err) {
      console.error('Failed to load schedule proposals:', err);
    }
  };

  const loadChampionshipInstructions = async () => {
    try {
      const response = await api.get(`/championships/${championship.id}/instructions`);
      setChampionshipInstructions(response.data.championship);
    } catch (err) {
      console.error('Failed to load championship instructions:', err);
    }
  };

  const isUserPlayer = () => {
    const result = user && (match.player1_id === user.id || match.player2_id === user.id);
    console.log('isUserPlayer check:', {
      userId: user?.id,
      player1Id: match.player1_id,
      player2Id: match.player2_id,
      isPlayer: result
    });
    return result;
  };

  const getOpponent = () => {
    if (!user || !isUserPlayer()) return null;
    return match.player1_id === user.id ? match.player2 : match.player1;
  };

  const canProposeTime = () => {
    if (!isUserPlayer()) return false;
    const currentSchedule = scheduleProposals.find(s => s.status === 'proposed' || s.status === 'accepted');
    return !currentSchedule && match.scheduling_status === 'pending';
  };

  const canPlayImmediate = () => {
    if (!isUserPlayer()) return false;
    return championship.allow_early_play && !match.game_id && match.scheduling_status !== 'forfeit';
  };

  const isOpponentOnline = (opponent) => {
    // This would need to be implemented based on your presence system
    // For now, we'll use a placeholder
    return opponent?.last_activity_at &&
           new Date(opponent.last_activity_at) > new Date(Date.now() - 5 * 60 * 1000);
  };

  const handleProposeTime = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(
        `/championships/${championship.id}/matches/${match.id}/schedule/propose`,
        {
          proposed_time: scheduleData.proposed_time,
          message: scheduleData.message
        }
      );

      if (response.data.success) {
        setShowScheduleForm(false);
        setScheduleData({ proposed_time: '', message: '' });
        await loadScheduleProposals();
        if (onMatchUpdate) onMatchUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to propose schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSchedule = async (scheduleId) => {
    setLoading(true);
    try {
      const response = await api.post(
        `/championships/${championship.id}/matches/${match.id}/schedule/${scheduleId}/accept`,
        { message: 'I accept this time!' }
      );

      if (response.data.success) {
        await loadScheduleProposals();
        if (onMatchUpdate) onMatchUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleProposeAlternative = async (scheduleId) => {
    const alternativeTime = prompt('Propose an alternative time (YYYY-MM-DD HH:MM):');
    if (!alternativeTime) return;

    setLoading(true);
    try {
      const response = await api.post(
        `/championships/${championship.id}/matches/${match.id}/schedule/${scheduleId}/propose-alternative`,
        {
          alternative_time: alternativeTime,
          message: 'How about this time instead?'
        }
      );

      if (response.data.success) {
        await loadScheduleProposals();
        if (onMatchUpdate) onMatchUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to propose alternative time');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayImmediate = async () => {
    if (!confirm('Start the game now? Both players must be online to play immediately.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        `/championships/${championship.id}/matches/${match.id}/schedule/play-immediate`
      );

      if (response.data.success) {
        // Navigate to the game
        navigate(response.data.redirect_url);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start immediate game');
    } finally {
      setLoading(false);
    }
  };

  const currentSchedule = scheduleProposals.find(s => s.status === 'proposed' || s.status === 'accepted' || s.status === 'alternative_proposed');

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      {/* Match Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {match.player1?.name} vs {match.player2?.name}
          </h3>
          <p className="text-sm text-gray-600">
            Round {match.round_number} • {match.round_type}
          </p>

          {/* Enhanced Time Display */}
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</p>
                <p className="text-sm font-semibold text-gray-900">{formatDateTime(match.deadline)}</p>
              </div>

              {match.scheduled_time && (
                <div className="text-center">
                  <p className="text-xs font-medium text-blue-500 uppercase tracking-wide">Scheduled Time</p>
                  <p className="text-sm font-semibold text-blue-900">{formatDateTime(match.scheduled_time)}</p>
                </div>
              )}

              <div className="text-center">
                <p className="text-xs font-medium text-green-500 uppercase tracking-wide">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMatchStatusColor(match.scheduling_status)}`}>
                  {match.scheduling_status}
                </span>
              </div>
            </div>

            {/* Time remaining indicator */}
            {match.deadline && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  {(() => {
                    const now = new Date();
                    const deadline = new Date(match.deadline);
                    const diffMs = deadline - now;
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffHours / 24);

                    if (diffMs < 0) {
                      return <span className="text-red-600 font-medium">⚠️ Overdue</span>;
                    } else if (diffHours < 24) {
                      return <span className="text-orange-600 font-medium">⏰ {diffHours} hours remaining</span>;
                    } else {
                      return <span className="text-green-600">📅 {diffDays} day{diffDays > 1 ? 's' : ''} remaining</span>;
                    }
                  })()}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="ml-4">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ℹ️ Instructions
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Championship Instructions */}
      {showInstructions && championshipInstructions && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Championship Instructions</h4>

          <div className="mb-3">
            <h5 className="font-medium text-blue-800 mb-1">Scheduling Rules:</h5>
            <div
              className="text-sm text-blue-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: championshipInstructions.scheduling_instructions }}
            />
          </div>

          <div>
            <h5 className="font-medium text-blue-800 mb-1">Play Rules:</h5>
            <div
              className="text-sm text-blue-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: championshipInstructions.play_instructions }}
            />
          </div>

          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              <strong>Grace Period:</strong> {championshipInstructions.default_grace_period_minutes} minutes
              {championshipInstructions.allow_early_play && ' • Early play allowed'}
            </p>
          </div>
        </div>
      )}

      {/* Current Schedule Status */}
      {currentSchedule && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">Schedule Proposal</h4>

          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Proposed by:</span> {currentSchedule.proposer?.name}
            </p>

            {currentSchedule.status === 'proposed' && (
              <p className="text-sm">
                <span className="font-medium">Proposed Time:</span> {formatDateTime(currentSchedule.proposed_time)}
              </p>
            )}

            {currentSchedule.status === 'alternative_proposed' && (
              <>
                <p className="text-sm">
                  <span className="font-medium">Original Time:</span> {formatDateTime(currentSchedule.proposed_time)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Alternative Time:</span> {formatDateTime(currentSchedule.alternative_time)}
                </p>
              </>
            )}

            {currentSchedule.status === 'accepted' && (
              <p className="text-sm text-green-700">
                <span className="font-medium">Accepted Time:</span> {formatDateTime(currentSchedule.proposed_time)}
              </p>
            )}

            {currentSchedule.proposer_message && (
              <p className="text-sm italic text-gray-600">
                "{currentSchedule.proposer_message}"
              </p>
            )}

            {currentSchedule.responder_message && (
              <p className="text-sm italic text-gray-600">
                "{currentSchedule.responder_message}"
              </p>
            )}
          </div>

          {/* Action buttons for schedule proposals */}
          {isUserPlayer() && currentSchedule.status === 'proposed' && currentSchedule.proposer_id !== user.id && (
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => handleAcceptSchedule(currentSchedule.id)}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleProposeAlternative(currentSchedule.id)}
                disabled={loading}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
              >
                Propose Alternative
              </button>
            </div>
          )}

          {currentSchedule.status === 'alternative_proposed' && currentSchedule.responder_id !== user.id && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Alternative proposed. Please accept or propose another alternative.</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleAcceptSchedule(currentSchedule.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Accept Alternative
                </button>
                <button
                  onClick={() => handleProposeAlternative(currentSchedule.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                >
                  Propose Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Info */}
      {console.log('Rendering action buttons section, isUserPlayer:', isUserPlayer())}

      {/* Action Buttons */}
      {isUserPlayer() && (
        <div className="space-y-4 border-2 border-blue-300 p-4 rounded-lg bg-blue-50">
          <div className="mb-2 text-xs text-blue-600 font-medium">
            ✓ You are a player in this match - Actions available
          </div>

          {/* Primary Actions - Most Important First */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Play Now Button - Always show if game can be created */}
            {(!match.game_id && match.scheduling_status !== 'forfeit') && (
              <button
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    // Use the correct API endpoint
                    const response = await api.post(`/championships/${championship.id}/matches/${match.id}/game`, {
                      time_control: 'blitz',
                      color: 'random'
                    });

                    if (response.data.success && response.data.game_id) {
                      // Navigate to the game
                      navigate(`/play/${response.data.game_id}`);
                    } else if (response.data.match?.game_id) {
                      // Alternative response format
                      navigate(`/play/${response.data.match.game_id}`);
                    }
                  } catch (err) {
                    console.error('Failed to create game:', err);
                    setError(err.response?.data?.message || 'Failed to create game. Please try scheduling a time with your opponent first.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center justify-center"
              >
                {loading ? (
                  <span>⏳ Starting...</span>
                ) : (
                  <>
                    🎮 <span className="ml-2">Play Now</span>
                  </>
                )}
              </button>
            )}

            {/* Send Request/Message Button */}
            <button
              onClick={() => {
                const opponent = getOpponent();
                if (opponent) {
                  // Show the schedule form instead
                  setShowScheduleForm(true);
                }
              }}
              disabled={loading}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium flex items-center justify-center"
            >
              💬 <span className="ml-2">Send Schedule Request</span>
            </button>
          </div>

          {/* Scheduling Actions */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">📅 Schedule Options</h4>

            {/* Propose Time Button */}
            {canProposeTime() && (
              <div>
                {!showScheduleForm ? (
                  <button
                    onClick={() => setShowScheduleForm(true)}
                    disabled={loading}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    📅 Propose a Time
                  </button>
                ) : (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-3">Propose Match Time</h4>
                    <form onSubmit={handleProposeTime} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Proposed Time
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduleData.proposed_time}
                          onChange={(e) => setScheduleData({...scheduleData, proposed_time: e.target.value})}
                          min={new Date().toISOString().slice(0, 16)}
                          max={match.deadline}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Must be before deadline: {formatDateTimeShort(match.deadline)}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Message (Optional)
                        </label>
                        <textarea
                          value={scheduleData.message}
                          onChange={(e) => setScheduleData({...scheduleData, message: e.target.value})}
                          placeholder="Add a message for your opponent..."
                          rows="2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {loading ? '⏳ Sending...' : '📤 Send Proposal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowScheduleForm(false);
                            setScheduleData({ proposed_time: '', message: '' });
                          }}
                          className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Alternative: Quick Time Slots */}
            {!showScheduleForm && canProposeTime() && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                {[
                  { label: 'Tonight 7PM', time: () => {
                    const tonight = new Date();
                    tonight.setHours(19, 0, 0, 0);
                    return tonight.toISOString().slice(0, 16);
                  }},
                  { label: 'Tomorrow 7PM', time: () => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(19, 0, 0, 0);
                    return tomorrow.toISOString().slice(0, 16);
                  }},
                  { label: 'Weekend 2PM', time: () => {
                    const saturday = new Date();
                    saturday.setDate(saturday.getDate() + (6 - saturday.getDay() + 7) % 7);
                    saturday.setHours(14, 0, 0, 0);
                    return saturday.toISOString().slice(0, 16);
                  }}
                ].map((slot, index) => (
                  <button
                    key={index}
                    onClick={async () => {
                      try {
                        const response = await api.post(
                          `/championships/${championship.id}/matches/${match.id}/schedule/propose`,
                          {
                            proposed_time: slot.time(),
                            message: `Quick proposal: ${slot.label}`
                          }
                        );
                        if (response.data.success) {
                          await loadScheduleProposals();
                          if (onMatchUpdate) onMatchUpdate();
                        }
                      } catch (err) {
                        setError('Failed to send quick proposal');
                      }
                    }}
                    disabled={loading}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
                  >
                    ⚡ {slot.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Game Link */}
          {match.game_id && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">
                    🎮 Game is ready!
                  </p>
                  <p className="text-xs text-green-600">
                    Game ID: {match.game_id}
                  </p>
                </div>
                <a
                  href={`/play/${match.game_id}`}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Play Now →
                </a>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {!canProposeTime() && !match.game_id && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">
                {match.scheduling_status === 'accepted' && '✅ Schedule accepted. Waiting for confirmation.'}
                {match.scheduling_status === 'confirmed' && `📅 Match scheduled for ${formatDateTime(match.scheduled_time)}`}
                {match.scheduling_status === 'forfeit' && '❌ Match has been forfeited.'}
                {match.scheduling_status === 'pending' && '⏳ Waiting for scheduling actions.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Non-Player View */}
      {!isUserPlayer() && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-red-600 font-medium mb-2">
            ⓘ Debug: You are not a player in this match
          </p>
          <p className="text-xs text-gray-500 mb-2">
            User ID: {user?.id || 'Not logged in'} |
            Player 1 ID: {match.player1_id} |
            Player 2 ID: {match.player2_id}
          </p>
          <p className="text-sm text-gray-600">
            This match is between {match.player1?.name} and {match.player2?.name}.
            {match.scheduling_status === 'pending' && ' Waiting for players to schedule their match.'}
            {match.scheduling_status === 'accepted' && ' Schedule has been proposed.'}
            {match.scheduling_status === 'confirmed' && ` Match scheduled for ${formatDateTime(match.scheduled_time)}`}
            {match.game_id && ' Game is in progress.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default MatchSchedulingCard;