// permissionHelpers.js - User permission checking utilities

/**
 * Check if user has a specific role
 * @param {Object} user - User object from AuthContext
 * @param {string|string[]} roles - Role name or array of role names
 * @returns {boolean}
 */
export const hasRole = (user, roles) => {
  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return false;
  }

  const roleArray = Array.isArray(roles) ? roles : [roles];
  const userRoleNames = user.roles.map(role => role.name);

  return roleArray.some(role => userRoleNames.includes(role));
};

/**
 * Check if user can create championships
 * Users with these roles can create championships:
 * - platform_admin
 * - organization_admin
 * - tournament_organizer
 *
 * @param {Object} user - User object from AuthContext
 * @returns {boolean}
 */
export const canCreateChampionship = (user) => {
  return hasRole(user, ['platform_admin', 'organization_admin', 'tournament_organizer']);
};

/**
 * Check if user can manage a specific championship
 * @param {Object} user - User object from AuthContext
 * @param {Object} championship - Championship object
 * @returns {boolean}
 */
export const canManageChampionship = (user, championship) => {
  if (!user || !championship) {
    return false;
  }

  // Platform admins can manage everything
  if (hasRole(user, 'platform_admin')) {
    return true;
  }

  // Championship creator can manage their own
  if (championship.created_by === user.id) {
    return true;
  }

  // Organization admins can manage org championships
  if (hasRole(user, 'organization_admin') &&
      championship.organization_id === user.organization_id) {
    return true;
  }

  return false;
};

/**
 * Check if user is a platform admin
 * @param {Object} user - User object from AuthContext
 * @returns {boolean}
 */
export const isPlatformAdmin = (user) => {
  return hasRole(user, 'platform_admin');
};

/**
 * Check if user is an organization admin
 * @param {Object} user - User object from AuthContext
 * @returns {boolean}
 */
export const isOrganizationAdmin = (user) => {
  return hasRole(user, 'organization_admin');
};

/**
 * Check if user is a tournament organizer
 * @param {Object} user - User object from AuthContext
 * @returns {boolean}
 */
export const isTournamentOrganizer = (user) => {
  return hasRole(user, 'tournament_organizer');
};

/**
 * Get user's highest role by checking in priority order
 * @param {Object} user - User object from AuthContext
 * @returns {string|null} - Role name or null
 */
export const getHighestRole = (user) => {
  const rolePriority = [
    'platform_admin',
    'organization_admin',
    'tournament_organizer',
    'monitor',
    'player',
    'guest'
  ];

  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return null;
  }

  const userRoleNames = user.roles.map(role => role.name);

  for (const role of rolePriority) {
    if (userRoleNames.includes(role)) {
      return role;
    }
  }

  return userRoleNames[0] || null;
};
