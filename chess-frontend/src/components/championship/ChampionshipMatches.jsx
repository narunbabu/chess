// ChampionshipMatches.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, getMatchResultDisplay, getMatchStatusColor } from '../../utils/championshipHelpers';
import './Championship.css';

const ChampionshipMatches = ({ championshipId, userOnly = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchMatches, reportMatchResult, createGameFromMatch } = useChampionship();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterRound, setFilterRound] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [reportingMatch, setReportingMatch] = useState(null);
  const [creatingGame, setCreatingGame] = useState(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        round: filterRound,
        status: filterStatus,
        user_only: userOnly
      };
      if (userOnly && user) {
        params.user_id = user.id;
      }
      const data = await fetchMatches(championshipId, params);
      setMatches(data.data || data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [championshipId, filterRound, filterStatus, userOnly, user?.id]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleCreateGame = async (matchId) => {
    setCreatingGame(matchId);
    try {
      const response = await createGameFromMatch(matchId);
      // Navigate to the created game
      navigate(`/play/multiplayer/${response.game.id}`);
    } catch (error) {
      console.error('Failed to create game:', error);
      setError(error.response?.data?.message || 'Failed to create game');
    } finally {
      setCreatingGame(null);
    }
  };

  const handleReportResult = async (matchId, result) => {
    setReportingMatch(matchId);
    try {
      await reportMatchResult(matchId, result);
      await loadMatches(); // Refresh matches
    } catch (error) {
      console.error('Failed to report result:', error);
      setError(error.response?.data?.message || 'Failed to report result');
    } finally {
      setReportingMatch(null);
    }
  };

  const isUserParticipantInMatch = (match) => {
    return user && (match.white_player_id === user.id || match.black_player_id === user.id);
  };

  const canUserCreateGame = (match) => {
    return isUserParticipantInMatch(match) && match.status === 'scheduled' && !match.game_id;
  };

  const canUserReportResult = (match) => {
    return isUserParticipantInMatch(match) &&
           (match.status === 'active' || match.status === 'scheduled') &&
           !match.result;
  };

  const getOpponent = (match) => {
    if (!user) return null;
    return match.white_player_id === user.id ? match.black_player : match.white_player;
  };

  const getUserColor = (match) => {
    if (!user) return null;
    return match.white_player_id === user.id ? 'white' : 'black';
  };

  const ResultReportModal = ({ match, isOpen, onClose, onSubmit }) => {
    const [result, setResult] = useState('');
    const [details, setDetails] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!result) return;

      onSubmit(match.id, {
        result_type: result,
        details: details.trim()
      });
      onClose();
    };

    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>Report Match Result</h3>
            <button onClick={onClose} className="modal-close">×</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="result">Result *</label>
                <select
                  id="result"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Select Result</option>
                  <option value="win">I Won</option>
                  <option value="loss">I Lost</option>
                  <option value="draw">Draw</option>
                  <option value="forfeit_win">Won by Forfeit</option>
                  <option value="forfeit_loss">Lost by Forfeit</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="details">Additional Details</label>
                <textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Optional: Add any notes about the game"
                  rows={3}
                  className="form-input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={reportingMatch === match.id}
              >
                {reportingMatch === match.id ? 'Reporting...' : 'Submit Result'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const MatchCard = ({ match }) => {
    const opponent = getOpponent(match);
    const userColor = getUserColor(match);
    const isUserTurn = false; // This would need to be determined from game state

    return (
      <div className="match-card">
        <div className="match-header">
          <div className="match-players">
            <div className="player-info">
              <div className={`player-name ${match.white_player_id === user?.id ? 'current-user' : ''}`}>
                {match.white_player?.name || 'Unknown Player'}
                {match.white_player_id === user?.id && <span className="you-indicator">(You)</span>}
              </div>
              <div className="player-rating">{match.white_player?.rating || 'N/A'}</div>
            </div>

            <div className="vs-separator">VS</div>

            <div className="player-info">
              <div className={`player-name ${match.black_player_id === user?.id ? 'current-user' : ''}`}>
                {match.black_player?.name || 'Unknown Player'}
                {match.black_player_id === user?.id && <span className="you-indicator">(You)</span>}
              </div>
              <div className="player-rating">{match.black_player?.rating || 'N/A'}</div>
            </div>
          </div>

          <div className="match-meta">
            <span className={`match-status ${getMatchStatusColor(match.status)}`}>
              {match.status}
            </span>
            <span className="round-info">Round {match.round}, Board {match.board_number}</span>
          </div>
        </div>

        <div className="match-details">
          <div className="match-schedule">
            <span className="schedule-label">Scheduled:</span>
            <span className="schedule-time">
              {formatDateTime(match.scheduled_at)}
            </span>
          </div>

          {match.result && (
            <div className="match-result">
              <span className="result-label">Result:</span>
              <span className="result-value">
                {getMatchResultDisplay(match)}
              </span>
            </div>
          )}

          {match.game_id && (
            <div className="game-link">
              <button
                onClick={() => navigate(`/play/multiplayer/${match.game_id}`)}
                className="btn btn-primary btn-small"
              >
                {match.status === 'active' ? 'Continue Game' : 'Review Game'}
              </button>
            </div>
          )}
        </div>

        <div className="match-actions">
          {canUserCreateGame(match) && (
            <button
              onClick={() => handleCreateGame(match.id)}
              disabled={creatingGame === match.id}
              className="btn btn-success"
            >
              {creatingGame === match.id ? 'Creating...' : 'Start Game'}
            </button>
          )}

          {canUserReportResult(match) && (
            <ResultReportModal
              match={match}
              isOpen={reportingMatch === match.id}
              onClose={() => setReportingMatch(null)}
              onSubmit={handleReportResult}
            >
              <button
                onClick={() => setReportingMatch(match.id)}
                className="btn btn-primary"
              >
                Report Result
              </button>
            </ResultReportModal>
          )}

          {match.status === 'active' && !match.game_id && isUserParticipantInMatch(match) && (
            <div className="action-message">
              <span className="info-text">Waiting for game to be created...</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round]) {
      acc[match.round] = [];
    }
    acc[match.round].push(match);
    return acc;
  }, {});

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => b - a); // Show latest rounds first

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading matches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>❌ {error}</p>
        <button onClick={loadMatches} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="championship-matches">
      <div className="matches-header">
        <h2>{userOnly ? 'My Matches' : 'All Matches'}</h2>

        {!userOnly && (
          <div className="matches-filters">
            <select
              value={filterRound}
              onChange={(e) => setFilterRound(e.target.value)}
              className="filter-select"
            >
              <option value="">All Rounds</option>
              {rounds.map(round => (
                <option key={round} value={round}>Round {round}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <h3>{userOnly ? 'No matches found' : 'No matches scheduled yet'}</h3>
          <p>
            {userOnly
              ? 'You are not participating in any matches for this championship.'
              : 'Matches will be displayed here once the championship begins.'
            }
          </p>
        </div>
      ) : (
        <div className="matches-content">
          {rounds.map(round => (
            (filterRound === '' || parseInt(filterRound) === round) && (
              <div key={round} className="round-section">
                <h3 className="round-title">Round {round}</h3>
                <div className="matches-grid">
                  {matchesByRound[round]
                    .filter(match => filterStatus === '' || match.status === filterStatus)
                    .map(match => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default ChampionshipMatches;