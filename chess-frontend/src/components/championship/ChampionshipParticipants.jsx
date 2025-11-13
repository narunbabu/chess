// ChampionshipParticipants.jsx
import React, { useState, useEffect } from 'react';
import { useChampionship } from '../../contexts/ChampionshipContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../utils/championshipHelpers';
import './Championship.css';

const ChampionshipParticipants = ({ championshipId, participants: propsParticipants }) => {
  const { user } = useAuth();
  const { fetchParticipants, loading, error } = useChampionship();

  // Use participants from props if available, otherwise fall back to context
  const participants = propsParticipants;

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, rating, registered_at
  const [filterBy, setFilterBy] = useState('all'); // all, paid, unpaid

  // Removed auto-fetch; now handled in context
  useEffect(() => {
    console.log('ChampionshipParticipants: Mounted for championshipId:', championshipId);
    return () => {
      console.log('ChampionshipParticipants: Unmounting for championshipId:', championshipId);
    };
  }, [championshipId]);

  const filteredAndSortedParticipants = (Array.isArray(participants) ? participants : [])
    .filter(participant => {
      // Search filter
      if (searchTerm && !participant.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Payment filter
      const isPaid = participant.payment_status === 'completed' || participant.payment_status === 'paid';
      if (filterBy === 'paid' && !isPaid) {
        return false;
      }
      if (filterBy === 'unpaid' && isPaid) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.user?.rating || 0) - (a.user?.rating || 0);
        case 'registered_at':
          return new Date(a.registered_at) - new Date(b.registered_at);
        case 'name':
        default:
          return a.user?.name?.localeCompare(b.user?.name || '');
      }
    });

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      completed: { color: 'success', text: '✅ Paid', icon: '💳' },
      paid: { color: 'success', text: '✅ Paid', icon: '💳' },
      pending: { color: 'warning', text: '⏳ Pending', icon: '⏰' },
      failed: { color: 'error', text: '❌ Failed', icon: '❌' },
      refunded: { color: 'info', text: '💰 Refunded', icon: '💸' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`payment-badge ${config.color}`}>
        {config.icon} {config.text}
      </span>
    );
  };

  const isCurrentUser = (participant) => {
    return user && participant.user_id === user.id;
  };

  // Only show loading state if we don't have participants data and are fetching
  if (loading && (!participants || participants.length === 0)) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading participants...</p>
      </div>
    );
  }

  // Only show error state if we don't have participants data and there's an error
  if (error && (!participants || participants.length === 0)) {
    return (
      <div className="error-state">
        <p>❌ {error}</p>
        <button onClick={() => fetchParticipants(championshipId)} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (!participants || participants.length === 0) {
    return (
      <div className="empty-state">
        <h3>No participants yet</h3>
        <p>Be the first to register for this championship!</p>
      </div>
    );
  }

  const participantsArray = Array.isArray(participants) ? participants : [];
  const stats = {
    total: participantsArray.length,
    paid: participantsArray.filter(p => p.payment_status === 'completed' || p.payment_status === 'paid').length,
    pending: participantsArray.filter(p => p.payment_status === 'pending').length,
    averageRating: participantsArray.length > 0
      ? Math.round(participantsArray.reduce((sum, p) => sum + (p.user?.rating || 0), 0) / participantsArray.length)
      : 0
  };

  return (
    <div className="championship-participants">
      <div className="participants-header">
        <h2>👥 Participants ({participantsArray.length})</h2>

        <div className="participants-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search participants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-input"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="name">Sort by Name</option>
            <option value="rating">Sort by Rating</option>
            <option value="registered_at">Sort by Registration Date</option>
          </select>

          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Participants</option>
            <option value="paid">Paid Only</option>
            <option value="unpaid">Unpaid Only</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="participants-stats">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.paid}</div>
            <div className="stat-label">Paid</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-value">{stats.averageRating}</div>
            <div className="stat-label">Avg Rating</div>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="participants-list">
        {filteredAndSortedParticipants.length === 0 ? (
          <div className="empty-state">
            <h3>No participants found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="participants-grid">
            {filteredAndSortedParticipants.map((participant) => (
              <div
                key={participant.id}
                className={`participant-card ${isCurrentUser(participant) ? 'current-user' : ''}`}
              >
                <div className="participant-avatar">
                  <img
                    src={`https://i.pravatar.cc/150?u=${participant.user?.email || participant.user_id}`}
                    alt={participant.user?.name}
                    className="avatar-image"
                  />
                  {isCurrentUser(participant) && (
                    <div className="you-badge">YOU</div>
                  )}
                </div>

                <div className="participant-info">
                  <h3 className="participant-name">
                    {participant.user?.name || 'Unknown Player'}
                  </h3>
                  <div className="participant-rating">
                    Rating: {participant.user?.rating || 'N/A'}
                  </div>
                </div>

                <div className="participant-meta">
                  <div className="registration-info">
                    <span className="registration-label">Registered:</span>
                    <span className="registration-date">
                      {formatDateTime(participant.registered_at, false)}
                    </span>
                  </div>

                  {participant.entry_fee && parseFloat(participant.entry_fee) > 0 && (
                    <div className="payment-info">
                      <span className="entry-fee">
                        ${parseFloat(participant.entry_fee).toFixed(2)}
                      </span>
                      {getPaymentStatusBadge(participant.payment_status)}
                    </div>
                  )}
                </div>

                {participant.seed_number && (
                  <div className="seed-info">
                    <span className="seed-label">Seed:</span>
                    <span className="seed-number">#{participant.seed_number}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export/Share Options */}
      <div className="participants-actions">
        <button className="btn btn-secondary">
          📄 Export Participants
        </button>
        <button className="btn btn-secondary">
          📋 Copy List
        </button>
      </div>
    </div>
  );
};

export default ChampionshipParticipants;
