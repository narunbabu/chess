import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getPlayerAvatar } from '../utils/playerDisplayUtils';
import '../styles/UnifiedCards.css';

const FriendsPage = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [message, setMessage] = useState(null);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadFriends = useCallback(async () => {
    try {
      const res = await api.get('/friends');
      setFriends(res.data || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res = await api.get('/friends/pending');
      setPendingRequests(res.data || []);
    } catch (err) {
      console.error('Error loading pending requests:', err);
    }
  }, []);

  const loadOnline = useCallback(async () => {
    try {
      const res = await api.get('/presence/online/users');
      const ids = (res.data?.online_users || []).map(u => u.id || u.user_id);
      setOnlineIds(new Set(ids));
    } catch {
      // presence endpoint optional
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([loadFriends(), loadPending(), loadOnline()]).finally(() => setLoading(false));
  }, [user, loadFriends, loadPending, loadOnline]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await api.get('/users', { params: { search: searchQuery } });
      setSearchResults((res.data || []).filter(u => u.id !== user.id));
      setSearched(true);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  const setAction = (id, val) => setActionLoading(prev => ({ ...prev, [id]: val }));

  const handleSendRequest = async (friendId) => {
    setAction(friendId, true);
    try {
      await api.post('/friends', { friend_id: friendId });
      showMessage('Friend request sent!');
      setSearchResults(prev => prev.filter(u => u.id !== friendId));
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to send request', 'error');
    } finally {
      setAction(friendId, false);
    }
  };

  const handleAccept = async (requesterId) => {
    setAction(requesterId, true);
    try {
      await api.post(`/friends/${requesterId}/accept`);
      showMessage('Friend request accepted!');
      loadPending();
      loadFriends();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to accept', 'error');
    } finally {
      setAction(requesterId, false);
    }
  };

  const handleReject = async (requesterId) => {
    setAction(requesterId, true);
    try {
      await api.delete(`/friends/${requesterId}/reject`);
      showMessage('Request rejected');
      loadPending();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to reject', 'error');
    } finally {
      setAction(requesterId, false);
    }
  };

  const handleRemove = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
    setAction(friendId, true);
    try {
      await api.delete(`/friends/${friendId}`);
      showMessage('Friend removed');
      loadFriends();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to remove', 'error');
    } finally {
      setAction(friendId, false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#262421]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#81b64c]" />
      </div>
    );
  }

  const friendIds = new Set(friends.map(f => f.id));
  const pendingSentIds = new Set(pendingRequests.map(p => p.id));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ color: '#e5e7eb', fontSize: '1.6rem', fontWeight: 700, marginBottom: 24 }}>
        Chess Mates
      </h1>

      {message && (
        <div style={{
          padding: '10px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(129,182,76,0.15)',
          color: message.type === 'error' ? '#ef4444' : '#81b64c',
          fontSize: 14,
          fontWeight: 600,
          border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(129,182,76,0.3)'}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#bababa', fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
            Pending Requests ({pendingRequests.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRequests.map(req => (
              <div key={req.id} className="unified-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                <img
                  src={getPlayerAvatar(req) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${req.id}`}
                  alt={req.name}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#2b2927' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{req.name}</div>
                  <div style={{ color: '#8b8987', fontSize: 12 }}>Rating: {req.rating || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={actionLoading[req.id]}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: 'none',
                      background: '#81b64c', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      opacity: actionLoading[req.id] ? 0.6 : 1,
                    }}
                  >
                    {actionLoading[req.id] ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionLoading[req.id]}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: '1px solid #4a4744',
                      background: 'transparent', color: '#bababa', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Search */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#bababa', fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
          Find Players
        </h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #3d3a37',
              background: '#2b2927', color: '#e5e7eb', fontSize: 14, outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#81b64c', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchResults.map(result => {
              const isFriend = friendIds.has(result.id);
              const isPending = pendingSentIds.has(result.id);
              return (
                <div key={result.id} className="unified-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                  <img
                    src={getPlayerAvatar(result) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${result.id}`}
                    alt={result.name}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#2b2927' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{result.name}</div>
                    <div style={{ color: '#8b8987', fontSize: 12 }}>Rating: {result.rating || '—'}</div>
                  </div>
                  {isFriend ? (
                    <span style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(129,182,76,0.15)', color: '#81b64c', fontSize: 12, fontWeight: 600 }}>
                      Already Friends
                    </span>
                  ) : isPending ? (
                    <span style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(234,179,8,0.15)', color: '#eab308', fontSize: 12, fontWeight: 600 }}>
                      Request Pending
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(result.id)}
                      disabled={actionLoading[result.id]}
                      style={{
                        padding: '6px 16px', borderRadius: 8, border: 'none',
                        background: '#81b64c', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        opacity: actionLoading[result.id] ? 0.6 : 1,
                      }}
                    >
                      {actionLoading[result.id] ? '...' : 'Add Friend'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {searched && searchResults.length === 0 && (
          <p style={{ color: '#8b8987', fontStyle: 'italic', fontSize: 14 }}>No players found matching your search.</p>
        )}
      </section>

      {/* Friends List */}
      <section>
        <h2 style={{ color: '#bababa', fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
          Your Friends ({friends.length})
        </h2>
        {friends.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {friends.map(friend => {
              const isOnline = onlineIds.has(friend.id);
              return (
                <div key={friend.id} className="unified-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={getPlayerAvatar(friend) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.id}`}
                      alt={friend.name}
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: '#2b2927' }}
                    />
                    <span style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2px solid #312e2b',
                      background: isOnline ? '#81b64c' : '#666',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{friend.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#8b8987', fontSize: 12 }}>Rating: {friend.rating || '—'}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: isOnline ? '#81b64c' : '#666',
                      }}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(friend.id)}
                    disabled={actionLoading[friend.id]}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid #4a4744',
                      background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      opacity: actionLoading[friend.id] ? 0.6 : 1,
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#8b8987', fontStyle: 'italic', fontSize: 14 }}>
            No friends yet. Search for players above and send them a friend request!
          </p>
        )}
      </section>
    </div>
  );
};

export default FriendsPage;
