import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; // Or your API service
import ChampionshipMatches from './ChampionshipMatches'; // Existing component
import { BACKEND_URL } from '../../config';
import './TournamentManagementDashboard.css';

const TournamentAdminDashboard = () => {
  const { id: championshipId } = useParams();
  const [championship, setChampionship] = useState(null);
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [pairingsPreview, setPairingsPreview] = useState([]);

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
  }, [championshipId]);

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

  return (
    <div className="tournament-admin-dashboard">
      <h2>Manage Tournament Matches</h2>

      {/* Championship Summary */}
      {championship && summary && (
        <div className="championship-summary">
          <h3>{championship.title}</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Format:</span>
              <span className="value">{championship.format}</span>
            </div>
            <div className="summary-item">
              <span className="label">Current Round:</span>
              <span className="value">{summary.current_round || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Next Round:</span>
              <span className="value">{summary.next_round_number || 1}</span>
            </div>
            <div className="summary-item">
              <span className="label">Participants:</span>
              <span className="value">{championship.participants_count || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Pending Matches:</span>
              <span className="value">{summary.matches?.pending || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Completed Matches:</span>
              <span className="value">{summary.matches?.completed || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Generate Matches Button */}
      <div className="admin-actions">
        <button
          onClick={openConfigDialog}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Loading...' : 'Generate Matches for Next Round'}
        </button>
        {error && <div className="error-message">{error}</div>}
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
      <ChampionshipMatches
        matches={matches}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default TournamentAdminDashboard;
