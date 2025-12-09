import { ROLES, ROLE_PERMISSIONS } from '../config/rolesConfig';

/**
 * Map role from database format to ROLE_PERMISSIONS key format
 */
const normalizeRole = (role) => {
  if (!role) return null;
  
  const roleUpper = role.toUpperCase();
  
  // Handle direct matches
  if (roleUpper === 'SUPERADMIN' || roleUpper === 'SUPER_ADMIN') return ROLES.SUPERADMIN;
  if (roleUpper === 'ADMIN') return ROLES.ADMIN;
  if (roleUpper === 'USER') return ROLES.USER;
  if (roleUpper === 'VIEWER') return ROLES.VIEWER;
  
  // Fallback for unknown roles - treat as USER
  console.warn(`[Permissions] Unknown role '${role}', defaulting to USER`);
  return ROLES.USER;
};

export const hasPermission = (user, resource, action, context = {}) => {
  if (!user) {
    console.warn('[Permissions] No user provided to hasPermission');
    return false;
  }
  
  // Use roleName if available (from login response), otherwise use role field
  const userRole = user.roleName || user.role || user.roleId;
  if (!userRole) {
    console.warn('[Permissions] No role found in user object');
    return false;
  }
  
  const normalizedRole = normalizeRole(userRole);
  
  // Superadmin has all permissions - check this first
  if (normalizedRole === ROLES.SUPERADMIN) {
    console.debug(`[Permissions] User '${user.username}' is SUPERADMIN, granting all permissions`);
    return true;
  }
  
  // Admin has most permissions except some sensitive ones
  if (normalizedRole === ROLES.ADMIN) {
    console.debug(`[Permissions] User '${user.username}' is ADMIN, granting most permissions`);
    return true;
  }
  
  // Check if role exists in ROLE_PERMISSIONS
  if (!ROLE_PERMISSIONS[normalizedRole]) {
    console.warn(`[Permissions] Role '${userRole}' not found in ROLE_PERMISSIONS, normalized to '${normalizedRole}'`);
    return false;
  }
  
  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[normalizedRole];
  const resourceLower = resource.toLowerCase();
  
  if (!rolePermissions[resourceLower]) {
    console.warn(`[Permissions] Resource '${resource}' not found in role '${normalizedRole}' permissions`);
    return false;
  }

  const resourcePermissions = rolePermissions[resourceLower];
  const actionUpper = action.toUpperCase();
  const hasRolePermission = resourcePermissions.includes(actionUpper);
  
  console.debug(`[Permissions] Permission check:`, {
    username: user.username,
    role: normalizedRole,
    resource: resourceLower,
    action: actionUpper,
    allowed: hasRolePermission,
    userPermissions: resourcePermissions
  });
  
  // If the permission is not granted by role, check site access for specific resources
  if (!hasRolePermission && context.siteId && context.siteType) {
    // Check if user has access to this specific site
    if (user.hasSiteAccess) {
      return user.hasSiteAccess(context.siteId, context.siteType);
    }
  }
  
  return hasRolePermission;
};

export const isAdmin = (user) => {
  if (!user) return false;
  
  const roleChecks = [
    user?.roleName,
    user?.role,
    user?.roleId,
    user?.permissions?.role
  ].filter(Boolean);
  
  return roleChecks.some(role => {
    const roleStr = String(role).toUpperCase().trim();
    return roleStr === 'ADMIN' || roleStr === 'SUPERADMIN' || roleStr === 'SUPER_ADMIN';
  }) || user?.isAdmin === true;
};

export const isSuperAdmin = (user) => {
  if (!user) return false;
  
  const roleChecks = [
    user?.roleName,
    user?.role,
    user?.roleId,
    user?.permissions?.role
  ].filter(Boolean);
  
  return roleChecks.some(role => {
    const roleStr = String(role).toUpperCase().trim();
    return roleStr === 'SUPERADMIN' || roleStr === 'SUPER_ADMIN';
  }) || user?.isSuperAdmin === true;
};

export const getModulePermissions = (user, resource) => {
  if (!user?.role || typeof user.role !== 'string') {
    return [];
  }
  
  const userRole = user.role.toUpperCase();
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) {
    return [];
  }

  return rolePermissions[resource.toLowerCase()] || [];
};

export const hasAnyPermission = (user, resource, actions, context = {}) => {
  return actions.some(action => hasPermission(user, resource, action, context));
};

export const hasAllPermissions = (user, resource, actions) => {
  return actions.every(action => hasPermission(user, resource, action));
};

export const getHighestRole = () => ROLES.ADMIN;

export const hasRole = (user, role) => {
  return user?.role?.toUpperCase() === role.toUpperCase();
};