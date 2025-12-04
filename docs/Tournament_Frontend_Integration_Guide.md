# Tournament Frontend Integration Guide

**Date**: 2025-12-03
**Status**: ✅ COMPLETED
**Version**: 2.0

---

## Overview

This guide explains how the frontend components handle **placeholder matches** in elimination rounds. The backend generates elimination matches with `null` player IDs, and the frontend resolves them dynamically based on tournament standings.

---

## Core Principle

```yaml
Swiss Rounds:
  - Players: PRE-DETERMINED (stored with actual IDs)
  - Backend: Provides actual player1_id and player2_id
  - Frontend: Displays player names directly

Elimination Rounds:
  - Players: PLACEHOLDERS (null IDs, resolved dynamically)
  - Backend: Provides metadata (bracket_position, requires_top_k)
  - Frontend: Resolves players from standings, shows "TBD" when locked
```
3. **Live Standings Tracking** - Real-time standings with proper tiebreakers
4. **Placeholder Matches** - `is_placeholder: true` for elimination rounds
5. **Third Place Match** - Automatic inclusion for applicable tournaments
6. **Complete Rankings** - Final positions for all players

## 📁 Files to Integrate

### 1. Helper Functions (Required)
```
Copy: chess-backend/public/tournament-helpers.js
To:   chess-frontend/src/utils/tournamentHelpers.js
```

### 2. Tournament Admin Dashboard (Modify)
```
File: chess-frontend/src/components/championship/TournamentAdminDashboard.jsx
Add: Dynamic match resolution and standings
```

### 3. Standings Display Component (Create)
```
New: chess-frontend/src/components/tournament/LiveStandings.jsx
```

### 4. Bracket Display Component (Create)
```
New: chess-frontend/src/components/tournament/DynamicBracket.jsx
```

---

## 🛠️ Step 1: Install Helper Functions

### Copy tournament-helpers.js
```bash
# Copy from backend to frontend
cp chess-backend/public/tournament-helpers.js chess-frontend/src/utils/tournamentHelpers.js
```

### Convert to ES6 Module
```javascript
// chess-frontend/src/utils/tournamentHelpers.js

// Remove browser-specific code and convert to ES6 export
export class TournamentStandingsManager {
    // ... (same implementation as before)
}

// Remove browser initialization code
// Remove: window.TournamentStandingsManager, window.tournamentManager

export default TournamentStandingsManager;
```

### Import in React Components
```jsx
// TournamentAdminDashboard.jsx
import TournamentStandingsManager from '../utils/tournamentHelpers';

export default function TournamentAdminDashboard({ championship }) {
    const [tournamentManager] = useState(() => new TournamentStandingsManager());
    // ... rest of component
}
```

---

## 🛠️ Step 2: Update API Responses

### Backend API Enhancement
Ensure your championship API returns match data with:

```json
{
    "matches": [
        {
            "id": 1,
            "round_number": 1,
            "round_type": "swiss",
            "player1_id": 123,
            "player2_id": 124,
            "is_placeholder": false,
            "status": "completed",
            "player1_result": 1,
            "player2_result": 0
        },
        {
            "id": 15,
            "round_number": 3,
            "round_type": "semi_final",
            "player1_id": null,
            "player2_id": null,
            "is_placeholder": true,
            "player1_bracket_position": 1,
            "player2_bracket_position": 4,
            "determined_by_round": 2,
            "requires_top_k": 4,
            "status": "pending"
        }
    ]
}
```

### Championship API Route
```php
// routes/api.php
Route::get('/championships/{id}/with-matches', function ($id) {
    $championship = Championship::with([
        'participants.user',
        'matches' => function ($query) {
            $query->with(['player1:id,name,rating', 'player2:id,name,rating'])
                  ->orderBy('round_number')
                  ->orderBy('id');
        }
    ])->findOrFail($id);

    return response()->json($championship);
});
```

---

## 🛠️ Step 3: Live Standings Component

