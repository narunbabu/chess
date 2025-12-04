/**
 * 🏆 Tournament Helper Functions
 *
 * Reusable functions for tournament standings, dynamic match resolution,
 * and bracket management. Can be used in visualizer, React frontend, and backend.
 *
 * @author Tournament System
 * @version 2.0
 */

class TournamentStandingsManager {
    constructor() {
        this.tieBreakers = ['points', 'buchholz', 'sonneborn_berger', 'rating'];
    }

    /**
     * 🧮 Calculate current standings based on completed matches
     * @param {Array} matches - Array of match objects
     * @param {Array} participants - Array of participant objects
     * @returns {Array} Sorted standings array
     */
    calculateStandings(matches, participants) {
        // Create shared cache for all player stats to prevent infinite recursion
        const statsCache = {};

        const standings = participants.map(participant => {
            const playerStats = this.calculatePlayerStats(participant.id, matches, participants, statsCache);
            return {
                ...participant,
                ...playerStats
            };
        });

        // Sort by tiebreakers
        return standings.sort((a, b) => {
            for (const tieBreaker of this.tieBreakers) {
                if (a[tieBreaker] !== b[tieBreaker]) {
                    return b[tieBreaker] - a[tieBreaker]; // Descending order
                }
            }
            return b.rating - a.rating; // Final tiebreaker
        });
    }

    /**
     * 📊 Calculate individual player statistics
     * @param {number} playerId - Player ID
     * @param {Array} matches - Array of match objects
     * @param {Array} participants - Array of participant objects
     * @param {Object} statsCache - Cache to prevent infinite recursion
     * @returns {Object} Player statistics
     */
    calculatePlayerStats(playerId, matches, participants, statsCache = {}) {
        // Return cached result if available
        if (statsCache[playerId]) {
            return statsCache[playerId];
        }

        const playerMatches = matches.filter(match =>
            (match.player1_id === playerId || match.player2_id === playerId) &&
            match.status === 'completed'
        );

        let wins = 0;
        let draws = 0;
        let losses = 0;

        // First pass: Calculate basic stats (no recursion)
        playerMatches.forEach(match => {
            const isPlayer1 = match.player1_id === playerId;
            const playerResult = isPlayer1 ? match.player1_result : match.player2_result;

            // Count results
            if (playerResult === 1) wins++;
            else if (playerResult === 0.5) draws++;
            else losses++;
        });

        // Cache basic stats to prevent recursion
        const basicStats = {
            points: wins * 1 + draws * 0.5,
            wins,
            draws,
            losses,
            matches_played: playerMatches.length,
            buchholz: 0,
            sonneborn_berger: 0
        };
        statsCache[playerId] = basicStats;

        // Second pass: Calculate tiebreakers using cached stats
        let buchholz = 0;
        let sonnebornBerger = 0;

        playerMatches.forEach(match => {
            const isPlayer1 = match.player1_id === playerId;
            const playerResult = isPlayer1 ? match.player1_result : match.player2_result;
            const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

            // Buchholz: Sum of opponents' scores
            const opponentStats = this.calculatePlayerStats(opponentId, matches, participants, statsCache);
            buchholz += (opponentStats.wins * 1 + opponentStats.draws * 0.5);

            // Sonneborn-Berger: Score × Opponent's score
            if (playerResult > 0) {
                sonnebornBerger += playerResult * (opponentStats.wins * 1 + opponentStats.draws * 0.5);
            }
        });

        // Update cache with complete stats
        basicStats.buchholz = buchholz;
        basicStats.sonneborn_berger = sonnebornBerger;

        return basicStats;
    }

    /**
     * 🏅 Get top K players from current standings
     * @param {Array} standings - Current standings array
     * @param {number} k - Number of players to select
     * @returns {Array} Top K players
     */
    getTopKPlayers(standings, k) {
        return standings.slice(0, Math.min(k, standings.length));
    }

    /**
     * 🔍 Resolve match participants dynamically
     * @param {Object} match - Match object (may be placeholder)
     * @param {Array} standings - Current standings
     * @param {Array} previousRoundMatches - Previous round completed matches
     * @returns {Object} Resolved match with actual players
     */
    resolveMatchParticipants(match, standings, previousRoundMatches) {
        if (!match.is_placeholder) {
            return match; // Already resolved
        }

        // Determine match type and select players
        let players;
        if (match.match_type === 'semi_final') {
            players = this.getTopKPlayers(standings, 4);
        } else if (match.match_type === 'quarter_final') {
            players = this.getTopKPlayers(standings, 8);
        } else if (match.match_type === 'third_place') {
            // Get semi-final losers
            const semiFinalLosers = this.getSemiFinalLosers(previousRoundMatches, standings);
            players = semiFinalLosers.slice(0, 2);
        } else if (match.match_type === 'final') {
            players = this.getTopKPlayers(standings, 2);
        } else {
            return match; // Unknown match type
        }

        // Assign players based on bracket position
        const resolvedMatch = { ...match };
        if (players.length >= 2) {
            resolvedMatch.player1_id = players[match.player1_bracket_position - 1].id;
            resolvedMatch.player2_id = players[match.player2_bracket_position - 1].id;
            resolvedMatch.is_placeholder = false;
        }

        return resolvedMatch;
    }

