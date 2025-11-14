const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AuthDAL = require('../auth/authDal');
const authDal = new AuthDAL();

/**
 * Middleware to verify JWT token and attach user and role info to request
 */
const authenticateToken = async (req, res, next) => {
    try {
        logger.info('[Auth] authenticateToken middleware starting', { 
            method: req.method, 
            path: req.path,
            url: req.url 
        });
        
        // Skip auth for public routes
        const isPublicRoute = req.method === 'GET' && req.path.match(/\/(production|consumption)\/\d+\/\d+/);
        if (isPublicRoute) {
            logger.info('[Auth] Skipping auth for public route:', req.path);
            return next();
        }

        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        
        logger.debug('[Auth] Auth header present:', !!authHeader, 'Token present:', !!token);

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
        
        // Log token verification details
        logger.info('[Auth] Token verified successfully:', {
            username: decoded.username,
            userId: decoded.userId,
            role: decoded.role,
            companyId: decoded.companyId,
            roleId: decoded.roleId
        });
        
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

        // Get company ID - prefer decoded JWT value, fallback to user data
        let companyId = decoded.companyId;
        
        if (!companyId) {
            companyId = user.companyId;
        }
        
        if (!companyId && user.metadata?.companyId) {
            companyId = user.metadata.companyId;
        }
        
        if (!companyId && decoded.metadata?.companyId) {
            companyId = decoded.metadata.companyId;
        }
        
        // Use helper to extract from metadata if still not found
        if (!companyId && user.metadata) {
            companyId = authDal.extractCompanyIdFromUser(user);
        }
        
        // Try decoded.accessibleSites as last resort
        if (!companyId && decoded.accessibleSites) {
            companyId = decoded.accessibleSites.companyId || 
                       decoded.accessibleSites.productionSites?.L?.[0]?.S?.split('_')?.[0] ||
                       decoded.companyIds?.[0];
        }

        // Ensure userId is set (use username as fallback)
        if (!user.userId) {
            logger.warn(`[Auth] No userId found for user: ${user.username}, using username as fallback`);
            user.userId = user.username;
        }

        // Get role and permissions from Role table (IMPORTANT: fetch BEFORE creating req.user)
        let rolePermissions = {};
        const roleId = user.roleId || decoded.roleId;
        logger.info('[Auth] Looking up roleId:', roleId);
        
        if (roleId) {
            const role = await authDal.getRoleById(roleId);
            if (role && role.permissions) {
                rolePermissions = role.permissions;
                logger.info('[Auth] Retrieved role permissions from database:', Object.keys(rolePermissions));
            } else {
                logger.warn(`[Auth] Could not find role or permissions for roleId: ${roleId}`);
                // Fallback to basic permissions
                rolePermissions = { allocation: ['READ'], production: ['READ'], consumption: ['READ'] };
            }
        } else {
            logger.warn('[Auth] No roleId found in user or token, using basic permissions');
            rolePermissions = { allocation: ['READ'], production: ['READ'], consumption: ['READ'] };
        }

        // NOW attach user info to request object with correct permissions structure
        req.user = {
            username: user.username,
            userId: user.userId,
            role: user.role || decoded.role || 'user',
            email: user.email || decoded.emailId,
            companyId: companyId,
            permissions: rolePermissions, // This should be the nested permissions object from RoleTable
            accessibleSites: user.metadata?.accessibleSites || {
                productionSites: { L: [] },
                consumptionSites: { L: [] }
            },
            roleId: roleId,
            metadata: {
                ...(user.metadata || {}),
                companyId: companyId
            }
        };
        
        logger.info('[Auth] User attached to request:', { 
            username: req.user.username,
            role: req.user.role,
            companyId: req.user.companyId,
            roleId: req.user.roleId
        });

        logger.info('[Auth] Final user permissions structure:', {
            allocationPermissions: req.user.permissions.allocation,
            productionPermissions: req.user.permissions.production,
            consumptionPermissions: req.user.permissions.consumption
        });

        logger.info('[Auth] authenticateToken middleware completed successfully, calling next()');
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
            logger.debug('[checkPermission] Checking permissions', {
                resource,
                action,
                username: req.user?.username,
                userPermissions: req.user?.permissions
            });
            
            if (!req.user) {
                logger.error('[checkPermission] No user object found in request');
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User authentication required'
                });
            }
            
            const userPermissions = req.user.permissions?.[resource] || [];
            logger.debug('[checkPermission] Permissions for resource:', { resource, userPermissions });
            
            if (!userPermissions.includes(action)) {
                logger.warn(`[checkPermission] Access denied: User ${req.user.username} attempted ${action} on ${resource}. User permissions: ${JSON.stringify(userPermissions)}`);
                return res.status(403).json({ 
                    success: false,
                    error: 'Access denied',
                    message: `You don't have permission to ${action} ${resource}`
                });
            }
            
            logger.debug(`[checkPermission] Access granted: User ${req.user.username} has ${action} permission on ${resource}`);
            next();
        } catch (error) {
            logger.error('[checkPermission] Permission check error:', error);
            res.status(500).json({ error: 'Error checking permissions' });
        }
    };
};

module.exports = {
    authenticateToken,
    checkPermission
};
