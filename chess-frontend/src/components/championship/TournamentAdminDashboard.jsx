// TournamentAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatChampionshipStatus, formatDateTime, calculateProgress } from '../../utils/championshipHelpers';
import PairingManager from './PairingManager';
import TournamentSettings from './TournamentSettings';
import './Championship.css';

const TournamentAdminDashboard = () => {
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
    startChampionship,
    generateNextRound,
    updateChampionship
  } = useChampionship();

  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState({});
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchChampionship(id);
      fetchParticipants(id);
      fetchStandings(id);
    }
  }, [id, fetchChampionship, fetchParticipants, fetchStandings]);

  const handleStartChampionship = async () => {
    if (!window.confirm('Are you sure you want to start this championship? This will generate first round pairings.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, start: true }));
    try {
      await startChampionship(id);
      await fetchChampionship(id);
      await fetchStandings(id);
    } catch (error) {
      console.error('Failed to start championship:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, start: false }));
    }
  };

  const handleGenerateNextRound = async () => {
    if (!window.confirm('Generate pairings for the next round? This will advance the tournament.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, generate: true }));
    try {
      await generateNextRound(id);
      await fetchChampionship(id);
      await fetchStandings(id);
    } catch (error) {
      console.error('Failed to generate next round:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, generate: false }));
    }
  };

  const handlePauseChampionship = async () => {
    if (!window.confirm('Pause the championship? Players will not be able to start new games.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, pause: true }));
    try {
      await updateChampionship(id, { status: 'paused' });
      await fetchChampionship(id);
    } catch (error) {
      console.error('Failed to pause championship:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, pause: false }));
    }
  };

  const handleResumeChampionship = async () => {
    if (!window.confirm('Resume the championship? Players will be able to continue their games.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, resume: true }));
    try {
      await updateChampionship(id, { status: 'active' });
      await fetchChampionship(id);
    } catch (error) {
      console.error('Failed to resume championship:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, resume: false }));
    }
  };

  const handleCompleteChampionship = async () => {
    if (!window.confirm('Complete the championship? This will finalize all results and standings.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, complete: true }));
    try {
      await updateChampionship(id, { status: 'completed' });
      await fetchChampionship(id);
    } catch (error) {
      console.error('Failed to complete championship:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, complete: false }));
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading tournament dashboard...</p>
      </div>
    );
  }

  if (error) {
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

  const progress = calculateProgress(activeChampionship);
  const canStart = activeChampionship.status === 'registration_open' && participants.length >= 2;
  const canGenerateNext = activeChampionship.status === 'in_progress' &&
                         activeChampionship.current_round < activeChampionship.total_rounds;

  const AdminActionCard = ({ title, description, actions }) => (
    <div className="admin-action-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="admin-actions">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.handler}
            disabled={action.disabled || actionLoading[action.key]}
            className={`btn btn-${action.type || 'primary'}`}
          >
            {actionLoading[action.key] ? action.loadingText || 'Loading...' : action.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderOverviewTab = () => (
    <div className="admin-overview">
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{participants.length}</div>
            <div className="stat-label">Participants</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon">🎮</div>
          <div className="stat-content">
            <div className="stat-value">{activeChampionship.current_round || 0}/{activeChampionship.total_rounds}</div>
            <div className="stat-label">Current Round</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{Math.round(progress)}%</div>
            <div className="stat-label">Progress</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">
              ${participants.filter(p => p.payment_status === 'paid').length * (parseFloat(activeChampionship.entry_fee) || 0)}
            </div>
            <div className="stat-label">Collected Fees</div>
          </div>
        </div>
      </div>

      <div className="admin-actions-grid">
        {activeChampionship.status === 'registration_open' && (
          <AdminActionCard
            title="🚀 Start Tournament"
            description="Begin the championship and generate first round pairings."
            actions={[
              {
                key: 'start',
                label: 'Start Championship',
                type: 'success',
                handler: handleStartChampionship,
                disabled: !canStart,
                loadingText: 'Starting...'
              }
            ]}
          />
        )}

        {activeChampionship.status === 'in_progress' && (
          <AdminActionCard
            title="⚡ Round Management"
            description="Control tournament progression and generate next round pairings."
            actions={[
              {
                key: 'generate',
                label: 'Generate Next Round',
                type: 'primary',
                handler: handleGenerateNextRound,
                disabled: !canGenerateNext,
                loadingText: 'Generating...'
              },
              {
                key: 'pause',
                label: 'Pause Tournament',
                type: 'warning',
                handler: handlePauseChampionship,
                loadingText: 'Pausing...'
              }
            ]}
          />
        )}

        {activeChampionship.status === 'paused' && (
          <AdminActionCard
            title="▶️ Resume Tournament"
            description="Resume the paused championship."
            actions={[
              {
                key: 'resume',
                label: 'Resume Championship',
                type: 'success',
                handler: handleResumeChampionship,
                loadingText: 'Resuming...'
              }
            ]}
          />
        )}

        <AdminActionCard
          title="🔧 Tournament Management"
          description="Advanced tournament controls and settings."
          actions={[
            {
              label: 'Manage Pairings',
              type: 'primary',
              handler: () => setShowPairingModal(true)
            },
            {
              label: 'Tournament Settings',
              type: 'secondary',
              handler: () => setShowSettingsModal(true)
            }
          ]}
        />

        {(activeChampionship.status === 'in_progress' || activeChampionship.status === 'paused') && (
          <AdminActionCard
            title="🏁 Complete Tournament"
            description="Finalize the championship and declare winners."
            actions={[
              {
                key: 'complete',
                label: 'Complete Championship',
                type: 'danger',
                handler: handleCompleteChampionship,
                loadingText: 'Completing...'
              }
            ]}
          />
        )}
      </div>

      {/* Tournament Progress */}
      <div className="admin-progress-section">
        <h3>📈 Tournament Progress</h3>
        <div className="progress-details">
          <div className="progress-item">
            <span className="progress-label">Status:</span>
            <span className={`status-badge ${formatChampionshipStatus(activeChampionship.status).toLowerCase()}`}>
              {formatChampionshipStatus(activeChampionship.status)}
            </span>
          </div>
          <div className="progress-item">
            <span className="progress-label">Started:</span>
            <span className="progress-value">{formatDateTime(activeChampionship.started_at) || 'Not started'}</span>
          </div>
          <div className="progress-item">
            <span className="progress-label">Current Round:</span>
            <span className="progress-value">{activeChampionship.current_round || 0} of {activeChampionship.total_rounds}</span>
          </div>
        </div>

        {activeChampionship.status === 'in_progress' && (
          <div className="progress-bar-container">
            <div className="progress-info">
              <span>Tournament Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="tournament-admin-dashboard">
      {/* Admin Header */}
      <div className="admin-header">
        <button
          onClick={() => navigate(`/championships/${id}`)}
          className="btn btn-secondary back-btn"
        >
          ← Back to Championship
        </button>

        <div className="admin-title-section">
          <h1>🏆 Tournament Admin Dashboard</h1>
          <div className="admin-championship-info">
            <span className="championship-name">{activeChampionship.name}</span>
            <span className={`championship-status ${formatChampionshipStatus(activeChampionship.status).toLowerCase()}`}>
              {formatChampionshipStatus(activeChampionship.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="admin-tabs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`admin-tab ${activeTab === 'participants' ? 'active' : ''}`}
        >
          👥 Participants
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`admin-tab ${activeTab === 'matches' ? 'active' : ''}`}
        >
          🎮 Matches
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`admin-tab ${activeTab === 'standings' ? 'active' : ''}`}
        >
          🏆 Standings
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`}
        >
          📜 Activity Logs
        </button>
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'participants' && (
          <div className="admin-participants-view">
            <h3>Participant Management</h3>
            <p>View and manage tournament participants, payments, and registrations.</p>
            {/* Here you would integrate the ChampionshipParticipants component with admin controls */}
          </div>
        )}
        {activeTab === 'matches' && (
          <div className="admin-matches-view">
            <h3>Match Management</h3>
            <p>Monitor and manage all tournament matches, games, and results.</p>
            {/* Here you would integrate the ChampionshipMatches component with admin controls */}
          </div>
        )}
        {activeTab === 'standings' && (
          <div className="admin-standings-view">
            <h3>Standings & Results</h3>
            <p>View current standings and manage tiebreak calculations.</p>
            {/* Here you would integrate the ChampionshipStandings component with admin controls */}
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="admin-logs-view">
            <h3>Activity Logs</h3>
            <p>View tournament activity, system events, and audit logs.</p>
            {/* Activity logs component would go here */}
          </div>
        )}
      </div>

      {/* Modals */}
      {showPairingModal && (
        <PairingManager
          championshipId={id}
          championship={activeChampionship}
          participants={participants}
          onClose={() => setShowPairingModal(false)}
          onSuccess={() => {
            setShowPairingModal(false);
            fetchChampionship(id);
            fetchStandings(id);
          }}
        />
      )}

      {showSettingsModal && (
        <TournamentSettings
          championship={activeChampionship}
          onClose={() => setShowSettingsModal(false)}
          onSuccess={(updated) => {
            setShowSettingsModal(false);
            fetchChampionship(id);
          }}
        />
      )}
    </div>
  );
};

export default TournamentAdminDashboard;