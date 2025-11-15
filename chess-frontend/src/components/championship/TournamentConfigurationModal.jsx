import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../config';
import './TournamentConfigurationModal.css';

const TournamentConfigurationModal = ({
  championship,
  isOpen,
  onClose,
  onTournamentGenerated,
  initialPreset = null
}) => {
  const [activeTab, setActiveTab] = useState('presets');
  const [selectedPreset, setSelectedPreset] = useState(initialPreset || 'small_tournament');
  const [customConfig, setCustomConfig] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Preset definitions
  const presets = {
    small_tournament: {
      name: 'Small Tournament',
      description: '3-10 participants, focused round-robin',
      icon: '🎯',
      rounds: 5,
      participants: { min: 3, max: 10 }
    },
    medium_tournament: {
      name: 'Medium Tournament',
      description: '11-30 participants, progressive elimination',
      icon: '🏆',
      rounds: 5,
      participants: { min: 11, max: 30 }
    },
    large_tournament: {
      name: 'Large Tournament',
      description: '31+ participants, elimination focused',
      icon: '👑',
      rounds: 5,
      participants: { min: 31, max: 100 }
    }
  };

  // Initialize custom config template
  useEffect(() => {
    if (isOpen) {
      const participantCount = championship?.participants_count || 0;
      setCustomConfig({
        mode: 'adaptive',
        total_rounds: championship?.total_rounds || 5,
        max_participants: Math.max(participantCount, championship?.max_participants || 10),
        round_structure: [
          {
            round_number: 1,
            name: 'Round 1',
            selection_rule: 'all_participants',
            matches_per_player: 2,
            pairing_method: 'random_seeded',
            description: 'All participants play'
          },
          {
            round_number: 2,
            name: 'Round 2',
            selection_rule: 'all_participants',
            matches_per_player: 1,
            pairing_method: 'rating_based',
            description: 'All participants play'
          }
        ],
        avoid_repeat_matches: true,
        color_balance_strict: true,
        bye_handling: 'give_points',
        bye_points: 0.5
      });
    }
  }, [isOpen, championship]);

  // Load preview when configuration changes
  useEffect(() => {
    if (isOpen && (selectedPreset || customConfig)) {
      loadPreview();
    }
  }, [selectedPreset, customConfig, isOpen]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const payload = activeTab === 'presets'
        ? { preset: selectedPreset }
        : { config: customConfig };

      const response = await fetch(
        `${BACKEND_URL}/championships/${championship.id}/tournament-preview`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load preview');
      }

      const params = new URLSearchParams();
      if (activeTab === 'presets') {
        params.append('preset', selectedPreset);
      }

      const previewResponse = await fetch(
        `${BACKEND_URL}/championships/${championship.id}/tournament-preview?${params}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await previewResponse.json();
      setPreview(data.preview);
    } catch (err) {
      setError(err.message || 'Failed to load tournament preview');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTournament = async (forceRegenerate = false) => {
    setGenerating(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const payload = activeTab === 'presets'
        ? { preset: selectedPreset, force_regenerate: forceRegenerate }
        : { config: customConfig, force_regenerate: forceRegenerate };

      const response = await fetch(
        `${BACKEND_URL}/championships/${championship.id}/generate-full-tournament`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate tournament');
      }

      const data = await response.json();

      // Success!
      alert(`✅ Tournament Generated Successfully!\n\n` +
            `Total Matches: ${data.summary.total_matches}\n` +
            `Total Rounds: ${data.summary.total_rounds}\n` +
            `Participants: ${data.summary.total_participants}\n\n` +
            `Matches per round:\n` +
            data.summary.round_breakdown?.map(r => `Round ${r.round}: ${r.matches} matches`).join('\n'));

      onTournamentGenerated?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const updateCustomConfigRound = (roundIndex, field, value) => {
    const newConfig = { ...customConfig };
    newConfig.round_structure[roundIndex] = {
      ...newConfig.round_structure[roundIndex],
      [field]: value
    };
    setCustomConfig(newConfig);
  };

  const addCustomConfigRound = () => {
    const newConfig = { ...customConfig };
    const nextRound = newConfig.round_structure.length + 1;
    newConfig.round_structure.push({
      round_number: nextRound,
      name: `Round ${nextRound}`,
      selection_rule: 'all_participants',
      matches_per_player: 1,
      pairing_method: 'random',
      description: 'New round configuration'
    });
    newConfig.total_rounds = nextRound;
    setCustomConfig(newConfig);
  };

  const removeCustomConfigRound = (roundIndex) => {
    const newConfig = { ...customConfig };
    newConfig.round_structure.splice(roundIndex, 1);
    // Re-number rounds
    newConfig.round_structure.forEach((round, index) => {
      round.round_number = index + 1;
      round.name = `Round ${index + 1}`;
    });
    newConfig.total_rounds = newConfig.round_structure.length;
    setCustomConfig(newConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="tournament-config-modal-overlay" onClick={onClose}>
      <div className="tournament-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tournament-config-header">
          <h2>🏆 Tournament Configuration</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tournament-config-tabs">
          <button
            className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            🎯 Quick Presets
          </button>
          <button
            className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            ⚙️ Custom Config
          </button>
          <button
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={!preview}
          >
            📊 Preview
          </button>
        </div>

        <div className="tournament-config-content">
          {/* Presets Tab */}
          {activeTab === 'presets' && (
            <div className="presets-tab">
              <div className="championship-info">
                <h3>{championship?.title}</h3>
                <p>Participants: {championship?.participants_count || 0} |
                   Max: {championship?.max_participants || 'Unlimited'} |
                   Rounds: {championship?.total_rounds || 5}</p>
              </div>

              <div className="presets-grid">
                {Object.entries(presets).map(([key, preset]) => {
                  const participantCount = championship?.participants_count || 0;
                  const isRecommended = participantCount >= preset.participants.min &&
                                       participantCount <= preset.participants.max;

                  return (
                    <div
                      key={key}
                      className={`preset-card ${selectedPreset === key ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
                      onClick={() => setSelectedPreset(key)}
                    >
                      <div className="preset-icon">{preset.icon}</div>
                      <div className="preset-name">{preset.name}</div>
                      <div className="preset-description">{preset.description}</div>
                      <div className="preset-details">
                        <span>👥 {preset.participants.min}-{preset.participants.max} players</span>
                        <span>🔄 {preset.rounds} rounds</span>
                      </div>
                      {isRecommended && (
                        <div className="preset-badge">Recommended</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedPreset && (
                <div className="preset-selection">
                  <h4>Selected: {presets[selectedPreset].name} {presets[selectedPreset].icon}</h4>
                  <p>{presets[selectedPreset].description}</p>
                </div>
              )}
            </div>
          )}

          {/* Custom Config Tab */}
          {activeTab === 'custom' && (
            <div className="custom-config-tab">
              <div className="config-section">
                <h4>Basic Settings</h4>
                <div className="config-grid">
                  <div className="config-field">
                    <label>Tournament Mode</label>
                    <select
                      value={customConfig?.mode || 'adaptive'}
                      onChange={(e) => setCustomConfig({...customConfig, mode: e.target.value})}
                    >
                      <option value="adaptive">Adaptive</option>
                      <option value="elimination">Elimination</option>
                      <option value="round_robin">Round Robin</option>
                      <option value="swiss">Swiss System</option>
                    </select>
                  </div>
                  <div className="config-field">
                    <label>Total Rounds</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={customConfig?.total_rounds || 5}
                      onChange={(e) => setCustomConfig({...customConfig, total_rounds: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="config-field">
                    <label>Max Participants</label>
                    <input
                      type="number"
                      min="2"
                      max="1000"
                      value={customConfig?.max_participants || 10}
                      onChange={(e) => setCustomConfig({...customConfig, max_participants: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              <div className="config-section">
                <div className="section-header">
                  <h4>Round Structure</h4>
                  <button className="add-round-btn" onClick={addCustomConfigRound}>
                    + Add Round
                  </button>
                </div>

                {customConfig?.round_structure?.map((round, index) => (
                  <div key={index} className="round-config">
                    <div className="round-header">
                      <h5>Round {round.round_number}</h5>
                      {customConfig.round_structure.length > 1 && (
                        <button
                          className="remove-round-btn"
                          onClick={() => removeCustomConfigRound(index)}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div className="config-grid">
                      <div className="config-field">
                        <label>Round Name</label>
                        <input
                          type="text"
                          value={round.name || ''}
                          onChange={(e) => updateCustomConfigRound(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="config-field">
                        <label>Participant Selection</label>
                        <select
                          value={round.selection_rule || 'all_participants'}
                          onChange={(e) => updateCustomConfigRound(index, 'selection_rule', e.target.value)}
                        >
                          <option value="all_participants">All Participants</option>
                          <option value="top_k">Top K Players</option>
                          <option value="top_percent">Top Percentage</option>
                          <option value="qualified">Qualified Players</option>
                        </select>
                      </div>
                      <div className="config-field">
                        <label>Matches Per Player</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={round.matches_per_player || 1}
                          onChange={(e) => updateCustomConfigRound(index, 'matches_per_player', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="config-field">
                        <label>Pairing Method</label>
                        <select
                          value={round.pairing_method || 'random'}
                          onChange={(e) => updateCustomConfigRound(index, 'pairing_method', e.target.value)}
                        >
                          <option value="random">Random</option>
                          <option value="random_seeded">Random Seeded</option>
                          <option value="rating_based">Rating Based</option>
                          <option value="standings_based">Standings Based</option>
                          <option value="direct_pairing">Direct Pairing</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="config-section">
                <h4>Advanced Settings</h4>
                <div className="config-grid">
                  <div className="config-field checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={customConfig?.avoid_repeat_matches || false}
                        onChange={(e) => setCustomConfig({...customConfig, avoid_repeat_matches: e.target.checked})}
                      />
                      Avoid Repeat Matches
                    </label>
                  </div>
                  <div className="config-field checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={customConfig?.color_balance_strict || false}
                        onChange={(e) => setCustomConfig({...customConfig, color_balance_strict: e.target.checked})}
                      />
                      Strict Color Balance
                    </label>
                  </div>
                  <div className="config-field">
                    <label>Bye Handling</label>
                    <select
                      value={customConfig?.bye_handling || 'give_points'}
                      onChange={(e) => setCustomConfig({...customConfig, bye_handling: e.target.value})}
                    >
                      <option value="give_points">Give Points</option>
                      <option value="skip_round">Skip Round</option>
                      <option value="random_pairing">Random Pairing</option>
                    </select>
                  </div>
                  <div className="config-field">
                    <label>Bye Points</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={customConfig?.bye_points || 0.5}
                      onChange={(e) => setCustomConfig({...customConfig, bye_points: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="preview-tab">
              {loading ? (
                <div className="loading">Loading preview...</div>
              ) : preview ? (
                <div className="tournament-preview">
                  <div className="preview-summary">
                    <h3>Tournament Overview</h3>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="label">Total Rounds</span>
                        <span className="value">{preview.total_rounds}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Total Matches</span>
                        <span className="value">{preview.total_matches}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Participants</span>
                        <span className="value">{preview.total_participants}</span>
                      </div>
                      <div className="summary-item">
                        <span className="label">Matches Per Player</span>
                        <span className="value">{preview.avg_matches_per_player?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="round-breakdown">
                    <h4>Round by Round Breakdown</h4>
                    <div className="rounds-list">
                      {preview.round_breakdown?.map((round, index) => (
                        <div key={index} className="round-preview-item">
                          <div className="round-header">
                            <h5>{round.name || `Round ${round.round}`}</h5>
                            <div className="round-stats">
                              <span>👥 {round.participants} players</span>
                              <span>🎯 {round.matches} matches</span>
                              <span>⚡ {round.avg_matches_per_player?.toFixed(1)} per player</span>
                            </div>
                          </div>
                          <div className="round-details">
                            <p><strong>Selection:</strong> {round.selection_rule_display}</p>
                            <p><strong>Pairing:</strong> {round.pairing_method_display}</p>
                            <p><strong>Density:</strong> {round.density_display}</p>
                            {round.description && <p><strong>Notes:</strong> {round.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="generation-estimate">
                    <h4>Generation Details</h4>
                    <p><strong>Estimated Time:</strong> {preview.generation_estimate?.estimated_time || 'N/A'}</p>
                    <p><strong>Complexity:</strong> {preview.generation_estimate?.complexity || 'N/A'}</p>
                    {preview.warnings && preview.warnings.length > 0 && (
                      <div className="warnings">
                        <strong>Warnings:</strong>
                        <ul>
                          {preview.warnings.map((warning, index) => (
                            <li key={index}>⚠️ {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="no-preview">No preview available</div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <div className="tournament-config-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={generating}
          >
            Cancel
          </button>

          {championship?.tournament_generated && (
            <button
              className="btn btn-warning"
              onClick={() => {
                if (window.confirm('⚠️ Tournament already exists. Regenerating will delete all existing matches and create new ones. Continue?')) {
                  handleGenerateTournament(true);
                }
              }}
              disabled={generating}
            >
              {generating ? 'Regenerating...' : '🔄 Regenerate Tournament'}
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={() => handleGenerateTournament(false)}
            disabled={generating || loading || (!selectedPreset && !customConfig)}
          >
            {generating ? 'Generating...' : championship?.tournament_generated ? '🔄 Regenerate' : '🚀 Generate Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TournamentConfigurationModal;