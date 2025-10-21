import React from 'react';
import './DetailedStatsModal.css';

const DetailedStatsModal = ({ isOpen, onClose, gameHistories, user }) => {
  if (!isOpen) return null;

  // Calculate statistics
  const totalGames = gameHistories.length;
  const wins = gameHistories.filter((g) => {
    const result = g.result?.toLowerCase() || '';
    return result.includes("win") && !result.includes("loss") && !result.includes("lost") && !result.includes("draw");
  }).length;
  const losses = gameHistories.filter((g) => {
    const result = g.result?.toLowerCase() || '';
    return result.includes("loss") || result.includes("lost");
  }).length;
  const draws = totalGames - wins - losses;

  // Sort games by date (newest first)
  const sortedGames = [...gameHistories].sort((a, b) => {
    const dateA = new Date(a.played_at || a.timestamp);
    const dateB = new Date(b.played_at || b.timestamp);
    return dateB - dateA;
  });

  return (
    <div className="detailed-stats-overlay" onClick={onClose}>
      <div className="detailed-stats-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="detailed-stats-header">
          <h2>📊 Detailed Game Statistics</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Summary Cards */}
        <div className="stats-summary">
          <div className="summary-card">
            <div className="summary-value">{totalGames}</div>
            <div className="summary-label">Total Games</div>
          </div>
          <div className="summary-card success">
            <div className="summary-value">{wins}</div>
            <div className="summary-label">Wins</div>
          </div>
          <div className="summary-card error">
            <div className="summary-value">{losses}</div>
            <div className="summary-label">Losses</div>
          </div>
          <div className="summary-card neutral">
            <div className="summary-value">{draws}</div>
            <div className="summary-label">Draws</div>
          </div>
          <div className="summary-card info">
            <div className="summary-value">{user?.rating || 1200}</div>
            <div className="summary-label">Current Rating</div>
          </div>
        </div>

        {/* Games Table */}
        <div className="stats-table-container">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Opponent</th>
                <th>Color</th>
                <th>Result</th>
                <th>Score</th>
                <th>Moves</th>
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game, index) => {
                const date = new Date(game.played_at || game.timestamp);
                const dateStr = date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                const timeStr = date.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const result = game.result || 'Unknown';
                const isWin = result.toLowerCase().includes("win") &&
                             !result.toLowerCase().includes("loss") &&
                             !result.toLowerCase().includes("lost") &&
                             !result.toLowerCase().includes("draw");
                const isLoss = result.toLowerCase().includes("loss") ||
                              result.toLowerCase().includes("lost");
                const isDraw = result.toLowerCase().includes("draw") ||
                              result.toLowerCase().includes("stalemate");

                const score = game.finalScore ?? game.final_score ?? game.score ?? 0;
                const opponent = game.opponent_name ||
                               (game.game_mode === 'computer' ? `Computer (Lv ${game.computer_level || game.computer_depth || 1})` : 'Unknown');

                const color = game.player_color === 'w' ? '⚪ White' : '⚫ Black';

                // Parse moves
                let moveCount = 0;
                if (game.moves) {
                  if (typeof game.moves === 'string') {
                    try {
                      const parsedMoves = JSON.parse(game.moves);
                      moveCount = Array.isArray(parsedMoves) ? parsedMoves.length : game.moves.split(';').length;
                    } catch {
                      moveCount = game.moves.split(';').length;
                    }
                  } else if (Array.isArray(game.moves)) {
                    moveCount = game.moves.length;
                  }
                }

                return (
                  <tr key={game.id || index} className={isWin ? 'row-win' : isLoss ? 'row-loss' : isDraw ? 'row-draw' : ''}>
                    <td>
                      <div className="date-cell">
                        <div className="date-main">{dateStr}</div>
                        <div className="date-time">{timeStr}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`mode-badge ${game.game_mode}`}>
                        {game.game_mode === 'computer' ? '🤖 Computer' : '👥 Multiplayer'}
                      </span>
                    </td>
                    <td>{opponent}</td>
                    <td>{color}</td>
                    <td>
                      <span className={`result-badge ${isWin ? 'win' : isLoss ? 'loss' : isDraw ? 'draw' : 'unknown'}`}>
                        {result}
                      </span>
                    </td>
                    <td className="score-cell">{typeof score === 'number' ? score.toFixed(1) : '0.0'}</td>
                    <td className="moves-cell">{moveCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DetailedStatsModal;
