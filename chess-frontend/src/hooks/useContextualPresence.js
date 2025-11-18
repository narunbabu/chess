// useContextualPresence.js - Smart, context-aware presence tracking
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Custom hook for contextual presence tracking
 * Only checks users relevant to current context:
 * - Friends/Contacts (people you've played with)
 * - Current round opponents (championship matches)
 * - Lobby users (paginated, for challenges)
 *
 * Reduces unnecessary checks by 95%+
 */
const useContextualPresence = () => {
  const [friends, setFriends] = useState([]);
  const [opponents, setOpponents] = useState([]);
  const [lobbyUsers, setLobbyUsers] = useState([]);
  const [lobbyPagination, setLobbyPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0,
    has_more: false
  });
  const [loading, setLoading] = useState({
    friends: false,
    opponents: false,
    lobby: false
  });
  const [error, setError] = useState(null);

  /**
   * Load friends/contacts with online status
   */
  const loadFriends = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, friends: true }));
      setError(null);

      const response = await api.get('/presence/friends');

      if (response.data.success) {
        setFriends(response.data.data.friends);
        console.log(`✅ [Friends] Loaded ${response.data.data.online_count}/${response.data.data.total_count} online`);
      }

    } catch (err) {
      console.error('❌ [Friends] Failed to load:', err);
      setError('Failed to load friends status');
    } finally {
      setLoading(prev => ({ ...prev, friends: false }));
    }
  }, []);

  /**
   * Load current round opponents with online status
   */
  const loadOpponents = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, opponents: true }));
      setError(null);

      const response = await api.get('/presence/opponents');

      if (response.data.success) {
        setOpponents(response.data.data.opponents);
        console.log(`✅ [Opponents] Loaded ${response.data.data.online_count}/${response.data.data.total_count} online`);
        console.log('📊 [Opponents] Full data:', response.data.data.opponents);
      }

    } catch (err) {
      console.error('❌ [Opponents] Failed to load:', err);
      setError('Failed to load opponents status');
    } finally {
      setLoading(prev => ({ ...prev, opponents: false }));
    }
  }, []);

  /**
   * Load lobby users (paginated)
   */
  const loadLobbyUsers = useCallback(async (options = {}) => {
    try {
      const {
        page = 1,
        perPage = 20,
        search = null,
        excludeFriends = false,
        append = false
      } = options;

      setLoading(prev => ({ ...prev, lobby: true }));
      setError(null);

      const params = {
        page,
        per_page: perPage
      };

      if (search) params.search = search;
      if (excludeFriends) params.exclude_friends = true;

      const response = await api.get('/presence/lobby', { params });

      if (response.data.success) {
        const newUsers = response.data.data.users;
        const pagination = response.data.data.pagination;

        setLobbyUsers(prev => append ? [...prev, ...newUsers] : newUsers);
        setLobbyPagination(pagination);

        console.log(`✅ [Lobby] Loaded ${newUsers.length} users (page ${page}/${pagination.total_pages})`);
      }

    } catch (err) {
      console.error('❌ [Lobby] Failed to load:', err);
      setError('Failed to load lobby users');
    } finally {
      setLoading(prev => ({ ...prev, lobby: false }));
    }
  }, []);

  /**
   * Load next page of lobby users
   */
  const loadMoreLobbyUsers = useCallback(async (options = {}) => {
    if (!lobbyPagination.has_more || loading.lobby) {
      return;
    }

    await loadLobbyUsers({
      ...options,
      page: lobbyPagination.current_page + 1,
      append: true
    });
  }, [lobbyPagination, loading.lobby, loadLobbyUsers]);

  /**
   * Refresh friends status
   */
  const refreshFriends = useCallback(async () => {
    await loadFriends();
  }, [loadFriends]);

  /**
   * Refresh opponents status
   */
  const refreshOpponents = useCallback(async () => {
    await loadOpponents();
  }, [loadOpponents]);

  /**
   * Refresh lobby users
   */
  const refreshLobby = useCallback(async () => {
    await loadLobbyUsers({ page: 1 });
  }, [loadLobbyUsers]);

  /**
   * Refresh all contexts
   */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadFriends(),
      loadOpponents(),
      loadLobbyUsers({ page: 1 })
    ]);
  }, [loadFriends, loadOpponents, loadLobbyUsers]);

  /**
   * Check if specific user is online
   */
  const isUserOnline = useCallback((userId) => {
    // Check in friends
    const friend = friends.find(f => f.user_id === userId);
    if (friend) return friend.is_online;

    // Check in opponents
    const opponent = opponents.find(o => o.user_id === userId);
    if (opponent) return opponent.is_online;

    // Check in lobby
    const lobbyUser = lobbyUsers.find(u => u.user_id === userId);
    if (lobbyUser) return lobbyUser.is_online;

    return false;
  }, [friends, opponents, lobbyUsers]);

  /**
   * Get user status with context
   */
  const getUserStatus = useCallback((userId) => {
    const user = [
      ...friends,
      ...opponents,
      ...lobbyUsers
    ].find(u => u.user_id === userId);

    if (!user) {
      return {
        status: 'unknown',
        color: '#6b7280',
        text: 'Unknown'
      };
    }

    return {
      status: user.is_online ? 'online' : 'offline',
      color: user.is_online ? '#10b981' : '#6b7280',
      text: user.is_online ? 'Online' : 'Offline',
      isOnline: user.is_online,
      lastSeen: user.last_seen
    };
  }, [friends, opponents, lobbyUsers]);

  /**
   * Get online counts
   */
  const getOnlineCounts = useCallback(() => {
    return {
      friends: friends.filter(f => f.is_online).length,
      opponents: opponents.filter(o => o.is_online).length,
      lobby: lobbyUsers.filter(u => u.is_online).length,
      total: [...friends, ...opponents, ...lobbyUsers]
        .filter(u => u.is_online)
        .length
    };
  }, [friends, opponents, lobbyUsers]);

  return {
    // Data
    friends,
    opponents,
    lobbyUsers,
    lobbyPagination,

    // Loading states
    loading,
    error,

    // Actions
    loadFriends,
    loadOpponents,
    loadLobbyUsers,
    loadMoreLobbyUsers,
    refreshFriends,
    refreshOpponents,
    refreshLobby,
    refreshAll,

    // Utilities
    isUserOnline,
    getUserStatus,
    getOnlineCounts
  };
};

export default useContextualPresence;
