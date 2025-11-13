// ConfirmationModal.jsx
import React, { useState } from 'react';
import './ConfirmationModal.css';

/**
 * Reusable confirmation modal for championship actions
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onConfirm - Callback when action is confirmed
 * @param {string} type - Type of confirmation: 'archive', 'restore', 'delete'
 * @param {object} championship - Championship data for context
 */
const ConfirmationModal = ({ isOpen, onClose, onConfirm, type = 'archive', championship }) => {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    // For delete, require typing DELETE
    if (type === 'delete' && confirmText !== 'DELETE') {
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setLoading(false);
      setConfirmText('');
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onClose();
  };

  const getModalConfig = () => {
    switch (type) {
      case 'archive':
        return {
          title: '📦 Archive Championship?',
          message: `Are you sure you want to archive "${championship?.name || 'this championship'}"?`,
          description: 'It will be removed from active lists but can be restored later.',
          icon: '⚠️',
          color: 'warning',
          confirmText: 'Archive',
          requiresTyping: false,
          details: championship?.participants_count > 0 ? (
            <div className="confirmation-details warning">
              <p><strong>⚠️ Warning:</strong> This championship has <strong>{championship.participants_count} participants</strong>.</p>
              <p>The championship will remain archived but participants data will be preserved.</p>
            </div>
          ) : null
        };

      case 'restore':
        return {
          title: '↺ Restore Championship?',
          message: `Are you sure you want to restore "${championship?.name || 'this championship'}"?`,
          description: 'It will be moved back to active championships list.',
          icon: '✓',
          color: 'success',
          confirmText: 'Restore',
          requiresTyping: false
        };

      case 'delete':
        return {
          title: '🗑️ Permanently Delete Championship?',
          message: `You are about to PERMANENTLY delete "${championship?.name || 'this championship'}".`,
          description: 'This action CANNOT be undone. All data will be permanently lost.',
          icon: '🚨',
          color: 'danger',
          confirmText: 'Permanently Delete',
          requiresTyping: true,
          details: (
            <div className="confirmation-details danger">
              <p><strong>⚠️ Critical Warning:</strong></p>
              <ul>
                <li><strong>Participants:</strong> {championship?.participants_count || 0}</li>
                <li><strong>Matches:</strong> {championship?.match_count || 0}</li>
                <li><strong>Status:</strong> {championship?.status || 'Unknown'}</li>
              </ul>
              <p className="delete-warning">
                Only empty championships with no participants can be permanently deleted.
              </p>
            </div>
          )
        };

      default:
        return {
          title: 'Confirm Action',
          message: 'Are you sure you want to proceed?',
          confirmText: 'Confirm',
          color: 'primary',
          requiresTyping: false
        };
    }
  };

  const config = getModalConfig();
  const canConfirm = !config.requiresTyping || confirmText === 'DELETE';

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className={`confirmation-modal ${config.color}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">{config.icon}</div>
          <h2>{config.title}</h2>
        </div>

        <div className="modal-body">
          <p className="modal-message">{config.message}</p>
          {config.description && (
            <p className="modal-description">{config.description}</p>
          )}

          {config.details && (
            <div className="modal-details">
              {config.details}
            </div>
          )}

          {config.requiresTyping && (
            <div className="confirmation-input">
              <label htmlFor="confirm-text">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                id="confirm-text"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`btn btn-${config.color}`}
            disabled={!canConfirm || loading}
          >
            {loading ? 'Processing...' : config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
