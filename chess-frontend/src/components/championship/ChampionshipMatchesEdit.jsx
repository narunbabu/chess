// ChampionshipMatchesEdit.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, getMatchResultDisplay, getMatchStatusColor } from '../../utils/championshipHelpers';
import { hasRole } from '../../utils/permissionHelpers';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import './Championship.css';
import './ChampionshipMatchesEdit.css';

const ChampionshipMatchesEdit = ({ championshipId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();

  // Use championshipId from props or URL params
  const effectiveChampionshipId = championshipId || id;

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterRound, setFilterRound] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deletingMatch, setDeletingMatch] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [championship, setChampionship] = useState(null);

  // Edit round modal state
  const [editingRound, setEditingRound] = useState(null);
  const [editForm, setEditForm] = useState({
    scheduled_at: '',
    deadline: ''
  });
  const [updatingRound, setUpdatingRound] = useState(null);

  // Check if user is admin or organizer using the proper permission helpers
  const isAdmin = hasRole(user, ['platform_admin', 'organization_admin', 'tournament_organizer']);
  const isOrganizer = championship?.organizer_id === user?.id;

  // Admins should have access even if championship data is still loading
  const canEdit = isAdmin || isOrganizer;

  // Debug logging
  console.log('ChampionshipMatchesEdit Debug:', {
    user: user?.id,
    userRoles: user?.roles,
    isAdmin,
    championship: championship?.id,
    organizerId: championship?.organizer_id,
    isOrganizer,
    canEdit
  });

  const loadChampionship = useCallback(async () => {
    if (!effectiveChampionshipId) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/championships/${effectiveChampionshipId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setChampionship(response.data);
    } catch (error) {
      console.error('Failed to load championship:', error);
      setError('Failed to load championship details');
    }
  }, [effectiveChampionshipId]);

  const loadMatches = useCallback(async () => {
    if (!effectiveChampionshipId) {
      setError('Championship ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${BACKEND_URL}/championships/${effectiveChampionshipId}/matches`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Handle different response formats
      if (response.data.matches) {
        setMatches(response.data.matches.data || response.data.matches);
      } else {
        setMatches(response.data);
      }
    } catch (error) {
      console.error('Failed to load matches:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to load matches';
      setError(errorMsg);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveChampionshipId]);

  useEffect(() => {
    loadChampionship();
  }, [loadChampionship]);

  useEffect(() => {
    if (canEdit) {
      loadMatches();
    }
  }, [canEdit, loadMatches]);

  const handleDeleteMatch = async (matchId) => {
    if (!effectiveChampionshipId) {
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
        `${BACKEND_URL}/championships/${effectiveChampionshipId}/matches/${matchId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.message) {
        // Refresh matches list
        await loadMatches();
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

  const handleDeleteAllMatches = async () => {
    if (!effectiveChampionshipId) {
      alert('Championship ID is missing');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Delete All Matches\n\n` +
      `Are you sure you want to delete ALL matches in this championship?\n` +
      `This will remove ${matches.length} match(es) and cannot be undone.\n\n` +
      `Type "DELETE ALL" to confirm:`
    );

    if (!confirmed) return;

    const confirmation = prompt('Type "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      alert('Confirmation text did not match. Operation cancelled.');
      return;
    }

    setDeletingAll(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.delete(
        `${BACKEND_URL}/championships/${effectiveChampionshipId}/matches`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.message) {
        // Refresh matches list
        await loadMatches();
        alert(`✅ Success: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Failed to delete all matches:', error);
      const errorMsg = error.response?.data?.error || 'Failed to delete all matches';
      alert(`❌ Error: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setDeletingAll(false);
    }
  };

  const handleEditRound = (roundNumber) => {
    // Get the first match of this round to determine current time
    const roundMatches = matchesByRound[roundNumber];
    if (!roundMatches || roundMatches.length === 0) return;

    const firstMatch = roundMatches[0];
    setEditingRound(roundNumber);

    // Convert the dates to local datetime-local format for the input fields
    const scheduledAt = new Date(firstMatch.scheduled_at);
    const deadline = new Date(firstMatch.deadline);

    setEditForm({
      scheduled_at: scheduledAt.toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:MM
      deadline: deadline.toISOString().slice(0, 16)
    });
  };

  const handleUpdateRound = async () => {
    if (!effectiveChampionshipId || editingRound === null) {
      alert('Missing required information');
      return;
    }

    // Validate dates
    const scheduledAt = new Date(editForm.scheduled_at);
    const deadline = new Date(editForm.deadline);
    const now = new Date();

    if (scheduledAt <= now) {
      alert('Scheduled time must be in the future');
      return;
    }

    if (deadline <= scheduledAt) {
      alert('Deadline must be after scheduled time');
      return;
    }

    setUpdatingRound(editingRound);
    try {
      const token = localStorage.getItem('auth_token');
      const roundMatches = matchesByRound[editingRound];

      // Update all matches in the round
      const updatePromises = roundMatches.map(async (match) => {
        return axios.put(
          `${BACKEND_URL}/championships/${effectiveChampionshipId}/matches/${match.id}/reschedule`,
          {
            scheduled_at: scheduledAt.toISOString(),
            deadline: deadline.toISOString()
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      });

      await Promise.all(updatePromises);

      // Refresh matches list
      await loadMatches();
      setEditingRound(null);
      alert(`✅ Success: Updated ${roundMatches.length} match(es) in Round ${editingRound}`);
    } catch (error) {
      console.error('Failed to update round:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to update round';
      alert(`❌ Error: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setUpdatingRound(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingRound(null);
    setEditForm({ scheduled_at: '', deadline: '' });
  };

  const MatchRow = ({ match }) => {
    return (
      <div className="match-row">
        <div className="match-cell white-player">
          <div className={`player-name ${match.white_player_id === user?.id ? 'current-user' : ''}`}>
            {match.white_player ? match.white_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
            {match.white_player_id === user?.id && <span className="you-indicator">(You)</span>}
          </div>
          <div className="player-rating">{match.white_player?.rating || 'N/A'}</div>
        </div>

        <div className="match-cell vs-cell">VS</div>

        <div className="match-cell black-player">
          <div className={`player-name ${match.black_player_id === user?.id ? 'current-user' : ''}`}>
            {match.black_player ? match.black_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
            {match.black_player_id === user?.id && <span className="you-indicator">(You)</span>}
          </div>
          <div className="player-rating">{match.black_player?.rating || 'N/A'}</div>
        </div>

        <div className="match-cell status-cell">
          <span className={`match-status ${getMatchStatusColor(match.status)}`}>
            {match.status}
          </span>
        </div>

        <div className="match-cell scheduled-cell">
          <div className="scheduled-date">{formatDateTime(match.scheduled_at)}</div>
          <div className="deadline-info" style={{ fontSize: '12px', color: '#8b8987' }}>
            Deadline: {formatDateTime(match.deadline)}
          </div>
        </div>

        <div className="match-cell result-cell">
          {match.result ? getMatchResultDisplay(match) : '-'}
        </div>

        <div className="match-cell game-cell">
          {match.game_id && (
            <button
              onClick={() => navigate(`/play/multiplayer/${match.game_id}`)}
              className="btn btn-primary btn-small"
            >
              {match.status === 'active' ? 'Continue' : 'Review'}
            </button>
          )}
        </div>

        <div className="match-cell actions-cell">
          <button
            onClick={() => handleEditRound(match.round_number || match.round)}
            className="btn btn-primary btn-small"
            title="Edit round time"
            style={{ marginRight: '8px' }}
          >
            ✏️ Round Time
          </button>
          <button
            onClick={() => handleDeleteMatch(match.id)}
            disabled={deletingMatch === match.id}
            className="btn btn-danger btn-small"
            title="Delete this match"
          >
            {deletingMatch === match.id ? 'Deleting...' : '🗑️ Delete'}
          </button>
        </div>
      </div>
    );
  };

  // Transform matches to ensure consistent field names
  const transformMatch = (match) => {
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

    return {
      ...match,
      white_player,
      black_player,
      round: match.round_number || match.round || 1
    };
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

  if (!canEdit) {
    return (
      <div className="error-state">
        <p>❌ Access Denied: You don't have permission to edit matches.</p>
        <button
          onClick={() => navigate(`/championships/${effectiveChampionshipId}`)}
          className="btn btn-primary"
        >
          Back to Championship
        </button>
      </div>
    );
  }

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
    <div className="championship-matches-edit">
      <div className="matches-header">
        <div className="header-left">
          <h2>Edit Matches</h2>
          <button
            onClick={() => navigate(`/championships/${effectiveChampionshipId}`)}
            className="btn btn-secondary btn-small"
          >
            ← Back to Championship
          </button>
        </div>

        <div className="header-actions">
          {transformedMatches.length > 0 && (
            <button
              onClick={handleDeleteAllMatches}
              disabled={deletingAll}
              className="btn btn-danger"
            >
              {deletingAll ? 'Deleting All...' : `🗑️ Delete All Matches (${transformedMatches.length})`}
            </button>
          )}
        </div>
      </div>

      <div className="edit-filters">
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

      {transformedMatches.length === 0 ? (
        <div className="empty-state">
          <h3>No matches found</h3>
          <p>
            No matches have been created for this championship yet.
          </p>
          <button
            onClick={() => navigate(`/championships/${effectiveChampionshipId}/admin`)}
            className="btn btn-primary"
          >
            Go to Tournament Management
          </button>
        </div>
      ) : (
        <div className="matches-content">
          {rounds.map(round => (
            (filterRound === '' || parseInt(filterRound) === round) && (
              <div key={round} className="round-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="round-title" style={{ margin: 0 }}>
                    Round {round}
                    {matchesByRound[round] && matchesByRound[round][0] && (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'normal',
                        color: '#8b8987',
                        marginLeft: '8px'
                      }}>
                        ({formatDateTime(matchesByRound[round][0].scheduled_at, false)})
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => handleEditRound(round)}
                    className="btn btn-primary btn-small"
                    title="Edit round time for all matches"
                  >
                    ✏️ Edit Round Time
                  </button>
                </div>
                <div className="matches-table">
                  <div className="matches-header-row">
                    <div className="match-cell header-cell white-player">White Player</div>
                    <div className="match-cell header-cell vs-cell"></div>
                    <div className="match-cell header-cell black-player">Black Player</div>
                    <div className="match-cell header-cell status-cell">Status</div>
                    <div className="match-cell header-cell scheduled-cell">Scheduled</div>
                    <div className="match-cell header-cell result-cell">Result</div>
                    <div className="match-cell header-cell game-cell">Game</div>
                    <div className="match-cell header-cell actions-cell">Actions</div>
                  </div>
                  {(matchesByRound[round] || [])
                    .filter(match => filterStatus === '' || match.status === filterStatus)
                    .map(match => (
                      <MatchRow key={match.id} match={match} />
                    ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Edit Round Modal */}
      {editingRound !== null && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#312e2b',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#ffffff' }}>
              ✏️ Edit Round {editingRound} Time
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#8b8987' }}>
                This will update the scheduled time and deadline for all {matchesByRound[editingRound]?.length || 0} matches in Round {editingRound}.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#bababa' }}>
                Round Start Date & Time:
              </label>
              <input
                type="datetime-local"
                value={editForm.scheduled_at}
                onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #4a4744',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: '#262421',
                  color: '#bababa'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', color: '#bababa' }}>
                Round Deadline Date & Time:
              </label>
              <input
                type="datetime-local"
                value={editForm.deadline}
                onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #4a4744',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: '#262421',
                  color: '#bababa'
                }}
              />
              <small style={{ display: 'block', marginTop: '4px', color: '#8b8987' }}>
                This is the deadline by which all matches in this round must be completed.
              </small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={handleCancelEdit}
                disabled={updatingRound === editingRound}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  border: '1px solid #4a4744',
                  borderRadius: '4px',
                  backgroundColor: '#3d3a37',
                  color: '#bababa',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRound}
                disabled={updatingRound === editingRound}
                className="btn btn-primary"
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#81b64c',
                  color: 'white',
                  cursor: updatingRound === editingRound ? 'not-allowed' : 'pointer',
                  opacity: updatingRound === editingRound ? 0.6 : 1
                }}
              >
                {updatingRound === editingRound ? 'Updating...' : `Update Round ${editingRound}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChampionshipMatchesEdit;