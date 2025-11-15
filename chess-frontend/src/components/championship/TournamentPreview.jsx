import React from 'react';
import './TournamentPreview.css';

const TournamentPreview = ({ preview, championship, onClose, onGenerate }) => {
  if (!preview) {
    return (
      <div className="tournament-preview-empty">
        <div className="empty-icon">📊</div>
        <h3>No Preview Available</h3>
        <p>Configure tournament settings to see preview</p>
      </div>
    );
  }

  const handleGenerateClick = () => {
    if (onGenerate) {
      onGenerate();
    }
  };

  return (
    <div className="tournament-preview">
      {/* Header */}
      <div className="preview-header">
        <div className="preview-title">
          <h3>🏆 Tournament Preview</h3>
          <p>{championship?.title}</p>
        </div>
        {onGenerate && (
          <button className="generate-btn" onClick={handleGenerateClick}>
            🚀 Generate Tournament
          </button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="preview-overview">
        <div className="overview-card primary">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <div className="card-value">{preview.total_rounds}</div>
            <div className="card-label">Total Rounds</div>
          </div>
        </div>

        <div className="overview-card secondary">
          <div className="card-icon">⚡</div>
          <div className="card-content">
            <div className="card-value">{preview.total_matches}</div>
            <div className="card-label">Total Matches</div>
          </div>
        </div>

        <div className="overview-card accent">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <div className="card-value">{preview.total_participants}</div>
            <div className="card-label">Participants</div>
          </div>
        </div>

        <div className="overview-card info">
          <div className="card-icon">📈</div>
          <div className="card-content">
            <div className="card-value">{preview.avg_matches_per_player?.toFixed(1) || 'N/A'}</div>
            <div className="card-label">Matches Per Player</div>
          </div>
        </div>
      </div>

      {/* Round Breakdown */}
      <div className="round-breakdown">
        <h4>📋 Round by Round Structure</h4>
        <div className="rounds-list">
          {preview.round_breakdown?.map((round, index) => (
            <div key={index} className="round-card">
              <div className="round-header">
                <div className="round-title">
                  <h5>{round.name || `Round ${round.round}`}</h5>
                  <div className="round-number">Round {round.round}</div>
                </div>
                <div className="round-stats">
                  <div className="stat">
                    <span className="stat-icon">👥</span>
                    <span className="stat-value">{round.participants}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon">🎯</span>
                    <span className="stat-value">{round.matches}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-value">{round.avg_matches_per_player?.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="round-details">
                <div className="detail-row">
                  <span className="detail-label">Selection:</span>
                  <span className="detail-value selection">{round.selection_rule_display}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Pairing:</span>
                  <span className="detail-value pairing">{round.pairing_method_display}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Density:</span>
                  <span className="detail-value density">{round.density_display}</span>
                </div>
                {round.description && (
                  <div className="detail-row">
                    <span className="detail-label">Notes:</span>
                    <span className="detail-value description">{round.description}</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="round-progress">
                <div
                  className="progress-fill"
                  style={{ width: `${(round.participants / preview.total_participants) * 100}%` }}
                ></div>
                <span className="progress-label">
                  {((round.participants / preview.total_participants) * 100).toFixed(0)}% of participants
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generation Details */}
      {preview.generation_estimate && (
        <div className="generation-details">
          <h4>⚙️ Generation Details</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-icon">⏱️</span>
              <div className="detail-info">
                <span className="detail-title">Estimated Time</span>
                <span className="detail-desc">{preview.generation_estimate.estimated_time || 'N/A'}</span>
              </div>
            </div>
            <div className="detail-item">
              <span className="detail-icon">🧠</span>
              <div className="detail-info">
                <span className="detail-title">Complexity</span>
                <span className="detail-desc">{preview.generation_estimate.complexity || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {preview.warnings && preview.warnings.length > 0 && (
        <div className="preview-warnings">
          <h4>⚠️ Warnings</h4>
          <ul className="warnings-list">
            {preview.warnings.map((warning, index) => (
              <li key={index} className="warning-item">
                <span className="warning-icon">⚠️</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="preview-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        {onGenerate && (
          <button className="btn btn-primary" onClick={handleGenerateClick}>
            🚀 Generate Tournament
          </button>
        )}
      </div>
    </div>
  );
};

export default TournamentPreview;