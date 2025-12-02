import React, { useState, useEffect } from 'react';
import './ChampionshipConfigurationModal.css';

const ChampionshipConfigurationModal = ({ championship, onClose, onSave }) => {
  const [config, setConfig] = useState({
    name: '',
    description: '',
    format: 'swiss_only',
    total_rounds: 5,
    time_control: {
      type: 'rapid',
      minutes: 10,
      increment: 0,
    },
    registration_settings: {
      open: true,
      deadline: null,
      max_participants: 100,
      min_participants: 2,
      require_payment: false,
      payment_amount: 0,
    },
    championship_settings: {
      auto_start: false,
      auto_start_date: null,
      bye_points: 1.0,
      allow_byes: true,
      pairing_method: 'balanced',
      tiebreak_rules: ['points', 'buchholz', 'sonneborn_berger'],
      color_assignment: 'balanced',
    },
    visibility: 'public',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  // Initialize config with championship data
  useEffect(() => {
    if (championship) {
      setConfig({
        name: championship.name || '',
        description: championship.description || '',
        format: championship.format || 'swiss_only',
        total_rounds: championship.total_rounds || 5,
        time_control: championship.time_control || {
          type: 'rapid',
          minutes: 10,
          increment: 0,
        },
        registration_settings: {
          open: championship.registration_open !== false,
          deadline: championship.registration_deadline || null,
          max_participants: championship.max_participants || 100,
          min_participants: championship.min_participants || 2,
          require_payment: championship.require_payment || false,
          payment_amount: championship.payment_amount || 0,
        },
        championship_settings: {
          auto_start: championship.auto_start || false,
          auto_start_date: championship.auto_start_date || null,
          bye_points: championship.bye_points || 1.0,
          allow_byes: championship.allow_byes !== false,
          pairing_method: championship.pairing_method || 'balanced',
          tiebreak_rules: championship.tiebreak_rules || ['points', 'buchholz', 'sonneborn_berger'],
          color_assignment: championship.color_assignment || 'balanced',
        },
        visibility: championship.visibility || 'public',
      });
    }
  }, [championship]);

  // Handle form input changes
  const handleInputChange = (path, value) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      const keys = path.split('.');
      let current = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!config.name.trim()) {
        throw new Error('Championship name is required');
      }

      if (!config.total_rounds || config.total_rounds < 1) {
        throw new Error('Number of rounds must be at least 1');
      }

      if (config.registration_settings.min_participants < 2) {
        throw new Error('Minimum participants must be at least 2');
      }

      if (config.registration_settings.max_participants < config.registration_settings.min_participants) {
        throw new Error('Maximum participants must be greater than minimum');
      }

      await onSave(config);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save championship configuration');
    } finally {
      setLoading(false);
    }
  };

  // Format time control display
  const formatTimeControl = (tc) => {
    if (tc.type === 'bullet') return `${tc.minutes}+${tc.increment} bullet`;
    if (tc.type === 'blitz') return `${tc.minutes}+${tc.increment} blitz`;
    if (tc.type === 'rapid') return `${tc.minutes}+${tc.increment} rapid`;
    if (tc.type === 'classical') return `${tc.minutes}+${tc.increment} classical`;
    return `${tc.minutes}+${tc.increment}`;
  };

  return (
    <div className="championship-config-modal-overlay">
      <div className="championship-config-modal">
        <div className="modal-header">
          <h2>Configure Championship</h2>
          <button onClick={onClose} className="close-btn" disabled={loading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="config-form">
          {/* Error Display */}
          {error && (
            <div className="alert alert-danger">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Configuration Tabs */}
          <div className="config-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
              onClick={() => setActiveTab('basic')}
            >
              Basic Info
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'time' ? 'active' : ''}`}
              onClick={() => setActiveTab('time')}
            >
              Time Control
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'registration' ? 'active' : ''}`}
              onClick={() => setActiveTab('registration')}
            >
              Registration
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              Championship Rules
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              Advanced
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Basic Information Tab */}
            {activeTab === 'basic' && (
              <div className="basic-config">
                <div className="form-group">
                  <label htmlFor="name" className="required">Championship Name</label>
                  <input
                    type="text"
                    id="name"
                    value={config.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="form-control"
                    placeholder="Enter championship name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={config.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="form-control"
                    rows={3}
                    placeholder="Describe your championship"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="format">Format</label>
                  <select
                    id="format"
                    value={config.format}
                    onChange={(e) => handleInputChange('format', e.target.value)}
                    className="form-control"
                  >
                    <option value="swiss_only">Swiss Only</option>
                    <option value="single_elimination">Single Elimination</option>
                    <option value="double_elimination">Double Elimination</option>
                    <option value="round_robin">Round Robin</option>
                    <option value="hybrid">Hybrid (Swiss + Knockout)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="total_rounds">Total Rounds</label>
                  <input
                    type="number"
                    id="total_rounds"
                    value={config.total_rounds}
                    onChange={(e) => handleInputChange('total_rounds', parseInt(e.target.value) || 1)}
                    className="form-control"
                    min="1"
                    max="50"
                    required
                  />
                  <small>Number of rounds in the championship</small>
                </div>

                <div className="form-group">
                  <label htmlFor="visibility">Visibility</label>
                  <select
                    id="visibility"
                    value={config.visibility}
                    onChange={(e) => handleInputChange('visibility', e.target.value)}
                    className="form-control"
                  >
                    <option value="public">Public (Anyone can see)</option>
                    <option value="private">Private (Invite only)</option>
                    <option value="unlisted">Unlisted (Not discoverable)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Time Control Tab */}
            {activeTab === 'time' && (
              <div className="time-config">
                <div className="form-group">
                  <label>Time Control Type</label>
                  <select
                    value={config.time_control.type}
                    onChange={(e) => handleInputChange('time_control.type', e.target.value)}
                    className="form-control"
                  >
                    <option value="bullet">Bullet (1-3 min)</option>
                    <option value="blitz">Blitz (3-10 min)</option>
                    <option value="rapid">Rapid (10-30 min)</option>
                    <option value="classical">Classical (30+ min)</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="minutes">Minutes</label>
                    <input
                      type="number"
                      id="minutes"
                      value={config.time_control.minutes}
                      onChange={(e) => handleInputChange('time_control.minutes', parseInt(e.target.value) || 1)}
                      className="form-control"
                      min="1"
                      max="180"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="increment">Increment (seconds)</label>
                    <input
                      type="number"
                      id="increment"
                      value={config.time_control.increment}
                      onChange={(e) => handleInputChange('time_control.increment', parseInt(e.target.value) || 0)}
                      className="form-control"
                      min="0"
                      max="60"
                    />
                  </div>
                </div>

                <div className="time-preview">
                  <strong>Time Control:</strong> {formatTimeControl(config.time_control)}
                </div>
              </div>
            )}

            {/* Registration Settings Tab */}
            {activeTab === 'registration' && (
              <div className="registration-config">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.registration_settings.open}
                      onChange={(e) => handleInputChange('registration_settings.open', e.target.checked)}
                    />
                    Open Registration
                  </label>
                  <small>Allow players to register for this championship</small>
                </div>

                {config.registration_settings.open && (
                  <>
                    <div className="form-group">
                      <label htmlFor="registration_deadline">Registration Deadline</label>
                      <input
                        type="datetime-local"
                        id="registration_deadline"
                        value={config.registration_settings.deadline || ''}
                        onChange={(e) => handleInputChange('registration_settings.deadline', e.target.value)}
                        className="form-control"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="min_participants">Minimum Participants</label>
                        <input
                          type="number"
                          id="min_participants"
                          value={config.registration_settings.min_participants}
                          onChange={(e) => handleInputChange('registration_settings.min_participants', parseInt(e.target.value) || 2)}
                          className="form-control"
                          min="2"
                          max="1000"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="max_participants">Maximum Participants</label>
                        <input
                          type="number"
                          id="max_participants"
                          value={config.registration_settings.max_participants}
                          onChange={(e) => handleInputChange('registration_settings.max_participants', parseInt(e.target.value) || 100)}
                          className="form-control"
                          min="2"
                          max="1000"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={config.registration_settings.require_payment}
                          onChange={(e) => handleInputChange('registration_settings.require_payment', e.target.checked)}
                        />
                        Require Payment
                      </label>
                      <small>Charge participants to join this championship</small>
                    </div>

                    {config.registration_settings.require_payment && (
                      <div className="form-group">
                        <label htmlFor="payment_amount">Payment Amount ($)</label>
                        <input
                          type="number"
                          id="payment_amount"
                          value={config.registration_settings.payment_amount}
                          onChange={(e) => handleInputChange('registration_settings.payment_amount', parseFloat(e.target.value) || 0)}
                          className="form-control"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Championship Rules Tab */}
            {activeTab === 'rules' && (
              <div className="rules-config">
                <div className="form-group">
                  <label htmlFor="pairing_method">Pairing Method</label>
                  <select
                    id="pairing_method"
                    value={config.championship_settings.pairing_method}
                    onChange={(e) => handleInputChange('championship_settings.pairing_method', e.target.value)}
                    className="form-control"
                  >
                    <option value="balanced">Balanced (Score + Color)</option>
                    <option value="score_only">Score Only</option>
                    <option value="random">Random</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="color_assignment">Color Assignment</label>
                  <select
                    id="color_assignment"
                    value={config.championship_settings.color_assignment}
                    onChange={(e) => handleInputChange('championship_settings.color_assignment', e.target.value)}
                    className="form-control"
                  >
                    <option value="balanced">Balanced (alternating colors)</option>
                    <option value="white">Always White</option>
                    <option value="black">Always Black</option>
                    <option value="random">Random</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.championship_settings.allow_byes}
                      onChange={(e) => handleInputChange('championship_settings.allow_byes', e.target.checked)}
                    />
                    Allow Byes
                  </label>
                  <small>Allow players to receive byes when odd number of participants</small>
                </div>

                {config.championship_settings.allow_byes && (
                  <div className="form-group">
                    <label htmlFor="bye_points">Bye Points</label>
                    <input
                      type="number"
                      id="bye_points"
                      value={config.championship_settings.bye_points}
                      onChange={(e) => handleInputChange('championship_settings.bye_points', parseFloat(e.target.value) || 1.0)}
                      className="form-control"
                      min="0"
                      max="1"
                      step="0.5"
                    />
                    <small>Points awarded to players who receive a bye</small>
                  </div>
                )}

                <div className="form-group">
                  <label>Tiebreak Rules (in order)</label>
                  <div className="tiebreak-select">
                    {['points', 'buchholz', 'sonneborn_berger', 'h2h', 'wins', 'performance'].map(rule => (
                      <label key={rule} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={config.championship_settings.tiebreak_rules.includes(rule)}
                          onChange={(e) => {
                            const tiebreaks = [...config.championship_settings.tiebreak_rules];
                            if (e.target.checked) {
                              tiebreaks.push(rule);
                            } else {
                              const index = tiebreaks.indexOf(rule);
                              if (index > -1) tiebreaks.splice(index, 1);
                            }
                            handleInputChange('championship_settings.tiebreak_rules', tiebreaks);
                          }}
                        />
                        {rule.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Settings Tab */}
            {activeTab === 'advanced' && (
              <div className="advanced-config">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.championship_settings.auto_start}
                      onChange={(e) => handleInputChange('championship_settings.auto_start', e.target.checked)}
                    />
                    Auto-start Championship
                  </label>
                  <small>Automatically start the championship when registration closes</small>
                </div>

                {config.championship_settings.auto_start && (
                  <div className="form-group">
                    <label htmlFor="auto_start_date">Auto-start Date & Time</label>
                    <input
                      type="datetime-local"
                      id="auto_start_date"
                      value={config.championship_settings.auto_start_date || ''}
                      onChange={(e) => handleInputChange('championship_settings.auto_start_date', e.target.value)}
                      className="form-control"
                    />
                  </div>
                )}

                <div className="config-summary">
                  <h4>Championship Summary</h4>
                  <div className="summary-item">
                    <strong>Name:</strong> {config.name || 'Not set'}
                  </div>
                  <div className="summary-item">
                    <strong>Format:</strong> {config.format?.replace('_', ' ') || 'Not set'}
                  </div>
                  <div className="summary-item">
                    <strong>Rounds:</strong> {config.total_rounds || 'Not set'}
                  </div>
                  <div className="summary-item">
                    <strong>Time Control:</strong> {formatTimeControl(config.time_control)}
                  </div>
                  <div className="summary-item">
                    <strong>Max Participants:</strong> {config.registration_settings.max_participants || 'Not set'}
                  </div>
                  <div className="summary-item">
                    <strong>Registration:</strong> {config.registration_settings.open ? 'Open' : 'Closed'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChampionshipConfigurationModal;