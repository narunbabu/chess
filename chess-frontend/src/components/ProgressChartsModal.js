import React, { useState } from 'react';
import UserProgressCharts from './UserProgressCharts';

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

const ProgressChartsModal = ({ isOpen, onClose, userId }) => {
  const [period, setPeriod] = useState('30d');

  if (!isOpen) return null;

  return (
    <div
      className="detailed-stats-overlay"
      onClick={onClose}
    >
      <div
        className="detailed-stats-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="detailed-stats-header">
          <h2>Your Progress</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: period === p.value ? '#81b64c' : '#464340',
                background: period === p.value ? 'rgba(129,182,76,0.15)' : 'transparent',
                color: period === p.value ? '#81b64c' : '#9b9895',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Charts */}
        <UserProgressCharts
          userId={userId}
          period={period}
          apiUrl="/user/progress"
        />
      </div>
    </div>
  );
};

export default ProgressChartsModal;
