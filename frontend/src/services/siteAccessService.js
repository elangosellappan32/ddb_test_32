import api from './api';
import { API_CONFIG } from '../config/api.config';
import { handleApiError } from '../utils/errorHandlers';

class SiteAccessService {
    constructor() {
        // Bind methods
        this.getAvailableSites = this.getAvailableSites.bind(this);
        this.grantSiteAccess = this.grantSiteAccess.bind(this);
    }

    /**
     * Gets all accessible sites for the current user
     * @param {string} siteType - Optional filter for site type ('production' or 'consumption')
     * @returns {Promise<Array>} Array of accessible sites
     */
    async getAvailableSites(siteType = null) {
        try {
            const response = await api.get(
                `${API_CONFIG.ENDPOINTS.SITE_ACCESS.BASE}/my-accessible-sites`
            );

            if (!response?.data?.success) {
                throw new Error(response?.data?.message || 'Failed to fetch accessible sites');
            }

            const { productionSites = [], consumptionSites = [] } = response.data.data || {};
            
            // Process sites based on the requested type
            let sites = [];
            
            if (!siteType || siteType === 'production') {
                sites = [
                    ...sites,
                    ...productionSites.map(site => {
                        // If siteName already contains the company name, use it as is
                        // Otherwise, format it as "Company Name - Site Name"
                        const siteName = site.siteName || `Site ${site.siteId}`;
                        const formattedName = siteName.includes(site.companyName) 
                            ? siteName 
                            : site.companyName 
                                ? `${site.companyName} - ${siteName}`
                                : siteName;

                        return {
                            id: `${site.companyId}_${site.siteId}`,
                            companyId: site.companyId,
                            productionSiteId: site.siteId,
                            name: formattedName,
                            type: 'production',
                            location: site.location || `${site.district || ''}${site.district && site.state ? ', ' : ''}${site.state || ''}`.trim() || 'Location not specified',
                            ...site  // Spread the rest of the site data
                        };
                    })
                ];
            }
            
            if (!siteType || siteType === 'consumption') {
                sites = [
                    ...sites,
                    ...consumptionSites.map(site => ({
                        id: `${site.companyId}_${site.siteId}`,
                        companyId: site.companyId,
                        consumptionSiteId: site.siteId,
                        name: site.siteName || 'Unnamed Consumption Site',
                        type: 'consumption',
                        location: `${site.district}, ${site.state}`.trim() || 'Location not specified'
                    }))
                ];
            }

            return sites;
        } catch (error) {
            console.error('Error fetching accessible sites:', error);
            throw error;
        }
    }

    /**
     * Grants access to existing sites for a user
     * @param {string} userId - The user ID to grant access to
     * @param {string[]} siteIds - Array of site IDs to grant access to
     * @param {string} siteType - Type of sites ('production' or 'consumption')
     * @returns {Promise<Object>} Response data
     */
    async grantSiteAccess(userId, siteIds, siteType) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }
            if (!Array.isArray(siteIds) || siteIds.length === 0) {
                throw new Error('At least one site ID is required');
            }
            if (!['production', 'consumption'].includes(siteType)) {
                throw new Error('Invalid site type. Must be either "production" or "consumption"');
            }

            const response = await api.post(
                API_CONFIG.ENDPOINTS.SITE_ACCESS.GRANT_ACCESS,
                {
                    userId,
                    siteIds,
                    siteType
                }
            );

            return response.data;
        } catch (error) {
            return handleApiError(error);
        }
    }
}

// Export the class for static method access
export { SiteAccessService };

// Also export an instance for backward compatibility
const siteAccessService = new SiteAccessService();
export default siteAccessService;
