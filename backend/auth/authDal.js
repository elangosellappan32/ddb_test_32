const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    ScanCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
    GetCommand
} = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');

class AuthDAL {
    constructor() {
        try {
            const client = new DynamoDBClient({
                endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
                maxAttempts: 3
            });
            this.docClient = DynamoDBDocumentClient.from(client);
            this.userTable = 'UserTable';
            this.roleTable = 'RoleTable';
            this.tokenTable = 'TokenTable';
        } catch (error) {
            logger.error('AuthDAL initialization error:', error);
            throw error;
        }
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
                return null;
            }

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

        // Verify role exists
        const role = await this.getRoleById(userData.roleId);
        if (!role) {
            throw new Error('Invalid role ID');
        }

        const timestamp = new Date().toISOString();
        const command = new PutCommand({
            TableName: this.userTable,
            Item: {
                username: userData.username,
                email: userData.email,
                password: userData.password,
                roleId: userData.roleId,
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
}

module.exports = AuthDAL;