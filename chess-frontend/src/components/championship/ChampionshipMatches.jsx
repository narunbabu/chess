// ChampionshipMatches.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, getMatchResultDisplay, getMatchStatusColor } from '../../utils/championshipHelpers';
import './Championship.css';

const ChampionshipMatches = ({
  championshipId,
  userOnly = false,
  matches: initialMatches = [],
  loading: initialLoading = false,
  error: initialError = null
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [matches, setMatches] = useState(initialMatches);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState(initialError);
  const [filterRound, setFilterRound] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [reportingMatch, setReportingMatch] = useState(null);
  const [creatingGame, setCreatingGame] = useState(null);

  // If matches are passed as props, use them
  useEffect(() => {
    setMatches(initialMatches);
    setLoading(initialLoading);
    setError(initialError);
  }, [initialMatches, initialLoading, initialError]);

  const handleCreateGame = async (matchId) => {
    setCreatingGame(matchId);
    try {
      // TODO: Implement game creation API call
      console.log('Create game for match:', matchId);
      // const response = await createGameFromMatch(matchId);
      // navigate(`/play/multiplayer/${response.game.id}`);
    } catch (error) {
      console.error('Failed to create game:', error);
      setError('Failed to create game');
    } finally {
      setCreatingGame(null);
    }
  };

  const handleReportResult = async (matchId, result) => {
    setReportingMatch(matchId);
    try {
      // TODO: Implement result reporting API call
      console.log('Report result for match:', matchId, result);
      // await reportMatchResult(matchId, result);
      // await loadMatches(); // Refresh matches
    } catch (error) {
      console.error('Failed to report result:', error);
      setError('Failed to report result');
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
                {match.white_player ? match.white_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
                {match.white_player_id === user?.id && <span className="you-indicator">(You)</span>}
              </div>
              <div className="player-rating">{match.white_player?.rating || 'N/A'}</div>
            </div>

            <div className="vs-separator">VS</div>

            <div className="player-info">
              <div className={`player-name ${match.black_player_id === user?.id ? 'current-user' : ''}`}>
                {match.black_player ? match.black_player.name : (match.result_type === 'bye' ? 'Bye' : 'Unknown Player')}
                {match.black_player_id === user?.id && <span className="you-indicator">(You)</span>}
              </div>
              <div className="player-rating">{match.black_player?.rating || 'N/A'}</div>
            </div>
          </div>

          <div className="match-meta">
            <span className={`match-status ${getMatchStatusColor(match.status)}`}>
              {match.status}
            </span>
            <span className="round-info">
              Round {match.round_number || match.round || 1}
              {match.board_number && `, Board ${match.board_number}`}
            </span>
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

  // Transform matches to ensure consistent field names
  const transformMatch = (match) => {
    // Map player1/player2 to white_player/black_player based on color assignments
    let white_player = null;
    let black_player = null;

    if (match.white_player_id) {
      white_player = match.white_player_id === match.player1_id
        ? match.player1
        : match.player2;
    }

    if (match.black_player_id) {
      black_player = match.black_player_id === match.player1_id
        ? match.player1
        : match.player2;
    }

    return {
      ...match,
      white_player,
      black_player,
      round: match.round_number || match.round || 1
    };
  };

  // Group matches by round
  const matchesArray = Array.isArray(matches) ? matches : [];
  const transformedMatches = matchesArray.map(transformMatch);
  const matchesByRound = transformedMatches.reduce((acc, match) => {
    const roundNum = match.round_number || match.round || 1;
    if (!acc[roundNum]) {
      acc[roundNum] = [];
    }
    acc[roundNum].push(match);
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
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
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

      {transformedMatches.length === 0 ? (
        <div className="empty-state">
          <h3>{userOnly ? 'No matches found' : 'No matches created yet'}</h3>
          <p>
            {userOnly
              ? 'You are not participating in any matches for this championship.'
              : 'Click "Generate Matches for Next Round" to create the first round of matches.'
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
                  {(matchesByRound[round] || [])
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
