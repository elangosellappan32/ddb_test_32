const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AuthDAL = require('./authDal');
const { mapRoleIdToName } = require('../utils/roleMapper');

class AuthController {
    constructor() {
        this.authDal = new AuthDAL();
    }

    generateTokens(userData) {
        const accessToken = jwt.sign(
            {
                userId: userData.userId || userData.username, // Use userId if available, fallback to username
                username: userData.username,
                role: userData.role,
                roleName: userData.roleName, // Include normalized role name
                permissions: userData.permissions,
                emailId: userData.email,
                companyId: userData.companyId, // Include company ID in the token
                metadata: userData.metadata, // Include full metadata for additional company information
                tokenType: 'access'
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        const refreshToken = jwt.sign(
            {
                username: userData.username,
                tokenType: 'refresh'
            },
            process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
            { expiresIn: '7d' }
        );

        return { accessToken, refreshToken };
    }

    async login(username, password) {
        try {
            logger.info(`Login attempt for user: ${username}`);
            // Get user from UserTable
            const userData = await this.authDal.getUserFromUserTable(username);
            if (!userData) {
                throw new Error('User not found');
            }
            if (userData.password !== password) {
                throw new Error('Invalid credentials');
            }

            // Map role/roleId to proper role name for frontend
            let roleName = userData.role || userData.roleId || 'USER';
            
            // Use roleMapper to convert database roleId to friendly name
            // If userData has roleId (like ROLE-1), map it; otherwise use role field
            if (userData.roleId) {
                roleName = mapRoleIdToName(userData.roleId);
            } else if (roleName && typeof roleName === 'string') {
                // Ensure roleName is in uppercase format expected by frontend
                const roleNameUpper = roleName.toUpperCase();
                // Map common variations to standard role names
                if (roleNameUpper === 'SUPERADMIN' || roleNameUpper === 'SUPER_ADMIN') {
                    roleName = 'SUPERADMIN';
                } else if (roleNameUpper === 'ADMIN') {
                    roleName = 'ADMIN';
                } else if (roleNameUpper === 'USER') {
                    roleName = 'USER';
                } else if (roleNameUpper === 'VIEWER') {
                    roleName = 'VIEWER';
                } else {
                    roleName = 'USER'; // Default to USER
                }
            }

            const permissions = userData.metadata?.permissions || (roleName === 'ADMIN' || roleName === 'SUPERADMIN'
                ? ['CREATE', 'READ', 'UPDATE', 'DELETE']
                : ['READ']);

            // Ensure userId is set (use username as fallback)
            const userId = userData.userId || username;
            
            const userInfo = {
                userId, // Use the userId from the database or fallback to username
                username,
                role: userData.role, // Keep original role for backward compatibility
                roleName, // Add normalized roleName for frontend permission checking
                permissions,
                emailId: userData.email,
                email: userData.email,
                companyId: userData.companyId, // Include companyId if available
                metadata: userData.metadata || {}
            };
            
            const { accessToken, refreshToken } = this.generateTokens(userInfo);

            // Store refresh token
            await this.authDal.storeRefreshToken(username, refreshToken);

            return {
                success: true,
                accessToken,
                refreshToken,
                user: userInfo
            };
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key');
            
            if (decoded.tokenType !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Get user data
            const userData = await this.authDal.getUserFromUserTable(decoded.username);
            if (!userData) {
                throw new Error('User not found');
            }

            // Verify refresh token is still valid in database
            const storedToken = await this.authDal.getRefreshToken(decoded.username);
            if (storedToken !== refreshToken) {
                throw new Error('Invalid refresh token');
            }

            // Map role to proper role name
            let roleName = userData.role || userData.roleId || 'USER';
            
            // Use roleMapper to convert database roleId to friendly name
            if (userData.roleId) {
                roleName = mapRoleIdToName(userData.roleId);
            } else if (roleName && typeof roleName === 'string') {
                const roleNameUpper = roleName.toUpperCase();
                if (roleNameUpper === 'SUPERADMIN' || roleNameUpper === 'SUPER_ADMIN') {
                    roleName = 'SUPERADMIN';
                } else if (roleNameUpper === 'ADMIN') {
                    roleName = 'ADMIN';
                } else if (roleNameUpper === 'USER') {
                    roleName = 'USER';
                } else if (roleNameUpper === 'VIEWER') {
                    roleName = 'VIEWER';
                } else {
                    roleName = 'USER';
                }
            }

            const permissions = userData.metadata?.permissions || (roleName === 'ADMIN' || roleName === 'SUPERADMIN'
                ? ['CREATE', 'READ', 'UPDATE', 'DELETE']
                : ['READ']);

            const userInfo = {
                username: userData.username,
                userId: userData.userId || userData.username,
                role: userData.role,
                roleName: roleName,
                permissions,
                emailId: userData.email,
                email: userData.email,
                companyId: userData.companyId
            };

            // Generate new tokens
            const tokens = this.generateTokens(userInfo);
            
            // Update stored refresh token
            await this.authDal.storeRefreshToken(decoded.username, tokens.refreshToken);

            return {
                success: true,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: userInfo
            };
        } catch (error) {
            logger.error('Token refresh error:', error);
            throw error;
        }
    }

    async validateToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            return {
                success: true,
                user: decoded
            };
        } catch (error) {
            logger.error('Token validation error:', error);
            throw new Error('Invalid token');
        }
    }

    /**
     * Get all sites accessible by a user
     * @param {Object} user - User object with username
     * @returns {Promise<Array>} - Array of site objects
     */
    async getAccessibleSites(user) {
        try {
            return await this.authDal.getAccessibleSites(user);
        } catch (error) {
            logger.error('Error in getAccessibleSites:', error);
            throw error;
        }
    }
}

module.exports = new AuthController();