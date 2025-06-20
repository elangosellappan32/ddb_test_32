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

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
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

        // If user has a roleId, get fresh role data
        let role = null;
        if (decoded.roleId) {
            role = await authDal.getRoleById(decoded.roleId);
            if (!role) {
                logger.error(`[Auth] Invalid role for user: ${decoded.username}`);
                return res.status(403).json({ 
                    success: false,
                    message: 'Invalid role',
                    code: 'INVALID_ROLE'
                });
            }
        }

        // Get company ID from decoded token or user metadata
        let companyId = decoded.companyId;
        if (!companyId && user.metadata?.companyId) {
            companyId = user.metadata.companyId;
        }
        if (!companyId && user.metadata?.accessibleSites?.productionSites?.L?.length > 0) {
            // Extract company ID from the first production site ID (format: companyId_siteId)
            const firstSiteId = user.metadata.accessibleSites.productionSites.L[0].S;
            companyId = parseInt(firstSiteId.split('_')[0], 10);
        }

        // Attach user and role info to request
        req.user = {
            username: decoded.username,
            email: decoded.emailId || user.email,
            role: decoded.role || user.role,
            companyId: companyId,
            permissions: decoded.permissions || role?.permissions || {
                'production': ['READ'],
                'consumption': ['READ'],
                'production-units': ['READ'],
                'consumption-units': ['READ']
            },
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
            const userPermissions = req.user?.permissions?.[resource] || [];
            
            if (!userPermissions.includes(action)) {
                logger.warn(`Access denied: User ${req.user.username} attempted ${action} on ${resource}`);
                return res.status(403).json({ 
                    error: 'Access denied',
                    message: `You don't have permission to ${action} ${resource}`
                });
            }
            
            next();
        } catch (error) {
            logger.error('Permission check error:', error);
            res.status(500).json({ error: 'Error checking permissions' });
        }
    };
};

module.exports = {
    authenticateToken,
    checkPermission
};
