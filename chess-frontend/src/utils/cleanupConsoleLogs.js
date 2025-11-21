/**
 * Utility to clean up console logs in ChampionshipMatches.jsx
 * This script helps replace all console.log statements with the new logger
 */

const replacements = [
  // Debug logs
  {
    pattern: /console\.log\('🔍 loadMatches Debug:'[^;]*\);?/g,
    replacement: 'logger.debug(\'loadMatches\', { action: \'loading\', championshipId, userOnly });'
  },
  {
    pattern: /console\.log\('📊 API Response:'[^;]*\);?/g,
    replacement: 'logger.api(endpoint, \'GET\', { status: response.status, matchesCount });'
  },
  {
    pattern: /console\.log\('Creating game for match:'[^;]*\);?/g,
    replacement: 'logger.info(\'Game\', `Creating game for match: ${matchId}`);'
  },
  {
    pattern: /console\.log\('Game creation response:'[^;]*\);?/g,
    replacement: 'logger.debug(\'Game\', \'Creation response received\');'
  },
  {
    pattern: /console\.log\('Report result for match:'[^;]*\);?/g,
    replacement: 'logger.info(\'Match\', `Reporting result for match: ${matchId}`);'
  },
  {
    pattern: /console\.log\('🚀 Scheduling match:'[^;]*\);?/g,
    replacement: 'logger.info(\'Schedule\', `Scheduling match: ${matchId}`);'
  },
  {
    pattern: /console\.log\('📡 Sending schedule request to:'[^;]*\);?/g,
    replacement: 'logger.debug(\'Schedule\', `Sending request to: ${endpoint}`);'
  },
  {
    pattern: /console\.log\('⏰ Proposed time \(ISO\):'[^;]*\);?/g,
    replacement: 'logger.debug(\'Schedule\', `Proposed time: ${scheduledTimeISO}`);'
  },
  {
    pattern: /console\.log\('✅ Schedule response:'[^;]*\);?/g,
    replacement: 'logger.debug(\'Schedule\', \'Schedule response received\');'
  },

  // Permission check logs - these are very verbose
  {
    pattern: /console\.log\('canUserCreateGame:'[^;]*\);?/g,
    replacement: ''  // Remove these entirely as they're too verbose
  },
  {
    pattern: /console\.log\('canUserReportResult:'[^;]*\);?/g,
    replacement: ''  // Remove these entirely as they're too verbose
  },
  {
    pattern: /console\.log\('canUserScheduleMatch:'[^;]*\);?/g,
    replacement: ''  // Remove these entirely as they're too verbose
  },
  {
    pattern: /console\.log\('canUserRequestPlay:'[^;]*\);?/g,
    replacement: ''  // Remove these entirely as they're too verbose
  },
  {
    pattern: /console\.log\('❌ No opponent found for match'\);?/g,
    replacement: 'logger.warn(\'Match\', \'No opponent found for match\');'
  },

  // Status and online check logs
  {
    pattern: /console\.log\('🔍 Opponent online status:'[^;]*\);?/g,
    replacement: 'logger.debug(\'Presence\', { opponentId, opponentName, onlineStatus });'
  },
  {
    pattern: /console\.log\('ChampionshipMatches Debug:'[^;]*\);?/g,
    replacement: 'logger.debug(\'ChampionshipMatches\', { championshipId, userOnly, matchesCount: matches.length });'
  },
  {
    pattern: /console\.log\('🎯 Player online status check:'[^;]*\);?/g,
    replacement: ''  // Remove this - too verbose
  },
  {
    pattern: /console\.log\('Match Actions Debug:'[^;]*\);?/g,
    replacement: ''  // Remove this - too verbose
  },

  // Transformation logs
  {
    pattern: /console\.log\('🔄 transformMatch input:'[^;]*\);?/g,
    replacement: ''  // Remove - too verbose for production
  },
  {
    pattern: /console\.log\('✅ transformMatch output:'[^;]*\);?/g,
    replacement: ''  // Remove - too verbose for production
  },
  {
    pattern: /console\.log\('🎯 Final match counts:'[^;]*\);?/g,
    replacement: 'logger.debug(\'MatchProcessing\', { totalMatches: userMatches.length });'
  }
];

// Export the replacements for use in a cleanup script
export { replacements };