### Create LiveStandings.jsx
```jsx
import React, { useState, useEffect, useMemo } from 'react';
import TournamentStandingsManager from '../utils/tournamentHelpers';

const LiveStandings = ({ matches, participants, matchResults, showToggle = true }) => {
    const [tournamentManager] = useState(() => new TournamentStandingsManager());
    const [isVisible, setIsVisible] = useState(true);

    const currentStandings = useMemo(() => {
        const completedMatches = matches.map(match => ({
            ...match,
            player1_result: matchResults[match.id] === match.player1_id ? 1 :
                           matchResults[match.id] === match.player2_id ? 0 : null,
            player2_result: matchResults[match.id] === match.player2_id ? 1 :
                           matchResults[match.id] === match.player1_id ? 0 : null,
            status: matchResults[match.id] ? 'completed' : 'pending'
        }));

        return tournamentManager.calculateStandings(completedMatches, participants);
    }, [matches, participants, matchResults, tournamentManager]);

    const getRankBadge = (rank) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    };

    const getRankClass = (rank) => {
        switch (rank) {
            case 1: return 'rank-1';
            case 2: return 'rank-2';
            case 3: return 'rank-3';
            default: return 'rank-other';
        }
    };

    if (!isVisible) {
        return (
            <div className="standings-container">
                <div className="standings-header">
                    <h3>📊 Tournament Standings</h3>
                    <button
                        className="btn btn-info btn-sm"
                        onClick={() => setIsVisible(true)}
                    >
                        🔄 Show
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="standings-container">
            <div className="standings-header">
                <h3>📊 Live Tournament Standings</h3>
                {showToggle && (
                    <button
                        className="btn btn-info btn-sm"
                        onClick={() => setIsVisible(false)}
                    >
                        🔄 Hide
                    </button>
                )}
            </div>

            <div className="table-responsive">
                <table className="standings-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Rating</th>
                            <th>Points</th>
                            <th>W-L-D</th>
                            <th>Matches</th>
                            <th>Buchholz</th>
                            <th>Sonneborn-Berger</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentStandings.map((standing, index) => (
                            <tr key={standing.id} className={getRankClass(index + 1)}>
                                <td className="rank">
                                    <span className="rank-badge">{getRankBadge(index + 1)}</span>
                                </td>
                                <td className="player-name">{standing.name}</td>
                                <td className="rating">{standing.rating}</td>
                                <td className="points">{standing.points}</td>
                                <td className="record">
                                    {standing.wins}-{standing.losses}-{standing.draws}
                                </td>
                                <td className="matches">{standing.matches_played}</td>
                                <td className="tiebreaker">{standing.buchholz.toFixed(1)}</td>
                                <td className="tiebreaker">{standing.sonneborn_berger.toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LiveStandings;
```

---

## 🛠️ Step 4: Dynamic Bracket Component

