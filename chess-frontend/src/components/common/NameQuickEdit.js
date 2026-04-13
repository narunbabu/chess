import React, { useState } from 'react';
import './NameQuickEdit.css';

const NameQuickEdit = ({ currentName, onSave, onCancel }) => {
  const [name, setName] = useState(currentName || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await onSave(trimmed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="name-quick-edit">
      <h3>Edit Display Name</h3>

      <form onSubmit={handleSubmit}>
        <div className="name-edit-field">
          <label htmlFor="name-input">Display Name</label>
          <input
            id="name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={50}
            autoFocus
          />
          <span className="name-char-count">{name.length}/50</span>
        </div>

        <div className="name-edit-footer">
          <button
            type="button"
            onClick={onCancel}
            className="name-edit-btn name-edit-btn-cancel"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="name-edit-btn name-edit-btn-save"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NameQuickEdit;
