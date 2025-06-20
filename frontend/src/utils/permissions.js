import { ROLES, ROLE_PERMISSIONS } from '../config/rolesConfig';

export const hasPermission = (user, resource, action, context = {}) => {
  if (!user?.role) return false;
  
  // Check if user is admin - they have all permissions
  if (user.role.toUpperCase() === ROLES.ADMIN) return true;
  
  // Check role-based permissions
  const userRole = user.role.toUpperCase();
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;

  const resourcePermissions = rolePermissions[resource.toLowerCase()];
  if (!resourcePermissions) return false;

  const hasRolePermission = resourcePermissions.includes(action.toUpperCase());
  
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
  return user?.role?.toUpperCase() === ROLES.ADMIN;
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