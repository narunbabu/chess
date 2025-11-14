import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChampionship } from '../contexts/ChampionshipContext';
import MatchSchedulingCard from '../components/championship/MatchSchedulingCard';
import { formatDateTime } from '../utils/championshipHelpers';

const ChampionshipSchedule = () => {
  const { championshipId } = useParams();
  const { user } = useAuth();
  const { fetchChampionship, fetchMatches } = useChampionship();

  const [championship, setChampionship] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load championship data and user matches
  useEffect(() => {
    const loadData = async () => {
      if (!championshipId || !user) return;

      setLoading(true);
      setError(null);

      try {
        // Load championship details
        const championshipData = await fetchChampionship(championshipId);
        setChampionship(championshipData);

        // Load user's matches for this championship
        const response = await fetchMatches(championshipId, { user_only: true, user_id: user.id });
        const userMatches = response.data || response;

        // Sort matches by deadline (soonest first) and then by round number
        const sortedMatches = userMatches.sort((a, b) => {
          const deadlineA = new Date(a.deadline);
          const deadlineB = new Date(b.deadline);

          if (deadlineA.getTime() !== deadlineB.getTime()) {
            return deadlineA.getTime() - deadlineB.getTime();
          }

          return a.round_number - b.round_number;
        });

        setMatches(sortedMatches);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load championship schedule');
        console.error('Failed to load championship schedule:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [championshipId, user, fetchChampionship, fetchMatches]);

  const handleMatchUpdate = () => {
    // Reload matches when a match is updated
    if (!championshipId || !user) return;

    fetchMatches(championshipId, { user_only: true, user_id: user.id })
      .then(response => {
        const userMatches = response.data || response;
        const sortedMatches = userMatches.sort((a, b) => {
          const deadlineA = new Date(a.deadline);
          const deadlineB = new Date(b.deadline);

          if (deadlineA.getTime() !== deadlineB.getTime()) {
            return deadlineA.getTime() - deadlineB.getTime();
          }

          return a.round_number - b.round_number;
        });
        setMatches(sortedMatches);
      })
      .catch(err => {
        console.error('Failed to reload matches:', err);
      });
  };

  const groupMatchesByStatus = () => {
    const now = new Date();
    const grouped = {
      needsAction: [],
      scheduled: [],
      inProgress: [],
      completed: [],
      overdue: []
    };

    matches.forEach(match => {
      const deadline = new Date(match.deadline);

      if (match.game_id) {
        grouped.inProgress.push(match);
      } else if (match.status === 'completed') {
        grouped.completed.push(match);
      } else if (match.scheduling_status === 'confirmed' || match.scheduling_status === 'accepted') {
        grouped.scheduled.push(match);
      } else if (deadline < now && match.scheduling_status !== 'completed') {
        grouped.overdue.push(match);
      } else if (match.scheduling_status === 'pending') {
        grouped.needsAction.push(match);
      } else {
        grouped.needsAction.push(match);
      }
    });

    return grouped;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'needsAction': return 'border-yellow-200 bg-yellow-50';
      case 'scheduled': return 'border-blue-200 bg-blue-50';
      case 'inProgress': return 'border-green-200 bg-green-50';
      case 'completed': return 'border-gray-200 bg-gray-50';
      case 'overdue': return 'border-red-200 bg-red-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getStatusTitle = (status) => {
    switch (status) {
      case 'needsAction': return 'Needs Your Action';
      case 'scheduled': return 'Scheduled';
      case 'inProgress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'overdue': return 'Overdue';
      default: return 'Other';
    }
  };

  if (!user) {
    return (
      <div className="container text-center py-5">
        <h3>Please log in to view your championship schedule</h3>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading championship schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container text-center py-5">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!championship) {
    return (
      <div className="container text-center py-5">
        <h3>Championship not found</h3>
      </div>
    );
  }

  const groupedMatches = groupMatchesByStatus();

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <h2>
            <i className="fas fa-calendar-alt me-2"></i>
            {championship.title} - My Matches
          </h2>
          <p className="text-muted">
            Manage your match schedule for this championship
          </p>
        </div>
        <div className="col-auto">
          <button
            onClick={() => window.history.back()}
            className="btn btn-outline-secondary"
          >
            <i className="fas fa-arrow-left me-2"></i>
            Back
          </button>
        </div>
      </div>

      {/* Championship Info */}
      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-muted mb-1">Tournament</h6>
                  <p className="mb-2">
                    <strong>{championship.title}</strong>
                  </p>
                  <p className="text-muted small mb-1">
                    Format: {championship.format?.replace('_', ' ')} •
                    Total Rounds: {championship.total_rounds}
                  </p>
                </div>
                <div className="col-md-6">
                  <h6 className="text-muted mb-1">Your Progress</h6>
                  <p className="mb-2">
                    Total Matches: <strong>{matches.length}</strong> •
                    Completed: <strong>{groupedMatches.completed.length}</strong>
                  </p>
                  <p className="text-muted small mb-1">
                    Needs Action: <span className="text-warning">{groupedMatches.needsAction.length}</span> •
                    In Progress: <span className="text-success">{groupedMatches.inProgress.length}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {(groupedMatches.needsAction.length > 0 || groupedMatches.overdue.length > 0) && (
        <div className="row mb-4">
          <div className="col">
            <div className="alert alert-warning d-flex align-items-center" role="alert">
              <i className="fas fa-exclamation-triangle me-2"></i>
              <div>
                <strong>Action Required:</strong> You have{' '}
                {groupedMatches.overdue.length > 0 && (
                  <span className="text-danger">
                    {groupedMatches.overdue.length} overdue match{groupedMatches.overdue.length > 1 ? 's' : ''}
                  </span>
                )}
                {groupedMatches.overdue.length > 0 && groupedMatches.needsAction.length > 0 && ' and '}
                {groupedMatches.needsAction.length > 0 && (
                  <span className="text-warning">
                    {groupedMatches.needsAction.length} match{groupedMatches.needsAction.length > 1 ? 'es' : ''} needing action
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Groups */}
      <div className="space-y-4">
        {Object.entries(groupedMatches).map(([status, statusMatches]) => (
          statusMatches.length > 0 && (
            <div key={status} className={`rounded-lg border p-4 ${getStatusColor(status)}`}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">
                  {getStatusTitle(status)}
                  <span className="badge bg-secondary ms-2">{statusMatches.length}</span>
                </h4>
                {status === 'needsAction' && (
                  <span className="text-warning">
                    <i className="fas fa-clock me-1"></i>
                    Act now!
                  </span>
                )}
                {status === 'overdue' && (
                  <span className="text-danger">
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    Overdue
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {statusMatches.map((match) => (
                  <MatchSchedulingCard
                    key={match.id}
                    match={match}
                    championship={championship}
                    onMatchUpdate={handleMatchUpdate}
                  />
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {/* No Matches */}
      {matches.length === 0 && (
        <div className="text-center py-5">
          <div className="card">
            <div className="card-body">
              <i className="fas fa-calendar-times fa-3x text-muted mb-3"></i>
              <h5>No Matches Found</h5>
              <p className="text-muted">
                You don't have any matches in this championship yet.
              </p>
              <p className="text-muted small">
                Matches will appear here once the tournament director generates the pairings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Instructions */}
      <div className="row mt-5">
        <div className="col">
          <div className="card bg-light">
            <div className="card-body">
              <h6 className="mb-2">
                <i className="fas fa-info-circle me-2"></i>
                Quick Guide
              </h6>
              <div className="row">
                <div className="col-md-6">
                  <p className="small mb-1">
                    <strong>📅 Propose Time:</strong> Suggest a time to play with your opponent
                  </p>
                  <p className="small mb-1">
                    <strong>🎮 Play Now:</strong> Start immediately if opponent is online
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="small mb-1">
                    <strong>✅ Accept:</strong> Agree to opponent's proposed time
                  </p>
                  <p className="small mb-1">
                    <strong>🔄 Alternative:</strong> Propose a different time if needed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChampionshipSchedule;