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
        logger.debug(`[UserController] Fetching user with ID: ${userId}`);
        
        // First try to get user by userId (which is the same as username in our case)
        const params = {
            TableName: TableNames.USERS, // Use USERS table constant
            Key: {
                username: userId.toString() // Use username as the key
            }
        };
        
        logger.debug('[UserController] GetItem params:', JSON.stringify(params, null, 2));
        
        const { Item } = await ddbDocClient.send(new GetCommand(params));
        
        if (!Item) {
            logger.warn(`[UserController] User not found with username: ${userId}`);
            return null;
        }
        
        logger.debug(`[UserController] Retrieved user data:`, JSON.stringify(Item, null, 2));
        
        // Extract accessibleSites from metadata if it exists
        let accessibleSites = {
            productionSites: [],
            consumptionSites: []
        };
        
        // Check if accessibleSites exists in metadata
        if (Item.metadata?.accessibleSites) {
            const siteData = Item.metadata.accessibleSites;
            
            // Process production sites
            if (siteData.productionSites?.L) {
                accessibleSites.productionSites = siteData.productionSites.L
                    .map(item => item.S || '')
                    .filter(Boolean);
            }
            
            // Process consumption sites
            if (siteData.consumptionSites?.L) {
                accessibleSites.consumptionSites = siteData.consumptionSites.L
                    .map(item => item.S || '')
                    .filter(Boolean);
            }
        }
        
        // Add accessibleSites to the user object
        const userWithSites = {
            ...Item,
            accessibleSites
        };
        
        logger.debug(`[UserController] Processed user data with sites:`, 
            JSON.stringify(userWithSites, null, 2));
        
        return userWithSites;
    } catch (error) {
        logger.error(`[UserController] Error getting user ${userId}:`, error);
        throw error;
    }
};

module.exports = {
    getUserById
};
