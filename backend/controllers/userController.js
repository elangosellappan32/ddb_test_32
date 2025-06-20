const { ddbDocClient } = require('../config/aws-config');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');

/**
 * Get user by ID
 * @param {string} userId - The ID of the user to retrieve
 * @returns {Promise<Object|null>} The user object or null if not found
 */
const getUserById = async (userId) => {
    try {
        const params = {
            TableName: TableNames.USER_METADATA,
            Key: {
                userId
            }
        };

        const { Item } = await ddbDocClient.send(new GetCommand(params));
        
        if (!Item) {
            logger.warn(`[UserController] User not found with ID: ${userId}`);
            return null;
        }

        logger.info(`[UserController] Retrieved user with ID: ${userId}`);
        
        // Ensure the accessibleSites structure exists
        if (!Item.accessibleSites) {
            Item.accessibleSites = {
                M: {
                    productionSites: { L: [] },
                    consumptionSites: { L: [] }
                }
            };
        }
        
        return Item;
    } catch (error) {
        logger.error(`[UserController] Error getting user ${userId}:`, error);
        throw error;
    }
};

module.exports = {
    getUserById
};
