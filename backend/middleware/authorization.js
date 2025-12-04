const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AuthDAL = require('../auth/authDal');
const authDal = new AuthDAL();

/**
 * Middleware to verify JWT token and attach user and role info to request
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Skip auth for public routes
        const isPublicRoute = req.method === 'GET' && req.path.match(/\/(production|consumption)\/\d+\/\d+/);
        if (isPublicRoute) {
            logger.info('[Auth] Skipping auth for public route:', req.path);
            return next();
        }

        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            logger.error('[Auth] No token provided');
            return res.status(401).json({ 
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Verify and decode the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        
        if (!decoded.username) {
            logger.error('[Auth] No username in token');
            return res.status(403).json({ 
                success: false,
                message: 'Invalid token: missing username',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Get fresh user data from database
        const user = await authDal.getUserByUsername(decoded.username);
        if (!user) {
            logger.error(`[Auth] User not found: ${decoded.username}`);
            return res.status(403).json({ 
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Attach user info to request object
        req.user = {
            username: user.username,
            userId: user.userId || user.username,
            role: user.role || 'user',
            email: user.email,
            // Add any other user properties needed by the application
            ...(user.metadata || {}) // Include any additional metadata
        };
        
        
        
        // Ensure user object has a valid userId
        if (!user.userId) {
            logger.warn(`[Auth] No userId found for user: ${user.username}, using username as fallback`);
            user.userId = user.username;
        }

        // Get fresh role data - try multiple sources for roleId
        let role = null;
        const roleIdToFetch = decoded.roleId || user.roleId;
        
        if (roleIdToFetch) {
            role = await authDal.getRoleById(roleIdToFetch);
            if (!role) {
                logger.error(`[Auth] Invalid role for user: ${decoded.username}`, {
                    roleId: roleIdToFetch,
                    decodedRoleId: decoded.roleId,
                    userRoleId: user.roleId
                });
                return res.status(403).json({ 
                    success: false,
                    message: 'Invalid role',
                    code: 'INVALID_ROLE'
                });
            }
            
            logger.info('[Auth] Fetched role from database:', {
                roleId: role.roleId,
                roleName: role.roleName,
                hasPermissions: !!role.permissions,
                permissionsStructure: role.permissions ? Object.keys(role.permissions) : 'NO_PERMISSIONS'
            });
        }

        // Get company ID with multiple fallbacks
        let companyId = decoded.companyId; // First priority: from JWT token
        
        if (!companyId && user.companyId) {
            companyId = user.companyId; // Second priority: from user database record
        }
        
        if (!companyId && user.metadata?.companyId) {
            companyId = user.metadata.companyId; // Third priority: from metadata
        }
        
        if (!companyId && decoded.metadata?.companyId) {
            companyId = decoded.metadata.companyId; // Fourth priority: from JWT metadata
        }
        
        // Use DAL helper to extract company ID from complex metadata structures
        if (!companyId) {
            const authDal = new (require('../auth/authDal'))();
            companyId = authDal.extractCompanyIdFromUser(user);
        }

        // If still no company ID and user is a super admin, assign default company ID
        if (!companyId && (decoded.role === 'superadmin' || decoded.role === 'SUPERADMIN')) {
            companyId = 1; // Default to company 1 for super admin users
            logger.info(`[Auth] Assigned default company ID (1) to super admin user: ${decoded.username}`);
        }


        // Determine user permissions with proper priority
        let userPermissions = {};
        let normalizedRole = user.role || 'user'; // Start with user's role from database
        
        // Priority 1: Use permissions from the fetched role (most up-to-date)
        if (role?.permissions) {
            userPermissions = role.permissions;
            // Update normalized role to use the fetched role's name
            normalizedRole = role.roleName || normalizedRole;
            logger.info('[Auth] Using permissions from database role:', {
                roleId: role.roleId,
                roleName: role.roleName,
                resources: Object.keys(userPermissions),
                allocationPermission: userPermissions['allocation']
            });
        } 
        // Priority 2: Use permissions from JWT token (if no role was found in DB)
        else if (decoded.permissions) {
            userPermissions = decoded.permissions;
            logger.info('[Auth] Using permissions from JWT token:', {
                resources: Object.keys(userPermissions),
                allocationPermission: userPermissions['allocation']
            });
        }
        // Priority 3: Determine permissions based on role name
        else {
            logger.warn('[Auth] No permissions found in role or JWT - using role-based defaults', {
                username: decoded.username,
                roleName: normalizedRole
            });
            
            // Assign permissions based on role
            if (normalizedRole.toUpperCase() === 'SUPERADMIN' || normalizedRole.toUpperCase() === 'SUPER_ADMIN') {
                userPermissions = {
                    'production': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'allocation': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'banking': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'lapse': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'captive': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'company': ['CREATE', 'READ', 'UPDATE', 'DELETE']
                };
            } else if (normalizedRole.toUpperCase() === 'ADMIN') {
                userPermissions = {
                    'production': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'allocation': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'banking': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'lapse': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'captive': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
                    'company': ['CREATE', 'READ', 'UPDATE', 'DELETE']
                };
            } else if (normalizedRole.toUpperCase() === 'USER') {
                userPermissions = {
                    'production': ['READ', 'UPDATE'],
                    'production-units': ['READ', 'UPDATE'],
                    'production-charges': ['READ', 'UPDATE'],
                    'consumption': ['READ', 'UPDATE'],
                    'consumption-units': ['READ', 'UPDATE'],
                    'allocation': ['READ', 'UPDATE'],
                    'banking': ['READ', 'UPDATE'],
                    'lapse': ['READ', 'UPDATE'],
                    'captive': ['READ'],
                    'company': ['READ']
                };
            } else if (normalizedRole.toUpperCase() === 'VIEWER') {
                userPermissions = {
                    'production': ['READ'],
                    'production-units': ['READ'],
                    'production-charges': ['READ'],
                    'consumption': ['READ'],
                    'consumption-units': ['READ'],
                    'allocation': ['READ'],
                    'banking': ['READ'],
                    'lapse': ['READ'],
                    'captive': ['READ'],
                    'company': ['READ']
                };
            } else {
                // Default: basic read-only access
                userPermissions = {
                    'production': ['READ'],
                    'consumption': ['READ'],
                    'production-units': ['READ'],
                    'consumption-units': ['READ'],
                    'allocation': ['READ']
                };
            }
            logger.info('[Auth] Applied role-based permissions:', {
                username: decoded.username,
                normalizedRole,
                resources: Object.keys(userPermissions)
            });
        }

        // Attach user and role info to request
        req.user = {
            userId: user.userId || user.username, // Use userId if available, fallback to username
            username: decoded.username,
            email: decoded.emailId || user.email,
            role: normalizedRole.toUpperCase(), // Use normalized role in uppercase for consistent permission checks
            companyId: companyId, // Use the resolved company ID
            permissions: userPermissions,
            accessibleSites: user.metadata?.accessibleSites || {
                productionSites: { L: [] },
                consumptionSites: { L: [] }
            },
            // Include role info if available
            ...(role && {
                roleId: role.roleId,
                roleName: role.roleName
            }),
            metadata: {
                ...user.metadata,
                companyId
            }
        };

        

        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Middleware to check if user has required permission for a resource
 */
