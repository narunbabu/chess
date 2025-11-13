// ChampionshipList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatChampionshipStatus, formatChampionshipType, formatPrizePool, formatParticipantCount, calculateDaysRemaining, formatDateTime, getStatusColorClass, canUserRegister } from '../../utils/championshipHelpers';
import { canCreateChampionship } from '../../utils/permissionHelpers';
import CreateChampionshipModal from './CreateChampionshipModal';
import ConfirmationModal from './ConfirmationModal';
import './Championship.css';

const ChampionshipList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { championships, loading, error, fetchChampionships, registerForChampionship, restoreChampionship, deleteChampionship, forceDeleteChampionship } = useChampionship();

  const [filters, setFilters] = useState({
    status: '',
    format: '',
    search: '',
    upcoming_only: false,
    user_registered: false,
    archived: false
  });

  // Memoize filters to prevent unnecessary re-renders
  const filtersMemo = useMemo(() => filters, [filters.status, filters.format, filters.search, filters.upcoming_only, filters.user_registered, filters.archived]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, type: null, championship: null });

  // Check if user is admin (can view archived)
  const isAdmin = user?.roles?.some(role =>
    role === 'platform_admin' || role === 'organization_admin'
  ) || false;

  // Check if user is platform admin (can force delete)
  const isPlatformAdmin = user?.roles?.some(role => role === 'platform_admin') || false;

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

      // Show user-friendly error message
      if (error.response?.data?.code === 'ALREADY_REGISTERED') {
        // Already registered - refresh the list to update UI
        await fetchChampionships(filtersMemo);
      } else {
        // Show other errors
        const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
        // You could add a toast notification here
        console.error(errorMessage);
      }
    } finally {
      setRegisteringId(null);
    }
  };

  const handleRestore = async (championshipId) => {
    setRestoringId(championshipId);
    try {
      await restoreChampionship(championshipId);
      // Refresh both lists
      await fetchChampionships({ ...filtersMemo, archived: false });
      await fetchChampionships(filtersMemo);
      closeConfirmationModal();
    } catch (error) {
      console.error('Restore failed:', error);
      alert(error.response?.data?.message || 'Failed to restore championship');
    } finally {
      setRestoringId(null);
    }
  };

  const handleArchive = async (championshipId) => {
    try {
      await deleteChampionship(championshipId);
      // Refresh the list
      await fetchChampionships(filtersMemo);
      closeConfirmationModal();
    } catch (error) {
      console.error('Archive failed:', error);
      alert(error.response?.data?.message || 'Failed to archive championship');
    }
  };

  const handleForceDelete = async (championshipId) => {
    try {
      await forceDeleteChampionship(championshipId);
      // Refresh the list
      await fetchChampionships(filtersMemo);
      closeConfirmationModal();
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.message || 'Failed to permanently delete championship');
    }
  };

  const openConfirmationModal = (type, championship) => {
    setConfirmationModal({ isOpen: true, type, championship });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ isOpen: false, type: null, championship: null });
  };

  const handleConfirmAction = async () => {
    const { type, championship } = confirmationModal;
    switch (type) {
      case 'archive':
        await handleArchive(championship.id);
        break;
      case 'restore':
        await handleRestore(championship.id);
        break;
      case 'delete':
        await handleForceDelete(championship.id);
        break;
      default:
        break;
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

  const ChampionshipCard = ({ championship, isArchived = false }) => {
    const canRegister = canUserRegister(championship, user);
    const isOrganizer = user && (championship.created_by === user.id || championship.organizer_id === user.id);
    const daysRemaining = calculateDaysRemaining(championship.registration_end_at);

    return (
      <div className={`championship-card ${isArchived ? 'archived' : ''}`}>
        <div className="championship-header">
          <div className="championship-title-section">
            <h3 className="championship-name">{championship.name}</h3>
            <span className={`championship-status ${isArchived ? 'archived' : getStatusColorClass(championship.status)}`}>
              {isArchived ? '📦 Archived' : formatChampionshipStatus(championship.status)}
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
          {isArchived ? (
            <>
              <button
                onClick={() => navigate(`/championships/${championship.id}`)}
                className="btn btn-secondary"
                data-tooltip="View Details"
              >
                <span className="btn-icon">👁️</span>
                <span className="btn-text">View Details</span>
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => openConfirmationModal('restore', championship)}
                    disabled={restoringId === championship.id}
                    className="btn btn-success"
                    data-tooltip="Restore Championship"
                  >
                    <span className="btn-icon">↺</span>
                    <span className="btn-text">{restoringId === championship.id ? 'Restoring...' : 'Restore'}</span>
                  </button>
                  {isPlatformAdmin && championship.participants_count === 0 && (
                    <button
                      onClick={() => openConfirmationModal('delete', championship)}
                      className="btn btn-danger"
                      data-tooltip="Delete Championship"
                    >
                      <span className="btn-icon">🗑️</span>
                      <span className="btn-text">Delete</span>
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => navigate(`/championships/${championship.id}`)}
                className="btn btn-primary"
                data-tooltip="View Details"
              >
                Details
              </button>

              {championship.user_participation && (
                <>
                  <button
                    onClick={() => navigate(`/championships/${championship.id}/my-matches`)}
                    className="btn btn-secondary"
                    data-tooltip="My Matches"
                  >
                    <span className="btn-icon">⚔️</span>
                    <span className="btn-text">My Matches</span>
                  </button>
                  <button
                    disabled
                    className="btn btn-info"
                    data-tooltip="Already Registered"
                  >
                    <span className="btn-icon">✓</span>
                    <span className="btn-text">Already Registered</span>
                  </button>
                </>
              )}

              {!championship.user_participation && canRegister && (
                <button
                  onClick={() => handleRegister(championship.id)}
                  disabled={registeringId === championship.id}
                  className="btn btn-success"
                  data-tooltip="Register for Championship"
                >
                  {registeringId === championship.id ? 'Registering...' : 'Register'}
                </button>
              )}

              {isOrganizer && (
                <>
                  <button
                    onClick={() => navigate(`/championships/${championship.id}/admin`)}
                    className="btn btn-admin"
                    data-tooltip="Manage Championship"
                  >
                    Manage
                  </button>
                  {championship.status !== 'in_progress' && (
                    <button
                      onClick={() => openConfirmationModal('archive', championship)}
                      className="btn btn-warning"
                      data-tooltip="Archive Championship"
                    >
                      Archive
                    </button>
                  )}
                </>
              )}
            </>
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
            data-tooltip="Create New Championship"
          >
            <span className="btn-icon">+</span>
            <span className="btn-text">Create Championship</span>
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
          {isAdmin && (
            <label className="checkbox-label archived-toggle">
              <input
                type="checkbox"
                checked={filters.archived}
                onChange={(e) => handleFilterChange('archived', e.target.checked)}
              />
              📦 Show Archived
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
                <ChampionshipCard
                  key={championship.id}
                  championship={championship}
                  isArchived={filters.archived}
                />
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={closeConfirmationModal}
        onConfirm={handleConfirmAction}
        type={confirmationModal.type}
        championship={confirmationModal.championship}
      />
    </div>
  );
};

export default ChampionshipList;