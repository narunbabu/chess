import React, { useState, useEffect } from 'react';
import { formatDateTime } from '../../utils/championshipHelpers';
import '../../styles/UnifiedCards.css';

/**
 * TournamentManagementDashboard - Admin dashboard for tournament management
 * Provides comprehensive tournament oversight and control
 */
const TournamentManagementDashboard = ({ championship, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [generatingRound, setGeneratingRound] = useState(false);
  const [pairingsPreview, setPairingsPreview] = useState([]);

  useEffect(() => {
    loadTournamentData();
  }, [championship?.id]);

  const loadTournamentData = async () => {
    if (!championship?.id) return;

    setLoading(true);
    try {
      // In a real implementation, these would be API calls
      // await loadMatches();
      // await loadParticipants();
      // await loadInvitations();

      // Mock data for demonstration
      setMatches([
        {
          id: 1,
          round_number: 1,
          board_number: 1,
          white_player: { id: 1, name: 'Alice Johnson', rating: 1850 },
          black_player: { id: 2, name: 'Bob Smith', rating: 1780 },
          status: 'scheduled',
          scheduled_at: new Date().toISOString()
        },
        {
          id: 2,
          round_number: 1,
          board_number: 2,
          white_player: { id: 3, name: 'Carol Davis', rating: 1920 },
          black_player: { id: 4, name: 'David Wilson', rating: 1790 },
          status: 'pending_invitation',
          scheduled_at: new Date().toISOString()
        }
      ]);

      setParticipants([
        { id: 1, user_id: 1, user: { name: 'Alice Johnson', rating: 1850 }, payment_status: 'completed' },
        { id: 2, user_id: 2, user: { name: 'Bob Smith', rating: 1780 }, payment_status: 'completed' },
        { id: 3, user_id: 3, user: { name: 'Carol Davis', rating: 1920 }, payment_status: 'completed' },
        { id: 4, user_id: 4, user: { name: 'David Wilson', rating: 1790 }, payment_status: 'completed' },
      ]);

      setInvitations([
        {
          id: 1,
          championship_match_id: 2,
          status: 'pending',
          priority: 'normal',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      ]);
    } catch (error) {
      console.error('Failed to load tournament data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNextRound = async () => {
    setGeneratingRound(true);
    try {
      // API call to generate next round
      // await generateNextRound(championship.id, selectedRound);

      // Mock response
      const newMatches = [
        {
          id: 3,
          round_number: 2,
          board_number: 1,
          white_player: { id: 1, name: 'Alice Johnson', rating: 1850 },
          black_player: { id: 3, name: 'Carol Davis', rating: 1920 },
          status: 'pending',
          scheduled_at: new Date().toISOString()
        }
      ];

      setMatches(prev => [...prev, ...newMatches]);
      setGeneratingRound(false);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to generate next round:', error);
      setGeneratingRound(false);
    }
  };

  const handleSendInvitations = async (matchIds) => {
    try {
      // API call to send invitations
      // await sendChampionshipInvitations(championship.id, matchIds);
      console.log('Sending invitations for matches:', matchIds);
    } catch (error) {
      console.error('Failed to send invitations:', error);
    }
  };

  const getTournamentStats = () => {
    const totalParticipants = participants.length;
    const paidParticipants = participants.filter(p => p.payment_status === 'completed').length;
    const totalMatches = matches.length;
    const completedMatches = matches.filter(m => m.status === 'completed').length;
    const pendingInvitations = invitations.filter(inv => inv.status === 'pending').length;

    return {
      totalParticipants,
      paidParticipants,
      totalMatches,
      completedMatches,
      pendingInvitations,
      currentRound: Math.max(...matches.map(m => m.round_number), 0),
      totalRounds: championship?.total_rounds || 5
    };
  };

  const stats = getTournamentStats();

  const renderOverview = () => (
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
          <button onClick={loadTournamentData} className="btn btn-primary">
            🔄 Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default TournamentManagementDashboard;