### Create DynamicBracket.jsx
```jsx
import React, { useState, useMemo } from 'react';
import TournamentStandingsManager from '../utils/tournamentHelpers';
import LiveStandings from './LiveStandings';

const DynamicBracket = ({ tournament, onMatchResult, currentResults }) => {
    const [tournamentManager] = useState(() => new TournamentStandingsManager());

    const { rounds, participants, matches } = tournament;

    // Calculate current standings for dynamic resolution
    const currentStandings = useMemo(() => {
        const completedMatches = matches.map(match => ({
            ...match,
            player1_result: currentResults[match.id] === match.player1_id ? 1 :
                           currentResults[match.id] === match.player2_id ? 0 : null,
            player2_result: currentResults[match.id] === match.player2_id ? 1 :
                           currentResults[match.id] === match.player1_id ? 0 : null,
            status: currentResults[match.id] ? 'completed' : 'pending'
        }));

        return tournamentManager.calculateStandings(completedMatches, participants);
    }, [matches, participants, currentResults, tournamentManager]);

    // Check if round should be unlocked
    const shouldRoundUnlock = (roundNumber) => {
        if (roundNumber === 1) return true;

        const previousRoundMatches = matches.filter(match => match.round_number === roundNumber - 1);
        return previousRoundMatches.every(match => match.status === 'completed' || currentResults[match.id]);
    };

    // Resolve match participants dynamically
    const resolveMatchParticipants = (match) => {
        if (!match.is_placeholder) {
            return match;
        }

        const resolvedMatch = { ...match };

        if (match.round_type === 'semi_final') {
            const top4 = tournamentManager.getTopKPlayers(currentStandings, 4);
            if (top4.length >= 4) {
                resolvedMatch.player1_id = top4[0].id;
                resolvedMatch.player2_id = top4[3].id; // 1v4 seeding
            }
        } else if (match.round_type === 'final') {
            const top2 = tournamentManager.getTopKPlayers(currentStandings, 2);
            if (top2.length >= 2) {
                resolvedMatch.player1_id = top2[0].id;
                resolvedMatch.player2_id = top2[1].id;
            }
        } else if (match.round_type === 'third_place') {
            // For third place, we need semi-final results
            const semiFinalMatches = matches.filter(m => m.round_type === 'semi_final');
            const semiFinalLosers = getLosersFromSemi(semiFinalMatches, currentResults, participants);
            if (semiFinalLosers.length >= 2) {
                resolvedMatch.player1_id = semiFinalLosers[0].id;
                resolvedMatch.player2_id = semiFinalLosers[1].id;
            }
        } else if (match.round_type === 'quarter_final') {
            const top8 = tournamentManager.getTopKPlayers(currentStandings, 8);
            if (top8.length >= 8) {
                // Standard quarter final seeding
                const bracketPos = match.player1_bracket_position;
                resolvedMatch.player1_id = top8[bracketPos - 1]?.id;
                resolvedMatch.player2_id = top8[8 - bracketPos]?.id; // 1v8, 2v7, etc.
            }
        }

        return resolvedMatch;
    };

    const getLosersFromSemi = (semiFinalMatches, results, participants) => {
        const losers = [];

        semiFinalMatches.forEach(match => {
            const winnerId = results[match.id];
            if (winnerId) {
                const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
                const loser = participants.find(p => p.id === loserId);
                if (loser) losers.push(loser);
            }
        });

        return losers;
    };

    const renderMatch = (match, roundNumber) => {
        const resolvedMatch = resolveMatchParticipants(match);
        const isUnlocked = shouldRoundUnlock(roundNumber);
        const isLocked = !isUnlocked && match.is_placeholder;

        const player1 = participants.find(p => p.id === resolvedMatch.player1_id);
        const player2 = participants.find(p => p.id === resolvedMatch.player2_id);
        const winnerId = currentResults[match.id];

        const handlePlayerClick = (playerId) => {
            if (isLocked || !playerId || match.is_placeholder && !player1 && !player2) return;
            onMatchResult(match.id, playerId);
        };

        return (
            <div
                key={match.id}
                className={`tournament-match ${isLocked ? 'locked' : ''} ${winnerId ? 'completed' : ''}`}
            >
                <div className="match-header">
                    {match.is_placeholder && (!player1 || !player2) ? (
                        `TBD - ${match.round_type.replace('_', ' ').toUpperCase()}`
                    ) : (
                        player1 && player2 ? `${player1.name} vs ${player2.name}` : 'Unknown Players'
                    )}
                </div>

                <div className="match-players">
                    {player1 ? (
                        <div
                            className={`player ${winnerId === player1.id ? 'winner' : ''} ${winnerId && winnerId !== player1.id ? 'loser' : ''}`}
                            onClick={() => handlePlayerClick(player1.id)}
                        >
                            <div className="player-info">
                                <span className="player-name">{player1.name}</span>
                                <span className="player-rating">{player1.rating}</span>
                            </div>
                            {winnerId === player1.id && <span className="winner-badge">WINNER</span>}
                        </div>
                    ) : (
                        <div className="player tbd">
                            <div className="player-info">
                                <span className="player-name">TBD</span>
                                <span className="player-rating">Waiting for standings</span>
                            </div>
                        </div>
                    )}

                    {player2 ? (
                        <div
                            className={`player ${winnerId === player2.id ? 'winner' : ''} ${winnerId && winnerId !== player2.id ? 'loser' : ''}`}
                            onClick={() => handlePlayerClick(player2.id)}
                        >
                            <div className="player-info">
                                <span className="player-name">{player2.name}</span>
                                <span className="player-rating">{player2.rating}</span>
                            </div>
                            {winnerId === player2.id && <span className="winner-badge">WINNER</span>}
                        </div>
                    ) : (
                        <div className="player tbd">
                            <div className="player-info">
                                <span className="player-name">TBD</span>
                                <span className="player-rating">Waiting for standings</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const getRoundStatus = (round, roundNumber) => {
        const isCompleted = round.matches.every(match =>
            match.status === 'completed' || currentResults[match.id]
        );
        const isUnlocked = shouldRoundUnlock(roundNumber);

        if (isCompleted) return { text: 'COMPLETED', class: 'completed' };
        if (isUnlocked) return { text: 'IN PROGRESS', class: 'unlocked' };
        return { text: 'LOCKED', class: 'locked' };
    };

    return (
        <div className="tournament-bracket">
            <LiveStandings
                matches={matches}
                participants={participants}
                matchResults={currentResults}
            />

            <div className="tournament-rounds">
                {rounds.map((round, roundIndex) => {
                    const roundNumber = roundIndex + 1;
                    const status = getRoundStatus(round, roundNumber);
                    const roundMatches = matches.filter(m => m.round_number === roundNumber);

                    return (
                        <div key={roundNumber} className="tournament-round">
                            <div className="round-header">
                                <h3>{round.name}</h3>
                                <span className={`round-status ${status.class}`}>
                                    {status.text}
                                </span>
                                {round.round_type === 'swiss' && (
                                    <small className="text-muted">Swiss Pairing</small>
                                )}
                            </div>

                            <div className="round-matches">
                                {roundMatches.map(match => renderMatch(match, roundNumber))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DynamicBracket;
```

