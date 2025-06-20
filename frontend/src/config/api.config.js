export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3333/api';

export const API_CONFIG = {
    BASE_URL: API_BASE_URL,
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    TABLES: {
        USER: 'UserTable',
        ROLE: 'RoleTable',
        COMPANY: 'CompanyTable',
        CAPTATIVE: 'CaptativeTable',
        PRODUCTION_SITE: 'ProductionSiteTable',
        PRODUCTION_UNIT: 'ProductionUnitTable',
        PRODUCTION_CHARGE: 'ProductionChargeTable',
        BANKING: 'BankingTable',
        ALLOCATION: 'AllocationTable',
        LAPSE: 'LapseTable',
        CONSUMPTION_SITE: 'ConsumptionSiteTable',
        CONSUMPTION_UNIT: 'ConsumptionUnitTable'
    },
    ENDPOINTS: {
        USER: {
            BASE: '/api/user',
            GET_ACCESSIBLE_SITES: '/api/user/accessible-sites'
        },
        SITE_ACCESS: {
            BASE: '/site-access',
            GET_AVAILABLE_SITES: (siteType) => `/site-access/available-sites/${siteType}`,
            GRANT_ACCESS: '/site-access/grant-access'
        },
        AUTH: {
            BASE: '/auth',
            LOGIN: '/auth/login',
            VERIFY: '/auth/verify',
            GET_CURRENT_USER: '/auth/me',
            GET_ACCESSIBLE_SITES: '/auth/accessible-sites'
        },
        CAPTIVE: {
            BASE: '/captive',
            GET_ALL: '/captive/all',
            GET_BY_GENERATOR_SHAREHOLDER: (generatorCompanyId, shareholderCompanyId) => 
                `/captive/${generatorCompanyId}/${shareholderCompanyId}`,
            CREATE: '/captive',
            UPDATE: (generatorCompanyId, shareholderCompanyId) => 
                `/captive/${generatorCompanyId}/${shareholderCompanyId}`,
            DELETE: (generatorCompanyId, shareholderCompanyId) => 
                `/captive/${generatorCompanyId}/${shareholderCompanyId}`
        },
        ROLES: {
            BASE: '/roles',
            GET_ALL: '/roles/all',
            GET_BY_ID: (roleId) => `/roles/${roleId}`,
            GET_BY_USERNAME: (username) => `/roles/user/${username}`
        },
        PRODUCTION: {
            SITE: {
                BASE: '/production-site',
                GET_ALL: '/production-site/all',
                GET_ONE: (companyId, productionSiteId) => 
                    `/production-site/${companyId}/${productionSiteId}`,
                CREATE: '/production-site',
                UPDATE: (companyId, productionSiteId) => 
                    `/production-site/${companyId}/${productionSiteId}`,
                DELETE: (companyId, productionSiteId) => 
                    `/production-site/${companyId}/${productionSiteId}`
            },
            UNIT: {
                BASE: '/production-unit',
                GET_ALL: (companyId, productionSiteId) => 
                    `/production-unit/${companyId}/${productionSiteId}/all`,
                GET_ONE: (companyId, productionSiteId, unitId) => 
                    `/production-unit/${companyId}/${productionSiteId}/${unitId}`,
                CREATE: (companyId, productionSiteId) => 
                    `/production-unit/${companyId}/${productionSiteId}`,
                UPDATE: (companyId, productionSiteId, unitId) => 
                    `/production-unit/${companyId}/${productionSiteId}/${unitId}`,
                DELETE: (companyId, productionSiteId, unitId) => 
                    `/production-unit/${companyId}/${productionSiteId}/${unitId}`
            },
            CHARGE: {
                BASE: '/production-charge',
                GET_ALL: (companyId, productionSiteId) => 
                    `/production-charge/${companyId}/${productionSiteId}/all`,
                GET_ONE: (companyId, productionSiteId, chargeId) => 
                    `/production-charge/${companyId}/${productionSiteId}/${chargeId}`,
                CREATE: (companyId, productionSiteId) => 
                    `/production-charge/${companyId}/${productionSiteId}`,
                UPDATE: (companyId, productionSiteId, chargeId) => 
                    `/production-charge/${companyId}/${productionSiteId}/${chargeId}`,
                DELETE: (companyId, productionSiteId, chargeId) => 
                    `/production-charge/${companyId}/${productionSiteId}/${chargeId}`
            }
        },
        CONSUMPTION: {
            SITE: {
                BASE: '/consumption-site',
                GET_ALL: '/consumption-site/all',
                GET_ONE: (companyId, siteId) => `/consumption-site/${companyId}/${siteId}`,
                CREATE: '/consumption-site',
                UPDATE: (companyId, siteId) => `/consumption-site/${companyId}/${siteId}`,
                DELETE: (companyId, siteId) => `/consumption-site/${companyId}/${siteId}`
            },
            UNIT: {
                BASE: '/consumption-unit',
                GET_ALL: (companyId, siteId) => `/consumption-unit/${companyId}/${siteId}/all`,
                GET_ONE: (companyId, siteId, sk) => `/consumption-unit/${companyId}/${siteId}/${sk}`,
                CREATE: (companyId, siteId) => `/consumption-unit/${companyId}/${siteId}`,
                UPDATE: (companyId, siteId, sk) => `/consumption-unit/${companyId}/${siteId}/${sk}`,
                DELETE: (companyId, siteId, sk) => `/consumption-unit/${companyId}/${siteId}/${sk}`
            }
        },
        ALLOCATION: {
            BASE: '/allocation',
            GET_ALL: '/allocation/month',
            CREATE: '/allocation',
            UPDATE: (pk, sk) => `/allocation/${pk}/${sk}`,
            DELETE: (pk, sk) => `/allocation/${pk}/${sk}`,
            BATCH: '/allocation/batch'
        },
        BANKING: {
            BASE: '/banking',
            GET_ALL: '/banking',
            CREATE: '/banking',
            UPDATE: (pk, sk) => `/banking/${pk}/${sk}`,
            DELETE: (pk, sk) => `/banking/${pk}/${sk}`,
            GET_BY_PERIOD: (pk, period) => `/banking/${pk}/period/${period}`,
            GET_BY_MONTH: (month) => `/banking/month/${month}`
        },
        LAPSE: {
            BASE: '/lapse',
            GET_ALL: '/lapse',
            CREATE: '/lapse',
            UPDATE: (pk, sk) => `/lapse/${pk}/${sk}`,
            DELETE: (pk, sk) => `/lapse/${pk}/${sk}`,
            GET_BY_MONTH: (month) => `/lapse/month/${month}`
        },
        COMPANY: {
            BASE: '/company',
            GET_ALL: '/company',
            GET_ONE: (companyId) => `/company/${companyId}`,
            CREATE: '/company',
            UPDATE: (companyId) => `/company/${companyId}`,
            DELETE: (companyId) => `/company/${companyId}`
        },
        CAPTATIVE: {
            BASE: '/captative',
            GET_ALL: (companyId) => `/company/${companyId}/captative`,
            GET_ONE: (companyId, captativeId) => `/company/${companyId}/captative/${captativeId}`,
            CREATE: (companyId) => `/company/${companyId}/captative`,
            UPDATE: (companyId, captativeId) => `/company/${companyId}/captative/${captativeId}`,
            DELETE: (companyId, captativeId) => `/company/${companyId}/captative/${captativeId}`,
            GET_BY_PERIOD: (companyId, period) => `/company/${companyId}/captative/period/${period}`
        }
    }
};

