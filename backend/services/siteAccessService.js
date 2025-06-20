const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');

const dynamoDB = DynamoDBDocument.from(new DynamoDB({
    region: process.env.AWS_REGION || 'local',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
}));

// Constants
const BATCH_SIZE = 25; // Max items per batch for DynamoDB
const LOCK_TIMEOUT = 30000; // 30 seconds
const SITE_TYPES = ['production', 'consumption'];
const DEFAULT_PERMISSIONS = {
    production: ['READ'],
    consumption: ['READ'],
    'production-units': ['READ'],
    'consumption-units': ['READ']
}; 

/**
 * Get all available sites of a specific type from the site table
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Array>} Array of available sites
 */
const getAvailableSites = async (siteType) => {
    validateSiteType(siteType);
    
    try {
        const tableName = siteType === 'production' ? 
            TableNames.PRODUCTION_SITE : 
            TableNames.CONSUMPTION_SITE;

        let items = [];
        let lastEvaluatedKey;

        do {
            const params = {
                TableName: tableName,
                ProjectionExpression: 'companyId, #siteId, #name, #type, #location',
                ExpressionAttributeNames: {
                    '#siteId': siteType === 'production' ? 'productionSiteId' : 'consumptionSiteId',
                    '#name': 'name',
                    '#type': 'type',
                    '#location': 'location'
                }
            };

            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            const result = await dynamoDB.scan(params);
            items = items.concat(result.Items);
            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return items;
    } catch (error) {
        logger.error(`Error fetching available ${siteType} sites:`, error);
        throw error;
    }
};

/**
 * Add access to existing sites for a user
 * @param {string} userId - The ID of the user
 * @param {Array} siteIds - Array of site IDs to grant access to, in format ["companyId_siteId"]
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<boolean>} True if successful
 */
const addExistingSiteAccess = async (userId, siteIds, siteType) => {
    if (!userId) throw new Error('userId is required');
    if (!Array.isArray(siteIds)) throw new Error('siteIds must be an array');
    validateSiteType(siteType);

    try {
        // Get current user metadata
        const { Item: userData } = await dynamoDB.get({
            TableName: TableNames.USER_METADATA,
            Key: { userId }
        });

        // Initialize user data if needed
        const updatedUserData = initializeAccessibleSites(userData || { userId });
        const listKey = `${siteType}Sites`;
        const currentSites = new Set(updatedUserData.accessibleSites[listKey].L.map(site => site.S));
        
        // Add new sites that don't already exist
        let hasChanges = false;
        siteIds.forEach(siteId => {
            if (!currentSites.has(siteId)) {
                updatedUserData.accessibleSites[listKey].L.push({ S: siteId });
                hasChanges = true;
            }
        });

        if (hasChanges) {
            // Update user metadata with optimistic locking
            const updateParams = {
                TableName: TableNames.USER_METADATA,
                Key: { userId },
                UpdateExpression: 'SET accessibleSites = :sites, #version = :newVersion',
                ConditionExpression: '#version = :version',
                ExpressionAttributeNames: {
                    '#version': 'version'
                },
                ExpressionAttributeValues: {
                    ':sites': updatedUserData.accessibleSites,
                    ':version': userData.version,
                    ':newVersion': userData.version + 1
                },
                ReturnValues: 'ALL_NEW'
            };

            await dynamoDB.update(updateParams);
            logger.info(`Added ${siteType} site access for user ${userId} to sites:`, siteIds);
        }

        return true;
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            logger.warn(`Optimistic lock failed for user ${userId}, retrying...`);
            return addExistingSiteAccess(userId, siteIds, siteType);
        }
        logger.error(`Error adding ${siteType} site access for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Validates a site type string
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @throws {Error} If site type is invalid
 */
const validateSiteType = (siteType) => {
    if (!SITE_TYPES.includes(siteType)) {
        throw new Error(`Invalid site type: ${siteType}. Must be '${SITE_TYPES.join("' or '")}'`);
    }
};

/**
 * Gets the appropriate site list from user metadata with validation
 * @param {Object} userData - The user metadata object
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Array} The list of sites the user has access to
 */
const getSiteList = (userData, siteType) => {
    validateSiteType(siteType);

    if (!userData?.accessibleSites) {
        return [];
    }

    const siteKey = `${siteType}Sites`;
    const sites = userData.accessibleSites[siteKey]?.L;

    if (!Array.isArray(sites)) {
        logger.warn(`Invalid ${siteType} sites format for user:`, userData.userId);
        return [];
    }

    return sites;
};

/**
 * Initializes empty accessible sites structure if not present
 * @param {Object} userData - The user metadata object
 * @returns {Object} Updated user metadata with initialized sites structure
 */
const initializeAccessibleSites = (userData = {}) => {
    const defaultStructure = {
        productionSites: { L: [] },
        consumptionSites: { L: [] },
    };

    if (!userData.accessibleSites) {
        userData.accessibleSites = defaultStructure;
    } else {
        if (!userData.accessibleSites.productionSites?.L) {
            userData.accessibleSites.productionSites = { L: [] };
        }
        if (!userData.accessibleSites.consumptionSites?.L) {
            userData.accessibleSites.consumptionSites = { L: [] };
        }
    }

    return userData;
};

/**
 * Updates user's site access list when a new site is created/updated
 * Uses optimistic locking to prevent conflicts
 * @param {string} userId - The user ID to update
 * @param {string} companyId - The company ID
 * @param {string} siteId - The site ID
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Object>} Updated user object
 * @throws {Error} If operation fails
 */
const updateUserSiteAccess = async (userId, companyId, siteId, siteType) => {
    // Log the incoming parameters for debugging
    logger.info(`[SiteAccess] Updating ${siteType} site access for user ${userId}`, {
        companyId,
        siteId,
        siteType
    });

    // Ensure siteId is a string and format the PK if needed
    const siteIdStr = String(siteId);
    const sitePk = siteIdStr.includes('_') ? siteIdStr : `${companyId}_${siteIdStr}`;
    
    logger.debug(`[SiteAccess] Using site PK: ${sitePk}`);
    if (!userId) throw new Error('userId is required');
    if (!companyId) throw new Error('companyId is required');
    if (!siteId) throw new Error('siteId is required');
    validateSiteType(siteType);

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            // Get current user metadata
            const { Item: userData } = await dynamoDB.get({
                TableName: TableNames.USER_METADATA,
                Key: { userId }
            });

            // Initialize user data if it doesn't exist
            let userMetadata = userData || {
                userId,
                accessibleSites: {
                    M: {
                        productionSites: { L: [] },
                        consumptionSites: { L: [] }
                    }
                },
                version: 0,
                createdat: new Date().toISOString(),
                updatedat: new Date().toISOString()
            };

            // Ensure accessibleSites and its properties exist with proper DynamoDB format
            if (!userMetadata.accessibleSites || !userMetadata.accessibleSites.M) {
                userMetadata.accessibleSites = {
                    M: {
                        productionSites: { L: [] },
                        consumptionSites: { L: [] }
                    }
                };
            }
            
            const listKey = `${siteType}Sites`;
            
            // Ensure the site list exists and is in the correct format
            if (!userMetadata.accessibleSites.M[listKey] || !userMetadata.accessibleSites.M[listKey].L) {
                userMetadata.accessibleSites.M[listKey] = { L: [] };
            }

            const siteList = userMetadata.accessibleSites.M[listKey].L;

            // Check if site already exists in list
            const siteExists = siteList.some(site => 
                site && site.M && site.M.S && site.M.S.S === siteKey
            );

            if (!siteExists) {
                // Add the new site with the correct DynamoDB format
                siteList.push({
                    M: {
                        S: { S: siteKey }
                    }
                });

                // Prepare update parameters
                const updateParams = {
                    TableName: TableNames.USER_METADATA,
                    Key: { userId },
                    UpdateExpression: 'SET accessibleSites = :sites, updatedat = :updatedat',
                    ExpressionAttributeValues: {
                        ':sites': userMetadata.accessibleSites,
                        ':updatedat': new Date().toISOString()
                    },
                    ReturnValues: 'ALL_NEW'
                };

                // Add version check for optimistic concurrency control
                if (userMetadata.version !== undefined) {
                    updateParams.ConditionExpression = 'version = :version';
                    updateParams.ExpressionAttributeValues[':version'] = userMetadata.version;
                    updateParams.UpdateExpression += ', version = :newVersion';
                    updateParams.ExpressionAttributeValues[':newVersion'] = (userMetadata.version || 0) + 1;
                }


                // Update the user metadata
                const { Attributes: updatedUser } = await dynamoDB.update(updateParams);
                logger.info(`Updated ${siteType} site access for user ${userId}:`, siteKey);
                return updatedUser;
            }

            // If site already exists, return current user data
            return userMetadata;

        } catch (error) {
            if (error.name === 'ConditionalCheckFailedException' && retryCount < maxRetries - 1) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
                retryCount++;
                continue;
            }
            logger.error(`Error updating ${siteType} site access for user ${userId}:`, error);
            throw error;
        }
    }
    
    throw new Error(`Failed to update site access after ${maxRetries} attempts`);
};

/**
 * Removes site access for all users when a site is deleted
 * Processes users in batches to handle large datasets
 * @param {string|number} companyId - The company ID
 * @param {string|number} siteId - The site ID to remove access for
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<boolean>} True if successful
 * @throws {Error} If operation fails
 */
const removeSiteAccess = async (companyId, siteId, siteType) => {
    if (!companyId) throw new Error('companyId is required');
    if (!siteId) throw new Error('siteId is required');
    validateSiteType(siteType);

    try {
        const siteKey = `${companyId}_${siteId}`;
        let lastEvaluatedKey;
        let processedUsers = 0;
        let updatedUsers = 0;

        do {
            // Scan users in batches
            const scanParams = {
                TableName: TableNames.USER_METADATA,
                Limit: BATCH_SIZE
            };

            if (lastEvaluatedKey) {
                scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }

            const { Items: users, LastEvaluatedKey } = await dynamoDB.scan(scanParams);
            lastEvaluatedKey = LastEvaluatedKey;

            // Filter users who have access to this site
            const usersWithAccess = users.filter(user => {
                const siteList = getSiteList(user, siteType);
                return siteList.some(site => site.S === siteKey);
            });

            if (usersWithAccess.length > 0) {
                // Process users in parallel batches
                const updatePromises = usersWithAccess.map(user => {
                    const listKey = `${siteType}Sites`;
                    const siteList = user.accessibleSites[listKey].L;
                    const updatedSiteList = siteList.filter(site => site.S !== siteKey);

                    const updateParams = {
                        TableName: TableNames.USER_METADATA,
                        Key: { userId: user.userId },
                        UpdateExpression: 'SET accessibleSites.#listKey = :sites, updatedat = :updatedat',
                        ExpressionAttributeNames: {
                            '#listKey': listKey
                        },
                        ExpressionAttributeValues: {
                            ':sites': { L: updatedSiteList },
                            ':updatedat': new Date().toISOString()
                        }
                    };

                    // Add optimistic locking
                    if (user.version) {
                        updateParams.ConditionExpression = 'version = :version';
                        updateParams.ExpressionAttributeValues[':version'] = user.version;
                        updateParams.UpdateExpression += ', version = :newVersion';
                        updateParams.ExpressionAttributeValues[':newVersion'] = user.version + 1;
                    }

                    return dynamoDB.update(updateParams);
                });

                try {
                    await Promise.all(updatePromises);
                    updatedUsers += usersWithAccess.length;
                } catch (batchError) {
                    // If optimistic locking fails, retry those users individually
                    if (batchError.name === 'ConditionalCheckFailedException') {
                        for (const user of usersWithAccess) {
                            try {
                                await removeSiteAccess(companyId, siteId, siteType);
                                updatedUsers++;
                            } catch (retryError) {
                                logger.error(`Failed to update access for user ${user.userId}:`, retryError);
                            }
                        }
                    } else {
                        throw batchError;
                    }
                }
            }

            processedUsers += users.length;

        } while (lastEvaluatedKey);

        logger.info(`Processed ${processedUsers} users, removed ${siteType} site access for site ${siteKey} from ${updatedUsers} users`);
        return true;
    } catch (error) {
        logger.error(`Error removing ${siteType} site access for site ${companyId}_${siteId}:`, error);
        throw error;
    }
};

module.exports = {
    updateUserSiteAccess,
    removeSiteAccess,
    validateSiteType,
    getSiteList,
    initializeAccessibleSites,
    getAvailableSites,
    addExistingSiteAccess
};
