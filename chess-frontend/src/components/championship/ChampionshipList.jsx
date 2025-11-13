// ChampionshipList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatChampionshipStatus, formatChampionshipType, formatPrizePool, formatParticipantCount, calculateDaysRemaining, formatDateTime, getStatusColorClass, canUserRegister } from '../../utils/championshipHelpers';
import { canCreateChampionship } from '../../utils/permissionHelpers';
import CreateChampionshipModal from './CreateChampionshipModal';
import './Championship.css';

const ChampionshipList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { championships, loading, error, fetchChampionships, registerForChampionship } = useChampionship();

  const [filters, setFilters] = useState({
    status: '',
    format: '',
    search: '',
    upcoming_only: false,
    user_registered: false
  });

  // Memoize filters to prevent unnecessary re-renders
  const filtersMemo = useMemo(() => filters, [filters.status, filters.format, filters.search, filters.upcoming_only, filters.user_registered]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);

  useEffect(() => {
    fetchChampionships(filtersMemo);
  }, [fetchChampionships, filtersMemo]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRegister = async (championshipId) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setRegisteringId(championshipId);
    try {
      await registerForChampionship(championshipId);
      // Refresh championships list
      await fetchChampionships(filtersMemo);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setRegisteringId(null);
    }
  };

  const filteredChampionships = championships.filter(championship => {
    if (filters.status && championship.status !== filters.status) return false;
    if (filters.format && championship.format !== filters.format) return false;
    if (filters.search && !championship.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.upcoming_only && championship.status !== 'registration_open' && championship.status !== 'upcoming') return false;
    if (filters.user_registered && !championship.user_participation) return false;
    return true;
  });

  const ChampionshipCard = ({ championship }) => {
    const canRegister = canUserRegister(championship, user);
    const isOrganizer = user && championship.organizer_id === user.id;
    const daysRemaining = calculateDaysRemaining(championship.registration_end_at);

    return (
      <div className="championship-card">
        <div className="championship-header">
          <div className="championship-title-section">
            <h3 className="championship-name">{championship.name}</h3>
            <span className={`championship-status ${getStatusColorClass(championship.status)}`}>
              {formatChampionshipStatus(championship.status)}
            </span>
          </div>
          {championship.prizes && championship.prizes.length > 0 && (
            <div className="championship-prize">
              🏆 {formatPrizePool(championship.prizes)}
            </div>
          )}
        </div>

        <div className="championship-info">
          <div className="championship-details">
            <div className="detail-item">
              <span className="detail-label">Format:</span>
              <span className="detail-value">{formatChampionshipType(championship.format)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Time Control:</span>
              <span className="detail-value">{championship.time_control?.minutes || 'N/A'} min</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Participants:</span>
              <span className="detail-value">
                {formatParticipantCount(championship.participants_count, championship.max_participants)}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Rounds:</span>
              <span className="detail-value">{championship.total_rounds || 'N/A'}</span>
            </div>
            {championship.entry_fee && parseFloat(championship.entry_fee) > 0 && (
              <div className="detail-item">
                <span className="detail-label">Entry Fee:</span>
                <span className="detail-value">${championship.entry_fee}</span>
              </div>
            )}
          </div>

          <div className="championship-dates">
            <div className="date-item">
              <span className="date-label">Registration:</span>
              <span className="date-value">
                {formatDateTime(championship.registration_start_at)} - {formatDateTime(championship.registration_end_at)}
              </span>
            </div>
            <div className="date-item">
              <span className="date-label">Start Date:</span>
              <span className="date-value">{formatDateTime(championship.starts_at)}</span>
            </div>
            {daysRemaining && championship.status === 'registration_open' && (
              <div className="date-item urgency">
                <span className="date-value">{daysRemaining}</span>
              </div>
            )}
          </div>
        </div>

        <div className="championship-actions">
          <button
            onClick={() => navigate(`/championships/${championship.id}`)}
            className="btn btn-primary"
          >
            View Details
          </button>

          {championship.user_participation && (
            <button
              onClick={() => navigate(`/championships/${championship.id}/my-matches`)}
              className="btn btn-secondary"
            >
              My Matches
            </button>
          )}

          {canRegister && (
            <button
              onClick={() => handleRegister(championship.id)}
              disabled={registeringId === championship.id}
              className="btn btn-success"
            >
              {registeringId === championship.id ? 'Registering...' : 'Register'}
            </button>
          )}

          {isOrganizer && (
            <button
              onClick={() => navigate(`/championships/${championship.id}/admin`)}
              className="btn btn-admin"
            >
              Manage
            </button>
          )}
        </div>
      </div>
    );
  };

  // Check if user has permission to create championships
  const userCanCreate = canCreateChampionship(user);

  return (
    <div className="championship-list-container">
      <div className="championship-list-header">
        <h1>🏆 Chess Championships</h1>
        {userCanCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary create-btn"
          >
            + Create Championship
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="championship-filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search championships..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="registration">Registration Open</option>
            <option value="upcoming">Starting Soon</option>
            <option value="active">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={filters.format}
            onChange={(e) => handleFilterChange('format', e.target.value)}
            className="filter-select"
          >
            <option value="">All Formats</option>
            <option value="swiss">Swiss System</option>
            <option value="elimination">Single Elimination</option>
            <option value="hybrid">Hybrid</option>
            <option value="round_robin">Round Robin</option>
          </select>
        </div>

        <div className="filter-checkboxes">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.upcoming_only}
              onChange={(e) => handleFilterChange('upcoming_only', e.target.checked)}
            />
            Upcoming Only
          </label>
          {user && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.user_registered}
                onChange={(e) => handleFilterChange('user_registered', e.target.checked)}
              />
              My Championships
            </label>
          )}
        </div>
      </div>

      {/* Loading and Error States */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading championships...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={() => fetchChampionships(filtersMemo)} className="btn btn-primary">
            Retry
          </button>
        </div>
      )}

      {/* Championships Grid */}
      {!loading && !error && (
        <>
          {filteredChampionships.length === 0 ? (
            <div className="empty-state">
              <h3>No championships found</h3>
              <p>Try adjusting your filters{userCanCreate ? ' or create a new championship' : ''}.</p>
              {userCanCreate && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary"
                >
                  Create Championship
                </button>
              )}
            </div>
          ) : (
            <div className="championships-grid">
              {filteredChampionships.map(championship => (
                <ChampionshipCard key={championship.id} championship={championship} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Championship Modal */}
      <CreateChampionshipModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(championship) => {
          // Refresh the championships list and navigate to the new championship
          fetchChampionships(filtersMemo);
          navigate(`/championships/${championship.id}`);
        }}
      />
    </div>
  );
};

export default ChampionshipList;