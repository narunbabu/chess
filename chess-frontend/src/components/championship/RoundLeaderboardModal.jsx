import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../../config';
import './Championship.css';

const RoundLeaderboardModal = ({ isOpen, onClose, championshipId, round }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && championshipId && round) {
      loadLeaderboard();
    }
  }, [isOpen, championshipId, round]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(
        `${BACKEND_URL}/championships/${championshipId}/matches/round/${round}/leaderboard`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setLeaderboard(response.data.leaderboard || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError(err.response?.data?.error || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Round {round} Leaderboard</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
          ) : error ? (
            <div style={{ color: 'red', padding: '20px' }}>{error}</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8b8987' }}>
              No completed matches yet for Round {round}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#262421', borderBottom: '2px solid #3d3a37' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left' }}>Rank</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left' }}>Player</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Played</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Won</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Draw</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>Lost</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player, index) => (
                  <tr key={player.user.id} style={{
                    borderBottom: '1px solid #3d3a37',
                    backgroundColor: index < 3 ? (index === 0 ? 'rgba(232, 169, 62, 0.1)' : index === 1 ? 'rgba(186, 186, 186, 0.05)' : 'rgba(232, 169, 62, 0.06)') : '#312e2b'
                  }}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                      {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : player.rank}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {player.user?.avatar_url && (
                          <img
                            src={player.user.avatar_url}
                            alt={player.user.name || 'Player'}
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        )}
                        <span>{player.user?.name || 'Unknown Player'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{player.played}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#81b64c', fontWeight: 'bold' }}>{player.won}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#8b8987' }}>{player.draw}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#fa6a5b' }}>{player.lost}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#ffffff' }}>
                      {player.points.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoundLeaderboardModal;
