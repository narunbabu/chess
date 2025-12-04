// ChampionshipStandings.jsx
import React, { useState, useEffect } from 'react';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { sortStandings } from '../../utils/championshipHelpers';
import './Championship.css';

const ChampionshipStandings = ({ championshipId }) => {
  const { user } = useAuth();
  const { standings, fetchStandings, loading, error } = useChampionship();

  const [sortBy, setSortBy] = useState('rank'); // rank, points, name
  const [showTiebreaks, setShowTiebreaks] = useState(false);

  // Removed auto-fetch; now handled in context
  useEffect(() => {
    console.log('ChampionshipStandings: Mounted for championshipId:', championshipId);
  }, [championshipId]);

  const standingsArray = Array.isArray(standings) ? standings : [];
  const sortedStandings = sortStandings(standingsArray).map((standing, index) => ({
    ...standing,
    displayRank: sortBy === 'rank' ? standing.rank : index + 1
  }));

  const formatScore = (score) => {
    const numScore = parseFloat(score);
    return numScore % 1 === 0 ? numScore.toString() : numScore.toFixed(1);
  };

  const getPerformance = (standing) => {
    if (!standing.games_played || standing.games_played === 0) return 'N/A';
    const winRate = (standing.points / (standing.games_played * 1)) * 100;
    return `${Math.round(winRate)}%`;
  };

  const getCurrentStreak = (standing) => {
    if (!standing.current_streak) return '-';
    const streak = standing.current_streak;
    if (streak === 0) return '-';
    if (streak > 0) return `W${streak}`;
    return `L${Math.abs(streak)}`;
  };

  const isCurrentUser = (standing) => {
    return user && standing.player_id === user.id;
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading standings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>❌ {error}</p>
        <button onClick={() => fetchStandings(championshipId)} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="empty-state">
        <h3>No standings available</h3>
        <p>Standings will be displayed here once matches are completed.</p>
      </div>
    );
  }

  return (
    <div className="championship-standings">
      <div className="standings-header">
        <h2>📊 Tournament Standings</h2>

        <div className="standings-controls">
          <div className="sort-controls">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="rank">Rank</option>
              <option value="points">Points</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div className="toggle-controls">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showTiebreaks}
                onChange={(e) => setShowTiebreaks(e.target.checked)}
              />
              Show Tiebreak Details
            </label>
          </div>
        </div>
      </div>

      <div className="standings-table-container">
        <div className="standings-table">
          {/* Table Header */}
          <div className="standings-header-row">
            <div className="rank-cell">Rank</div>
            <div className="player-cell">Player</div>
            <div className="score-cell">Score</div>
            <div className="games-cell">Games</div>
            <div className="performance-cell">Performance</div>
            <div className="streak-cell">Streak</div>
            {showTiebreaks && (
              <>
                <div className="tiebreak-cell">Buchholz</div>
                <div className="tiebreak-cell">Sonneborn-Berger</div>
                <div className="tiebreak-cell">Rating</div>
              </>
            )}
          </div>

          {/* Table Body */}
          {sortedStandings.map((standing) => (
            <div
              key={standing.player_id}
              className={`standings-row ${isCurrentUser(standing) ? 'current-user-row' : ''}`}
            >
              <div className="rank-cell">
                <span className="rank-number">{standing.display_rank}</span>
                {standing.display_rank === 1 && <span className="medal">🥇</span>}
                {standing.display_rank === 2 && <span className="medal">🥈</span>}
                {standing.display_rank === 3 && <span className="medal">🥉</span>}
              </div>

              <div className="player-cell">
                <div className="player-info">
                  <div className="player-name">
                    {standing.player_name}
                    {isCurrentUser(standing) && (
                      <span className="you-indicator"> (You)</span>
                    )}
                  </div>
                  <div className="player-rating">{standing.player_rating}</div>
                </div>
              </div>

              <div className="score-cell">
                <span className="score-value">{formatScore(standing.points)}</span>
                <div className="score-breakdown">
                  {standing.wins}W-{standing.draws}D-{standing.losses}L
                </div>
              </div>

              <div className="games-cell">{standing.games_played}</div>

              <div className="performance-cell">
                <span className={`performance-value ${getPerformance(standing) === '100%' ? 'perfect' : ''}`}>
                  {getPerformance(standing)}
                </span>
              </div>

              <div className="streak-cell">
                <span className={`streak-value ${
                  standing.current_streak > 2 ? 'hot-streak' :
                  standing.current_streak < -2 ? 'cold-streak' : ''
                }`}>
                  {getCurrentStreak(standing)}
                </span>
              </div>

              {showTiebreaks && (
                <>
                  <div className="tiebreak-cell">
                    {formatScore(standing.tiebreak_points || 0)}
                  </div>
                  <div className="tiebreak-cell">
                    {formatScore(standing.sonnenborn_berger || 0)}
                  </div>
                  <div className="tiebreak-cell">
                    {standing.player_rating || 'N/A'}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Standings Legend */}
      <div className="standings-legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-symbol">W-D-L</span>
            <span className="legend-desc">Wins-Draws-Losses</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol">W3</span>
            <span className="legend-desc">3 game winning streak</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol">L2</span>
            <span className="legend-desc">2 game losing streak</span>
          </div>
          <div className="legend-item">
            <span className="legend-symbol">🥇🥈🥉</span>
            <span className="legend-desc">Top 3 positions</span>
          </div>
        </div>
      </div>

      {/* Tiebreaker Rules */}
      <div className="tiebreaker-rules">
        <h4>🏆 Tiebreaker Rules</h4>
        <p>When players have the same score, the following tiebreakers are applied in order:</p>
        <div className="tiebreaker-list">
          <div className="tiebreaker-item">
            <div className="tiebreaker-rank">1st</div>
            <div className="tiebreaker-details">
              <strong>Points</strong>
              <div className="tiebreaker-desc">Total tournament points (1 for win, 0.5 for draw, 0 for loss)</div>
            </div>
          </div>
          <div className="tiebreaker-item">
            <div className="tiebreaker-rank">2nd</div>
            <div className="tiebreaker-details">
              <strong>Buchholz Score</strong>
              <div className="tiebreaker-desc">Sum of all opponents' tournament points (higher is better)</div>
            </div>
          </div>
          <div className="tiebreaker-item">
            <div className="tiebreaker-rank">3rd</div>
            <div className="tiebreaker-details">
              <strong>Sonneborn-Berger Score</strong>
              <div className="tiebreaker-desc">Sum of opponents' points weighted by your result against them (higher is better)</div>
            </div>
          </div>
          <div className="tiebreaker-item">
            <div className="tiebreaker-rank">4th</div>
            <div className="tiebreaker-details">
              <strong>Initial Rating</strong>
              <div className="tiebreaker-desc">Player's rating at tournament start (higher rating wins ties)</div>
            </div>
          </div>
        </div>
        <div className="tiebreaker-note">
          <small>
            💡 <strong>Example:</strong> If two players both have 3 points, the player with the higher Buchholz score ranks above.
            If Buchholz scores are equal, Sonneborn-Berger decides, then rating as the final tiebreaker.
          </small>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="standings-summary">
        <h3>📈 Tournament Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Total Players</div>
            <div className="stat-value">{standingsArray.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Games Played</div>
            <div className="stat-value">
              {standingsArray.reduce((sum, s) => sum + (s.games_played || 0), 0)}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Average Score</div>
            <div className="stat-value">
              {standingsArray.length > 0 ? formatScore(
                standingsArray.reduce((sum, s) => sum + (s.points || 0), 0) / standingsArray.length
              ) : '0'}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Perfect Scores</div>
            <div className="stat-value">
              {standingsArray.filter(s => s.losses === 0 && s.games_played > 0).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChampionshipStandings;
