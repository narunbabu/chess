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
    'swiss_only': 'Swiss System',
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
  if (!championship.total_rounds) {
    return 0;
  }

  // If we have completed_rounds from the API, use that
  if (championship.completed_rounds !== undefined) {
    return Math.min((championship.completed_rounds / championship.total_rounds) * 100, 100);
  }

  // Fallback: if current_round is provided, calculate based on completed rounds
  if (championship.current_round) {
    // Progress should be based on completed rounds, not current round
    // If we're in round 2, then 1 round is completed
    const completedRounds = Math.max(0, championship.current_round - 1);
    return Math.min((completedRounds / championship.total_rounds) * 100, 100);
  }

  return 0;
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
  try {
    if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
      return 'No prizes';
    }

    const totalPrize = prizes.reduce((sum, prize) => sum + parseFloat(prize.amount || 0), 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(totalPrize);
  } catch (error) {
    console.warn('Error formatting prize pool:', error);
    return 'No prizes';
  }
};

/**
 * Format currency amount in INR
 */
export const formatCurrency = (amount) => {
  try {
    if (!amount || isNaN(parseFloat(amount))) {
      return '₹0';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(parseFloat(amount));
  } catch (error) {
    console.warn('Error formatting currency:', error);
    return '₹0';
  }
};

/**
 * Format participant count
 */
export const formatParticipantCount = (current, max = null) => {
  if (max) {
    return `${current} / ${max}`;
  }
  return `${current} Players`;
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
 * Format deadline with urgency indicator and danger level
 */
export const formatDeadlineWithUrgency = (scheduledDate) => {
  if (!scheduledDate) return 'Not set';

  const now = new Date();
  const deadline = new Date(scheduledDate);
  const diffTime = deadline - now;
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // If deadline has passed
  if (diffTime < 0) {
    return {
      text: 'Overdue',
      urgency: 'danger',
      color: 'text-red-600 bg-red-100 border-red-300'
    };
  }

  // If less than 2 hours - critical danger
  if (diffHours <= 2) {
    return {
      text: `Complete by ${format(deadline, 'MMM d, HH:mm')} (${diffHours}h left)`,
      urgency: 'critical',
      color: 'text-red-700 bg-red-100 border-red-400 font-bold'
    };
  }

  // If less than 6 hours - high danger
  if (diffHours <= 6) {
    return {
      text: `Complete by ${format(deadline, 'MMM d, HH:mm')} (${diffHours}h left)`,
      urgency: 'high',
      color: 'text-orange-600 bg-orange-100 border-orange-300 font-semibold'
    };
  }

  // If less than 24 hours - moderate danger
  if (diffHours <= 24) {
    return {
      text: `Complete by ${format(deadline, 'MMM d, HH:mm')} (${diffHours}h left)`,
      urgency: 'moderate',
      color: 'text-yellow-600 bg-yellow-100 border-yellow-300'
    };
  }

  // If less than 3 days - low urgency
  if (diffDays <= 3) {
    return {
      text: `Complete by ${format(deadline, 'MMM d, HH:mm')} (${diffDays}d left)`,
      urgency: 'low',
      color: 'text-blue-600 bg-blue-100 border-blue-300'
    };
  }

  // Plenty of time - normal
  return {
    text: `Complete by ${format(deadline, 'MMM d, HH:mm')} (${diffDays}d left)`,
    urgency: 'normal',
    color: 'text-gray-600 bg-gray-100 border-gray-300'
  };
};

/**
 * Get match card urgency styling
 */
export const getMatchCardUrgencyClass = (scheduledDate) => {
  const urgency = formatDeadlineWithUrgency(scheduledDate);

  switch (urgency.urgency) {
    case 'critical':
      return 'border-l-4 border-red-500 bg-red-50';
    case 'high':
      return 'border-l-4 border-orange-500 bg-orange-50';
    case 'moderate':
      return 'border-l-4 border-yellow-500 bg-yellow-50';
    case 'low':
      return 'border-l-4 border-blue-500 bg-blue-50';
    default:
      return 'border-l-4 border-gray-300';
  }
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
 * @param {Object} data - Championship data to validate
 * @param {Object} originalData - Original championship data (for edit mode)
 */
export const validateChampionshipData = (data, originalData = null) => {
  const errors = {};
  const isEditing = !!originalData;

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

  // Registration start date validation
  if (!data.registration_start_at) {
    errors.registration_start_at = 'Registration start date is required';
  } else {
    const newRegStartDate = new Date(data.registration_start_at);

    if (isEditing) {
      // When editing, only check if moving to an earlier date than originally set
      const originalRegStartDate = new Date(originalData.registration_start_at);
      if (newRegStartDate < originalRegStartDate) {
        errors.registration_start_at = 'Cannot set registration start date earlier than originally set';
      }
    } else {
      // When creating, ensure date is not in the past
      if (newRegStartDate < now) {
        errors.registration_start_at = 'Registration start date cannot be in the past';
      }
    }
  }

  // Registration end date validation
  if (!data.registration_end_at) {
    errors.registration_end_at = 'Registration end date is required';
  } else if (data.registration_start_at && data.registration_end_at) {
    const start = new Date(data.registration_start_at);
    const end = new Date(data.registration_end_at);
    if (end <= start) {
      errors.registration_end_at = 'Registration end date must be after start date';
    }
  }

  // Championship start date validation
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