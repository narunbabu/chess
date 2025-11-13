// championshipHelpers.js
import { format } from 'date-fns';

/**
 * Format championship status display
 */
export const formatChampionshipStatus = (status) => {
  const statusMap = {
    'registration_open': '📝 Registration Open',
    'upcoming': '📅 Starting Soon',
    'in_progress': '🎮 In Progress',
    'paused': '⏸️ Paused',
    'completed': '✅ Completed',
    'cancelled': '❌ Cancelled'
  };
  return statusMap[status] || status;
};

/**
 * Get status color class
 */
export const getStatusColorClass = (status) => {
  const colorMap = {
    'registration_open': 'text-blue-600 bg-blue-100',
    'upcoming': 'text-yellow-600 bg-yellow-100',
    'in_progress': 'text-green-600 bg-green-100',
    'paused': 'text-orange-600 bg-orange-100',
    'completed': 'text-gray-600 bg-gray-100',
    'cancelled': 'text-red-600 bg-red-100'
  };
  return colorMap[status] || 'text-gray-600 bg-gray-100';
};

/**
 * Format championship type
 */
export const formatChampionshipType = (format) => {
  const typeMap = {
    'swiss_only': '🏆 Swiss System',
    'elimination_only': '⚔️ Single Elimination',
    'swiss_elimination': '🎯 Hybrid (Swiss + Elimination)',
    'round_robin': '🔄 Round Robin'
  };
  return typeMap[format] || format;
};

/**
 * Format time control
 */
export const formatTimeControl = (timeControl) => {
  if (!timeControl) return 'Standard';

  const { minutes, increment } = timeControl;
  if (increment) {
    return `${minutes}+${increment}`;
  }
  return `${minutes} minutes`;
};

/**
 * Calculate championship progress percentage
 */
export const calculateProgress = (championship) => {
  if (!championship.total_rounds || !championship.current_round) {
    return 0;
  }

  return Math.min((championship.current_round / championship.total_rounds) * 100, 100);
};

/**
 * Check if user can register for championship
 */
export const canUserRegister = (championship, user) => {
  if (!user || !championship) return false;

  // Check registration status
  if (championship.status !== 'registration_open') return false;

  // Check if already registered
  if (championship.user_participation) return false;

  // Check if registration is open based on dates
  const now = new Date();
  const registrationStart = new Date(championship.registration_start_at);
  const registrationEnd = new Date(championship.registration_end_at);

  if (now < registrationStart || now > registrationEnd) return false;

  // Check if maximum participants reached
  if (championship.max_participants && championship.participants_count >= championship.max_participants) {
    return false;
  }

  return true;
};

/**
 * Check if user is tournament organizer
 */
export const isUserOrganizer = (championship, user) => {
  return user && championship && (championship.created_by === user.id || championship.organizer_id === user.id);
};

/**
 * Format prize pool
 */
export const formatPrizePool = (prizes) => {
  if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
    return 'No prizes';
  }

  const totalPrize = prizes.reduce((sum, prize) => sum + parseFloat(prize.amount || 0), 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(totalPrize);
};

/**
 * Format participant count
 */
export const formatParticipantCount = (current, max = null) => {
  if (max) {
    return `${current} / ${max} participants`;
  }
  return `${current} participants`;
};

/**
 * Get match result display
 */
export const getMatchResultDisplay = (match) => {
  if (!match.result) return 'Not played';

  const { result_type, winner_id, details } = match.result;

  switch (result_type) {
    case 'win':
      return winner_id === match.white_player_id ? '1-0' : '0-1';
    case 'draw':
      return '½-½';
    case 'forfeit':
      return winner_id === match.white_player_id ? '1-0 (FF)' : '0-1 (FF)';
    default:
      return details || result_type;
  }
};

/**
 * Get match status color
 */
export const getMatchStatusColor = (status) => {
  const colorMap = {
    'scheduled': 'bg-gray-100 text-gray-600',
    'active': 'bg-green-100 text-green-600',
    'completed': 'bg-blue-100 text-blue-600',
    'expired': 'bg-red-100 text-red-600',
    'cancelled': 'bg-gray-100 text-gray-600'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-600';
};

/**
 * Format date and time
 */
export const formatDateTime = (dateString, includeTime = true) => {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);
  const formatStr = includeTime ? 'MMM d, yyyy HH:mm' : 'MMM d, yyyy';

  return format(date, formatStr);
};

/**
 * Calculate days remaining
 */
