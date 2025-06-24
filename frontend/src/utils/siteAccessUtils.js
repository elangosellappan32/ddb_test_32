import api from '../services/api';

/**
 * Utility functions for site access management
 */

/**
 * Checks if a user has access to a specific site
 * @param {Object} user - The user object
 * @param {string} siteId - The site ID in format 'companyId_siteId'
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {boolean} Whether the user has access to the site
 */
export const hasAccessToSite = (user, siteId, siteType) => {
    if (!user || !siteId || !siteType) return false;

    // Admin users have access to all sites
    if (user.role === 'admin' || user.roleName === 'ADMIN') {
        return true;
    }

    // Check if user has accessible sites configuration
    if (!user.accessibleSites) return false;

    const sitesList = siteType === 'production' 
        ? user.accessibleSites.productionSites?.L 
        : user.accessibleSites.consumptionSites?.L;

    // Validate sites list structure
    if (!Array.isArray(sitesList)) return false;

    // Check if site exists in user's accessible sites
    return sitesList.some(site => site.S === siteId);
};

/**
 * Get all site IDs that a user has access to
 * @param {Object} user - The user object
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {string[]} Array of site IDs
 */
export const getAccessibleSiteIds = (user, siteType) => {
    if (!user || !siteType) return [];

    // Admin users have access to all sites, but we still need to return the ones they can see
    // This will be populated by API calls later
    if (user.role === 'admin' || user.roleName === 'ADMIN') {
        return [];
    }

    // Check if user has accessible sites configuration
    if (!user.accessibleSites) return [];

    const sitesList = siteType === 'production' 
        ? user.accessibleSites.productionSites?.L 
        : user.accessibleSites.consumptionSites?.L;

    // Validate sites list structure and return site IDs
    if (!Array.isArray(sitesList)) return [];

    return sitesList.map(site => site.S).filter(Boolean);
};

/**
 * Format a site ID from its components
 * @param {string|number} companyId - The company ID
 * @param {string|number} siteId - The site ID
 * @returns {string} The formatted site ID
 */
export const formatSiteId = (companyId, siteId) => {
    return `${companyId}_${siteId}`;
};

/**
 * Parse a site ID into its components
 * @param {string} combinedId - The combined site ID (format: 'companyId_siteId')
 * @returns {Object} Object containing companyId and siteId
 */
export const parseSiteId = (combinedId) => {
    if (!combinedId || typeof combinedId !== 'string') return { companyId: null, siteId: null };
    
    const [companyId, siteId] = combinedId.split('_');
    return {
        companyId: companyId ? Number(companyId) : null,
        siteId: siteId ? Number(siteId) : null
    };
};

/**
 * Updates a user's accessible sites
 * @param {Object} user - The user object
 * @param {string} siteId - The site ID to add
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Object} Updated user object
 */
export const addSiteToUserAccess = (user, siteId, siteType) => {
    if (!user || !siteId || !siteType) return user;

    // Create a deep copy of the user object
    const updatedUser = JSON.parse(JSON.stringify(user));

    // Initialize accessibleSites if it doesn't exist
    if (!updatedUser.accessibleSites) {
        updatedUser.accessibleSites = {
            productionSites: { L: [] },
            consumptionSites: { L: [] }
        };
    }

    // Get the correct sites array
    const sitesArray = siteType === 'production' 
        ? updatedUser.accessibleSites.productionSites.L 
        : updatedUser.accessibleSites.consumptionSites.L;

    // Check if site already exists
    if (!sitesArray.some(site => site.S === siteId)) {
        sitesArray.push({ S: siteId });
    }

    return updatedUser;
};

/**
 * Updates user's site access in the backend
 * @param {Object} user - The user object
 * @param {string} siteId - The site ID
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Object>} Updated user object from the backend
 * @throws {Error} If the update fails
 */
/**
 * Updates user's site access in the backend
 * @param {Object} user - The user object
 * @param {Object|string} siteData - The site data object or site ID string
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Object>} Response from the server
 * @throws {Error} If the update fails
 */
