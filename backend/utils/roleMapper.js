/**
 * Role mapping between database roleIds and frontend-friendly role names
 */

const ROLE_MAP = {
    'ROLE-1': 'SUPERADMIN',
    'ROLE-2': 'ADMIN',
    'ROLE-3': 'USER',
    'ROLE-4': 'VIEWER'
};

const REVERSE_ROLE_MAP = {
    'SUPERADMIN': 'ROLE-1',
    'ADMIN': 'ROLE-2',
    'USER': 'ROLE-3',
    'VIEWER': 'ROLE-4'
};

/**
 * Convert database roleId to frontend role name
 * @param {string} roleId - Database role ID (e.g., 'ROLE-1')
 * @returns {string} Frontend role name (e.g., 'ADMIN')
 */
const mapRoleIdToName = (roleId) => {
    return ROLE_MAP[roleId] || roleId;
};

/**
 * Convert frontend role name to database roleId
 * @param {string} roleName - Frontend role name (e.g., 'ADMIN')
 * @returns {string} Database role ID (e.g., 'ROLE-2')
 */
const mapRoleNameToId = (roleName) => {
    return REVERSE_ROLE_MAP[roleName] || roleName;
};

/**
 * Transform user object to include frontend-friendly roleId
 * @param {Object} user - User object from database
 * @returns {Object} User object with transformed roleId
 */
const transformUserRole = (user) => {
    if (!user) return user;
    
    return {
        ...user,
        roleId: mapRoleIdToName(user.roleId),
        // Keep original roleId for reference if needed
        _roleIdOriginal: user.roleId
    };
};

/**
 * Transform array of users to include frontend-friendly roleIds
 * @param {Array} users - Array of user objects
 * @returns {Array} Array of user objects with transformed roleIds
 */
const transformUsersRoles = (users) => {
    if (!Array.isArray(users)) return users;
    return users.map(transformUserRole);
};

module.exports = {
    ROLE_MAP,
    REVERSE_ROLE_MAP,
    mapRoleIdToName,
    mapRoleNameToId,
    transformUserRole,
    transformUsersRoles
};
