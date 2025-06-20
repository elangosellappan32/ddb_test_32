const logger = require('../utils/logger');

/**
 * Middleware to validate if user has access to the requested site
 */
const validateSiteAccess = (siteType) => {
    return (req, res, next) => {
        try {
            logger.info(`[validateSiteAccess] Starting validation for ${siteType} site`);
            logger.debug('[validateSiteAccess] User object:', JSON.stringify(req.user, null, 2));            // Check if user object exists
            if (!req.user) {
                logger.error('[validateSiteAccess] No user object found in request');
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Admin users or users with ADMIN role bypass site access validation
            if (req.user.roleName === 'ADMIN' || req.user.role === 'admin') {
                logger.info(`Admin user ${req.user.username || req.user.email} bypassing site access validation`);
                return next();
            }

            // Check if this is a GET request for site details
            if (req.method === 'GET') {
                logger.info('[validateSiteAccess] Allowing GET request for site details');
                return next();
            }            // Check if user has required objects
            if (!req.user.accessibleSites || !req.user.permissions) {
                logger.error('[validateSiteAccess] Missing required user data:', { 
                    hasAccessibleSites: !!req.user.accessibleSites,
                    hasPermissions: !!req.user.permissions
                });
                return res.status(403).json({
                    success: false,
                    message: 'User permissions not properly configured',
                    code: 'INVALID_USER_CONFIG'
                });
            }

            const { companyId, productionSiteId, consumptionSiteId } = req.params;
            logger.info('[validateSiteAccess] Request params:', { companyId, productionSiteId, consumptionSiteId });

            // Validate that all required parameters are present
            const siteIdParam = siteType === 'production' ? productionSiteId : consumptionSiteId;
            if (!companyId || !siteIdParam) {
                logger.error('[validateSiteAccess] Missing required parameters:', { companyId, siteIdParam });
                return res.status(400).json({
                    success: false,
                    message: 'Missing required site parameters'
                });
            }            // Format site ID
            const siteId = `${companyId}_${siteIdParam}`;
            logger.info(`[validateSiteAccess] Checking access for site ID: ${siteId}`);            // For DELETE operations, ensure user has delete permission
            if (req.method === 'DELETE') {
                // Verify user authentication first
                if (!req.user) {
                    logger.error('[validateSiteAccess] No authenticated user for DELETE operation');
                    return res.status(401).json({
                        success: false,
                        message: 'Authentication required',
                        code: 'UNAUTHORIZED'
                    });
                }

                // Verify user has required permissions structure
                if (!req.user.permissions) {
                    logger.error('[validateSiteAccess] User permissions not configured');
                    return res.status(403).json({
                        success: false,
                        message: 'User permissions not properly configured',
                        code: 'INVALID_PERMISSIONS'
                    });
                }

                const resourceType = siteType === 'production' ? 'production' : 'consumption';
                const hasDeletePermission = req.user.permissions[resourceType]?.includes('DELETE');
                
                if (!hasDeletePermission) {
                    logger.error('[validateSiteAccess] User lacks DELETE permission:', req.user.permissions);
                    return res.status(403).json({
                        success: false,
                        message: 'You do not have permission to delete sites',
                        code: 'DELETE_NOT_ALLOWED'
                    });
                }
            }

            // Get the appropriate sites list based on site type
            const sitesList = siteType === 'production' 
                ? req.user.accessibleSites.productionSites
                : req.user.accessibleSites.consumptionSites;

            // Skip site list validation for admin users
            if (req.user.role === 'admin' || req.user.roleName === 'ADMIN') {
                logger.info('[validateSiteAccess] Admin user - bypassing site list validation');
                return next();
            }

            // Validate sites list structure
            if (!sitesList || !sitesList.L) {
                logger.error(`[validateSiteAccess] Invalid ${siteType} sites format:`, sitesList);
                return res.status(403).json({
                    success: false,
                    message: `No ${siteType} sites access configured`,
                    code: 'NO_SITE_ACCESS'
                });
            }

            const accessibleSites = sitesList.L;
            
            // Validate accessibleSites is an array
            if (!Array.isArray(accessibleSites)) {
                logger.error('[validateSiteAccess] Accessible sites is not an array:', accessibleSites);
                return res.status(500).json({
                    success: false,
                    message: 'Invalid site access configuration'
                });
            }            // Check if site exists in accessible sites list
            const hasSiteAccess = accessibleSites.some(site => {
                if (!site || typeof site.S !== 'string') {
                    logger.warn('[validateSiteAccess] Invalid site format:', site);
                    return false;
                }
                return site.S === siteId;
            });

            if (!hasSiteAccess) {
                logger.error(`[validateSiteAccess] User does not have access to site: ${siteId}`);
                return res.status(403).json({
                    success: false,
                    message: 'Invalid site access data format'
                });
            }

            // Check if the site is in the accessible sites list
            const hasAccess = accessibleSites.some(site => site.S === siteId);
            
            if (!hasAccess) {
                logger.warn(`[validateSiteAccess] Access denied: User ${req.user.username} attempted to access ${siteType} site ${siteId}`);
                logger.debug('Available sites:', accessibleSites.map(site => site.S));
                return res.status(403).json({
                    success: false,
                    message: `You don't have access to this ${siteType} site`
                });
            }
            
            logger.info(`[validateSiteAccess] Access granted for site ${siteId}`);
            next();
        } catch (error) {
            logger.error('[validateSiteAccess] Unexpected error:', error);
            res.status(500).json({
                success: false,
                message: 'Error validating site access',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
};

module.exports = validateSiteAccess;
