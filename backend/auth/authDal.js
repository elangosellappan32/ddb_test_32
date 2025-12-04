const { ScanCommand, PutCommand, UpdateCommand, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const docClient = require('../utils/db');
const TableNames = require('../constants/tableNames');

class AuthDAL {
    constructor() {
        this.docClient = docClient;
        this.userTable = 'UserTable';
        this.roleTable = 'RoleTable';
        this.tokenTable = 'TokenTable';
    }

    async validateTables() {
        try {
            // Test connection by attempting to scan with limit 1
            await this.docClient.send(new ScanCommand({
                TableName: this.userTable,
                Limit: 1
            }));
            await this.docClient.send(new ScanCommand({
                TableName: this.roleTable,
                Limit: 1
            }));
            return true;
        } catch (error) {
            logger.error('Table validation failed:', error);
            if (error.name === 'ResourceNotFoundException') {
                throw new Error('Required database tables do not exist');
            }
            throw error;
        }
    }

    async getUserByUsername(username) {
        try {
            await this.validateTables();
            const command = new GetCommand({
                TableName: this.userTable,
                Key: { username }
            });

            const result = await this.docClient.send(command);
            if (!result.Item) {
                return null;
            }

            // Map the role field to roleId for consistency
            const user = result.Item;
            if (user.role && !user.roleId) {
                // Convert role to roleId based on our schema
                user.roleId = user.role === 'admin' ? 'ROLE-1' : 
                             user.role === 'user' ? 'ROLE-2' : 'ROLE-3';
            }
            
            // Ensure userId is set (use username as fallback)
            if (!user.userId) {
                user.userId = user.username;
            }
            
            return user;
        } catch (error) {
            logger.error('DAL Error - getUserByUsername:', error);
            if (error.name === 'ResourceNotFoundException') {
                throw new Error('User table not found');
            } else if (error.name === 'NetworkingError') {
                throw new Error('Database connection failed');
            }
            throw error;
        }
    }

    async getRoleById(roleId) {
        try {
            const command = new GetCommand({
                TableName: this.roleTable,
                Key: { roleId }
            });

            const result = await this.docClient.send(command);
            if (!result.Item) {
                logger.error(`[AuthDAL] Role not found: ${roleId}`);
                return null;
            }

            logger.info(`[AuthDAL] Role retrieved successfully: ${roleId}`, {
                roleName: result.Item.roleName,
                hasPermissions: !!result.Item.permissions,
                permissionKeys: result.Item.permissions ? Object.keys(result.Item.permissions) : []
            });

            // Return role without any user-specific data
            return {
                roleId: result.Item.roleId,
                roleName: result.Item.roleName,
                description: result.Item.description,
                permissions: result.Item.permissions,
                metadata: {
                    accessLevel: result.Item.metadata.accessLevel,
                    isSystemRole: result.Item.metadata.isSystemRole
                }
            };
        } catch (error) {
            logger.error('DAL Error - getRoleById:', error);
            throw error;
        }
    }

    async getUserFromUserTable(username) {
        try {
            const command = new GetCommand({
                TableName: this.userTable,
                Key: { username },
                // Explicitly request all attributes to ensure we get everything
                ProjectionExpression: 'username, email, password, role, roleId, metadata, companyId, isActive, createdAt, updatedAt, lastLogin, userId'
            });

            const response = await this.docClient.send(command);
            if (!response.Item) {
                logger.warn(`User not found: ${username}`);
                return null;
            }

            const userItem = response.Item;
            
            // Ensure we have all required fields with defaults
            const userData = {
                username: userItem.username,
                email: userItem.email,
                password: userItem.password,
                role: userItem.role || 'user',
                roleId: userItem.roleId || null,
                metadata: userItem.metadata || {},
                userId: userItem.userId || userItem.username, // Use existing userId or fallback to username
                companyId: userItem.companyId || null,
                isActive: userItem.isActive !== false, // Default to true if not set
                createdAt: userItem.createdAt || new Date().toISOString(),
                updatedAt: userItem.updatedAt || new Date().toISOString(),
                lastLogin: userItem.lastLogin || null
            };

            return userData;
        } catch (error) {
            logger.error('DAL Error - getUserFromUserTable:', { 
                error: error.message,
                username,
                stack: error.stack
            });
            throw error;
        }
    }

    async getUserByEmail(email) {
        try {
            const command = new QueryCommand({
                TableName: this.userTable,
                IndexName: 'EmailIndex',
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': email
                }
            });

            const response = await this.docClient.send(command);
            if (!response.Items.length) {
                return null;
            }

            // Return user info without sensitive data
            const { password, ...userWithoutPassword } = response.Items[0];
            return userWithoutPassword;
        } catch (error) {
            logger.error('DAL Error - getUserByEmail:', error);
            throw error;
        }
    }

    async createUser(userData) {
        if (!userData.username || !userData.password || !userData.roleId) {
            throw new Error('Missing required user data');
        }

        // Import roleMapper to handle friendly name to roleId conversion
        const { mapRoleNameToId } = require('../utils/roleMapper');
        
        // If roleId is a friendly name (ADMIN, USER, etc.), convert it to database format (ROLE-X)
        let roleIdToStore = userData.roleId;
        if (!userData.roleId.startsWith('ROLE-')) {
            roleIdToStore = mapRoleNameToId(userData.roleId);
            logger.info(`[AuthDAL] Converted roleId from ${userData.roleId} to ${roleIdToStore}`);
        }

        // Verify role exists
        const role = await this.getRoleById(roleIdToStore);
        if (!role) {
            throw new Error(`Invalid role ID: ${roleIdToStore}`);
        }

        const timestamp = new Date().toISOString();
        const command = new PutCommand({
            TableName: this.userTable,
            Item: {
                username: userData.username,
                email: userData.email,
                password: userData.password,
                roleId: roleIdToStore,
                metadata: {
                    department: userData.metadata?.department || 'General',
                    accessLevel: role.metadata.accessLevel
                },
                isActive: true,
                version: 1,
                createdAt: timestamp,
                updatedAt: timestamp,
                lastLogin: null
            },
            ConditionExpression: 'attribute_not_exists(username) AND attribute_not_exists(email)'
        });

        try {
            await this.docClient.send(command);
            return { success: true };
        } catch (error) {
            logger.error('Create user error:', error);
            throw error;
        }
    }

    async updatePassword(username, hashedPassword) {
        if (!username || !hashedPassword) {
            throw new Error('Missing required data');
        }

        const command = new UpdateCommand({
            TableName: this.userTable,
            Key: { username },
            UpdateExpression: 'SET #pwd = :pwd, updatedAt = :updatedAt, version = version + :inc',
            ExpressionAttributeNames: {
                '#pwd': 'password'
            },
            ExpressionAttributeValues: {
                ':pwd': hashedPassword,
                ':updatedAt': new Date().toISOString(),
                ':inc': 1
            },
            ConditionExpression: 'attribute_exists(username)'
        });

        try {
            await this.docClient.send(command);
            return { success: true };
        } catch (error) {
            logger.error('Update password error:', error);
            throw error;
        }
    }

    async updateUserMetadata(username, metadata) {
        const command = new UpdateCommand({
            TableName: this.userTable,
            Key: { username },
            UpdateExpression: 'SET metadata = :metadata, updatedAt = :updatedAt, version = version + :inc',
            ExpressionAttributeValues: {
                ':metadata': metadata,
                ':updatedAt': new Date().toISOString(),
                ':inc': 1
            },
            ReturnValues: 'ALL_NEW'
        });

        try {
            const result = await this.docClient.send(command);
            return result.Attributes;
        } catch (error) {
            logger.error('Update user metadata error:', error);
            throw error;
        }
    }

    async updateLastLogin(username) {
        const command = new UpdateCommand({
            TableName: this.userTable,
            Key: { username },
            UpdateExpression: 'SET lastLogin = :lastLogin',
            ExpressionAttributeValues: {
                ':lastLogin': new Date().toISOString()
            }
        });

        try {
            await this.docClient.send(command);
            return { success: true };
        } catch (error) {
            logger.error('Update last login error:', error);
            throw error;
        }
    }

    async getAllUsers() {
        const command = new ScanCommand({
            TableName: this.userTable,
            ProjectionExpression: '#username, email, roleId, createdAt, updatedAt, version, isActive',
            ExpressionAttributeNames: {
                '#username': 'username'
            }
        });

        try {
            const result = await this.docClient.send(command);
            return result.Items;
        } catch (error) {
            logger.error('Get all users error:', error);
            throw error;
        }
    }

    async getAllRoles() {
        const command = new ScanCommand({
            TableName: this.roleTable
        });

        try {
            const result = await this.docClient.send(command);
            // Map roles to ensure we only return role-specific data
            return result.Items.map(role => ({
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
            logger.error('Get all roles error:', error);
            throw error;
        }
    }

    async storeRefreshToken(username, token) {
        try {
            const now = new Date().toISOString();
            await this.docClient.send(new PutCommand({
                TableName: this.tokenTable,
                Item: {
                    username,
                    token,
                    createdAt: now,
                    updatedAt: now
                }
            }));
            return true;
        } catch (error) {
            logger.error('Store refresh token error:', error);
            throw error;
        }
    }

    async getRefreshToken(username) {
        try {
            const { Item } = await this.docClient.send(new GetCommand({
                TableName: this.tokenTable,
                Key: { username }
            }));
            return Item?.token;
        } catch (error) {
            logger.error('Get refresh token error:', error);
            throw error;
        }
    }

    async revokeRefreshToken(username) {
        try {
            await this.docClient.send(new UpdateCommand({
                TableName: this.tokenTable,
                Key: { username },
                UpdateExpression: 'SET revoked = :revoked, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':revoked': true,
                    ':updatedAt': new Date().toISOString()
                }
            }));
            return true;
        } catch (error) {
            logger.error('Revoke refresh token error:', error);
            throw error;
        }
    }

    /**
     * Extract company ID from user metadata
     * Handles multiple formats: direct companyId, metadata structure, and DynamoDB L/S format
     */
    extractCompanyIdFromUser(user) {
        if (!user) return null;

        // Check direct companyId field (if it exists)
        if (user.companyId) {
            return user.companyId;
        }

        // Check metadata.companyId
        if (user.metadata?.companyId) {
            return user.metadata.companyId;
        }

        // Check metadata.accessibleSites.company (DynamoDB format)
        if (user.metadata?.accessibleSites?.company?.L?.length > 0) {
            const companyId = user.metadata.accessibleSites.company.L[0]?.S;
            if (companyId) {
                return parseInt(companyId, 10);
            }
        }

        // Check metadata.accessibleSites.companyIds
        if (user.metadata?.accessibleSites?.companyIds?.length > 0) {
            return user.metadata.accessibleSites.companyIds[0];
        }

        // Check production sites (format: companyId_siteId)
        if (user.metadata?.accessibleSites?.productionSites?.L?.length > 0) {
            const firstSiteId = user.metadata.accessibleSites.productionSites.L[0]?.S;
            if (firstSiteId) {
                const companyId = parseInt(firstSiteId.split('_')[0], 10);
                if (!isNaN(companyId)) {
                    return companyId;
                }
            }
        }

        logger.warn(`[AuthDAL] Could not extract companyId from user: ${user.username}`);
        return null;
    }

    /**
     * Get accessible sites for a user
     * @param {Object} user - User object with metadata containing accessible sites
     * @returns {Object} Object with productionSites and consumptionSites arrays
     */
    async getAccessibleSites(user) {
        try {
            if (!user || !user.metadata?.accessibleSites) {
                logger.warn(`[AuthDAL] No accessible sites found for user: ${user?.username}`);
                return {
                    productionSites: [],
                    consumptionSites: []
                };
            }

            const accessibleSites = user.metadata.accessibleSites;

            // Extract production sites from DynamoDB format { L: [{S: 'siteId'}, ...] }
            const productionSites = accessibleSites.productionSites?.L?.map(item => item.S).filter(Boolean) || [];

            // Extract consumption sites from DynamoDB format { L: [{S: 'siteId'}, ...] }
            const consumptionSites = accessibleSites.consumptionSites?.L?.map(item => item.S).filter(Boolean) || [];

            return {
                productionSites,
                consumptionSites
            };
        } catch (error) {
            logger.error('[AuthDAL] Error getting accessible sites:', error);
            return {
                productionSites: [],
                consumptionSites: []
            };
        }
    }

}

// Export the AuthDAL class
module.exports = AuthDAL;