---

## 🛠️ Step 5: Update TournamentAdminDashboard

### Modify TournamentAdminDashboard.jsx
```jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import TournamentStandingsManager from '../utils/tournamentHelpers';
import DynamicBracket from './DynamicBracket';

const TournamentAdminDashboard = ({ championship }) => {
    const [tournamentManager] = useState(() => new TournamentStandingsManager());
    const [tournamentData, setTournamentData] = useState(null);
    const [matchResults, setMatchResults] = useState({});
    const [loading, setLoading] = useState(true);

    // Load tournament data
    useEffect(() => {
        loadTournamentData();
    }, [championship.id]);

    const loadTournamentData = async () => {
        try {
            setLoading(true);

            // Use the enhanced API endpoint
            const response = await fetch(`/api/championships/${championship.id}/with-matches`);
            const data = await response.json();

            // Process matches to include is_placeholder flag
            const processedMatches = data.matches.map(match => ({
                ...match,
                is_placeholder: shouldMatchBePlaceholder(match),
                player1_bracket_position: getBracketPosition(match, 1),
                player2_bracket_position: getBracketPosition(match, 2)
            }));

            setTournamentData({
                ...data,
                matches: processedMatches
            });

        } catch (error) {
            toast.error('Failed to load tournament data');
            console.error('Error loading tournament:', error);
        } finally {
            setLoading(false);
        }
    };

    const shouldMatchBePlaceholder = (match) => {
        const eliminationTypes = ['semi_final', 'quarter_final', 'final', 'third_place', 'round_of_16'];
        return eliminationTypes.includes(match.round_type);
    };

    const getBracketPosition = (match, playerNumber) => {
        // Return bracket position based on match type and position in bracket
        // This logic should match the test data generator
        const posKey = `player${playerNumber}_bracket_position`;
        return match[posKey] || null;
    };

    const handleMatchResult = async (matchId, winnerId) => {
        try {
            // Toggle winner selection
            const newResults = { ...matchResults };
            if (newResults[matchId] === winnerId) {
                delete newResults[matchId];
            } else {
                newResults[matchId] = winnerId;
            }

            // Update local state immediately for responsive UI
            setMatchResults(newResults);

            // Send to backend (implement API endpoint)
            await fetch(`/api/matches/${matchId}/result`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ winner_id: winnerId }),
            });

            toast.success('Match result updated');

            // Check if tournament is complete
            checkTournamentCompletion(newResults);

        } catch (error) {
            toast.error('Failed to update match result');
            console.error('Error updating result:', error);

            // Revert local state on error
            setMatchResults(matchResults);
        }
    };

    const checkTournamentCompletion = (results) => {
        if (!tournamentData) return;

        const allMatchesCompleted = tournamentData.matches.every(match =>
            match.status === 'completed' || results[match.id]
        );

        if (allMatchesCompleted) {
            generateFinalRankings(results);
        }
    };

    const generateFinalRankings = (results) => {
        if (!tournamentData) return;

        const completedMatches = tournamentData.matches.map(match => ({
            ...match,
            player1_result: results[match.id] === match.player1_id ? 1 :
                           results[match.id] === match.player2_id ? 0 : null,
            player2_result: results[match.id] === match.player2_id ? 1 :
                           results[match.id] === match.player1_id ? 0 : null,
            status: results[match.id] ? 'completed' : 'pending'
        }));

        const finalResults = tournamentManager.generateFinalRankings(
            completedMatches,
            tournamentData.participants.map(p => p.user),
            getFinalMatchResults(results)
        );

        // Show final rankings modal or navigate to results page
        showFinalRankings(finalResults);
    };

    const getFinalMatchResults = (results) => {
        const matches = tournamentData.matches;
        const finalMatch = matches.find(m => m.round_type === 'final');
        const thirdPlaceMatch = matches.find(m => m.round_type === 'third_place');

        return {
            champion: finalMatch && results[finalMatch.id] ?
                tournamentData.participants.find(p => p.user_id === results[finalMatch.id])?.user : null,
            runner_up: finalMatch && results[finalMatch.id] ?
                tournamentData.participants.find(p => p.user_id === (finalMatch.player1_id === results[finalMatch.id] ? finalMatch.player2_id : finalMatch.player1_id))?.user : null,
            third_place: thirdPlaceMatch && results[thirdPlaceMatch.id] ?
                tournamentData.participants.find(p => p.user_id === results[thirdPlaceMatch.id])?.user : null
        };
    };

    const showFinalRankings = (finalRankings) => {
        // Implement final rankings display (modal, new page, etc.)
        console.log('Tournament Complete! Final Rankings:', finalRankings);
        toast.success('🏆 Tournament Complete! Check final rankings.');
    };

    const resetAllResults = () => {
        setMatchResults({});
        toast.info('All match results reset');
    };

    if (loading) {
        return <div className="loading-spinner">Loading tournament...</div>;
    }

    if (!tournamentData) {
        return <div className="error-message">Failed to load tournament data</div>;
    }

    return (
        <div className="tournament-admin-dashboard">
            <div className="dashboard-header">
                <h2>{championship.title}</h2>
                <div className="dashboard-controls">
                    <button
                        className="btn btn-secondary"
                        onClick={resetAllResults}
                    >
                        🔄 Reset All Winners
                    </button>
                </div>
            </div>

            <div className="dashboard-content">
                <DynamicBracket
                    tournament={tournamentData}
                    onMatchResult={handleMatchResult}
                    currentResults={matchResults}
                />
            </div>
        </div>
    );
};

export default TournamentAdminDashboard;
```

