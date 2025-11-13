// TournamentSettings.jsx
import React, { useState } from 'react';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { validateChampionshipData } from '../../utils/championshipHelpers';
import './Championship.css';

const TournamentSettings = ({ championship, onClose, onSuccess }) => {
  const { updateChampionship } = useChampionship();

  const [formData, setFormData] = useState({
    name: championship.name || '',
    description: championship.description || '',
    settings: {
      ...championship.settings,
      round_duration_days: championship.settings?.round_duration_days || 3,
      allow_byes: championship.settings?.allow_byes !== false,
      color_preference: championship.settings?.color_preference !== false,
      auto_pairing: championship.settings?.auto_pairing !== false,
      require_game_confirmation: championship.settings?.require_game_confirmation || false,
      public_standings: championship.settings?.public_standings !== false,
      allow_late_registration: championship.settings?.allow_late_registration || false,
      ...championship.settings
    }
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState('basic');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleSettingChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = validateChampionshipData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    try {
      const updated = await updateChampionship(championship.id, formData);
      onSuccess(updated);
    } catch (error) {
      console.error('Failed to update tournament:', error);
      setErrors({ submit: error.response?.data?.message || 'Failed to update tournament' });
    } finally {
      setLoading(false);
    }
  };

  const renderBasicSettings = () => (
    <div className="settings-section">
      <h4>📋 Basic Information</h4>

      <div className="form-group">
        <label htmlFor="name">Tournament Name *</label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className={`form-input ${errors.name ? 'error' : ''}`}
        />
        {errors.name && <span className="error-message">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          rows={4}
          className={`form-input ${errors.description ? 'error' : ''}`}
        />
        {errors.description && <span className="error-message">{errors.description}</span>}
      </div>
    </div>
  );

  const renderGameSettings = () => (
    <div className="settings-section">
      <h4>🎮 Game Settings</h4>

      <div className="form-group">
        <label htmlFor="round_duration_days">Round Duration (days)</label>
        <input
          type="number"
          id="round_duration_days"
          value={formData.settings.round_duration_days}
          onChange={(e) => handleSettingChange('round_duration_days', parseInt(e.target.value))}
          min="1"
          max="14"
          className="form-input"
        />
        <small>Time players have to complete each round</small>
      </div>

      <div className="checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.allow_byes}
            onChange={(e) => handleSettingChange('allow_byes', e.target.checked)}
          />
          Allow byes for odd number of participants
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.color_preference}
            onChange={(e) => handleSettingChange('color_preference', e.target.checked)}
          />
          Consider color preferences in pairings
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.auto_pairing}
            onChange={(e) => handleSettingChange('auto_pairing', e.target.checked)}
          />
          Automatic pairings for each round
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.require_game_confirmation}
            onChange={(e) => handleSettingChange('require_game_confirmation', e.target.checked)}
          />
          Require confirmation before starting games
        </label>
      </div>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="settings-section">
      <h4>👁️ Display & Privacy</h4>

      <div className="checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.public_standings}
            onChange={(e) => handleSettingChange('public_standings', e.target.checked)}
          />
          Make standings publicly visible
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.allow_late_registration}
            onChange={(e) => handleSettingChange('allow_late_registration', e.target.checked)}
          />
          Allow late registration (if rounds haven't started)
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.show_player_ratings}
            onChange={(e) => handleSettingChange('show_player_ratings', e.target.checked)}
          />
          Show player ratings to public
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.settings.enable_chat}
            onChange={(e) => handleSettingChange('enable_chat', e.target.checked)}
          />
          Enable tournament chat
        </label>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="settings-section">
      <h4>⚙️ Advanced Settings</h4>

      <div className="form-group">
        <label htmlFor="tiebreak_rules">Tiebreak Rules</label>
        <div className="tiebreak-options">
          {['buchholz', 'sonnenborn_berger', 'cumulative', 'head_to_head'].map((rule) => (
            <label key={rule} className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.settings.tiebreak_rules?.includes(rule) || false}
                onChange={(e) => {
                  const currentRules = formData.settings.tiebreak_rules || [];
                  const newRules = e.target.checked
                    ? [...currentRules, rule]
                    : currentRules.filter(r => r !== rule);
                  handleSettingChange('tiebreak_rules', newRules);
                }}
              />
              {rule.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="max_rounds_per_day">Maximum Rounds Per Day</label>
        <input
          type="number"
          id="max_rounds_per_day"
          value={formData.settings.max_rounds_per_day || 1}
          onChange={(e) => handleSettingChange('max_rounds_per_day', parseInt(e.target.value))}
          min="1"
          max="5"
          className="form-input"
        />
        <small>Limit how many rounds can be generated per day</small>
      </div>

      <div className="form-group">
        <label htmlFor="time_extension">Time Extension for Inactive Games (hours)</label>
        <input
          type="number"
          id="time_extension"
          value={formData.settings.time_extension || 0}
          onChange={(e) => handleSettingChange('time_extension', parseInt(e.target.value))}
          min="0"
          max="168"
          className="form-input"
        />
        <small>Additional time granted for inactive games</small>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal tournament-settings-modal">
        <div className="modal-header">
          <h2>⚙️ Tournament Settings</h2>
          <button onClick={onClose} className="modal-close" disabled={loading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-content">
            {errors.submit && (
              <div className="error-message global">
                {errors.submit}
              </div>
            )}

            {/* Settings Navigation */}
            <div className="settings-nav">
              <button
                type="button"
                onClick={() => setActiveSection('basic')}
                className={`settings-nav-btn ${activeSection === 'basic' ? 'active' : ''}`}
              >
                📋 Basic
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('games')}
                className={`settings-nav-btn ${activeSection === 'games' ? 'active' : ''}`}
              >
                🎮 Games
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('display')}
                className={`settings-nav-btn ${activeSection === 'display' ? 'active' : ''}`}
              >
                👁️ Display
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('advanced')}
                className={`settings-nav-btn ${activeSection === 'advanced' ? 'active' : ''}`}
              >
                ⚙️ Advanced
              </button>
            </div>

            {/* Settings Content */}
            <div className="settings-content">
              {activeSection === 'basic' && renderBasicSettings()}
              {activeSection === 'games' && renderGameSettings()}
              {activeSection === 'display' && renderDisplaySettings()}
              {activeSection === 'advanced' && renderAdvancedSettings()}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TournamentSettings;