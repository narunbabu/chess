// useUserPresence.js - Custom hook for tracking user online status
import { useState, useEffect } from 'react';
import presenceService from '../services/presenceService';

const useUserPresence = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializePresence = async () => {
      const authToken = localStorage.getItem('auth_token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      console.log('🚀 Initializing presence service:', {
        hasToken: !!authToken,
        userId: user.id,
        userName: user.name,
        mounted
      });

      if (!authToken || !user.id || !mounted) {
        console.warn('⚠️ Presence initialization failed:', {
          hasToken: !!authToken,
          userId: user.id,
          mounted
        });
        return;
      }

      // Set up event handlers
      presenceService.setEventHandlers({
        onConnectionChange: (connected) => {
          if (!mounted) return;
          console.log('🔌 Presence connection changed:', connected);
          setIsConnected(connected);
        },
        onUserOnline: (users) => {
          if (!mounted) return;
          console.log('👥 Users online event:', users);
          setOnlineUsers(prev => {
            const userIds = prev.map(u => u.user_id || u.id);
            const newUsers = users.filter(u => !userIds.includes(u.user_id || u.id));
            const updated = [...prev, ...newUsers];
            console.log('📝 Updated online users:', updated);
            return updated;
          });
        },
        onUserOffline: (user) => {
          if (!mounted) return;
          console.log('👋 User offline event:', user);
          setOnlineUsers(prev => {
            const filtered = prev.filter(u => (u.user_id || u.id) !== (user.user_id || user.id));
            console.log('📝 Updated online users after removal:', filtered);
            return filtered;
          });
        },
        onPresenceUpdate: (event) => {
          console.log('🔄 Presence update event:', event);
          // Handle presence updates if needed
        }
      });

      // Initialize the service
      const success = await presenceService.initialize(user, authToken);
      if (success && mounted) {
        setIsConnected(true);
      }
    };

    initializePresence();

    return () => {
      mounted = false;
    };
  }, []);

  // Check if a specific user is online
  const isUserOnline = (userId) => {
    if (!userId) {
      console.log(`🔍 isUserOnline(${userId}): no userId`);
      return false;
    }

    // If WebSocket is connected, use real-time data
    if (isConnected) {
      const online = onlineUsers.some(user => {
        const userMatch = (user.user_id || user.id) === parseInt(userId);
        if (userMatch && user.user) {
          console.log(`✅ Found online user:`, user.user.name);
        }
        return userMatch;
      });

      console.log(`🔍 isUserOnline(${userId}): ${online ? 'ONLINE' : 'OFFLINE'} (WebSocket) | Total online users: ${onlineUsers.length}`);
      return online;
    }

    // FALLBACK: If WebSocket is not connected, try API polling as backup
    console.log(`🔍 isUserOnline(${userId}): WebSocket not connected, using fallback...`);
    return false; // Conservative fallback - assume offline if WebSocket is down
  };

  // Get status for a user
  const getUserStatus = (userId) => {
    if (!isConnected) {
      return { status: 'unknown', color: '#6b7280', text: 'Unknown' };
    }

    const online = isUserOnline(userId);
    return {
      status: online ? 'online' : 'offline',
      color: online ? '#10b981' : '#6b7280',
      text: online ? 'Online' : 'Offline'
    };
  };

  return {
    onlineUsers,
    isConnected,
    isUserOnline,
    getUserStatus
  };
};

export default useUserPresence;