export const API_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

export const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const API_MESSAGES = {
    AUTH: {
        LOGIN_SUCCESS: 'Login successful',
        LOGIN_FAILED: 'Invalid username or password',
        LOGOUT_SUCCESS: 'Logged out successfully',
        SESSION_EXPIRED: 'Your session has expired. Please login again',
        UNAUTHORIZED: 'You are not authorized to perform this action'
    },
    PRODUCTION: {
        SITE_CREATED: 'Production site created successfully',
        SITE_UPDATED: 'Production site updated successfully',
        SITE_DELETED: 'Production site deleted successfully',
        UNIT_CREATED: 'Production unit created successfully',
        UNIT_UPDATED: 'Production unit updated successfully',
        UNIT_DELETED: 'Production unit deleted successfully',
        CHARGE_CREATED: 'Production charge created successfully',
        CHARGE_UPDATED: 'Production charge updated successfully',
        CHARGE_DELETED: 'Production charge deleted successfully',
        COMPANY_CREATED: 'Company created successfully',
        COMPANY_UPDATED: 'Company updated successfully',
        COMPANY_DELETED: 'Company deleted successfully',
        CAPTATIVE_CREATED: 'Captative created successfully',
        CAPTATIVE_UPDATED: 'Captative updated successfully',
        CAPTATIVE_DELETED: 'Captative deleted successfully'
    }
};

export const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    VIEWER: 'viewer'
};

export const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: {
        roleId: 'ROLE-1',
        permissions: {
            production: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            'production-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            'production-charges': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            'consumption': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            'consumption-units': ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            users: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
            roles: ['READ']
        },
        metadata: {
            accessLevel: 'Full',
            isSystemRole: true
        }
    },
    [ROLES.USER]: {
        roleId: 'ROLE-2',
        permissions: {
            production: ['READ', 'UPDATE'],
            'production-units': ['READ', 'UPDATE'],
            'production-charges': ['READ', 'UPDATE'],
            'consumption': ['READ', 'UPDATE'],
            'consumption-units': ['READ', 'UPDATE'],
            users: ['READ'],
            roles: ['READ']
        },
        metadata: {
            accessLevel: 'Standard',
            isSystemRole: true
        }
    },
    [ROLES.VIEWER]: {
        roleId: 'ROLE-3',
        permissions: {
            production: ['READ'],
            'production-units': ['READ'],
            'production-charges': ['READ'],
            'consumption': ['READ'],
            'consumption-units': ['READ'],
            users: ['READ'],
            roles: ['READ']
        },
        metadata: {
            accessLevel: 'Basic',
            isSystemRole: true
        }
    }
};