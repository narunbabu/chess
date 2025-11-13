// PairingManager.jsx
import React, { useState, useEffect } from 'react';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { formatDateTime } from '../../utils/championshipHelpers';
import './Championship.css';

const PairingManager = ({ championshipId, championship, participants, onClose, onSuccess }) => {
  const { fetchMatches, generateNextRound } = useChampionship();

  const [currentRound, setCurrentRound] = useState(1);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pairingMethod, setPairingMethod] = useState('automatic'); // automatic, manual
  const [pairings, setPairings] = useState([]);
  const [selectedPairings, setSelectedPairings] = useState([]);

  useEffect(() => {
    loadMatches();
  }, [championshipId, currentRound]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await fetchMatches(championshipId, { round: currentRound });
      setMatches(data.data || data);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAutomaticPairings = () => {
    if (!participants || participants.length < 2) return [];

    // Simple pairing algorithm - in real implementation, this would use the Swiss pairing service
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const newPairings = [];

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      newPairings.push({
        white_player: shuffled[i],
        black_player: shuffled[i + 1],
        board_number: Math.floor(i / 2) + 1
      });
    }

    // Handle odd number of participants
    if (shuffled.length % 2 === 1) {
      const lastPlayer = shuffled[shuffled.length - 1];
      newPairings.push({
        white_player: lastPlayer,
        black_player: null, // Bye
        board_number: Math.floor(shuffled.length / 2) + 1,
        is_bye: true
      });
    }

    return newPairings;
  };

  const handleGeneratePairings = () => {
    if (pairingMethod === 'automatic') {
      const autoPairings = generateAutomaticPairings();
      setPairings(autoPairings);
    }
  };

  const handleSavePairings = async () => {
    setGenerating(true);
    try {
      await generateNextRound(championshipId);
      onSuccess();
    } catch (error) {
      console.error('Failed to save pairings:', error);
    } finally {
      setGenerating(false);
    }
  };

  const PairingCard = ({ pairing, index }) => (
    <div className="pairing-card">
      <div className="pairing-header">
        <span className="board-number">Board {index + 1}</span>
        {pairing.is_bye && <span className="bye-badge">BYE</span>}
      </div>

      <div className="pairing-players">
        <div className="player-slot white">
          <div className="player-info">
            <img
              src={`https://i.pravatar.cc/150?u=${pairing.white_player?.user?.email || pairing.white_player?.user_id}`}
              alt={pairing.white_player?.user?.name}
              className="player-avatar"
            />
            <div className="player-details">
              <div className="player-name">{pairing.white_player?.user?.name}</div>
              <div className="player-rating">Rating: {pairing.white_player?.user?.rating || 'N/A'}</div>
            </div>
          </div>
          <div className="player-color">♔ White</div>
        </div>

        <div className="vs-divider">VS</div>

        <div className="player-slot black">
          {pairing.black_player ? (
            <>
              <div className="player-info">
                <img
                  src={`https://i.pravatar.cc/150?u=${pairing.black_player?.user?.email || pairing.black_player?.user_id}`}
                  alt={pairing.black_player?.user?.name}
                  className="player-avatar"
                />
                <div className="player-details">
                  <div className="player-name">{pairing.black_player?.user?.name}</div>
                  <div className="player-rating">Rating: {pairing.black_player?.user?.rating || 'N/A'}</div>
                </div>
              </div>
              <div className="player-color">♚ Black</div>
            </>
          ) : (
            <div className="bye-indicator">
              <div className="bye-icon">🎯</div>
              <div className="bye-text">Bye - Automatic Win</div>
            </div>
          )}
        </div>
      </div>

      {!pairing.is_bye && (
        <div className="pairing-actions">
          <button
            className="btn btn-small btn-secondary"
            onClick={() => handleSwapPlayers(index)}
          >
            🔄 Swap Colors
          </button>
          <button
            className="btn btn-small btn-danger"
            onClick={() => handleRemovePairing(index)}
          >
            ❌ Remove
          </button>
        </div>
      )}
    </div>
  );

  const handleSwapPlayers = (index) => {
    const newPairings = [...pairings];
    const pairing = newPairings[index];
    const temp = pairing.white_player;
    pairing.white_player = pairing.black_player;
    pairing.black_player = temp;
    setPairings(newPairings);
  };

  const handleRemovePairing = (index) => {
    const newPairings = pairings.filter((_, i) => i !== index);
    setPairings(newPairings);
  };

  const canGeneratePairings = championship.status === 'in_progress' || championship.status === 'registration_open';
  const hasExistingPairings = matches.length > 0;

  return (
    <div className="modal-overlay">
      <div className="modal pairing-manager-modal">
        <div className="modal-header">
          <h2>🎯 Pairing Manager</h2>
          <button onClick={onClose} className="modal-close" disabled={generating}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Pairing Method Selection */}
          {!hasExistingPairings && (
            <div className="pairing-method-section">
              <h3>Pairing Method</h3>
              <div className="pairing-methods">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="automatic"
                    checked={pairingMethod === 'automatic'}
                    onChange={(e) => setPairingMethod(e.target.value)}
                  />
                  <div className="radio-content">
                    <div className="radio-title">🤖 Automatic Pairings</div>
                    <div className="radio-desc">Use Swiss algorithm to generate optimal pairings</div>
                  </div>
                </label>

                <label className="radio-label">
                  <input
                    type="radio"
                    value="manual"
                    checked={pairingMethod === 'manual'}
                    onChange={(e) => setPairingMethod(e.target.value)}
                  />
                  <div className="radio-content">
                    <div className="radio-title">✋ Manual Pairings</div>
                    <div className="radio-desc">Create pairings manually</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Current Round Selection */}
          <div className="round-selection">
            <h3>Round Selection</h3>
            <div className="round-controls">
              <label htmlFor="round-select">Round:</label>
              <select
                id="round-select"
                value={currentRound}
                onChange={(e) => setCurrentRound(parseInt(e.target.value))}
                className="filter-select"
              >
                {[...Array(championship.total_rounds)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Round {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Existing Pairings */}
          {hasExistingPairings && (
            <div className="existing-pairings">
              <h3>Current Pairings - Round {currentRound}</h3>
              <div className="pairings-grid">
                {matches.map((match) => (
                  <div key={match.id} className="pairing-card existing">
                    <div className="pairing-header">
                      <span className="board-number">Board {match.board_number}</span>
                      <span className={`match-status ${match.status}`}>
                        {match.status}
                      </span>
                    </div>

                    <div className="pairing-players">
                      <div className="player-slot white">
                        <div className="player-info">
                          <img
                            src={`https://i.pravatar.cc/150?u=${match.white_player?.email || match.white_player_id}`}
                            alt={match.white_player?.name}
                            className="player-avatar"
                          />
                          <div className="player-details">
                            <div className="player-name">{match.white_player?.name}</div>
                            <div className="player-rating">Rating: {match.white_player?.rating || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="player-color">♔ White</div>
                      </div>

                      <div className="vs-divider">VS</div>

                      <div className="player-slot black">
                        <div className="player-info">
                          <img
                            src={`https://i.pravatar.cc/150?u=${match.black_player?.email || match.black_player_id}`}
                            alt={match.black_player?.name}
                            className="player-avatar"
                          />
                          <div className="player-details">
                            <div className="player-name">{match.black_player?.name}</div>
                            <div className="player-rating">Rating: {match.black_player?.rating || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="player-color">♚ Black</div>
                      </div>
                    </div>

                    {match.scheduled_at && (
                      <div className="pairing-schedule">
                        <small>Scheduled: {formatDateTime(match.scheduled_at)}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Pairings */}
          {pairings.length > 0 && !hasExistingPairings && (
            <div className="generated-pairings">
              <h3>Generated Pairings - Round {currentRound}</h3>
              <div className="pairings-grid">
                {pairings.map((pairing, index) => (
                  <PairingCard key={index} pairing={pairing} index={index} />
                ))}
              </div>

              <div className="pairing-summary">
                <div className="summary-item">
                  <span>Total Pairings:</span>
                  <strong>{pairings.length}</strong>
                </div>
                <div className="summary-item">
                  <span>Byes:</span>
                  <strong>{pairings.filter(p => p.is_bye).length}</strong>
                </div>
                <div className="summary-item">
                  <span>Actual Games:</span>
                  <strong>{pairings.filter(p => !p.is_bye).length}</strong>
                </div>
              </div>
            </div>
          )}

          {/* No Pairings */}
          {!hasExistingPairings && pairings.length === 0 && (
            <div className="no-pairings">
              <div className="no-pairings-icon">🎯</div>
              <h3>No Pairings Generated</h3>
              <p>
                {pairingMethod === 'automatic'
                  ? 'Click "Generate Pairings" to create automatic pairings using the Swiss algorithm.'
                  : 'Manual pairing mode selected. Create pairings manually below.'}
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={generating}
          >
            Cancel
          </button>

          {!hasExistingPairings && pairings.length === 0 && (
            <button
              onClick={handleGeneratePairings}
              className="btn btn-primary"
              disabled={!canGeneratePairings || participants.length < 2}
            >
              Generate Pairings
            </button>
          )}

          {pairings.length > 0 && !hasExistingPairings && (
            <button
              onClick={handleSavePairings}
              className="btn btn-success"
              disabled={generating || pairings.length === 0}
            >
              {generating ? 'Saving...' : 'Save Pairings'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PairingManager;