const checkPermission = (resource, action) => {
    return (req, res, next) => {
        try {
            // Get the user permissions object
            const userPermissions = req.user?.permissions;
            const userRole = req.user?.role?.toUpperCase();
            
            logger.info('[Permission] Checking access (DETAILED):', {
                username: req.user?.username,
                resource,
                action,
                userRole: userRole,
                userPermissionsKeys: userPermissions ? Object.keys(userPermissions) : 'none',
                fullPermissionsObject: JSON.stringify(userPermissions, null, 2)
            });

            // If user has admin or superadmin role, grant all permissions
            if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
                logger.info(`[Permission] Granting all permissions to ${userRole} user: ${req.user?.username}`);
                return next();
            }
            
            // Check if user has the required action permission
            // Permissions can be stored as either:
            // 1. Object mapping: { resource: [actions] } e.g., { production: ['READ', 'CREATE'] }
            // 2. Array: ['READ', 'CREATE'] (legacy format)
            
            let hasPermission = false;
            
            if (typeof userPermissions === 'object' && !Array.isArray(userPermissions)) {
                // Object format: check if resource exists and action is in the array
                const resourcePermissions = userPermissions[resource];
                hasPermission = Array.isArray(resourcePermissions) && 
                                resourcePermissions.includes(action.toUpperCase());
                logger.debug('[Permission] Using object format permissions', {
                    resource,
                    resourcePermissions,
                    action: action.toUpperCase(),
                    hasPermission
                });
            } else if (Array.isArray(userPermissions)) {
                // Array format (legacy): check if action is in array
                hasPermission = userPermissions.includes(action.toUpperCase());
                logger.debug('[Permission] Using array format permissions', {
                    userPermissions,
                    action: action.toUpperCase(),
                    hasPermission
                });
            }
            
            if (!hasPermission) {
                logger.warn(`[Permission] Access denied: User ${req.user?.username} attempted ${action} on ${resource}`, {
                    userRole: userRole,
                    requiredAction: action,
                    resource,
                    userPermissions: userPermissions,
                    allUserKeys: Object.keys(userPermissions || {})
                });
                return res.status(403).json({ 
                    error: 'Access denied',
                    message: `You don't have permission to ${action} ${resource}`,
                    code: 'PERMISSION_DENIED',
                    details: {
                        required: `${resource}:${action}`,
                        userPermissions: userPermissions,
                        availableResources: userPermissions ? Object.keys(userPermissions) : []
                    }
                });
            }
            
            logger.debug(`[Permission] Access granted to ${req.user?.username} for ${action} on ${resource}`);
            next();
        } catch (error) {
            logger.error('[Permission] Permission check error:', error);
            res.status(500).json({ error: 'Error checking permissions' });
        }
    };
};

module.exports = {
    authenticateToken,
    checkPermission
};
