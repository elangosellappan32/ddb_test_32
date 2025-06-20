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
     * Fetches available sites of a specific type
     * @param {string} siteType - Type of site ('production' or 'consumption')
     * @returns {Promise<Array>} List of available sites
     */
    async getAvailableSites(siteType) {
        try {
            if (!['production', 'consumption'].includes(siteType)) {
                throw new Error('Invalid site type. Must be either "production" or "consumption"');
            }

            const response = await api.get(
                API_CONFIG.ENDPOINTS.SITE_ACCESS.GET_AVAILABLE_SITES(siteType)
            );

            if (!response?.data?.data) {
                throw new Error('Invalid response format');
            }

            // Process and validate sites
            const sites = response.data.data.map(site => ({
                id: `${site.companyId}_${site[`${siteType}SiteId`]}`,
                companyId: site.companyId,
                [`${siteType}SiteId`]: site[`${siteType}SiteId`],
                name: site.name || 'Unnamed Site',
                type: site.type?.toLowerCase() || 'unknown',
                location: site.location || 'Unknown Location',
            }));

            return sites;
        } catch (error) {
            return handleApiError(error);
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

const siteAccessService = new SiteAccessService();
export default siteAccessService;
