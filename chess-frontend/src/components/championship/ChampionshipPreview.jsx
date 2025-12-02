import React, { useState, useEffect } from 'react';
import './ChampionshipPreview.css';

const ChampionshipPreview = ({ championship, config = {}, onClose, onStart, onRegister }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Format time control display
  const formatTimeControl = (timeControl) => {
    if (!timeControl) return 'Not set';
    return `${timeControl.minutes || 0}+${timeControl.increment || 0} ${timeControl.type || 'minutes'}`;
  };

  // Format date display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get status badge color
  const getStatusColor = (status) => {
    const colors = {
      upcoming: 'blue',
      registration_open: 'green',
      in_progress: 'yellow',
      paused: 'orange',
      completed: 'gray',
      cancelled: 'red'
    };
    return colors[status] || 'gray';
  };

  // Get format display
  const getFormatDisplay = (format) => {
    const displays = {
      swiss_only: 'Swiss System',
      single_elimination: 'Single Elimination',
      double_elimination: 'Double Elimination',
      round_robin: 'Round Robin',
      hybrid: 'Hybrid (Swiss + Knockout)'
    };
    return displays[format] || format?.replace('_', ' ') || 'Not set';
  };

  // Handle registration
  const handleRegister = async () => {
    if (!onRegister) return;

    setLoading(true);
    setError(null);

    try {
      await onRegister();
    } catch (err) {
      setError(err.message || 'Failed to register for championship');
    } finally {
      setLoading(false);
    }
  };

  // Handle start championship
  const handleStart = async () => {
    if (!onStart) return;

    setLoading(true);
    setError(null);

    try {
      await onStart();
    } catch (err) {
      setError(err.message || 'Failed to start championship');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="championship-preview-overlay">
      <div className="championship-preview">
        <div className="preview-header">
          <div className="championship-title">
            <h1>{championship?.name || config?.name || 'Untitled Championship'}</h1>
            <span className={`status-badge ${getStatusColor(championship?.status || 'upcoming')}`}>
              {(championship?.status || 'upcoming').replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className="close-btn" disabled={loading}>
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
            <button onClick={() => setError(null)} className="alert-close">×</button>
          </div>
        )}

        {/* Preview Tabs */}
        <div className="preview-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`tab-btn ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            Participants
          </button>
          <button
            className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </button>
        </div>

        {/* Tab Content */}
        <div className="preview-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-preview">
              <div className="preview-grid">
                {/* Basic Info */}
                <div className="preview-card">
                  <h3>Basic Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Format:</label>
                      <span>{getFormatDisplay(championship?.format || config?.format)}</span>
                    </div>
                    <div className="info-item">
                      <label>Status:</label>
                      <span className={`status-text ${getStatusColor(championship?.status || 'upcoming')}`}>
                        {(championship?.status || 'upcoming').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Time Control:</label>
                      <span>{formatTimeControl(championship?.time_control || config?.time_control)}</span>
                    </div>
                    <div className="info-item">
                      <label>Total Rounds:</label>
                      <span>{championship?.total_rounds || config?.total_rounds || 'Not set'}</span>
                    </div>
                  </div>
                </div>

                {/* Registration Info */}
                <div className="preview-card">
                  <h3>Registration</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Current Participants:</label>
                      <span>{championship?.participants_count || 0}</span>
                    </div>
                    <div className="info-item">
                      <label>Maximum Participants:</label>
                      <span>{championship?.max_participants || config?.registration_settings?.max_participants || 'Unlimited'}</span>
                    </div>
                    <div className="info-item">
                      <label>Registration Deadline:</label>
                      <span>{formatDate(championship?.registration_deadline || config?.registration_settings?.deadline)}</span>
                    </div>
                    <div className="info-item">
                      <label>Registration Fee:</label>
                      <span>
                        {championship?.payment_amount || config?.registration_settings?.payment_amount
                          ? `$${championship?.payment_amount || config?.registration_settings?.payment_amount}`
                          : 'Free'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Championship Settings */}
                <div className="preview-card">
                  <h3>Championship Settings</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Pairing Method:</label>
                      <span>{(championship?.pairing_method || config?.championship_settings?.pairing_method || 'balanced').replace('_', ' ')}</span>
                    </div>
                    <div className="info-item">
                      <label>Color Assignment:</label>
                      <span>{(championship?.color_assignment || config?.championship_settings?.color_assignment || 'balanced').replace('_', ' ')}</span>
                    </div>
                    <div className="info-item">
                      <label>Byes Allowed:</label>
                      <span>{championship?.allow_byes !== false ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="info-item">
                      <label>Bye Points:</label>
                      <span>{championship?.bye_points || config?.championship_settings?.bye_points || 1.0} points</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {championship?.description && (
                <div className="preview-card full-width">
                  <h3>Description</h3>
                  <p className="description-text">{championship.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="details-preview">
              <div className="preview-section">
                <h3>Championship Structure</h3>
                <div className="structure-info">
                  <div className="structure-item">
                    <strong>Format:</strong> {getFormatDisplay(championship?.format || config?.format)}
                  </div>
                  <div className="structure-item">
                    <strong>Total Rounds:</strong> {championship?.total_rounds || config?.total_rounds || 'Not set'}
                  </div>
                  <div className="structure-item">
                    <strong>Current Round:</strong> {championship?.current_round || 0}
                  </div>
                  <div className="structure-item">
                    <strong>Visibility:</strong> {(championship?.visibility || config?.visibility || 'public').replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h3>Time Control</h3>
                <div className="time-control-display">
                  <div className="time-value">
                    {formatTimeControl(championship?.time_control || config?.time_control)}
                  </div>
                  <div className="time-details">
                    <div className="time-detail">
                      <label>Minutes:</label>
                      <span>{(championship?.time_control || config?.time_control)?.minutes || 0}</span>
                    </div>
                    <div className="time-detail">
                      <label>Increment:</label>
                      <span>{(championship?.time_control || config?.time_control)?.increment || 0} seconds</span>
                    </div>
                    <div className="time-detail">
                      <label>Type:</label>
                      <span>{(championship?.time_control || config?.time_control)?.type || 'Not set'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h3>Tiebreak Rules</h3>
                <div className="tiebreak-list">
                  {(championship?.tiebreak_rules || config?.championship_settings?.tiebreak_rules || ['points', 'buchholz']).map((rule, index) => (
                    <div key={index} className="tiebreak-item">
                      <span className="tiebreak-order">{index + 1}.</span>
                      <span className="tiebreak-name">{rule.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="participants-preview">
              <div className="participants-header">
                <h3>Participants ({championship?.participants_count || 0})</h3>
                <div className="participants-limit">
                  {championship?.max_participants && (
                    <span>/ {championship.max_participants} max</span>
                  )}
                </div>
              </div>

              <div className="participants-status">
                {championship?.status === 'upcoming' && (
                  <div className="status-message info">
                    Registration is not yet open for this championship.
                  </div>
                )}
                {championship?.status === 'registration_open' && (
                  <div className="status-message success">
                    Registration is currently open! Join now to participate.
                  </div>
                )}
                {championship?.status === 'in_progress' && (
                  <div className="status-message warning">
                    Registration has closed. Championship is in progress.
                  </div>
                )}
                {championship?.status === 'completed' && (
                  <div className="status-message">
                    This championship has completed.
                  </div>
                )}
              </div>

              {championship?.participants_count > 0 && (
                <div className="participants-summary">
                  <div className="summary-stat">
                    <label>Total Participants:</label>
                    <span>{championship.participants_count}</span>
                  </div>
                  {championship?.registration_open && (
                    <div className="summary-stat">
                      <label>Available Spots:</label>
                      <span>{(championship?.max_participants || Infinity) - championship.participants_count}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="schedule-preview">
              <div className="preview-section">
                <h3>Registration Schedule</h3>
                <div className="schedule-item">
                  <div className="schedule-label">Registration Opens:</div>
                  <div className="schedule-value">
                    {formatDate(championship?.registration_start_date)}
                  </div>
                </div>
                <div className="schedule-item">
                  <div className="schedule-label">Registration Deadline:</div>
                  <div className="schedule-value">
                    {formatDate(championship?.registration_deadline)}
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h3>Championship Schedule</h3>
                <div className="schedule-item">
                  <div className="schedule-label">Start Date:</div>
                  <div className="schedule-value">
                    {formatDate(championship?.starts_at)}
                  </div>
                </div>
                {championship?.auto_start && (
                  <div className="schedule-item">
                    <div className="schedule-label">Auto-start:</div>
                    <div className="schedule-value">
                      Yes (when registration closes)
                    </div>
                  </div>
                )}
              </div>

              <div className="preview-section">
                <h3>Estimated Timeline</h3>
                <div className="timeline-info">
                  <div className="timeline-item">
                    <strong>Estimated Duration:</strong>
                    <span>{(championship?.total_rounds || config?.total_rounds || 5) * 2} weeks</span>
                  </div>
                  <div className="timeline-item">
                    <strong>Rounds Per Week:</strong>
                    <span>1-2 rounds</span>
                  </div>
                  <div className="timeline-item">
                    <strong>Average Game Length:</strong>
                    <span>{(championship?.time_control || config?.time_control)?.minutes || 10} minutes</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="preview-actions">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Close
          </button>

          {championship?.status === 'upcoming' && championship?.registration_open !== false && onRegister && (
            <button
              onClick={handleRegister}
              className="btn-primary"
              disabled={loading || (championship?.max_participants && championship.participants_count >= championship.max_participants)}
            >
              {loading ? 'Registering...' : 'Register for Championship'}
            </button>
          )}

          {championship?.status === 'registration_open' && onStart && (
            <button
              onClick={handleStart}
              className="btn-success"
              disabled={loading}
            >
              {loading ? 'Starting...' : 'Start Championship'}
            </button>
          )}

          {championship?.status === 'paused' && onStart && (
            <button
              onClick={handleStart}
              className="btn-warning"
              disabled={loading}
            >
              {loading ? 'Resuming...' : 'Resume Championship'}
            </button>
          )}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="preview-loading">
            <div className="spinner"></div>
            <p>Processing...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChampionshipPreview;