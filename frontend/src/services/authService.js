import api from './apiUtils';
import { API_MESSAGES } from '../config/api.config';
import { hasPermission } from '../utils/permissions';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const authService = {    login: async (username, password) => {
        try {
            console.info('Attempting login...');
            const response = await api.post('/auth/login', { 
                username, 
                password 
            });

            if (response.data?.success) {
                const { token, user } = response.data;
                console.info('Login response:', { token: !!token, user });

                // Validate user object
                if (!user || typeof user !== 'object') {
                    console.error('Invalid user data:', user);
                    throw new Error('Invalid user data received from server');
                }

                // Validate metadata and accessibleSites
                if (!user.metadata?.accessibleSites) {
                    console.error('Missing accessibleSites in user metadata:', user.metadata);
                    throw new Error('Site access configuration missing from user data');
                }

                const accessibleSites = user.metadata.accessibleSites;

                // Validate production sites structure
                if (!accessibleSites.productionSites?.L || !Array.isArray(accessibleSites.productionSites.L)) {
                    console.error('Invalid productionSites structure:', accessibleSites.productionSites);
                    throw new Error('Invalid production sites access configuration');
                }

                // Validate consumption sites structure
                if (!accessibleSites.consumptionSites?.L || !Array.isArray(accessibleSites.consumptionSites.L)) {
                    console.error('Invalid consumptionSites structure:', accessibleSites.consumptionSites);
                    throw new Error('Invalid consumption sites access configuration');
                }

                // Validate site ID format
                const validateSiteIds = (sites) => {
                    return sites.every(site => (
                        site && 
                        typeof site.S === 'string' && 
                        site.S.includes('_')
                    ));
                };

                if (!validateSiteIds(accessibleSites.productionSites.L)) {
                    console.error('Invalid production site IDs:', accessibleSites.productionSites.L);
                    throw new Error('Invalid production site access data format');
                }

                if (!validateSiteIds(accessibleSites.consumptionSites.L)) {
                    console.error('Invalid consumption site IDs:', accessibleSites.consumptionSites.L);
                    throw new Error('Invalid consumption site access data format');
                }

                // Ensure companyId is included in user data
                if (!user.companyId) {
                    console.warn('No companyId found in user data. This may affect some features.');
                }

                // Extract company ID from department or metadata if available
                let userCompanyId = user.companyId;
                if (!userCompanyId && user.metadata?.department) {
                    if (user.metadata.department.toLowerCase().includes('smr')) {
                        userCompanyId = '5'; // SMR Energy's company ID
                    } else if (user.metadata.department.toLowerCase().includes('strio')) {
                        userCompanyId = '1'; // STRIO's company ID
                    }
                }

                const userData = {
                    username: user.username,
                    email: user.email,
                    roleId: user.roleId,
                    roleName: user.roleName,
                    role: user.roleName?.toLowerCase(),
                    permissions: user.permissions || {},
                    metadata: user.metadata,
                    accessibleSites: accessibleSites,
                    companyId: userCompanyId
                };

                if (!userData.companyId) {
                    console.warn('No companyId found for user. This user may not be able to perform company-specific operations.');
                }

                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(USER_KEY, JSON.stringify(userData));
                
                console.info('User data stored successfully');
                return {
                    success: true,
                    user: userData
                };
            }

            throw new Error(response.data?.message || API_MESSAGES.AUTH.LOGIN_FAILED);
        } catch (error) {
            console.error('Login error:', error);
            if (error.response?.status === 404) {
                throw new Error('Login service is temporarily unavailable. Please try again later.');
            }
            throw new Error(error.response?.data?.message || error.message || API_MESSAGES.AUTH.LOGIN_FAILED);
        }
    },

    logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    getCurrentUser: () => {
        try {
            const userStr = localStorage.getItem(USER_KEY);
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    getToken: () => localStorage.getItem(TOKEN_KEY),

    isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),

    isAdmin: () => {
        const user = authService.getCurrentUser();
        return user?.role?.toUpperCase() === 'ADMIN';
    },

    hasRole: (role) => {
        const user = authService.getCurrentUser();
        return user?.role?.toUpperCase() === role.toUpperCase();
    },

    hasPermission: (resource, action) => {
        const user = authService.getCurrentUser();
        if (!user || !user.role) {
            return false;
        }
        return hasPermission(user, resource, action);
    },

    // Useful helper methods for checking specific permissions
    canCreate: (resource) => authService.hasPermission(resource, 'CREATE'),
    canRead: (resource) => authService.hasPermission(resource, 'READ'),
    canUpdate: (resource) => authService.hasPermission(resource, 'UPDATE'),
    canDelete: (resource) => authService.hasPermission(resource, 'DELETE'),
    
    // Method to check if user has any of the given permissions
    hasAnyPermission: (resource, actions) => {
        const user = authService.getCurrentUser();
        return actions.some(action => hasPermission(user, resource, action));
    },

    // Add method to get accessible sites
    getAccessibleSites: () => {
        const user = authService.getCurrentUser();
        return user?.accessibleSites || {
            productionSites: { L: [] },
            consumptionSites: { L: [] }
        };
    },

    // Add helper method to check if site is accessible
    canAccessSite: (siteType, siteId) => {
        const user = authService.getCurrentUser();
        if (!user?.accessibleSites) return false;

        const sites = siteType === 'production' 
            ? user.accessibleSites.productionSites.L 
            : user.accessibleSites.consumptionSites.L;

        return sites.some(site => site.S === siteId);
    }
};

export default authService;