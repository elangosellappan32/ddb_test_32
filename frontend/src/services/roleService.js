import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

const roleService = {
    getAllRoles: async () => {
        try {
            const response = await api.get(`${API_CONFIG.ENDPOINTS.ROLES.GET_ALL}`);
            // Only return roles, not user info
            return response.data.map(role => ({
                roleId: role.roleId,
                roleName: role.roleName,
                description: role.description,
                permissions: role.permissions,
                metadata: {
                    accessLevel: role.metadata.accessLevel,
                    isSystemRole: role.metadata.isSystemRole
                }
            }));
        } catch (error) {
            console.error('Error fetching roles:', error);
            return [
                {
                    roleId: 'ROLE-1',
                    roleName: 'admin',
                    description: 'Administrator role with full access',
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
                {
                    roleId: 'ROLE-2',
                    roleName: 'user',
                    description: 'Standard user with basic access',
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
                {
                    roleId: 'ROLE-3',
                    roleName: 'viewer',
                    description: 'Read-only access',
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
            ];
        }
    },

    getRoleByUsername: async (username) => {
        try {
            // First get the user to get their roleId
            const userResponse = await api.get(`${API_CONFIG.ENDPOINTS.USERS.GET_BY_USERNAME(username)}`);
            const roleId = userResponse.data.roleId;
            
            // Then get the role details
            const roleResponse = await api.get(`${API_CONFIG.ENDPOINTS.ROLES.GET_BY_ID(roleId)}`);
            return roleResponse.data;
        } catch (error) {
            console.error('Error fetching role:', error);
            // Return a default user role as fallback
            return {
                roleId: 'ROLE-2',
                roleName: 'user',
                description: 'Standard user with basic access',
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
            };
        }
    }
};

export default roleService;