---

## 🛠️ Step 6: CSS Styling

### Add Tournament CSS
```css
/* src/styles/tournament.css */

.tournament-admin-dashboard {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e9ecef;
}

.dashboard-controls {
    display: flex;
    gap: 10px;
}

.tournament-bracket {
    display: grid;
    gap: 30px;
}

.standings-container {
    background: white;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    margin-bottom: 30px;
}

.standings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.standings-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
}

.standings-table th {
    background: #3498db;
    color: white;
    padding: 12px 15px;
    text-align: left;
    font-weight: bold;
    font-size: 14px;
}

.standings-table td {
    padding: 10px 15px;
    border-bottom: 1px solid #e9ecef;
    font-size: 13px;
}

.standings-table tr:hover {
    background: #f8f9fa;
}

.rank-1 { color: #FFD700; font-weight: bold; }
.rank-2 { color: #C0C0C0; font-weight: bold; }
.rank-3 { color: #CD7F32; font-weight: bold; }
.rank-other { color: #666; }

.tournament-rounds {
    display: grid;
    gap: 30px;
}

.tournament-round {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.round-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e9ecef;
}

.round-header h3 {
    margin: 0;
    color: #2c3e50;
}

.round-status {
    padding: 8px 15px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
}

.round-status.completed {
    background: #d4edda;
    color: #155724;
}

.round-status.unlocked {
    background: #cce5ff;
    color: #004085;
}

.round-status.locked {
    background: #f8d7da;
    color: #721c24;
}

.round-matches {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 15px;
}

.tournament-match {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 10px;
    padding: 15px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tournament-match.completed {
    border-color: #28a745;
    background: #f8fff9;
}

.tournament-match.locked {
    opacity: 0.6;
    background: #f8f9fa;
}

.match-header {
    font-weight: bold;
    margin-bottom: 10px;
    color: #495057;
    text-align: center;
    font-size: 14px;
}

.match-players {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.player {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
    border: 2px solid transparent;
}

.player:hover:not(.bye):not(.tbd) {
    background: #e9ecef;
    transform: translateX(5px);
}

.player.winner {
    background: #28a745;
    color: white;
    border-color: #1e7e34;
}

.player.loser {
    background: #dc3545;
    color: white;
    border-color: #c82333;
}

.player.bye {
    background: #ffc107;
    color: #212529;
    border-color: #e0a800;
    cursor: default;
}

.player.tbd {
    background: #6c757d;
    color: white;
    cursor: default;
    text-align: center;
    font-style: italic;
}

.player-info {
    flex: 1;
}

.player-name {
    font-weight: bold;
    font-size: 14px;
}

.player-rating {
    font-size: 12px;
    opacity: 0.8;
}

.winner-badge {
    background: #28a745;
    color: white;
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: bold;
}

/* Responsive Design */
@media (max-width: 768px) {
    .tournament-admin-dashboard {
        padding: 10px;
    }

    .dashboard-header {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
    }

    .round-matches {
        grid-template-columns: 1fr;
    }

    .standings-table {
        font-size: 12px;
    }

    .standings-table th,
    .standings-table td {
        padding: 8px 10px;
    }
}
```

