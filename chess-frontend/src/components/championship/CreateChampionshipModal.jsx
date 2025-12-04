// CreateChampionshipModal.jsx
import React, { useState, useEffect } from 'react';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { validateChampionshipData } from '../../utils/championshipHelpers';
import './Championship.css';

// Helper function to get default datetime-local value
function getDefaultDateTime(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  // Format as YYYY-MM-DDTHH:MM
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Helper function to format date for datetime-local input
function formatDateTimeForInput(dateString) {
  if (!dateString) return getDefaultDateTime();

  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.warn('Invalid date format:', dateString);
    return getDefaultDateTime();
  }
}

// Helper function to add days/hours to a date
function addTimeToDate(dateString, days = 0, hours = 0) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  return formatDateTimeForInput(date);
}

const CreateChampionshipModal = ({ isOpen, onClose, onSuccess, championship: editingChampionship }) => {
  const { createChampionship, updateChampionship } = useChampionship();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [stepInteracted, setStepInteracted] = useState({});
  const totalSteps = 3;
  const isEditing = !!editingChampionship;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    format: 'swiss_only',
    time_control: {
      minutes: 10,
      increment: 0
    },
    max_participants: 50,
    total_rounds: 5,
    entry_fee: '',
    registration_start_at: getDefaultDateTime(),
    registration_end_at: getDefaultDateTime(7), // 7 days from now
    starts_at: getDefaultDateTime(14), // 14 days from now
    prizes: [],
    settings: {
      allow_byes: true,
      color_preference: true,
      tiebreak_rules: ['buchholz', 'sonnenborn_berger'],
      auto_pairing: true,
      round_duration_days: 1, // Gap between rounds
      registration_gap_days: 7, // Gap between registration start and end
      start_gap_days: 7 // Gap between registration end and championship start
    },
    gaps: {
      registration_duration_days: 7, // Days for registration period
      preparation_days: 7, // Days between registration end and championship start
      round_gap_hours: 24 // Hours between rounds (default 1 day)
    }
  });

  // Populate form data when editing
  useEffect(() => {
    if (isEditing && editingChampionship) {
      setFormData({
        name: editingChampionship.title || editingChampionship.name || '',
        description: editingChampionship.description || '',
        format: editingChampionship.format || 'swiss_only',
        time_control: editingChampionship.time_control || {
          minutes: 10,
          increment: 0
        },
        max_participants: editingChampionship.max_participants || 50,
        total_rounds: editingChampionship.total_rounds || editingChampionship.swiss_rounds || 5,
        entry_fee: editingChampionship.entry_fee || '',
        registration_start_at: formatDateTimeForInput(editingChampionship.registration_start_at),
        registration_end_at: formatDateTimeForInput(editingChampionship.registration_deadline || editingChampionship.registration_end_at),
        starts_at: formatDateTimeForInput(editingChampionship.start_date || editingChampionship.starts_at),
        prizes: editingChampionship.prizes || [],
        settings: {
          allow_byes: editingChampionship.settings?.allow_byes ?? true,
          color_preference: editingChampionship.settings?.color_preference ?? true,
          tiebreak_rules: editingChampionship.settings?.tiebreak_rules || ['buchholz', 'sonnenborn_berger'],
          auto_pairing: editingChampionship.settings?.auto_pairing ?? true,
          round_duration_days: editingChampionship.settings?.round_duration_days || editingChampionship.match_time_window_hours / 24 || 1
        },
        gaps: {
          registration_duration_days: editingChampionship.gaps?.registration_duration_days || 7,
          preparation_days: editingChampionship.gaps?.preparation_days || 7,
          round_gap_hours: editingChampionship.gaps?.round_gap_hours || 24
        }
      });
    }
  }, [isEditing, editingChampionship]);

  // Auto-calculate dates when gaps change
  useEffect(() => {
    if (!isEditing && formData.registration_start_at) {
      const regEnd = addTimeToDate(
        formData.registration_start_at,
        formData.gaps.registration_duration_days,
        0
      );
      const champStart = addTimeToDate(
        regEnd,
        formData.gaps.preparation_days,
        0
      );

      setFormData(prev => ({
        ...prev,
        registration_end_at: regEnd,
        starts_at: champStart
      }));
    }
  }, [
    formData.gaps.registration_duration_days,
    formData.gaps.preparation_days,
    formData.registration_start_at,
    isEditing
  ]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Mark current step as interacted
    setStepInteracted(prev => ({
      ...prev,
      [currentStep]: true
    }));

    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleNestedInputChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));

    // Mark current step as interacted
    setStepInteracted(prev => ({
      ...prev,
      [currentStep]: true
    }));
  };

  const handleAddPrize = () => {
    setFormData(prev => ({
      ...prev,
      prizes: [...prev.prizes, { position: prev.prizes.length + 1, amount: '', description: '' }]
    }));
  };

  const handleRemovePrize = (index) => {
    setFormData(prev => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index)
    }));
  };

  const handlePrizeChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) =>
        i === index ? { ...prize, [field]: value } : prize
      )
    }));
  };

  const validateCurrentStep = () => {
    const stepErrors = {};

    // Only validate if user has interacted with this step
    if (!stepInteracted[currentStep]) {
      setErrors({});
      return true;
    }

    switch (currentStep) {
      case 1:
        if (!formData.name || formData.name.trim().length < 3) {
          stepErrors.name = 'Championship name must be at least 3 characters';
        }
        if (!formData.description || formData.description.trim().length < 10) {
          stepErrors.description = 'Description must be at least 10 characters';
        }
        if (!formData.format) {
          stepErrors.format = 'Please select a format';
        }
        break;

      case 2:
        if (!formData.time_control.minutes || formData.time_control.minutes < 1) {
          stepErrors['time_control.minutes'] = 'Please specify a valid time control';
        }
        if (!formData.max_participants || formData.max_participants < 2) {
          stepErrors.max_participants = 'Minimum 2 participants required';
        }
        if (formData.max_participants > 1000) {
          stepErrors.max_participants = 'Maximum 1000 participants allowed';
        }
        if (!formData.total_rounds || formData.total_rounds < 1) {
          stepErrors.total_rounds = 'Please specify number of rounds';
        }
        break;

      case 3:
        if (!formData.registration_start_at) {
          stepErrors.registration_start_at = 'Registration start date is required';
        }
        if (!formData.registration_end_at) {
          stepErrors.registration_end_at = 'Registration end date is required';
        }
        if (!formData.starts_at) {
          stepErrors.starts_at = 'Championship start date is required';
        }

        // Validate chronological order
        const regStart = new Date(formData.registration_start_at);
        const regEnd = new Date(formData.registration_end_at);
        const champStart = new Date(formData.starts_at);

        if (regEnd <= regStart) {
          stepErrors.registration_end_at = 'Registration end must be after registration start';
        }
        if (champStart <= regEnd) {
          stepErrors.starts_at = 'Championship start must be after registration end';
        }

        // Check minimum gaps
        const regGapHours = (regEnd - regStart) / (1000 * 60 * 60);
        const prepGapHours = (champStart - regEnd) / (1000 * 60 * 60);

        if (regGapHours < 1) {
          stepErrors.registration_end_at = 'Registration period must be at least 1 hour';
        }
        if (prepGapHours < 1) {
          stepErrors.starts_at = 'Preparation period must be at least 1 hour';
        }
        break;
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all steps - pass original data when editing
    const validation = validateChampionshipData(formData, isEditing ? editingChampionship : null);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    try {
      // Debug: Log original form data
      console.log('Original form data:', formData);
      console.log('Registration end at:', formData.registration_end_at);
      console.log('Starts at:', formData.starts_at);

      // Prepare data for context (which will transform to backend format)
      const dataForContext = {
        name: formData.name || 'Untitled Championship',
        description: formData.description || '',
        entry_fee: formData.entry_fee || 0,
        max_participants: formData.max_participants || 50,
        registration_end_at: formData.registration_end_at || getDefaultDateTime(7),
        starts_at: formData.starts_at || getDefaultDateTime(14),
        settings: {
          round_duration_days: formData.settings?.round_duration_days || 3
        },
        time_control: {
          minutes: formData.time_control?.minutes || 10,
          increment: formData.time_control?.increment || 0
        },
        total_rounds: formData.total_rounds || 5,
        format: formData.format || 'swiss_only',
        top_qualifiers: formData.format === 'hybrid' ? 8 : null,
        organization_id: null,
        visibility: 'public',
        allow_public_registration: true
      };

      console.log('Submitting data to context:', dataForContext);
      let championship;
      if (isEditing) {
        championship = await updateChampionship(editingChampionship.id, dataForContext);
      } else {
        championship = await createChampionship(dataForContext);
      }
      onSuccess?.(championship);
      onClose();
      // Reset form
      setFormData({
        name: '',
        description: '',
        format: 'swiss_only',
        time_control: { minutes: 10, increment: 0 },
        max_participants: 50,
        total_rounds: 5,
        entry_fee: '',
        registration_start_at: getDefaultDateTime(),
        registration_end_at: getDefaultDateTime(7),
        starts_at: getDefaultDateTime(14),
        prizes: [],
        settings: {
          allow_byes: true,
          color_preference: true,
          tiebreak_rules: ['buchholz', 'sonnenborn_berger'],
          auto_pairing: true,
          round_duration_days: 1
        },
        gaps: {
          registration_duration_days: 7,
          preparation_days: 7,
          round_gap_hours: 24
        }
      });
      setCurrentStep(1);
      setStepInteracted({});
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} championship:`, error);
      setErrors({ submit: error.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} championship` });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h3>Basic Information</h3>

            <div className="form-group">
              <label htmlFor="name">Championship Name *</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter championship name"
                className={`form-input ${errors.name ? 'error' : ''}`}
              />
              {stepInteracted[currentStep] && errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your championship"
                rows={4}
                className={`form-input ${errors.description ? 'error' : ''}`}
              />
              {stepInteracted[currentStep] && errors.description && <span className="error-message">{errors.description}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="format">Format *</label>
              <select
                id="format"
                value={formData.format}
                onChange={(e) => handleInputChange('format', e.target.value)}
                className={`form-input ${errors.format ? 'error' : ''}`}
              >
                <option value="">Select Format</option>
                <option value="swiss_only">Swiss System</option>
                <option value="elimination_only">Single Elimination</option>
                <option value="hybrid">Hybrid (Swiss + Elimination)</option>
                  </select>
              {stepInteracted[currentStep] && errors.format && <span className="error-message">{errors.format}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="entry_fee">Entry Fee (₹)</label>
              <input
                type="number"
                id="entry_fee"
                value={formData.entry_fee}
                onChange={(e) => handleInputChange('entry_fee', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="form-input"
              />
              <small>Leave empty for free tournaments</small>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3>Tournament Settings</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="minutes">Time Control (minutes) *</label>
                <input
                  type="number"
                  id="minutes"
                  value={formData.time_control.minutes}
                  onChange={(e) => handleNestedInputChange('time_control', 'minutes', parseInt(e.target.value))}
                  min="1"
                  max="180"
                  className={`form-input ${errors['time_control.minutes'] ? 'error' : ''}`}
                />
                {stepInteracted[currentStep] && errors['time_control.minutes'] && (
                  <span className="error-message">{errors['time_control.minutes']}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="increment">Increment (seconds)</label>
                <input
                  type="number"
                  id="increment"
                  value={formData.time_control.increment}
                  onChange={(e) => handleNestedInputChange('time_control', 'increment', parseInt(e.target.value))}
                  min="0"
                  max="60"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="max_participants">Max Participants *</label>
                <input
                  type="number"
                  id="max_participants"
                  value={formData.max_participants}
                  onChange={(e) => handleInputChange('max_participants', parseInt(e.target.value))}
                  min="2"
                  max="1000"
                  className={`form-input ${errors.max_participants ? 'error' : ''}`}
                />
                {stepInteracted[currentStep] && errors.max_participants && <span className="error-message">{errors.max_participants}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="total_rounds">Total Rounds *</label>
                <input
                  type="number"
                  id="total_rounds"
                  value={formData.total_rounds}
                  onChange={(e) => handleInputChange('total_rounds', parseInt(e.target.value))}
                  min="1"
                  max="15"
                  className={`form-input ${errors.total_rounds ? 'error' : ''}`}
                />
                {stepInteracted[currentStep] && errors.total_rounds && <span className="error-message">{errors.total_rounds}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="round_duration_days">Round Duration (days)</label>
              <input
                type="number"
                id="round_duration_days"
                value={formData.settings.round_duration_days}
                onChange={(e) => handleNestedInputChange('settings', 'round_duration_days', parseInt(e.target.value))}
                min="1"
                max="14"
                className="form-input"
              />
              <small>Time players have to complete each round</small>
            </div>

            <div className="form-group">
              <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Schedule Gaps</h4>
              <small style={{ display: 'block', marginBottom: '15px', color: '#666' }}>
                Configure time intervals between different phases
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="registration_duration_days">Registration Period (days)</label>
                <input
                  type="number"
                  id="registration_duration_days"
                  value={formData.gaps.registration_duration_days}
                  onChange={(e) => handleNestedInputChange('gaps', 'registration_duration_days', parseInt(e.target.value) || 1)}
                  min="1"
                  max="90"
                  className="form-input"
                />
                <small>Days from registration start to end</small>
              </div>

              <div className="form-group">
                <label htmlFor="preparation_days">Preparation Period (days)</label>
                <input
                  type="number"
                  id="preparation_days"
                  value={formData.gaps.preparation_days}
                  onChange={(e) => handleNestedInputChange('gaps', 'preparation_days', parseInt(e.target.value) || 1)}
                  min="1"
                  max="90"
                  className="form-input"
                />
                <small>Days from registration end to championship start</small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="round_gap_hours">Gap Between Rounds (hours)</label>
              <input
                type="number"
                id="round_gap_hours"
                value={formData.gaps.round_gap_hours}
                onChange={(e) => handleNestedInputChange('gaps', 'round_gap_hours', parseInt(e.target.value) || 1)}
                min="1"
                max="168"
                className="form-input"
              />
              <small>Hours between consecutive rounds (default: 24 = 1 day)</small>
            </div>

            <div className="form-group">
              <label>Prizes</label>
              {formData.prizes.length === 0 ? (
                <button type="button" onClick={handleAddPrize} className="btn btn-secondary">
                  + Add Prize
                </button>
              ) : (
                <div className="prizes-list">
                  {formData.prizes.map((prize, index) => (
                    <div key={index} className="prize-item">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Position</label>
                          <input
                            type="number"
                            value={prize.position}
                            onChange={(e) => handlePrizeChange(index, 'position', e.target.value)}
                            min="1"
                            className="form-input small"
                          />
                        </div>
                        <div className="form-group">
                          <label>Amount ($)</label>
                          <input
                            type="number"
                            value={prize.amount}
                            onChange={(e) => handlePrizeChange(index, 'amount', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="form-input small"
                          />
                        </div>
                        <div className="form-group">
                          <label>Description</label>
                          <input
                            type="text"
                            value={prize.description}
                            onChange={(e) => handlePrizeChange(index, 'description', e.target.value)}
                            placeholder="e.g., 1st Place"
                            className="form-input"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePrize(index)}
                          className="btn btn-danger btn-small"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddPrize} className="btn btn-secondary">
                    + Add Another Prize
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h3>Schedule</h3>

            <div style={{
              background: '#f0f7ff',
              border: '1px solid #b3d9ff',
              borderRadius: '6px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#0066cc' }}>
                📅 Auto-Calculated Schedule
              </div>
              <div style={{ color: '#333' }}>
                • Registration Period: <strong>{formData.gaps.registration_duration_days} days</strong><br/>
                • Preparation Time: <strong>{formData.gaps.preparation_days} days</strong><br/>
                • Gap Between Rounds: <strong>{formData.gaps.round_gap_hours} hours</strong>
              </div>
              <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                💡 Dates are calculated based on gaps set in Step 2. You can still manually adjust them below.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="registration_start_at">Registration Start *</label>
              <input
                type="datetime-local"
                id="registration_start_at"
                value={formData.registration_start_at}
                onChange={(e) => handleInputChange('registration_start_at', e.target.value)}
                className={`form-input ${errors.registration_start_at ? 'error' : ''}`}
              />
              {stepInteracted[currentStep] && errors.registration_start_at && <span className="error-message">{errors.registration_start_at}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="registration_end_at">Registration End *</label>
              <input
                type="datetime-local"
                id="registration_end_at"
                value={formData.registration_end_at}
                onChange={(e) => handleInputChange('registration_end_at', e.target.value)}
                className={`form-input ${errors.registration_end_at ? 'error' : ''}`}
              />
              <small>
                Auto-calculated: {formData.gaps.registration_duration_days} days after registration start
              </small>
              {stepInteracted[currentStep] && errors.registration_end_at && <span className="error-message">{errors.registration_end_at}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="starts_at">Championship Start *</label>
              <input
                type="datetime-local"
                id="starts_at"
                value={formData.starts_at}
                onChange={(e) => handleInputChange('starts_at', e.target.value)}
                className={`form-input ${errors.starts_at ? 'error' : ''}`}
              />
              <small>
                Auto-calculated: {formData.gaps.preparation_days} days after registration end
              </small>
              {stepInteracted[currentStep] && errors.starts_at && <span className="error-message">{errors.starts_at}</span>}
            </div>

            <div className="form-group">
              <label>Advanced Settings</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.allow_byes}
                    onChange={(e) => handleNestedInputChange('settings', 'allow_byes', e.target.checked)}
                  />
                  Allow byes for odd number of participants
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.color_preference}
                    onChange={(e) => handleNestedInputChange('settings', 'color_preference', e.target.checked)}
                  />
                  Consider color preferences in pairings
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.auto_pairing}
                    onChange={(e) => handleNestedInputChange('settings', 'auto_pairing', e.target.checked)}
                  />
                  Automatic pairings for each round
                </label>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal create-championship-modal">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Championship' : 'Create Championship'}</h2>
          <button
            onClick={onClose}
            className="modal-close"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Progress Steps */}
        <div className="progress-steps">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`step ${step === currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
            >
              <div className="step-number">{step}</div>
              <div className="step-label">
                {step === 1 && 'Basic Info'}
                {step === 2 && 'Settings'}
                {step === 3 && 'Schedule'}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-content">
            {errors.submit && (
              <div className="error-message global">
                {errors.submit}
              </div>
            )}

            {renderStepContent()}
          </div>

          <div className="modal-footer">
            <div className="step-navigation">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Previous
                </button>
              )}

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Championship' : 'Create Championship')}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChampionshipModal;