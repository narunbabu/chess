import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Or your API service
import ChampionshipMatches from './ChampionshipMatches'; // Existing component

const TournamentAdminDashboard = ({ championshipId }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch matches (existing logic)
  const fetchMatches = async () => {
    try {
      const response = await axios.get(`/api/championships/${championshipId}/matches`);
      setMatches(response.data.data || []);
    } catch (err) {
      setError('Failed to fetch matches');
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [championshipId]);

  // Generate matches
  const handleGenerateMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`/api/championships/${championshipId}/generate-matches`);
      if (response.data.success) {
        setMatches(response.data.matches || []);
        alert(`${response.data.message}`);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError('Failed to generate matches');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tournament-admin-dashboard">
      <h2>Manage Tournament Matches</h2>
      
      {/* Generate Matches Button */}
      <div className="admin-actions">
        <button 
          onClick={handleGenerateMatches} 
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Generating...' : 'Generate Matches for Current Round'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {/* Display Matches */}
      <ChampionshipMatches matches={matches} />
    </div>
  );
};

export default TournamentAdminDashboard;
