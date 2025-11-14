// ChampionshipList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatChampionshipStatus, formatChampionshipType, formatPrizePool, formatParticipantCount, calculateDaysRemaining, formatDateTime, getStatusColorClass, canUserRegister, formatCurrency } from '../../utils/championshipHelpers';
import { canCreateChampionship } from '../../utils/permissionHelpers';
import CreateChampionshipModal from './CreateChampionshipModal';
import ConfirmationModal from './ConfirmationModal';
import MockRazorpayPayment from './MockRazorpayPayment';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChampionship, setEditingChampionship] = useState(null);
  const [registeringId, setRegisteringId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, type: null, championship: null });
  const [expandedActionPanel, setExpandedActionPanel] = useState(null);
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, championship: null });

  // Check if user is admin (can view archived)
  const isAdmin = user?.roles?.some(role =>
    role === 'platform_admin' || role === 'organization_admin'
  ) || false;

  // Check if user is platform admin (can force delete)
  const isPlatformAdmin = user?.roles?.some(role => role === 'platform_admin') || false;

  useEffect(() => {
    fetchChampionships(filtersMemo);
  }, [fetchChampionships, filtersMemo]);

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (expandedActionPanel && !event.target.closest('.championship-actions-container')) {
        setExpandedActionPanel(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedActionPanel]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRegister = async (championship) => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if championship requires payment
    const entryFee = parseFloat(championship.entry_fee || 0);
    if (entryFee > 0) {
      // Show payment modal for paid championships
      setPaymentModal({ isOpen: true, championship });
      return;
    }

    // Free registration
    setRegisteringId(championship.id);
    try {
      await registerForChampionship(championship.id);
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

  const handlePaymentSuccess = async (paymentData) => {
    console.log('Payment successful:', paymentData);
    // Close payment modal
    setPaymentModal({ isOpen: false, championship: null });
    // Refresh championships list
    await fetchChampionships(filtersMemo);
  };

  const closePaymentModal = () => {
    setPaymentModal({ isOpen: false, championship: null });
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

  const toggleActionPanel = (championshipId) => {
    setExpandedActionPanel(prev => prev === championshipId ? null : championshipId);
  };

  const ChampionshipCard = ({ championship, isArchived = false }) => {
    const canRegister = canUserRegister(championship, user);
    const isOrganizer = user && (championship.created_by === user.id || championship.organizer_id === user.id);
    const daysRemaining = calculateDaysRemaining(championship.registration_end_at);
    const isPanelExpanded = expandedActionPanel === championship.id;

    return (
      <div className={`championship-card ${isArchived ? 'archived' : ''}`}>
      <div className="championship-header">
        <div className="championship-title-section">
        <h3 className="championship-name">{championship.name}</h3>
        <div className="championship-meta">
          <span className={`championship-status ${isArchived ? 'archived' : getStatusColorClass(championship.status)}`}>
          {isArchived ? '📦 Archived' : formatChampionshipStatus(championship.status)}
          </span>
          {championship.prizes && championship.prizes.length > 0 && (
          <span className="championship-prize">
            🏆 {formatPrizePool(championship.prizes)}
          </span>
          )}
        </div>
        </div>
      </div>

      <div className="championship-summary">
        <div className="summary-row">
        <div className="summary-item">
          <span className="summary-icon">🏆</span>
          <span className="summary-text">{formatChampionshipType(championship.format)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-icon">⏱️</span>
          <span className="summary-text">{championship.time_control?.minutes || 'N/A'}m</span>
        </div>
        <div className="summary-item">
          <span className="summary-icon">👥</span>
          <span className="summary-text">
          {formatParticipantCount(championship.participants_count, championship.max_participants)}
          </span>
        </div>
        {championship.entry_fee && parseFloat(championship.entry_fee) > 0 && (
          <div className="summary-item">
          <span className="summary-icon">💰</span>
          <span className="summary-text">{formatCurrency(championship.entry_fee)}</span>
          </div>
        )}
        </div>

        <div className="summary-row">
        <div className="summary-item">
          <span className="summary-icon">🔢</span>
          <span className="summary-text">{championship.total_rounds || 'N/A'} rounds</span>
        </div>
        <div className="summary-item">
          <span className="summary-icon">🏢</span>
          <span className="summary-text">
          {championship.organization_id ? 'Organization' : 'Public'}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-icon">👁️</span>
          <span className="summary-text">
          {championship.visibility === 'private' ? 'Private' : championship.visibility === 'organization' ? 'Org Only' : 'Public'}
          </span>
        </div>
        </div>
      </div>

      <div className="championship-deadline">
        <span className="deadline-label">
        {!isArchived && daysRemaining && championship.status === 'registration_open' ? (
          daysRemaining <= 3 ? (
          <span className="urgency">⚠️ {daysRemaining === 0 ? 'Ends today' : `${daysRemaining} days left`}</span>
          ) : (
          <span>📅 {formatDateTime(championship.starts_at)}</span>
          )
        ) : (
          <span>📅 {formatDateTime(championship.starts_at)}</span>
        )}
        </span>
      </div>

      <div className="championship-actions-container">
        <button
        className={`actions-toggle ${isPanelExpanded ? 'active' : ''}`}
        onClick={() => toggleActionPanel(championship.id)}
        aria-label="Toggle actions"
        >
        <span className="toggle-icon">⚙️</span>
        </button>

        <div className={`actions-panel ${isPanelExpanded ? 'expanded' : ''}`}>
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
          <span className="btn-icon">👁️</span>
          <span className="btn-text">Details</span>
          </button>

          {championship.user_participation && (
          <>
            <button
            onClick={() => navigate(`/championships/${championship.id}?tab=my-matches`)}
            className="btn btn-secondary"
            data-tooltip="My Matches"
            >
            <span className="btn-icon">⚔️</span>
            <span className="btn-text">Matches</span>
            </button>
            <button
            disabled
            className="btn btn-info"
            data-tooltip="Already Registered"
            >
            <span className="btn-icon">✓</span>
            <span className="btn-text">Registered</span>
            </button>
          </>
          )}

          {!championship.user_participation && canRegister && (
          <button
            onClick={() => handleRegister(championship)}
            disabled={registeringId === championship.id}
            className="btn btn-success"
            data-tooltip="Register for Championship"
          >
            <span className="btn-icon">📋</span>
            <span className="btn-text">{registeringId === championship.id ? 'Registering...' : 'Register'}</span>
          </button>
          )}

          {isOrganizer && (
          <>
            <button
            onClick={() => {
              setEditingChampionship(championship);
              setShowEditModal(true);
            }}
            className="btn btn-secondary"
            data-tooltip="Edit Championship"
            >
            <span className="btn-icon">📝</span>
            <span className="btn-text">Edit</span>
            </button>
            <button
            onClick={() => navigate(`/championships/${championship.id}/admin`)}
            className="btn btn-admin"
            data-tooltip="Manage Championship"
            >
            <span className="btn-icon">⚙️</span>
            <span className="btn-text">Manage</span>
            </button>
            {championship.status !== 'in_progress' || (championship.status === 'in_progress' && championship.participants_count === 0) && (
            <button
              onClick={() => openConfirmationModal('archive', championship)}
              className="btn btn-warning"
              data-tooltip={championship.status === 'in_progress' && championship.participants_count === 0 ? "Archive Empty Championship" : "Archive Championship"}
            >
              <span className="btn-icon">📦</span>
              <span className="btn-text">
                {championship.status === 'in_progress' && championship.participants_count === 0 ? 'Archive Empty' : 'Archive'}
              </span>
            </button>
            )}
          </>
          )}
        </>
        )}
        </div>
        </div>
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

      {/* Edit Championship Modal */}
      <CreateChampionshipModal
        isOpen={showEditModal}
        championship={editingChampionship}
        onClose={() => {
          setShowEditModal(false);
          setEditingChampionship(null);
        }}
        onSuccess={(championship) => {
          // Refresh the championships list
          fetchChampionships(filtersMemo);
          setShowEditModal(false);
          setEditingChampionship(null);
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

      {/* Payment Modal */}
      {paymentModal.isOpen && paymentModal.championship && (
        <MockRazorpayPayment
          championship={paymentModal.championship}
          onSuccess={handlePaymentSuccess}
          onClose={closePaymentModal}
        />
      )}
    </div>
  );
};

export default ChampionshipList;