    /**
     * 🥉 Get semi-final losers for third place match
     * @param {Array} semiFinalMatches - Semi-final match results
     * @param {Array} standings - Current standings
     * @returns {Array} Two semi-final losers
     */
    getSemiFinalLosers(semiFinalMatches, standings) {
        const losers = [];

        semiFinalMatches.forEach(match => {
            if (match.status === 'completed') {
                const winnerId = match.player1_result > match.player2_result ? match.player1_id : match.player2_id;
                const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
                losers.push(standings.find(p => p.id === loserId));
            }
        });

        // If no completed matches, return top 4 players with placeholder logic
        if (losers.length === 0) {
            const top4 = this.getTopKPlayers(standings, 4);
            // Assume players 3 and 4 for now (will be resolved after semis)
            return [top4[2] || null, top4[3] || null];
        }

        return losers.filter(Boolean);
    }

    /**
     * 🔓 Check if a round should be unlocked
     * @param {number} roundNumber - Round number to check
     * @param {Array} allMatches - All tournament matches
     * @returns {boolean} Whether round should be unlocked
     */
    shouldRoundUnlock(roundNumber, allMatches) {
        const previousRoundMatches = allMatches.filter(match => match.round === roundNumber - 1);

        // Round 1 is always unlocked
        if (roundNumber === 1) return true;

        // All previous round matches must be completed
        return previousRoundMatches.every(match => match.status === 'completed');
    }

    /**
     * 📋 Generate match display name
     * @param {Object} match - Match object
     * @param {Array} participants - Participant array
     * @param {boolean} includeIds - Whether to include player IDs
     * @returns {string} Display name for match
     */
    getMatchDisplayName(match, participants, includeIds = false) {
        if (match.is_placeholder) {
            return `TBD - ${match.match_type.replace('_', ' ').toUpperCase()}`;
        }

        const player1 = participants.find(p => p.id === match.player1_id);
        const player2 = participants.find(p => p.id === match.player2_id);

        if (!player1 || !player2) {
            return 'Unknown Players';
        }

        const p1Name = includeIds ? `${player1.name} (ID: ${player1.id})` : player1.name;
        const p2Name = includeIds ? `${player2.name} (ID: ${player2.id})` : player2.name;

        return `${p1Name} vs ${p2Name}`;
    }

    /**
     * 🏆 Generate final rankings
     * @param {Array} matches - All completed matches
     * @param {Array} participants - All tournament participants
     * @param {Object} finalResults - Final match results
     * @returns {Array} Complete rankings with all players
     */
    generateFinalRankings(matches, participants, finalResults) {
        const standings = this.calculateStandings(matches, participants);
        const rankings = [...participants];

        // Assign positions based on match results and standings
        rankings.forEach((player, index) => {
            let finalPosition = index + 1;

            // Check if player is in final matches
            if (finalResults.champion && finalResults.champion.id === player.id) {
                finalPosition = 1;
            } else if (finalResults.runner_up && finalResults.runner_up.id === player.id) {
                finalPosition = 2;
            } else if (finalResults.third_place && finalResults.third_place.id === player.id) {
                finalPosition = 3;
            } else {
                // For other players, use standings position
                const standingIndex = standings.findIndex(s => s.id === player.id);
                if (standingIndex !== -1) {
                    finalPosition = standingIndex + 1;
                }
            }

            player.final_position = finalPosition;
        });

        // Sort by final position
        return rankings.sort((a, b) => a.final_position - b.final_position);
    }

    /**
     * 🎯 Validate tournament structure
     * @param {Array} matches - Tournament matches
     * @param {Array} participants - Tournament participants
     * @returns {Object} Validation results
     */
    validateTournamentStructure(matches, participants) {
        const issues = [];
        const warnings = [];

        // Check for player playing multiple matches in same round
        const roundPlayerMap = {};
        matches.forEach(match => {
            if (!match.is_placeholder) {
                [match.player1_id, match.player2_id].forEach(playerId => {
                    const round = match.round;
                    if (!roundPlayerMap[round]) roundPlayerMap[round] = new Set();
                    if (roundPlayerMap[round].has(playerId)) {
                        issues.push(`Player ${playerId} appears multiple times in round ${round}`);
                    }
                    roundPlayerMap[round].add(playerId);
                });
            }
        });

        // Check Swiss rounds for equal contribution
        const swissRounds = matches.filter(m => m.round_type === 'swiss');
        const swissRoundsMap = {};
        swissRounds.forEach(match => {
            if (!match.is_placeholder) {
                const round = match.round;
                if (!swissRoundsMap[round]) swissRoundsMap[round] = new Set();
                swissRoundsMap[round].add(match.player1_id);
                swissRoundsMap[round].add(match.player2_id);
            }
        });

        Object.keys(swissRoundsMap).forEach(round => {
            const playersInRound = swissRoundsMap[round].size;
            const expectedPlayers = participants.length;
            if (playersInRound !== expectedPlayers) {
                warnings.push(`Round ${round}: ${playersInRound}/${expectedPlayers} players participating`);
            }
        });

        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            summary: {
                totalMatches: matches.length,
                totalParticipants: participants.length,
                completedMatches: matches.filter(m => m.status === 'completed').length,
                placeholderMatches: matches.filter(m => m.is_placeholder).length
            }
        };
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TournamentStandingsManager;
} else if (typeof window !== 'undefined') {
    window.TournamentStandingsManager = TournamentStandingsManager;
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
    window.tournamentManager = new TournamentStandingsManager();
}

console.log('🏆 Tournament Helpers loaded successfully!');