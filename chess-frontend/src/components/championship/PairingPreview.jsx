import React, { useState } from 'react';
import axios from 'axios';

const PairingPreview = ({
  championshipId,
  pairings,
  roundNumber,
  summary,
  loading,
  error,
  onGenerateRound,
  onCancel
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateRound = async () => {
    setIsGenerating(true);
    try {
      await onGenerateRound();
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="pairing-preview loading">
        <div className="loading-spinner">Loading pairings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pairing-preview error">
        <div className="error-message">
          <h4>❌ Preview Error</h4>
          <p>{error}</p>
        </div>
        <div className="actions">
          <button onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!pairings || pairings.length === 0) {
    return (
      <div className="pairing-preview empty">
        <h4>🎯 Round {roundNumber} Pairings Preview</h4>
        <div className="no-pairings">
          <p>No pairings available for this round.</p>
          <p>This could be because:</p>
          <ul>
            <li>All rounds have been completed</li>
            <li>Not enough participants for pairings</li>
            <li>Round requirements not met</li>
          </ul>
        </div>
        <div className="actions">
          <button onClick={onCancel} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pairing-preview">
      <div className="preview-header">
        <h4>🎯 Round {roundNumber} Pairings Preview</h4>
        {summary && (
          <div className="summary">
            <span className="total-pairings">{pairings.length} pairings</span>
            {summary.byes && <span className="byes">{summary.byes} byes</span>}
          </div>
        )}
      </div>

      <div className="pairings-list">
        {pairings.map((pairing, index) => (
          <div key={`${pairing.player1_id}-${pairing.player2_id}-${index}`} className="pairing-item">
            <div className="pairing-position">{index + 1}.</div>

            <div className="player-info player1">
              <div className="player-name">
                {pairing.player1?.name || `Player ${pairing.player1_id}`}
              </div>
              {pairing.player1_score !== undefined && (
                <div className="player-score">Score: {pairing.player1_score}</div>
              )}
              {pairing.player1_color && (
                <div className={`color-indicator ${pairing.player1_color}`}>
                  {pairing.player1_color === 'w' ? '♔ White' : '♚ Black'}
                </div>
              )}
            </div>

            <div className="vs-divider">VS</div>

            <div className="player-info player2">
              <div className="player-name">
                {pairing.player2?.name || `Player ${pairing.player2_id}`}
              </div>
              {pairing.player2_score !== undefined && (
                <div className="player-score">Score: {pairing.player2_score}</div>
              )}
              {pairing.player2_color && (
                <div className={`color-indicator ${pairing.player2_color}`}>
                  {pairing.player2_color === 'w' ? '♔ White' : '♚ Black'}
                </div>
              )}
            </div>

            {pairing.is_elimination && (
              <div className="match-type elimination">
                🏆 Elimination
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="actions">
        <button
          onClick={handleGenerateRound}
          disabled={isGenerating}
          className="btn btn-primary"
        >
          {isGenerating ? 'Generating Round...' : `⚡ Generate Round ${roundNumber}`}
        </button>
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>

      <div className="warning-note">
        <p>⚠️ Once generated, matches will be created and players will receive invitations.</p>
        <p>Please review the pairings carefully before confirming.</p>
      </div>
    </div>
  );
};

export default PairingPreview;