---

## 🧪 Testing Integration

### Test with Sample Data
```jsx
// Use the generated test data for development
const testTournament = {
    rounds: [...], // From tournament_test_5_players_v2.json
    participants: [...],
    matches: [...]
};

// Test in development mode
<DynamicBracket
    tournament={testTournament}
    onMatchResult={(matchId, winnerId) => console.log('Winner:', winnerId)}
    currentResults={{}}
/>
```

### Test Cases to Verify
1. **Equal Contribution**: Each player plays once per Swiss round
2. **Round Locking**: Round 2 matches are locked until Round 1 completes
3. **Dynamic Resolution**: Semi-final shows "TBD" until Round 2 completes
4. **Proper Seeding**: Final shows actual winners, not pre-assigned players
5. **Third Place Match**: Appears after semi-finals
6. **Live Standings**: Update correctly after each match
7. **Complete Rankings**: All players get final position

---

## 📋 API Endpoints Required

### Championship with Matches
```php
GET /api/championships/{id}/with-matches
Response: {
    id: 1,
    title: "Tournament Name",
    participants: [{ user: { id, name, rating } }],
    matches: [{
        id: 1,
        round_number: 1,
        round_type: "swiss",
        player1_id: 123,
        player2_id: 124,
        is_placeholder: false,
        status: "pending"
    }, {
        id: 15,
        round_number: 3,
        round_type: "semi_final",
        player1_id: null,
        player2_id: null,
        is_placeholder: true,
        player1_bracket_position: 1,
        player2_bracket_position: 4,
        determined_by_round: 2,
        requires_top_k: 4,
        status: "pending"
    }]
}
```

### Update Match Result
```php
POST /api/matches/{id}/result
Body: { winner_id: 123 }
Response: { success: true, message: "Match result updated" }
```

### Get Tournament Standings
```php
GET /api/championships/{id}/standings
Response: {
    standings: [{
        id: 1,
        name: "Player Name",
        rating: 1500,
        points: 3,
        wins: 1,
        draws: 0,
        losses: 0,
        matches_played: 1,
        buchholz: 1.5,
        sonneborn_berger: 3.0,
        rank: 1
    }]
}
```

---

## 🎯 Implementation Checklist

- [ ] Copy `tournament-helpers.js` to frontend utils
- [ ] Convert helper functions to ES6 module
- [ ] Create `LiveStandings.jsx` component
- [ ] Create `DynamicBracket.jsx` component
- [ ] Update `TournamentAdminDashboard.jsx`
- [ ] Add tournament CSS styles
- [ ] Implement required API endpoints
- [ ] Test with sample tournament data
- [ ] Verify equal contribution in Swiss rounds
- [ ] Verify round locking mechanism
- [ ] Verify dynamic player assignment
- [ ] Test complete tournament flow
- [ ] Add error handling and validation
- [ ] Add loading states and user feedback

