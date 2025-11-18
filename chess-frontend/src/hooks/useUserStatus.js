// useUserStatus.js - React hook for database-backed user status
import { useState, useEffect, useCallback } from 'react';
import userStatusService from '../services/userStatusService';

/**
 * Custom hook for tracking user online/offline status
 * Uses database-backed approach for reliability
 */
const useUserStatus = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Initialize service on mount
  useEffect(() => {
    let mounted = true;

    const initService = async () => {
      const authToken = localStorage.getItem('auth_token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      if (!authToken || !user.id) {
        console.log('⚠️ [useUserStatus] No auth token or user, skipping initialization');
        return;
      }

      console.log('🚀 [useUserStatus] Initializing status service for user:', user.name);

      // Set up event handlers
      userStatusService.setEventHandlers({
        onConnectionRestore: () => {
          if (mounted) {
            console.log('✅ [useUserStatus] Connection restored');
            setIsServiceActive(true);
          }
        },
        onHeartbeatFail: (error) => {
          if (mounted) {
            console.warn('⚠️ [useUserStatus] Heartbeat failed:', error.message);
          }
        }
      });

      // Initialize the service
      const success = await userStatusService.initialize();

      if (mounted) {
        setIsInitialized(success);
        setIsServiceActive(success);

        if (success) {
          console.log('✅ [useUserStatus] Service initialized successfully');
          // Optionally load initial online users list
          loadOnlineUsers();
        }
      }
    };

    initService();

    return () => {
      mounted = false;
    };
  }, []);

  // Load online users (optional - for showing online users list)
  const loadOnlineUsers = useCallback(async () => {
    try {
      const users = await userStatusService.getOnlineUsers();
      setOnlineUsers(users);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load online users:', error);
    }
  }, []);

  // Check if a specific user is online
  const isUserOnline = useCallback(async (userId) => {
    if (!userId) {
      return false;
    }

    try {
      const online = await userStatusService.isUserOnline(userId);
      return online;
    } catch (error) {
      console.error(`Failed to check status for user ${userId}:`, error);
      return false;
    }
  }, []);

  // Batch check multiple users
  const batchCheckStatus = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) {
      return new Map();
    }

    try {
      const statusMap = await userStatusService.batchCheckStatus(userIds);
      return statusMap;
    } catch (error) {
      console.error('Batch status check failed:', error);
      return new Map();
    }
  }, []);

  // Get user status with color and text
  const getUserStatus = useCallback(async (userId) => {
    const online = await isUserOnline(userId);

    return {
      status: online ? 'online' : 'offline',
      color: online ? '#10b981' : '#6b7280',
      text: online ? 'Online' : 'Offline',
      isOnline: online
    };
  }, [isUserOnline]);

  // Clear cache for a user
  const clearCache = useCallback((userId = null) => {
    userStatusService.clearCache(userId);
  }, []);

  // Refresh online users list
  const refreshOnlineUsers = useCallback(async () => {
    await loadOnlineUsers();
  }, [loadOnlineUsers]);

  return {
    isInitialized,
    isServiceActive,
    onlineUsers,
    lastUpdate,
    isUserOnline,
    batchCheckStatus,
    getUserStatus,
    clearCache,
    refreshOnlineUsers
  };
};

export default useUserStatus;
