import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios'; // Or your API service
import ChampionshipMatches from './ChampionshipMatches'; // Existing component
import TournamentConfigurationModal from './TournamentConfigurationModal';
import { BACKEND_URL } from '../../config';
import './TournamentManagementDashboard.css';

const TournamentAdminDashboard = () => {
  const { id: championshipId } = useParams();
  const navigate = useNavigate();
  const [championship, setChampionship] = useState(null);
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showTournamentConfigModal, setShowTournamentConfigModal] = useState(false);
  const [pairingsPreview, setPairingsPreview] = useState([]);
  const [tournamentStats, setTournamentStats] = useState(null);

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
      setSummary(response.data.summary || null);
    } catch (err) {
      setError('Failed to fetch matches');
      console.error('Error fetching matches:', err);
    }
  };

  useEffect(() => {
    fetchChampionship();
    fetchMatches();
    fetchTournamentStats();
  }, [championshipId]);

  // Fetch tournament statistics
  const fetchTournamentStats = async () => {
    if (!championshipId) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${BACKEND_URL}/championships/${championshipId}/stats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setTournamentStats(response.data);
    } catch (err) {
      console.warn('Could not fetch tournament stats:', err);
      // Stats are optional, don't set error
    }
  };

  // Fetch pairings preview
  const fetchPairingsPreview = async () => {
    if (!championshipId) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${BACKEND_URL}/championships/${championshipId}/matches/pairings-preview`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setPairingsPreview(response.data.pairings || []);
      return response.data;
    } catch (err) {
      console.error('Error fetching pairings preview:', err);
      throw err;
    }
  };

  // Generate matches
  const handleGenerateMatches = async () => {
    if (!championshipId) {
      setError('Championship ID is missing');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/matches/schedule-next`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      // Backend returns: { message, round_number, matches_scheduled, summary }
      if (response.data && response.data.message) {
        const { message, round_number, matches_scheduled } = response.data;
        // Close dialog
        closeConfigDialog();
        // Show success message
        alert(`Success!\n\n${message}\n\nRound: ${round_number}\nMatches Created: ${matches_scheduled}`);
        // Refresh data
        fetchChampionship();
        fetchMatches();
      } else if (response.data.error) {
        setError(response.data.error);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to generate matches';
      setError(errorMsg);
      console.error('Error generating matches:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open configuration dialog
  const openConfigDialog = async () => {
    setError(null);
    setLoading(true);
    try {
      await fetchPairingsPreview();
      setShowConfigDialog(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load pairings preview');
    } finally {
      setLoading(false);
    }
  };

  // Close configuration dialog
  const closeConfigDialog = () => {
    setShowConfigDialog(false);
    setPairingsPreview([]);
  };

  // Handle full tournament generation
  const handleGenerateFullTournament = (preset = 'small_tournament') => {
    setShowTournamentConfigModal(true);
  };

  // Handle tournament generated callback
  const handleTournamentGenerated = (data) => {
    // Refresh all data
    fetchChampionship();
    fetchMatches();
    fetchTournamentStats();
  };

  // Determine recommended preset based on participant count
  const getRecommendedPreset = () => {
    const participantCount = championship?.participants_count || 0;
    if (participantCount <= 10) return 'small_tournament';
    if (participantCount <= 30) return 'medium_tournament';
    return 'large_tournament';
  };

  // Quick generate tournament
  const handleQuickGenerate = async () => {
    if (!championshipId) return;

    const preset = getRecommendedPreset();
    const isTournamentGenerated = championship?.tournament_generated;

    const confirmed = window.confirm(
      `⚡ Quick Generate Tournament\n\n` +
      `Preset: ${preset.replace('_', ' ').toUpperCase()}\n` +
      `Participants: ${championship?.participants_count || 0}\n` +
      `Rounds: ${championship?.total_rounds || 5}\n` +
      (isTournamentGenerated ? '\n⚠️ Tournament already exists. This will delete all existing matches and regenerate.\n' : '\n') +
      `This will generate all tournament rounds at once. Continue?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const payload = { preset };

      // Add force_regenerate if tournament already exists
      if (isTournamentGenerated) {
        payload.force_regenerate = true;
      }

      const response = await axios.post(
        `${BACKEND_URL}/championships/${championshipId}/generate-full-tournament`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.message) {
        const { message, summary } = response.data;
        alert(`✅ Tournament Generated Successfully!\n\n` +
              `Total Matches: ${summary?.total_matches || 'N/A'}\n` +
              `Total Rounds: ${summary?.total_rounds || 'N/A'}\n` +
              `Participants: ${summary?.total_participants || 'N/A'}`);

        handleTournamentGenerated(response.data);
      } else if (response.data?.error) {
        setError(response.data.error);
      }
    } catch (err) {
      let errorMsg = 'Failed to generate tournament';

      if (err.code === 'ERR_NETWORK') {
        errorMsg = 'Network Error: Unable to connect to the server. Please ensure the backend server is running.';
      } else if (err.response?.status === 401) {
        errorMsg = 'Authentication Error: Please log in again.';
      } else if (err.response?.status === 403) {
        errorMsg = 'Permission Error: You do not have permission to generate tournaments.';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }

      setError(errorMsg);
      console.error('Error generating tournament:', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        data: err.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  
  return (
    <div className="tournament-admin-dashboard">
      <h2>🏆 Tournament Management</h2>

      {/* Championship Summary */}
      {championship && (summary || tournamentStats) && (
        <div className="championship-summary">
          <h3>{championship.title}</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Format:</span>
              <span className="value">{championship.format}</span>
            </div>
            <div className="summary-item">
              <span className="label">Current Round:</span>
              <span className="value">{summary?.current_round || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Next Round:</span>
              <span className="value">{summary?.next_round_number || 1}</span>
            </div>
            <div className="summary-item">
              <span className="label">Participants:</span>
              <span className="value">{championship.participants_count || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Pending Matches:</span>
              <span className="value">{summary?.matches?.pending || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Completed Matches:</span>
              <span className="value">{summary?.matches?.completed || 0}</span>
            </div>
            {championship.tournament_generated && (
              <div className="summary-item generated">
                <span className="label">Tournament:</span>
                <span className="value">✅ Generated</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tournament Generation Section */}
      <div className="tournament-generation-section">
        <div className="section-header">
          <h3>🚀 Full Tournament Generation</h3>
          <div className="recommended-preset">
            Recommended: <strong>{getRecommendedPreset().replace('_', ' ').toUpperCase()}</strong>
          </div>
        </div>

        <div className="tournament-actions-grid">
          {/* Quick Generate Button */}
          <button
            onClick={handleQuickGenerate}
            disabled={loading || !championship?.participants_count}
            className="btn btn-success quick-generate-btn"
            title="Generate tournament with recommended preset"
          >
            <span className="btn-icon">⚡</span>
            <span className="btn-text">
              {loading ? 'Generating...' : (championship?.tournament_generated ? '🔄 Regenerate All Rounds' : 'Quick Generate All Rounds')}
            </span>
            <span className="btn-subtitle">
              {getRecommendedPreset().replace('_', ' ')} preset
            </span>
          </button>

          {/* Advanced Configuration Button */}
          <button
            onClick={() => handleGenerateFullTournament()}
            disabled={loading}
            className="btn btn-primary config-generate-btn"
            title="Configure tournament settings before generation"
          >
            <span className="btn-icon">⚙️</span>
            <span className="btn-text">
              {loading ? 'Loading...' : 'Configure & Generate'}
            </span>
            <span className="btn-subtitle">
              Custom tournament settings
            </span>
          </button>

          {/* Preview Tournament Button */}
          <button
            onClick={() => setShowTournamentConfigModal(true)}
            disabled={loading}
            className="btn btn-secondary preview-btn"
            title="Preview tournament structure"
          >
            <span className="btn-icon">👁️</span>
            <span className="btn-text">
              {loading ? 'Loading...' : 'Preview Tournament'}
            </span>
            <span className="btn-subtitle">
              See structure before generating
            </span>
          </button>
        </div>

        {championship?.tournament_generated && (
          <div className="tournament-status success">
            <span className="status-icon">✅</span>
            <div className="status-content">
              <strong>Tournament Already Generated</strong>
              <p>All rounds have been generated. You can regenerate if needed, which will replace all existing matches.</p>
            </div>
          </div>
        )}

        {!championship?.participants_count && (
          <div className="tournament-status warning">
            <span className="status-icon">⚠️</span>
            <div className="status-content">
              <strong>No Participants Yet</strong>
              <p>Wait for participants to register before generating the tournament.</p>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>

      {/* Legacy Single Round Generation */}
      <div className="legacy-generation-section">
        <div className="section-header">
          <h3>🎯 Single Round Generation (Legacy)</h3>
        </div>

        <button
          onClick={openConfigDialog}
          disabled={loading}
          className="btn btn-outline"
        >
          {loading ? 'Loading...' : 'Generate Next Round Only'}
        </button>
      </div>

      {/* Configuration Dialog */}
      {showConfigDialog && (
        <div className="dialog-overlay" onClick={closeConfigDialog}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3>Generate Matches - Round {summary?.next_round_number}</h3>

            <div className="dialog-body">
              <div className="config-section">
                <h4>Tournament Details</h4>
                <table className="config-table">
                  <tbody>
                    <tr>
                      <td><strong>Round Number:</strong></td>
                      <td>{summary?.next_round_number || 1}</td>
                    </tr>
                    <tr>
                      <td><strong>Eligible Participants:</strong></td>
                      <td>{championship?.participants_count || 0}</td>
                    </tr>
                    <tr>
                      <td><strong>Matches to Create:</strong></td>
                      <td>{pairingsPreview.length}</td>
                    </tr>
                    <tr>
                      <td><strong>Color Assignment:</strong></td>
                      <td>{championship?.color_assignment_method || 'balanced'}</td>
                    </tr>
                    <tr>
                      <td><strong>Time Control:</strong></td>
                      <td>
                        {championship?.time_control_minutes || championship?.time_control?.minutes || 10}
                        {championship?.time_control_increment > 0 || championship?.time_control?.increment > 0
                          ? `+${championship?.time_control_increment || championship?.time_control?.increment}`
                          : ''}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Match Window:</strong></td>
                      <td>{championship?.match_time_window_hours || 24} hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {pairingsPreview.length > 0 && (
                <div className="config-section">
                  <h4>Pairings Preview</h4>
                  <table className="pairings-table">
                    <thead>
                      <tr>
                        <th>Match</th>
                        <th>White</th>
                        <th>Black</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairingsPreview.map((pairing, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{pairing.player1?.name || `Player ${pairing.player1_id || 'Unknown'}`}</td>
                          <td>{pairing.player2?.name || `Player ${pairing.player2_id || 'Unknown'}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dialog-actions">
              <button
                onClick={handleGenerateMatches}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : 'Confirm & Generate Matches'}
              </button>
              <button
                onClick={closeConfigDialog}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display Matches */}
      <div className="matches-section">
        <div className="matches-section-header">
          <h3>All Matches</h3>
          <button
            onClick={() => navigate(`/championships/${championshipId}/matches/edit`)}
            className="btn btn-admin"
            title="Edit and manage matches"
          >
            <span className="btn-icon">✏️</span>
            <span className="btn-text">Edit Matches</span>
          </button>
        </div>
        <ChampionshipMatches
          matches={matches}
          loading={loading}
          error={error}
          onMatchDeleted={fetchMatches}
          championshipId={championshipId}
        />
      </div>

      {/* Tournament Configuration Modal */}
      <TournamentConfigurationModal
        championship={championship}
        isOpen={showTournamentConfigModal}
        onClose={() => setShowTournamentConfigModal(false)}
        onTournamentGenerated={handleTournamentGenerated}
        initialPreset={getRecommendedPreset()}
      />
    </div>
  );
};

export default TournamentAdminDashboard;