---

## 🔍 Debugging Tips

1. **Console Logging**: Use `console.log(tournamentManager.calculateStandings(...))` to verify calculations
2. **Match Resolution**: Check if `is_placeholder` flag is properly set in API responses
3. **Round Unlocking**: Verify `shouldRoundUnlock()` logic matches tournament requirements
4. **Standings Update**: Ensure standings recalculate after each match result
5. **API Data Format**: Validate that match data includes all required fields
6. **Player Assignment**: Check that bracket positions match expected seeding

---

---

## ✅ Implementation Status (2025-12-03)

### Backend Fixes Completed
✅ All elimination pairing methods return placeholders instead of actual player IDs
✅ `createPlaceholderMatch()` fixed and enhanced with metadata support
✅ Test data regenerated with correct placeholder structure (v2 files)
✅ Comprehensive metadata added: `requires_top_k`, `player1_bracket_position`, `player2_bracket_position`, `determined_by_round`

### Frontend Updates Completed
✅ **TournamentAdminDashboard.jsx** (Lines 500-523)
  - Added placeholder detection logic
  - Shows "TBD (Rank #1)" for locked elimination matches
  - Shows actual player names for resolved matches
  - Added visual distinction with CSS class

✅ **tournament_visualizer_v3.html** (Lines 800-855)
  - Updated `resolveMatchParticipants()` function
  - Uses backend metadata (`requires_top_k`, `bracket_position`)
  - Properly handles third-place matches (semi-final losers)
  - Falls back to `round_type` when `match_type` not set

### Key Changes Made

#### 1. TournamentAdminDashboard.jsx
```jsx
// Lines 500-523: Placeholder match handling
{pairingsPreview.map((pairing, index) => {
  const isPlaceholder = pairing.is_placeholder || (!pairing.player1_id || !pairing.player2_id);
  const player1Name = isPlaceholder
    ? `TBD (Rank #${pairing.player1_bracket_position || '?'})`
    : pairing.player1?.name || `Player ${pairing.player1_id || 'Unknown'}`;
  // ... similar for player2
})}
```

#### 2. tournament_visualizer_v3.html
```javascript
// Lines 800-838: Enhanced resolution logic
function resolveMatchParticipants(match) {
  if (!match.is_placeholder) return match;

  const matchType = match.round_type || match.match_type;

  if (match.requires_top_k) {
    const topPlayers = tournamentManager.getTopKPlayers(standings, match.requires_top_k);
    const pos1Index = (match.player1_bracket_position || 1) - 1;
    const pos2Index = (match.player2_bracket_position || 2) - 1;

    resolvedMatch.player1_id = topPlayers[pos1Index].id;
    resolvedMatch.player2_id = topPlayers[pos2Index].id;
  } else if (matchType === 'third_place') {
    // Special handling for semi-final losers
  }

  return resolvedMatch;
}
```

### Testing Completed
✅ 3-player tournament test data verified
✅ Placeholder match structure validated
✅ Dynamic resolution logic tested
✅ Round locking mechanism confirmed
✅ Bracket position metadata verified

### Documentation Created
✅ `BACKEND_FIXES_COMPLETED.md` - Detailed backend changes
✅ `TOURNAMENT_PRINCIPLES.md` - Core tournament rules
✅ `TOURNAMENT_VIOLATIONS_AND_FIXES.md` - Analysis and fixes
✅ `Tournament_Frontend_Integration_Guide.md` - This document (updated)

---

## 📚 Additional Resources

- [Backend Fixes Documentation](./BACKEND_FIXES_COMPLETED.md)
- [Tournament Principles](./TOURNAMENT_PRINCIPLES.md)
- [Violations & Fixes Analysis](./TOURNAMENT_VIOLATIONS_AND_FIXES.md)
- [Tournament System Documentation](../Tournament_Implementation_Summary.md)
- [Test Data Guide](../chess-backend/public/VISUALIZER_TESTING_GUIDE.md)
- [Helper Functions Reference](../chess-backend/public/tournament-helpers.js)
- [Sample Test Data](../chess-backend/public/tournament_test_5_players_v2.json)