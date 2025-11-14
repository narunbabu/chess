import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import PairingPreview from './PairingPreview';
import ChampionshipMatches from './ChampionshipMatches';
import { formatDateTime } from '../../utils/championshipHelpers';
import '../../styles/UnifiedCards.css';

/**
 * TournamentManagementDashboard - Admin dashboard for tournament management
 * Provides comprehensive tournament oversight and control
 */
const TournamentManagementDashboard = ({ championship, onClose, onRefresh }) => {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Round management state
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [showPairingsPreview, setShowPairingsPreview] = useState(false);
  const [pairingsData, setPairingsData] = useState(null);
  const [pairingsLoading, setPairingsLoading] = useState(false);
  const [pairingsError, setPairingsError] = useState(null);

  // Match management state
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Tournament statistics state
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Participants state
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  // Additional state for dashboard functionality
  const [selectedRound, setSelectedRound] = useState(1);
  const [generatingRound, setGeneratingRound] = useState(false);

  useEffect(() => {
    if (championship?.id) {
      fetchTournamentOverview();
      if (activeTab === 'matches') {
        fetchMatches();
      } else if (activeTab === 'statistics') {
        fetchStats();
      } else if (activeTab === 'participants') {
        fetchParticipants();
      }
    }
  }, [championship?.id, activeTab]);

  const fetchTournamentOverview = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/championships/${championship.id}/stats`);
      if (response.data.success) {
        setStats(response.data.data);
        setCurrentRound(response.data.data.current_round || 1);
        setTotalRounds(response.data.data.total_rounds || championship.total_rounds);
      }
    } catch (err) {
      console.error('Failed to fetch tournament overview:', err);
      setError('Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      setMatchesLoading(true);
      const response = await axios.get(`${BACKEND_URL}/championships/${championship.id}/matches`);
      if (response.data.success) {
        setMatches(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      setError('Failed to load matches');
    } finally {
      setMatchesLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await axios.get(`${BACKEND_URL}/championships/${championship.id}/stats`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError('Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchParticipants = async () => {
    try {
      setParticipantsLoading(true);
      const response = await axios.get(`${BACKEND_URL}/championships/${championship.id}/participants`);
      if (response.data.success) {
        setParticipants(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch participants:', err);
      setError('Failed to load participants');
    } finally {
      setParticipantsLoading(false);
    }
  };

  // Preview pairings for next round
  const handlePreviewPairings = async (roundNumber = null) => {
    try {
      setPairingsLoading(true);
      setPairingsError(null);

      const token = localStorage.getItem('auth_token');
      const payload = roundNumber ? { round: roundNumber } : {};
      const response = await axios.post(
        `${BACKEND_URL}/championships/${championship.id}/matches/preview`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.round_number) {
        setPairingsData({
          roundNumber: response.data.round_number,
          pairings: response.data.pairings || [],
          summary: response.data.summary
        });
        setShowPairingsPreview(true);
      }
    } catch (err) {
      setPairingsError(err.response?.data?.error || 'Failed to preview pairings');
    } finally {
      setPairingsLoading(false);
    }
  };

  // Generate next round
  const handleGenerateRound = async (force = false) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${BACKEND_URL}/championships/${championship.id}/matches/schedule-next`,
        { force },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success || response.data.message) {
        alert(`✅ ${response.data.message}`);
        setShowPairingsPreview(false);
        setPairingsData(null);

        // Refresh data
        await fetchTournamentOverview();
        await fetchMatches();
        onRefresh?.();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to generate round';
      alert(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getTournamentStats = () => {
    if (!stats) {
      return {
        totalParticipants: 0,
        paidParticipants: 0,
        totalMatches: 0,
        completedMatches: 0,
        pendingInvitations: 0,
        currentRound: 0,
        totalRounds: championship?.total_rounds || 0,
        activeMatches: 0
      };
    }

    return {
      totalParticipants: stats.participant_count || 0,
      paidParticipants: participants.filter(p => p.payment_status === 'completed').length,
      totalMatches: stats.total_matches_count || 0,
      completedMatches: stats.completed_matches_count || 0,
      pendingInvitations: stats.pending_invitations_count || 0,
      currentRound: stats.current_round || 1,
      totalRounds: stats.total_rounds || championship?.total_rounds || 0,
      activeMatches: stats.active_matches_count || 0
    };
  };

  const stats = getTournamentStats();

  const renderOverview = () => (
    <div className="tournament-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalParticipants}</div>
            <div className="stat-label">Total Participants</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎮</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalMatches}</div>
            <div className="stat-label">Total Matches</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.completedMatches}</div>
            <div className="stat-label">Completed Matches</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{stats.activeMatches}</div>
            <div className="stat-label">Active Matches</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-value">Round {stats.currentRound}/{stats.totalRounds}</div>
            <div className="stat-label">Current Round</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <div className="stat-value">{championship?.time_control_minutes || 10}+{championship?.time_control_increment || 0}</div>
            <div className="stat-label">Time Control</div>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={() => handlePreviewPairings()}
            disabled={pairingsLoading || loading || stats.currentRound >= stats.totalRounds}
          >
            {pairingsLoading ? '🔄 Loading...' : '👁️ Preview Next Round'}
          </button>

          <button
            className="btn btn-success"
            onClick={() => handleGenerateRound(false)}
            disabled={loading || stats.currentRound >= stats.totalRounds}
          >
            {loading ? '⏳ Generating...' : '⚡ Generate Round'}
          </button>

          <button
            className="btn btn-warning"
            onClick={() => {
              if (confirm('Are you sure you want to force generate the next round? This bypasses all safety checks.')) {
                handleGenerateRound(true);
              }
            }}
            disabled={loading}
          >
            ⚠️ Force Generate
          </button>

          <button
            className="btn btn-info"
            onClick={() => setActiveTab('matches')}
          >
            ♟️ View Matches
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setActiveTab('participants')}
          >
            👥 Participants
          </button>
        </div>
      </div>
    </div>
  );
    <div className="tournament-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.paidParticipants}/{stats.totalParticipants}</div>
            <div className="stat-label">Participants (Paid/Total)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <div className="stat-value">{stats.completedMatches}/{stats.totalMatches}</div>
            <div className="stat-label">Matches (Completed/Total)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📨</div>
          <div className="stat-info">
            <div className="stat-value">{stats.pendingInvitations}</div>
            <div className="stat-label">Pending Invitations</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-value">Round {stats.currentRound}/{stats.totalRounds}</div>
            <div className="stat-label">Current Round</div>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={handleGenerateNextRound}
            disabled={generatingRound || stats.currentRound >= stats.totalRounds}
          >
            {generatingRound ? '⏳ Generating...' : '🎯 Generate Next Round'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleSendInvitations([2, 3])}
            disabled={matches.filter(m => m.status === 'pending').length === 0}
          >
            📨 Send Invitations
          </button>

          <button
            className="btn btn-info"
            onClick={() => setActiveTab('participants')}
          >
            👥 Manage Participants
          </button>

          <button
            className="btn btn-warning"
            onClick={() => setActiveTab('matches')}
          >
            ⚙️ Configure Settings
          </button>
        </div>
      </div>
    </div>
  );

  // Send invitations to players for specific matches
  const handleSendInvitations = async (matchIds) => {
    if (!championship?.id) {
      alert('❌ Championship not loaded');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      for (const matchId of matchIds) {
        const response = await axios.post(
          `${BACKEND_URL}/championships/${championship.id}/matches/${matchId}/send-invitation`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success || response.data.message) {
          console.log('✅ Invitations sent for match:', matchId, response.data.message);
        }
      }

      alert('✅ Invitations sent successfully!');

      // Refresh matches to update status
      await fetchMatches();
    } catch (error) {
      console.error('❌ Failed to send invitations:', error);
      const errorMessage = error.response?.data?.error || 'Failed to send invitations';
      alert(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate next round (legacy method - redirects to new implementation)
  const handleGenerateNextRound = async () => {
    // Use the existing round generation flow
    await handlePreviewPairings();
  };

  const renderMatches = () => {
    const roundMatches = matches.filter(m => m.round_number === selectedRound);
    const pendingMatches = roundMatches.filter(m => m.status === 'pending');

    return (
      <div className="matches-management">
        <div className="round-selector">
          <label htmlFor="round-select">View Round:</label>
          <select
            id="round-select"
            value={selectedRound}
            onChange={(e) => setSelectedRound(parseInt(e.target.value))}
            className="filter-select"
          >
            {[...Array(stats.totalRounds)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                Round {i + 1} {i + 1 === stats.currentRound && '(Current)'}
              </option>
            ))}
          </select>
        </div>

        <div className="matches-header">
          <h3>Round {selectedRound} Matches</h3>
          <div className="match-counts">
            <span>Total: {roundMatches.length}</span>
            <span>• Pending: {pendingMatches.length}</span>
            <span>• Completed: {roundMatches.filter(m => m.status === 'completed').length}</span>
          </div>
        </div>

        <div className="matches-grid">
          {roundMatches.map((match) => (
            <div key={match.id} className="match-card">
              <div className="match-header">
                <span className="board-number">Board {match.board_number}</span>
                <span className={`match-status ${match.status}`}>
                  {match.status.replace('_', ' ')}
                </span>
              </div>

              <div className="match-players">
                <div className="player-slot white">
                  <img
                    src={`https://i.pravatar.cc/150?u=${match.white_player?.id}`}
                    alt={match.white_player?.name}
                    className="player-avatar"
                  />
                  <div className="player-info">
                    <div className="player-name">{match.white_player?.name}</div>
                    <div className="player-rating">{match.white_player?.rating}</div>
                  </div>
                  <div className="player-color">♔</div>
                </div>

                <div className="vs-divider">VS</div>

                <div className="player-slot black">
                  <img
                    src={`https://i.pravatar.cc/150?u=${match.black_player?.id}`}
                    alt={match.black_player?.name}
                    className="player-avatar"
                  />
                  <div className="player-info">
                    <div className="player-name">{match.black_player?.name}</div>
                    <div className="player-rating">{match.black_player?.rating}</div>
                  </div>
                  <div className="player-color">♚</div>
                </div>
              </div>

              {match.scheduled_at && (
                <div className="match-schedule">
                  <small>Scheduled: {formatDateTime(match.scheduled_at)}</small>
                </div>
              )}

              <div className="match-actions">
                {match.status === 'pending' && (
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleSendInvitations([match.id])}
                  >
                    📨 Send Invitation
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderParticipants = () => (
    <div className="participants-management">
      <div className="participants-header">
        <h3>Tournament Participants</h3>
        <div className="participant-counts">
          <span>Total: {participants.length}</span>
          <span>• Paid: {stats.paidParticipants}</span>
          <span>• Unpaid: {participants.length - stats.paidParticipants}</span>
        </div>
      </div>

      <div className="participants-grid">
        {participants.map((participant) => (
          <div key={participant.id} className="participant-card">
            <div className="participant-header">
              <img
                src={`https://i.pravatar.cc/150?u=${participant.user?.email || participant.user_id}`}
                alt={participant.user?.name}
                className="participant-avatar"
              />
              <div className="participant-info">
                <div className="participant-name">{participant.user?.name}</div>
                <div className="participant-rating">Rating: {participant.user?.rating || 'N/A'}</div>
              </div>
            </div>

            <div className="participant-status">
              <span className={`payment-status ${participant.payment_status}`}>
                {participant.payment_status === 'completed' ? '✅ Paid' : '⏳ Unpaid'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderInvitations = () => (
    <div className="invitations-management">
      <div className="invitations-header">
        <h3>Championship Invitations</h3>
        <div className="invitation-counts">
          <span>Pending: {stats.pendingInvitations}</span>
          <span>• Total: {invitations.length}</span>
        </div>
      </div>

      <div className="invitations-grid">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="invitation-card">
            <div className="invitation-header">
              <span className="invitation-id">#{invitation.id}</span>
              <span className={`invitation-status ${invitation.status}`}>
                {invitation.status}
              </span>
            </div>

            <div className="invitation-details">
              <div className="invitation-match">
                Match ID: {invitation.championship_match_id}
              </div>
              <div className="invitation-priority">
                Priority: {invitation.priority}
              </div>
              <div className="invitation-time">
                Created: {formatDateTime(invitation.created_at)}
              </div>
              {invitation.expires_at && (
                <div className="invitation-expiry">
                  Expires: {formatDateTime(invitation.expires_at)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="tournament-settings">
      <h3>Tournament Settings</h3>
      <div className="settings-grid">
        <div className="setting-item">
          <label>Tournament Name</label>
          <input
            type="text"
            value={championship?.name || ''}
            className="form-input"
            readOnly
          />
        </div>

        <div className="setting-item">
          <label>Status</label>
          <input
            type="text"
            value={championship?.status || ''}
            className="form-input"
            readOnly
          />
        </div>

        <div className="setting-item">
          <label>Total Rounds</label>
          <input
            type="number"
            value={championship?.total_rounds || 0}
            className="form-input"
            readOnly
          />
        </div>

        <div className="setting-item">
          <label>Current Round</label>
          <input
            type="number"
            value={stats.currentRound}
            className="form-input"
            readOnly
          />
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn btn-primary">
          ⚙️ Advanced Settings
        </button>
        <button className="btn btn-secondary">
          📊 Export Data
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: '📊 Overview', component: renderOverview },
    { id: 'matches', label: '🎯 Matches', component: renderMatches },
    { id: 'participants', label: '👥 Participants', component: renderParticipants },
    { id: 'invitations', label: '📨 Invitations', component: renderInvitations },
    { id: 'settings', label: '⚙️ Settings', component: renderSettings }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal tournament-management-dashboard">
        <div className="modal-header">
          <h2>🏆 Tournament Management Dashboard</h2>
          <button onClick={onClose} className="modal-close" disabled={loading}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Tournament Header */}
          <div className="tournament-header">
            <h3>{championship?.name}</h3>
            <span className={`tournament-status ${championship?.status}`}>
              {championship?.status?.replace('_', ' ')}
            </span>
          </div>

          {/* Tabs Navigation */}
          <div className="dashboard-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {tabs.find(tab => tab.id === activeTab)?.component()}
          </div>

          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner">⏳ Loading...</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close Dashboard
          </button>
          <button onClick={() => {
            fetchTournamentOverview();
            if (activeTab === 'matches') fetchMatches();
            if (activeTab === 'participants') fetchParticipants();
          }} className="btn btn-primary">
            🔄 Refresh Data
          </button>
        </div>

        {/* Pairings Preview Modal */}
        {showPairingsPreview && (
          <div className="modal-overlay">
            <div className="modal pairing-preview-modal">
              <div className="modal-header">
                <h3>🎯 Round Pairings Preview</h3>
                <button onClick={() => {
                  setShowPairingsPreview(false);
                  setPairingsData(null);
                }} className="modal-close">
                  ×
                </button>
              </div>
              <div className="modal-content">
                <PairingPreview
                  championshipId={championship.id}
                  pairings={pairingsData?.pairings}
                  roundNumber={pairingsData?.roundNumber}
                  summary={pairingsData?.summary}
                  loading={pairingsLoading}
                  error={pairingsError}
                  onGenerateRound={() => handleGenerateRound(false)}
                  onCancel={() => {
                    setShowPairingsPreview(false);
                    setPairingsData(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button onClick={() => setError(null)} className="dismiss-error">×</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentManagementDashboard;