const { docClient } = require('../config/aws-config');
const { ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');

class UserDAL {
    constructor() {
        this.docClient = docClient;
        this.userTable = TableNames.USERS || 'UserTable';
    }

    /**
     * Get all users with their details
     * @returns {Promise<Array>} Array of user objects
     */
    async getAllUsers() {
        try {
            logger.info('[UserDAL] Fetching all users');
            
            const command = new ScanCommand({
                TableName: this.userTable,
                ProjectionExpression: 'username, email, roleId, createdAt, updatedAt, isActive, #version',
                ExpressionAttributeNames: {
                    '#version': 'version'
                }
            });

            const result = await this.docClient.send(command);
            logger.info(`[UserDAL] Retrieved ${result.Items.length} users`);
            
            return result.Items || [];
        } catch (error) {
            logger.error('[UserDAL] Error getting all users:', error);
            throw error;
        }
    }

    /**
     * Get user by username
     * @param {string} username - The username to retrieve
     * @returns {Promise<Object|null>} User object or null if not found
     */
    async getUserByUsername(username) {
        try {
            
            const command = new GetCommand({
                TableName: this.userTable,
                Key: {
                    username: username.toString()
                }
            });

            const result = await this.docClient.send(command);
            
            if (!result.Item) {
                logger.warn(`[UserDAL] User not found: ${username}`);
                return null;
            }

            return result.Item;
        } catch (error) {
            logger.error(`[UserDAL] Error getting user ${username}:`, error);
            throw error;
        }
    }

    /**
     * Create a new user
     * @param {Object} userData - User data including username, email, password, roleId, etc.
     * @returns {Promise<Object>} Created user object
     */
    async createUser(userData) {
        try {
            logger.info(`[UserDAL] Creating new user: ${userData.username}`);

            const now = new Date().toISOString();
            const user = {
                username: userData.username.toString(),
                email: userData.email || '',
                password: userData.password || '',
                roleId: userData.roleId || 'USER',
                createdAt: now,
                updatedAt: now,
                isActive: userData.isActive !== undefined ? userData.isActive : true,
                version: 1
            };

            // Add optional fields
            if (userData.metadata) {
                user.metadata = userData.metadata;
            }

            const command = new PutCommand({
                TableName: this.userTable,
                Item: user,
                ConditionExpression: 'attribute_not_exists(username)' // Prevent overwriting existing users
            });

            await this.docClient.send(command);
            logger.info(`[UserDAL] User created successfully: ${userData.username}`);

            return user;
        } catch (error) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.warn(`[UserDAL] User already exists: ${userData.username}`);
                throw new Error(`User ${userData.username} already exists`);
            }
            logger.error(`[UserDAL] Error creating user:`, error);
            throw error;
        }
    }

    /**
     * Update an existing user
     * @param {string} username - The username of the user to update
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated user object
     */
    async updateUser(username, updateData) {
        try {
            logger.info(`[UserDAL] Updating user: ${username}`);

            // Check if username is being changed
            if (updateData.username && updateData.username !== username) {
                logger.info(`[UserDAL] Username change requested: ${username} -> ${updateData.username}`);
                return await this.changeUsername(username, updateData);
            }

            // Build the update expression
            const updates = [];
            const expressionAttributeValues = {};
            const expressionAttributeNames = {};

            Object.keys(updateData).forEach((key, index) => {
                if (key !== 'username') { // Don't update the primary key
                    const placeholder = `#${key}`;
                    const valuePlaceholder = `:${key}`;
                    
                    expressionAttributeNames[placeholder] = key;
                    expressionAttributeValues[valuePlaceholder] = updateData[key];
                    updates.push(`${placeholder} = ${valuePlaceholder}`);
                }
            });

            // Always update the updatedAt timestamp
            expressionAttributeNames['#updatedAt'] = 'updatedAt';
            expressionAttributeValues[':updatedAt'] = new Date().toISOString();
            updates.push('#updatedAt = :updatedAt');

            const updateExpression = `SET ${updates.join(', ')}`;

            const command = new UpdateCommand({
                TableName: this.userTable,
                Key: {
                    username: username.toString()
                },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            });

            const result = await this.docClient.send(command);
            logger.info(`[UserDAL] User updated successfully: ${username}`);

            return result.Attributes;
        } catch (error) {
            logger.error(`[UserDAL] Error updating user ${username}:`, error);
            throw error;
        }
    }

    /**
     * Change a user's username (requires creating new record and deleting old)
     * @param {string} oldUsername - The old username
     * @param {Object} updateData - Update data including new username
     * @returns {Promise<Object>} Updated user object with new username
     */
    async changeUsername(oldUsername, updateData) {
        try {
            logger.info(`[UserDAL] Changing username: ${oldUsername} -> ${updateData.username}`);

            // Get the existing user
            const getCommand = new GetCommand({
                TableName: this.userTable,
                Key: {
                    username: oldUsername.toString()
                }
            });

            const existingUserResult = await this.docClient.send(getCommand);
            if (!existingUserResult.Item) {
                throw new Error(`User ${oldUsername} not found`);
            }

            const existingUser = existingUserResult.Item;

            // Check if new username already exists
            const checkNewUsername = new GetCommand({
                TableName: this.userTable,
                Key: {
                    username: updateData.username.toString()
                }
            });

            const checkResult = await this.docClient.send(checkNewUsername);
            if (checkResult.Item) {
                throw new Error(`Username ${updateData.username} already exists`);
            }

            // Prepare the new user record with updated data
            const newUser = {
                ...existingUser,
                username: updateData.username.toString(),
                updatedAt: new Date().toISOString()
            };

            // Merge other update data
            Object.keys(updateData).forEach(key => {
                if (key !== 'username') {
                    newUser[key] = updateData[key];
                }
            });

            // Create the new user record
            const putCommand = new PutCommand({
                TableName: this.userTable,
                Item: newUser,
                ConditionExpression: 'attribute_not_exists(username)'
            });

            await this.docClient.send(putCommand);
            logger.info(`[UserDAL] New user record created with username: ${updateData.username}`);

            // Delete the old user record
            const deleteCommand = new DeleteCommand({
                TableName: this.userTable,
                Key: {
                    username: oldUsername.toString()
                }
            });

            await this.docClient.send(deleteCommand);
            logger.info(`[UserDAL] Old user record deleted: ${oldUsername}`);

            return newUser;
        } catch (error) {
            logger.error(`[UserDAL] Error changing username:`, error);
            throw error;
        }
    }

    /**
     * Delete a user
     * @param {string} username - The username to delete
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteUser(username) {
        try {
            logger.info(`[UserDAL] Deleting user: ${username}`);

            const command = new DeleteCommand({
                TableName: this.userTable,
                Key: {
                    username: username.toString()
                }
            });

            await this.docClient.send(command);
            logger.info(`[UserDAL] User deleted successfully: ${username}`);

            return true;
        } catch (error) {
            logger.error(`[UserDAL] Error deleting user ${username}:`, error);
            throw error;
        }
    }

    /**
     * Get users by role
     * @param {string} roleId - The role ID to filter by
     * @returns {Promise<Array>} Array of users with the specified role
     */
    async getUsersByRole(roleId) {
        try {
            logger.info(`[UserDAL] Fetching users by role: ${roleId}`);

            const command = new ScanCommand({
                TableName: this.userTable,
                FilterExpression: 'roleId = :roleId',
                ExpressionAttributeValues: {
                    ':roleId': roleId
                },
                ProjectionExpression: 'username, email, roleId, createdAt, updatedAt, isActive'
            });

            const result = await this.docClient.send(command);
            logger.info(`[UserDAL] Found ${result.Items.length} users with role ${roleId}`);

            return result.Items || [];
        } catch (error) {
            logger.error(`[UserDAL] Error getting users by role ${roleId}:`, error);
            throw error;
        }
    }

    /**
     * Get active users
     * @returns {Promise<Array>} Array of active users
     */
    async getActiveUsers() {
        try {
            logger.info('[UserDAL] Fetching active users');

            const command = new ScanCommand({
                TableName: this.userTable,
                FilterExpression: 'isActive = :isActive',
                ExpressionAttributeValues: {
                    ':isActive': true
                },
                ProjectionExpression: 'username, email, roleId, createdAt, updatedAt'
            });

            const result = await this.docClient.send(command);
            logger.info(`[UserDAL] Found ${result.Items.length} active users`);

            return result.Items || [];
        } catch (error) {
            logger.error('[UserDAL] Error getting active users:', error);
            throw error;
        }
    }
}

module.exports = new UserDAL();
