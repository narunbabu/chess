// ChampionshipDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatChampionshipStatus, formatChampionshipType, formatPrizePool, formatParticipantCount, calculateProgress, formatDateTime, canUserRegister, isUserOrganizer, calculateDaysRemaining, getStatusColorClass } from '../../utils/championshipHelpers';
import ChampionshipStandings from './ChampionshipStandings';
import ChampionshipMatches from './ChampionshipMatches';
import ChampionshipParticipants from './ChampionshipParticipants';
import ConfirmationModal from './ConfirmationModal';
import './Championship.css';

const ChampionshipDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeChampionship,
    participants,
    standings,
    loading,
    error,
    fetchChampionship,
    fetchParticipants,
    fetchStandings,
    registerForChampionship,
    startChampionship,
    deleteChampionship,
    restoreChampionship,
    forceDeleteChampionship
  } = useChampionship();

  const [activeTab, setActiveTab] = useState('overview');
  const [registering, setRegistering] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, type: null });

  // Check if user is platform admin
  const isPlatformAdmin = user?.roles?.some(role => role === 'platform_admin') || false;

  useEffect(() => {
    if (id) {
      console.log('ChampionshipDetails: Fetching data for championship', id);
      fetchChampionship(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRegister = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setRegistering(true);
    try {
      await registerForChampionship(id);
      await fetchChampionship(id);
      await fetchParticipants(id);
    } catch (error) {
      console.error('Registration failed:', error);

      // Check if user is already registered
      if (error.response?.status === 409 && error.response?.data?.error?.code === 'ALREADY_REGISTERED') {
        // Refresh the championship data to show correct registration status
        await fetchChampionship(id);
        await fetchParticipants(id);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleStartChampionship = async () => {
    if (!window.confirm('Are you sure you want to start this championship? This will generate the first round pairings.')) {
      return;
    }

    setStarting(true);
    try {
      await startChampionship(id);
      await fetchChampionship(id);
      setActiveTab('matches');
    } catch (error) {
      console.error('Failed to start championship:', error);
    } finally {
      setStarting(false);
    }
  };

  const handleArchive = async () => {
    try {
      await deleteChampionship(id);
      navigate('/championships');
    } catch (error) {
      console.error('Archive failed:', error);
      alert(error.response?.data?.message || 'Failed to archive championship');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreChampionship(id);
      await fetchChampionship(id);
      closeConfirmationModal();
    } catch (error) {
      console.error('Restore failed:', error);
      alert(error.response?.data?.message || 'Failed to restore championship');
    }
  };

  const handleForceDelete = async () => {
    try {
      await forceDeleteChampionship(id);
      navigate('/championships');
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.message || 'Failed to permanently delete championship');
    }
  };

  const openConfirmationModal = (type) => {
    setConfirmationModal({ isOpen: true, type });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({ isOpen: false, type: null });
  };

  const handleConfirmAction = async () => {
    switch (confirmationModal.type) {
      case 'archive':
        await handleArchive();
        break;
      case 'restore':
        await handleRestore();
        break;
      case 'delete':
        await handleForceDelete();
        break;
      default:
        break;
    }
  };

  if (loading && !activeChampionship) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading championship details...</p>
      </div>
    );
  }

  if (error && !activeChampionship) {
    return (
      <div className="error-state">
        <p>❌ {error}</p>
        <button onClick={() => fetchChampionship(id)} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (!activeChampionship) {
    return (
      <div className="error-state">
        <p>Championship not found</p>
        <button onClick={() => navigate('/championships')} className="btn btn-primary">
          Back to Championships
        </button>
      </div>
    );
  }

  const canRegister = canUserRegister(activeChampionship, user);
  const isOrganizer = isUserOrganizer(activeChampionship, user);
  const isRegistered = activeChampionship.user_participation;
  const isPaid = activeChampionship.user_status === 'paid';
  const progress = calculateProgress(activeChampionship);
  const daysRemaining = calculateDaysRemaining(activeChampionship.registration_end_at || activeChampionship.registration_deadline);

  const renderOverviewTab = () => (
    <div className="championship-overview">
      <div className="overview-grid">
        <div className="overview-section">
          <h3>📋 Description</h3>
          <p>{activeChampionship.description || 'No description provided.'}</p>
        </div>

        <div className="overview-section">
          <h3>🏆 Format & Rules</h3>
          <div className="format-details">
            <div className="detail-item">
              <span className="detail-label">Format:</span>
              <span className="detail-value">{formatChampionshipType(activeChampionship.format)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Time Control:</span>
              <span className="detail-value">
                {activeChampionship.time_control?.minutes || 'N/A'} min
                {activeChampionship.time_control?.increment > 0 && ` +${activeChampionship.time_control.increment}s`}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Total Rounds:</span>
              <span className="detail-value">{activeChampionship.total_rounds || 'N/A'}</span>
            </div>
            {activeChampionship.settings?.round_duration_days && (
              <div className="detail-item">
                <span className="detail-label">Round Duration:</span>
                <span className="detail-value">{activeChampionship.settings.round_duration_days} days</span>
              </div>
            )}
          </div>
        </div>

        {activeChampionship.prizes && activeChampionship.prizes.length > 0 && (
          <div className="overview-section">
            <h3>🎁 Prizes</h3>
            <div className="prize-breakdown">
              {activeChampionship.prizes.map((prize, index) => (
                <div key={index} className="prize-item">
                  <span className="prize-position">{prize.position}st</span>
                  <span className="prize-amount">${parseFloat(prize.amount || 0).toFixed(2)}</span>
                  {prize.description && <span className="prize-desc">{prize.description}</span>}
                </div>
              ))}
              <div className="total-prize">
                <strong>Total Prize Pool:</strong> {formatPrizePool(activeChampionship.prizes)}
              </div>
            </div>
          </div>
        )}

        <div className="overview-section">
          <h3>📅 Schedule</h3>
          <div className="schedule-details">
            <div className="date-item">
              <span className="date-label">Registration Period:</span>
              <span className="date-value">
                {formatDateTime(activeChampionship.registration_start_at)} - {formatDateTime(activeChampionship.registration_end_at || activeChampionship.registration_deadline)}
              </span>
            </div>
            <div className="date-item">
              <span className="date-label">Tournament Start:</span>
              <span className="date-value">{formatDateTime(activeChampionship.starts_at)}</span>
            </div>
            {daysRemaining && activeChampionship.status === 'registration_open' && (
              <div className="date-item urgency">
                <span className="date-value">{daysRemaining}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeChampionship.status === 'in_progress' && (
        <div className="progress-section">
          <h3>📊 Tournament Progress</h3>
          <div className="progress-bar-container">
            <div className="progress-info">
              <span>Round {activeChampionship.current_round || 0} of {activeChampionship.total_rounds}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="championship-details-container">
      {/* Championship Header */}
      <div className="championship-header">
        <button
          onClick={() => navigate('/championships')}
          className="btn btn-secondary back-btn"
        >
          ← Back
        </button>

        <div className="championship-title-section">
          <h1 className="championship-title">{activeChampionship.name}</h1>
          <div className="championship-meta">
            <span className={`championship-status ${getStatusColorClass(activeChampionship.status)}`}>
              {formatChampionshipStatus(activeChampionship.status)}
            </span>
            <span className="participant-count">
              {formatParticipantCount(activeChampionship.registered_count || activeChampionship.participants_count, activeChampionship.max_participants)}
            </span>
          </div>
        </div>

        <div className="championship-actions">
          {/* Register button - only show if user can register */}
          {canRegister && !isRegistered && (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="btn btn-success"
            >
              {registering ? 'Registering...' : 'Register'}
            </button>
          )}

          {/* Already registered button - show if user is registered */}
          {isRegistered && (
            <button
              disabled={true}
              className="btn btn-success"
              title={isPaid ? "You are registered and paid for this championship" : "You are registered for this championship"}
            >
              ✓ Already Registered
            </button>
          )}

          {/* My Matches button - show if user is registered */}
          {isRegistered && (
            <button
              onClick={() => setActiveTab('my-matches')}
              className="btn btn-primary"
            >
              My Matches
            </button>
          )}

          {/* Organizer actions */}
          {isOrganizer && activeChampionship.status === 'registration_open' && (
            <button
              onClick={handleStartChampionship}
              disabled={starting || (activeChampionship.registered_count || activeChampionship.participants_count) < 2}
              className="btn btn-admin"
            >
              {starting ? 'Starting...' : 'Start Championship'}
            </button>
          )}

          {isOrganizer && (
            <>
              <button
                onClick={() => navigate(`/championships/${id}/admin`)}
                className="btn btn-admin"
              >
                Manage Tournament
              </button>
              {activeChampionship.status !== 'in_progress' && !activeChampionship.deleted_at && (
                <button
                  onClick={() => openConfirmationModal('archive')}
                  className="btn btn-warning"
                  title="Archive this championship"
                >
                  📦 Archive
                </button>
              )}
              {activeChampionship.deleted_at && (
                <button
                  onClick={() => openConfirmationModal('restore')}
                  className="btn btn-success"
                  title="Restore this archived championship"
                >
                  ↺ Restore
                </button>
              )}
              {isPlatformAdmin && activeChampionship.deleted_at && activeChampionship.participants_count === 0 && (
                <button
                  onClick={() => openConfirmationModal('delete')}
                  className="btn btn-danger"
                  title="Permanently delete this championship"
                >
                  🗑️ Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action Messages */}
      {isOrganizer && activeChampionship.status === 'registration_open' && (activeChampionship.registered_count || activeChampionship.participants_count) < 2 && (
        <div className="warning-message">
          ⚠️ At least 2 participants are required to start the championship.
        </div>
      )}

      {/* Tabs */}
      <div className="championship-tabs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`tab ${activeTab === 'participants' ? 'active' : ''}`}
        >
          Participants ({activeChampionship.registered_count || activeChampionship.participants_count})
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`tab ${activeTab === 'standings' ? 'active' : ''}`}
          disabled={activeChampionship.status === 'registration_open'}
        >
          Standings
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
          disabled={activeChampionship.status === 'registration_open'}
        >
          Matches
        </button>
        {activeChampionship.user_participation && (
          <button
            onClick={() => setActiveTab('my-matches')}
            className={`tab ${activeTab === 'my-matches' ? 'active' : ''}`}
          >
            My Matches
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'participants' && <ChampionshipParticipants championshipId={id} participants={activeChampionship.participants || []} />}
        {activeTab === 'standings' && <ChampionshipStandings championshipId={id} />}
        {activeTab === 'matches' && <ChampionshipMatches championshipId={id} />}
        {activeTab === 'my-matches' && (
          <ChampionshipMatches championshipId={id} userOnly={true} />
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={closeConfirmationModal}
        onConfirm={handleConfirmAction}
        type={confirmationModal.type}
        championship={activeChampionship}
      />
    </div>
  );
};

export default ChampionshipDetails;