export const calculateDaysRemaining = (endDate) => {
  if (!endDate) return null;

  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Ended';
  if (diffDays === 0) return 'Ends today';
  if (diffDays === 1) return 'Ends tomorrow';

  return `${diffDays} days remaining`;
};

/**
 * Sort standings by rank
 */
export const sortStandings = (standings) => {
  // Handle non-array inputs
  if (!Array.isArray(standings)) {
    return [];
  }

  return [...standings].sort((a, b) => {
    // First by rank
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }

    // Then by points (descending)
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    // Then by tiebreak points (descending)
    if (b.tiebreak_points !== a.tiebreak_points) {
      return b.tiebreak_points - a.tiebreak_points;
    }

    // Then by player name (alphabetical)
    return a.player_name.localeCompare(b.player_name);
  });
};

/**
 * Validate championship data
 */
export const validateChampionshipData = (data) => {
  const errors = {};

  if (!data.name || data.name.trim().length < 3) {
    errors.name = 'Championship name must be at least 3 characters';
  }

  if (!data.format || !['swiss_only', 'elimination_only', 'swiss_elimination', 'round_robin'].includes(data.format)) {
    errors.format = 'Please select a valid championship format';
  }

  if (!data.time_control || !data.time_control.minutes || data.time_control.minutes < 1) {
    errors.time_control = 'Please specify a valid time control';
  }

  if (data.max_participants && (data.max_participants < 2 || data.max_participants > 1000)) {
    errors.max_participants = 'Maximum participants must be between 2 and 1000';
  }

  if (data.prizes && Array.isArray(data.prizes)) {
    data.prizes.forEach((prize, index) => {
      if (!prize.position || prize.position < 1) {
        errors[`prizes.${index}.position`] = 'Position must be a positive number';
      }
      if (!prize.amount || parseFloat(prize.amount) < 0) {
        errors[`prizes.${index}.amount`] = 'Prize amount must be non-negative';
      }
    });
  }

  // Date validations - these fields are required
  const now = new Date();
  if (!data.registration_start_at) {
    errors.registration_start_at = 'Registration start date is required';
  } else if (new Date(data.registration_start_at) < now) {
    errors.registration_start_at = 'Registration start date cannot be in the past';
  }

  if (!data.registration_end_at) {
    errors.registration_end_at = 'Registration end date is required';
  } else if (data.registration_start_at && data.registration_end_at) {
    const start = new Date(data.registration_start_at);
    const end = new Date(data.registration_end_at);
    if (end <= start) {
      errors.registration_end_at = 'Registration end date must be after start date';
    }
  }

  if (!data.starts_at) {
    errors.starts_at = 'Championship start date is required';
  } else if (data.starts_at && data.registration_end_at) {
    const start = new Date(data.starts_at);
    const regEnd = new Date(data.registration_end_at);
    if (start <= regEnd) {
      errors.starts_at = 'Championship start date must be after registration end date';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Generate bracket data for elimination tournaments
 */
export const generateBracketData = (matches, participants) => {
  if (!matches || !participants) return null;

  // Group matches by round
  const rounds = {};
  matches.forEach(match => {
    if (!rounds[match.round]) {
      rounds[match.round] = [];
    }
    rounds[match.round].push(match);
  });

  // Sort rounds and matches within rounds
  const sortedRounds = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b)
    .map(round => ({
      round,
      matches: rounds[round].sort((a, b) => a.board_number - b.board_number)
    }));

  return sortedRounds;
};

/**
 * Calculate player head-to-head record
 */
export const calculateHeadToHead = (player1Id, player2Id, matches) => {
  const player1Wins = matches.filter(m =>
    m.result?.winner_id === player1Id &&
    (m.white_player_id === player1Id || m.black_player_id === player1Id) &&
    (m.white_player_id === player2Id || m.black_player_id === player2Id)
  ).length;

  const player2Wins = matches.filter(m =>
    m.result?.winner_id === player2Id &&
    (m.white_player_id === player1Id || m.black_player_id === player1Id) &&
    (m.white_player_id === player2Id || m.black_player_id === player2Id)
  ).length;

  const draws = matches.filter(m =>
    m.result?.result_type === 'draw' &&
    (m.white_player_id === player1Id || m.black_player_id === player1Id) &&
    (m.white_player_id === player2Id || m.black_player_id === player2Id)
  ).length;

  return {
    player1Wins,
    player2Wins,
    draws,
    totalGames: player1Wins + player2Wins + draws
  };
};