export const updateUserSiteAccess = async (user, siteData, siteType) => {
    console.log('[SiteAccess] Starting site access update:', { user, siteData, siteType });
    
    // Input validation - check for user ID in multiple possible fields
    const userId = user?.id || user?.userId || user?.username || user?.email;
    if (!userId) {
        const error = new Error('User ID is required');
        console.error('[SiteAccess] Validation error:', error, { user });
        throw error;
    }

    if (!siteData) {
        const error = new Error('Site data is required');
        console.error('[SiteAccess] Validation error:', error);
        throw error;
    }

    if (!['production', 'consumption'].includes(siteType)) {
        const error = new Error('Invalid site type. Must be "production" or "consumption"');
        console.error('[SiteAccess] Validation error:', error);
        throw error;
    }

    // Extract company ID from user object at the function level
    const companyId = user.companyId || user.company?.id || (user.metadata && user.metadata.companyId);
    
    if (!companyId) {
        const error = new Error('Company ID is required in user object');
        console.error('[SiteAccess] Validation error:', error, { user });
        throw error;
    }
    
    console.log(`[SiteAccess] Updating ${siteType} site access for user ${userId} in company ${companyId}`);
    
    const requestData = {
        userId,
        companyId,
        siteType
    };

    try {

        // Extract site ID and format it correctly
        let siteId;
        let siteDataObj = {};
        
        // Handle different siteData formats
        if (typeof siteData === 'object' && siteData !== null) {
            // Handle site data object
            siteId = siteData.id || siteData.siteId || siteData[`${siteType}SiteId`];
            
            if (!siteId) {
                const error = new Error('Site ID not found in site data');
                console.error('[SiteAccess] Validation error:', error, { siteData });
                throw error;
            }

            // Store additional site data
            siteDataObj = {
                name: siteData.name || `${siteType} Site`,
                type: siteData.type || siteType,
                location: siteData.location || '',
                capacity: siteData.capacity_MW || siteData.capacity || 0,
                status: siteData.status || 'active'
            };
        } else if (typeof siteData === 'string' || typeof siteData === 'number') {
            // Handle string or number site ID (format: companyId_siteId or just siteId)
            siteId = String(siteData);
            siteDataObj = {
                name: `${siteType} Site ${siteId}`,
                type: siteType,
                status: 'active'
            };
        } else {
            const error = new Error(`Invalid siteData format. Expected object or string, got ${typeof siteData}`);
            console.error('[SiteAccess] Validation error:', error, { siteData });
            throw error;
        }

        // Ensure siteId is a string
        const siteIdStr = String(siteId);
        
        // Format the site ID if needed (ensure it's in companyId_siteId format)
        const formattedSiteId = siteIdStr.includes('_') ? siteIdStr : `${companyId}_${siteIdStr}`;
        
        // Add site data to request
        requestData.siteData = siteDataObj;
        requestData.siteId = formattedSiteId;

        console.log(`[SiteAccess] Sending update request for ${siteType} site access`, {
            userId,
            companyId,
            siteType,
            originalSiteId: siteId,
            formattedSiteId,
            siteData: requestData.siteData
        });

        // Get the authentication token - using the same key as in authService.js
        const authToken = localStorage.getItem('auth_token');
        
        // Debug logging
        console.log('[SiteAccess] Making API call to update site access:', {
            endpoint: '/site-access/update-site-access',
            userId,
            companyId,
            siteType,
            originalSiteId: siteId,
            formattedSiteId,
            hasToken: !!authToken,
            tokenLength: authToken ? authToken.length : 0,
            localStorageKeys: Object.keys(localStorage),
            authTokenKey: 'auth_token',
            allAuthKeys: Object.keys(localStorage).filter(key => key.includes('token') || key.includes('auth'))
        });

        if (!authToken) {
            const error = new Error('No authentication token found. Please log in again.');
            console.error('[SiteAccess] Authentication error:', error, {
                localStorage: Object.keys(localStorage).filter(key => key.includes('token') || key.includes('auth')),
                hasToken: !!authToken,
                tokenLength: authToken ? authToken.length : 0,
                allAuthKeys: Object.keys(localStorage).filter(key => key.includes('token') || key.includes('auth'))
            });
            throw error;
        }

        // Make the API call with the correct endpoint
        try {
            const response = await api.post('/site-access/update-site-access', requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.data) {
                const error = new Error('Invalid response from server');
                console.error('[SiteAccess] API error:', error);
                throw error;
            }

            console.log(`[SiteAccess] Successfully updated ${siteType} site access for user ${userId}`, {
                response: response.data
            });
            
            return response.data;
        } catch (error) {
            console.error('[SiteAccess] API request failed:', {
                error: error.response?.data || error.message,
                status: error.response?.status,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }

    } catch (error) {
        // Log detailed error information
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            siteType,
            siteData: safeStringify(siteData),
            userId: userId || 'unknown',
            companyId: companyId || 'unknown',
            response: error.response?.data
        };
        
        console.error('[SiteAccess] Error updating site access:', errorInfo);
        
        // Extract a more helpful error message
        let errorMessage = 'Failed to update site access';
        
        if (error.message.includes('includes is not a function')) {
            errorMessage = 'Invalid site data format. Please contact support if the issue persists.';
        } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        // Create a new error to preserve the stack trace
        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        enhancedError.isHandled = true;
        
        // Helper function to safely stringify objects with circular references
        function safeStringify(obj) {
            try {
                return JSON.stringify(obj, (key, value) => 
                    typeof value === 'bigint' ? value.toString() : value
                );
            } catch (e) {
                return `[Object could not be stringified: ${e.message}]`;
            }
        }
        throw enhancedError;
    }
};
