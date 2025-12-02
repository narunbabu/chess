import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ChampionshipMatches from './ChampionshipMatches';
import ChampionshipConfigurationModal from './ChampionshipConfigurationModal';
import { BACKEND_URL } from '../../config';
import './ChampionshipManagementDashboard.css';

const ChampionshipManagementDashboard = () => {
  const { id: championshipId } = useParams();
  const navigate = useNavigate();
  const [championship, setChampionship] = useState(null);
  const [matches, setMatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [championshipStats, setChampionshipStats] = useState(null);

  // Fetch championship details
  const fetchChampionship = async () => {
    if (!championshipId) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/championships/${championshipId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setChampionship(response.data.championship);
    } catch (err) {
      console.error('Error fetching championship:', err);
      setError('Failed to fetch championship details');
    }
  };

  // Fetch matches
  const fetchMatches = async () => {
    if (!championshipId) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/championships/${championshipId}/matches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setMatches(response.data.matches || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
  };

  // Fetch participants
  const fetchParticipants = async () => {
    if (!championshipId) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/championships/${championshipId}/participants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setParticipants(response.data.participants || []);
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  };

  // Fetch championship statistics
  const fetchChampionshipStats = async () => {
    if (!championshipId) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${BACKEND_URL}/championships/${championshipId}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setChampionshipStats(response.data);
    } catch (err) {
      console.error('Error fetching championship stats:', err);
    }
  };

  // Generate pairings for next round
  const generatePairings = async (round = null) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/generate-pairings`,
        { round },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setMatches(response.data.matches || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate pairings');
    } finally {
      setLoading(false);
    }
  };

  // Update championship status
  const updateChampionshipStatus = async (newStatus) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/status`,
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      await fetchChampionship();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update championship status`);
    } finally {
      setLoading(false);
    }
  };

  // Remove participant
  const removeParticipant = async (participantId) => {
    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      await axios.delete(
        `${BACKEND_URL}/championships/${championshipId}/participants/${participantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      await fetchParticipants();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove participant');
    }
  };

  // Load initial data
  useEffect(() => {
    if (championshipId) {
      fetchChampionship();
      fetchMatches();
      fetchParticipants();
      fetchChampionshipStats();
    }
  }, [championshipId]);

  // Render loading state
  if (loading && !championship) {
    return (
      <div className="championship-management-loading">
        <div className="spinner"></div>
        <p>Loading championship management dashboard...</p>
      </div>
    );
  }

  // Render error state
  if (error && !championship) {
    return (
      <div className="championship-management-error">
        <h2>Error Loading Championship</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/championships')} className="btn-primary">
          Back to Championships
        </button>
      </div>
    );
  }

  return (
    <div className="championship-management-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="championship-info">
          <h1>{championship?.name || 'Championship Management'}</h1>
          <div className="championship-meta">
            <span className={`status-badge ${championship?.status}`}>
              {championship?.status?.replace('_', ' ') || 'Unknown'}
            </span>
            <span className="format-badge">
              {championship?.format?.replace('_', ' ') || 'Not set'}
            </span>
            <span className="participants-count">
              {participants.length} participants
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={() => navigate('/championships')}
            className="btn-secondary"
          >
            Back to List
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="btn-primary"
          >
            Configure
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="alert-close">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          Participants
        </button>
        <button
          className={`tab-button ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          Matches
        </button>
        <button
          className={`tab-button ${activeTab === 'pairings' ? 'active' : ''}`}
          onClick={() => setActiveTab('pairings')}
        >
          Pairings
        </button>
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-grid">
              {/* Championship Details */}
              <div className="overview-card">
                <h3>Championship Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Format:</label>
                    <span>{championship?.format?.replace('_', ' ') || 'Not set'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span>{championship?.status?.replace('_', ' ') || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Total Rounds:</label>
                    <span>{championship?.total_rounds || 'Not set'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Current Round:</label>
                    <span>{championship?.current_round || 0}</span>
                  </div>
                  <div className="detail-item">
                    <label>Registration Deadline:</label>
                    <span>
                      {championship?.registration_deadline
                        ? new Date(championship.registration_deadline).toLocaleDateString()
                        : 'Not set'
                      }
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Start Date:</label>
                    <span>
                      {championship?.starts_at
                        ? new Date(championship.starts_at).toLocaleDateString()
                        : 'Not set'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="overview-card">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  {championship?.status === 'upcoming' && (
                    <button
                      onClick={() => updateChampionshipStatus('registration_open')}
                      className="btn-success"
                      disabled={loading}
                    >
                      Open Registration
                    </button>
                  )}
                  {championship?.status === 'registration_open' && (
                    <button
                      onClick={() => updateChampionshipStatus('in_progress')}
                      className="btn-primary"
                      disabled={loading}
                    >
                      Start Championship
                    </button>
                  )}
                  {championship?.status === 'in_progress' && (
                    <button
                      onClick={() => updateChampionshipStatus('paused')}
                      className="btn-warning"
                      disabled={loading}
                    >
                      Pause Championship
                    </button>
                  )}
                  {championship?.status === 'paused' && (
                    <button
                      onClick={() => updateChampionshipStatus('in_progress')}
                      className="btn-primary"
                      disabled={loading}
                    >
                      Resume Championship
                    </button>
                  )}
                  <button
                    onClick={() => generatePairings()}
                    className="btn-secondary"
                    disabled={loading || championship?.status !== 'in_progress'}
                  >
                    Generate Next Round
                  </button>
                </div>
              </div>

              {/* Statistics Summary */}
              {championshipStats && (
                <div className="overview-card">
                  <h3>Statistics Summary</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <label>Total Matches:</label>
                      <span>{championshipStats.total_matches || 0}</span>
                    </div>
                    <div className="stat-item">
                      <label>Completed Matches:</label>
                      <span>{championshipStats.completed_matches || 0}</span>
                    </div>
                    <div className="stat-item">
                      <label>Pending Matches:</label>
                      <span>{championshipStats.pending_matches || 0}</span>
                    </div>
                    <div className="stat-item">
                      <label>Active Participants:</label>
                      <span>{championshipStats.active_participants || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="participants-tab">
            <div className="participants-header">
              <h3>Participants Management</h3>
              <div className="participants-actions">
                <button
                  onClick={() => navigate(`/championships/${championshipId}/register`)}
                  className="btn-primary"
                >
                  Add Participant
                </button>
                <button onClick={fetchParticipants} className="btn-secondary">
                  Refresh
                </button>
              </div>
            </div>
            <div className="participants-list">
              {participants.map((participant) => (
                <div key={participant.id} className="participant-card">
                  <div className="participant-info">
                    <h4>{participant.user?.name || 'Unknown User'}</h4>
                    <p>{participant.user?.email || ''}</p>
                    <div className="participant-stats">
                      <span>Score: {participant.score || 0}</span>
                      <span>Rank: {participant.rank || '-'}</span>
                    </div>
                  </div>
                  <div className="participant-actions">
                    <button className="btn-info">View Details</button>
                    {championship?.status === 'upcoming' && (
                      <button
                        onClick={() => removeParticipant(participant.id)}
                        className="btn-danger"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="matches-tab">
            <ChampionshipMatches
              championshipId={championshipId}
              matches={matches}
              onMatchesUpdate={setMatches}
              loading={loading}
              error={error}
            />
          </div>
        )}

        {activeTab === 'pairings' && (
          <div className="pairings-tab">
            <div className="pairings-header">
              <h3>Pairings Management</h3>
              <div className="pairings-actions">
                <input
                  type="number"
                  placeholder="Round number (optional)"
                  className="round-input"
                />
                <button
                  onClick={() => generatePairings()}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate Pairings'}
                </button>
              </div>
            </div>
            {/* Pairings preview would go here */}
            <div className="pairings-content">
              <p>Pairings generation interface</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-tab">
            <h3>Championship Statistics</h3>
            {/* Detailed statistics would go here */}
            <div className="stats-content">
              <p>Detailed statistics interface</p>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <ChampionshipConfigurationModal
          championship={championship}
          onClose={() => setShowConfigModal(false)}
          onSave={async (config) => {
            try {
              const token = localStorage.getItem('auth_token');
              await axios.put(
                `${BACKEND_URL}/championships/${championshipId}`,
                { ...championship, ...config },
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              await fetchChampionship();
              setShowConfigModal(false);
            } catch (err) {
              setError(err.response?.data?.message || 'Failed to update championship');
            }
          }}
        />
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}
    </div>
  );
};

export default ChampionshipManagementDashboard;