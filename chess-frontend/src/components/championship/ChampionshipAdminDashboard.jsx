import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Or your API service
import ChampionshipMatches from './ChampionshipMatches'; // Existing component
import ChampionshipConfigurationModal from './ChampionshipConfigurationModal';
import { BACKEND_URL } from '../../config';
import './ChampionshipManagementDashboard.css';

const ChampionshipAdminDashboard = () => {
  const { id: championshipId } = useParams();
  const navigate = useNavigate();
  const [championship, setChampionship] = useState(null);
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showChampionshipConfigModal, setShowChampionshipConfigModal] = useState(false);
  const [pairingsPreview, setPairingsPreview] = useState([]);
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
    }
  };

  // Fetch matches (existing logic)
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
      setMatches(response.data.matches || response.data || []);
    } catch (err) {
      console.error('Error fetching championship matches:', err);
    }
  };

  // Generate pairings (existing logic)
  const generatePairings = async (round = null) => {
    if (!championshipId) return;
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
      // Update the matches list with generated pairings
      setMatches(response.data.matches || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate pairings');
    } finally {
      setLoading(false);
    }
  };

  // Update championship status (start/pause/complete)
  const updateChampionshipStatus = async (newStatus) => {
    if (!championshipId) return;
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
      // Refresh championship data
      await fetchChampionship();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${newStatus} championship`);
    } finally {
      setLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    if (championshipId) {
      fetchChampionship();
      fetchMatches();
    }
  }, [championshipId]);

  // Show loading state
  if (loading && !championship) {
    return (
      <div className="championship-dashboard-loading">
        <div className="spinner"></div>
        <p>Loading championship data...</p>
      </div>
    );
  }

  // Show error state
  if (error && !championship) {
    return (
      <div className="championship-dashboard-error">
        <h3>Error Loading Championship</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/championships')}>
          Back to Championships
        </button>
      </div>
    );
  }

  // Main dashboard content
  return (
    <div className="championship-admin-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="championship-title">
          <h1>{championship?.name || 'Championship'}</h1>
          <span className={`status-badge ${championship?.status || 'unknown'}`}>
            {championship?.status || 'Unknown'}
          </span>
        </div>
        <div className="dashboard-actions">
          <button
            onClick={() => navigate('/championships')}
            className="btn-secondary"
          >
            Back to List
          </button>
          <button
            onClick={() => setShowChampionshipConfigModal(true)}
            className="btn-primary"
          >
            Configure Championship
          </button>
        </div>
      </div>

      {/* Championship Overview */}
      <div className="championship-overview">
        <div className="overview-card">
          <h3>Championship Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <label>Format:</label>
              <span>{championship?.format || 'Not set'}</span>
            </div>
            <div className="detail-item">
              <label>Participants:</label>
              <span>{championship?.participants_count || 0}</span>
            </div>
            <div className="detail-item">
              <label>Status:</label>
              <span>{championship?.status || 'Unknown'}</span>
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
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-card">
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
              Generate Next Round Pairings
            </button>
            <button
              onClick={() => navigate(`/championships/${championshipId}/participants`)}
              className="btn-info"
            >
              Manage Participants
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            className="close-alert"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Processing request...</p>
        </div>
      )}

      {/* Championship Configuration Modal */}
      {showChampionshipConfigModal && (
        <ChampionshipConfigurationModal
          championship={championship}
          onClose={() => setShowChampionshipConfigModal(false)}
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
              setShowChampionshipConfigModal(false);
            } catch (err) {
              setError(err.response?.data?.message || 'Failed to update championship');
            }
          }}
        />
      )}

      {/* Championship Matches Component */}
      <div className="matches-section">
        <ChampionshipMatches
          championshipId={championshipId}
          matches={matches}
          onMatchesUpdate={setMatches}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
};

export default ChampionshipAdminDashboard;