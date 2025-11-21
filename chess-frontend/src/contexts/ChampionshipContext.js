// ChampionshipContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ChampionshipContext = createContext(null);

export const ChampionshipProvider = ({ children }) => {
  const [championships, setChampionships] = useState([]);
  const [activeChampionship, setActiveChampionship] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [standings, setStandings] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Fetch all championships
  const fetchChampionships = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/championships', { params: filters });
      const championshipsData = response.data.data || response.data;
      setChampionships(championshipsData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch championships');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single championship
  const fetchChampionship = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/championships/${id}`);
      const championship = response.data.championship || response.data; // Handle both response formats
      setActiveChampionship(championship);
      return championship;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create championship
  const createChampionship = useCallback(async (championshipData) => {
    setLoading(true);
    setError(null);
    try {
      // Map frontend field names to backend field names
      console.log('Context - Received championshipData:', championshipData);
      console.log('Context - registration_end_at:', championshipData.registration_end_at);
      console.log('Context - starts_at:', championshipData.starts_at);

      const backendData = {
        title: championshipData.name,
        description: championshipData.description,
        entry_fee: championshipData.entry_fee || 0,
        max_participants: championshipData.max_participants,
        registration_deadline: championshipData.registration_end_at,
        start_date: championshipData.starts_at,
        match_time_window_hours: championshipData.settings?.round_duration_days
          ? championshipData.settings.round_duration_days * 24
          : 72, // Default 3 days in hours
        time_control_minutes: championshipData.time_control?.minutes || 10,
        time_control_increment: championshipData.time_control?.increment || 0,
        total_rounds: championshipData.total_rounds || 5,
        format: championshipData.format,
        swiss_rounds: championshipData.total_rounds, // Used for swiss_only and hybrid formats
        top_qualifiers: championshipData.top_qualifiers, // Used for hybrid format
        organization_id: championshipData.organization_id || null,
        visibility: championshipData.visibility || 'public',
        allow_public_registration: championshipData.allow_public_registration !== false,
      };

      console.log('Context - Sending backendData to API:', backendData);
      console.log('Context - backendData.registration_deadline:', backendData.registration_deadline);
      console.log('Context - backendData.start_date:', backendData.start_date);

      const response = await api.post('/championships', backendData);
      const championship = response.data.championship || response.data; // Handle both response formats
      setChampionships(prev => [...prev, championship]);
      return championship;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update championship
  const updateChampionship = useCallback(async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      // Map frontend field names to backend field names (same as createChampionship)
      const backendData = {
        title: data.name,
        description: data.description,
        entry_fee: data.entry_fee || 0,
        max_participants: data.max_participants,
        registration_deadline: data.registration_end_at,
        start_date: data.starts_at,
        match_time_window_hours: data.settings?.round_duration_days
          ? data.settings.round_duration_days * 24
          : 72, // Default 3 days in hours
        time_control_minutes: data.time_control?.minutes || 10,
        time_control_increment: data.time_control?.increment || 0,
        total_rounds: data.total_rounds || 5,
        format: data.format,
        swiss_rounds: data.total_rounds, // Used for swiss_only and hybrid formats
        top_qualifiers: data.top_qualifiers, // Used for hybrid format
        organization_id: data.organization_id || null,
        visibility: data.visibility || 'public',
        allow_public_registration: data.allow_public_registration !== false,
      };

      const response = await api.put(`/championships/${id}`, backendData);
      const updated = response.data;

      setChampionships(prev => prev.map(champ => champ.id === id ? updated : champ));

      // Update activeChampionship using functional update so we don't depend on activeChampionship identity
      setActiveChampionship(prev => (prev && prev.id === id ? updated : prev));

      return updated;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // no activeChampionship dependency

  // Delete championship (archive - soft delete)
  const deleteChampionship = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/championships/${id}`);
      setChampionships(prev => prev.filter(champ => champ.id !== id));
      setActiveChampionship(prev => (prev && prev.id === id ? null : prev));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to archive championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore archived championship
  const restoreChampionship = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/championships/${id}/restore`);
      const restored = response.data.championship || response.data;

      // Add back to championships list
      setChampionships(prev => [...prev, restored]);

      return restored;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Permanently delete championship (force delete)
  const forceDeleteChampionship = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/championships/${id}/force`);
      setChampionships(prev => prev.filter(champ => champ.id !== id));
      setActiveChampionship(prev => (prev && prev.id === id ? null : prev));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to permanently delete championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Register for championship
  const registerForChampionship = useCallback(async (id, paymentData = null) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = paymentData ? `/championships/${id}/register-with-payment` : `/championships/${id}/register`;
      const response = await api.post(endpoint, paymentData || {});

      // Update participants_count and user_participation using functional update
      setActiveChampionship(prev => {
        if (!prev || prev.id !== id) return prev;
        const participants_count = (prev.participants_count || prev.registered_count || 0) + 1;
        return { ...prev, participants_count, user_participation: response.data.participation };
      });

      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register for championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch championship participants
  const fetchParticipants = useCallback(async (id) => {
    if (!id) return null; // defensive guard
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/championships/${id}/participants`);
      const participantsData = response.data.data || response.data;
      // Ensure participants is always an array
      setParticipants(Array.isArray(participantsData) ? participantsData : []);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch participants');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch championship standings
  const fetchStandings = useCallback(async (id) => {
    if (!id) return null; // defensive guard
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/championships/${id}/standings`);
      setStandings(response.data.data || response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch standings');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Track fetched data per championship to prevent redundant fetches
  const fetchedDataRef = useRef(new Set());

  // Auto-fetch participants and standings when active championship changes, but only once per ID
  useEffect(() => {
    const id = activeChampionship?.id;
    if (id && !fetchedDataRef.current.has(`participants_${id}`) && !fetchedDataRef.current.has(`standings_${id}`)) {
      console.log('ChampionshipContext: Auto-fetching participants and standings for ID:', id);
      fetchedDataRef.current.add(`participants_${id}`);
      fetchedDataRef.current.add(`standings_${id}`);
      fetchParticipants(id);
      fetchStandings(id);
    }
  }, [activeChampionship?.id, fetchParticipants, fetchStandings]);

  // Fetch championship matches
  const fetchMatches = useCallback(async (id, filters = {}) => {
    if (!id) return null; // defensive guard
    setLoading(true);
    setError(null);
    try {
      // If user_only is true, use the dedicated my-matches endpoint
      if (filters.user_only && filters.user_id) {
        const response = await api.get(`/championships/${id}/my-matches`);
        return response.data.data || response.data;
      }

      // Otherwise, use the regular matches endpoint
      const response = await api.get(`/championships/${id}/matches`, { params: filters });
      return response.data.data || response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch matches');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all user's championship matches (across all championships)
  const fetchMyMatches = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/championship-matches/my-matches', { params: filters });
      return response.data.data || response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch my matches');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Start championship
  const startChampionship = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/championships/${id}/start`);
      const started = response.data;

      // Use functional update
      setActiveChampionship(prev => (prev && prev.id === id ? started : prev));
      return started;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Pause championship
  const pauseChampionship = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/admin/tournaments/${id}/pause`);
      const paused = response.data;

      // Use functional update
      setActiveChampionship(prev => (prev && prev.id === id ? paused : prev));

      // Also update the championships list
      setChampionships(prev => prev.map(champ => champ.id === id ? paused : champ));

      return paused;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to pause championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete championship
  const completeChampionship = useCallback(async (id, finalStandings = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/admin/tournaments/${id}/complete`, {
        final_standings: finalStandings
      });
      const completed = response.data;

      // Use functional update
      setActiveChampionship(prev => (prev && prev.id === id ? completed : prev));

      // Also update the championships list
      setChampionships(prev => prev.map(champ => champ.id === id ? completed : champ));

      return completed;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete championship');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate next round
  const generateNextRound = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/championships/${id}/generate-next-round`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate next round');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Report match result
  const reportMatchResult = useCallback(async (matchId, resultData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/championship-matches/${matchId}/report-result`, resultData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to report match result');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create game from match
  const createGameFromMatch = useCallback(async (matchId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/championship-matches/${matchId}/create-game`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create game');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(() => {
    const contextValue = {
      championships,
      activeChampionship,
      currentMatch,
      standings,
      participants,
      loading,
      error,
      fetchChampionships,
      fetchChampionship,
      createChampionship,
      updateChampionship,
      deleteChampionship,
      restoreChampionship,
      forceDeleteChampionship,
      registerForChampionship,
      fetchParticipants,
      fetchStandings,
      fetchMatches,
      fetchMyMatches,
      startChampionship,
      pauseChampionship,
      completeChampionship,
      generateNextRound,
      reportMatchResult,
      createGameFromMatch,
      setActiveChampionship,
      setCurrentMatch,
      clearError,
    };
    
    // Debug logging to track context re-renders
    console.log('ChampionshipContext: Context value updated', {
      activeChampionshipId: activeChampionship?.id,
      championshipsCount: championships.length,
      loading,
      error: error?.message
    });
    
    return contextValue;
  }, [
    championships,
    activeChampionship,
    currentMatch,
    standings,
    participants,
    loading,
    error,
    // Remove all function dependencies since they should be stable with useCallback
    // fetchChampionships,
    // fetchChampionship,
    // createChampionship,
    // updateChampionship,
    // deleteChampionship,
    // registerForChampionship,
    // fetchParticipants,
    // fetchStandings,
    // fetchMatches,
    // startChampionship,
    // generateNextRound,
    // reportMatchResult,
    // createGameFromMatch,
    // clearError,
  ]);

  return (
    <ChampionshipContext.Provider value={value}>
      {children}
    </ChampionshipContext.Provider>
  );
};

export const useChampionship = () => {
  const context = useContext(ChampionshipContext);
  if (!context) {
    throw new Error('useChampionship must be used within a ChampionshipProvider');
  }
  return context;
};
