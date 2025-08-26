const { ScanCommand, GetCommand, UpdateCommand, QueryCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');
const { docClient } = require('../config/aws-config');

// Use the centralized DynamoDB Document Client
const ddbDocClient = docClient;

// Constants
const BATCH_SIZE = 25; // Max items per batch for DynamoDB
const MAX_RETRIES = 3;
const SITE_TYPES = ['production', 'consumption'];
const SITE_TABLES = {
    production: TableNames.PRODUCTION_SITES,
    consumption: TableNames.CONSUMPTION_SITES
};

/**
 * Validates that a site type is either 'production' or 'consumption'
 * @param {string} siteType - The site type to validate
 * @throws {Error} If site type is invalid
 */
const validateSiteType = (siteType) => {
    if (!SITE_TYPES.includes(siteType)) {
        throw new Error(`Invalid site type: ${siteType}. Must be one of: ${SITE_TYPES.join(', ')}`);
    }
};

/**
 * Initializes the accessibleSites object in user metadata if it doesn't exist
 * @param {Object} userData - The user data object
 * @returns {Object} The updated user data with initialized accessibleSites
 */
const initializeAccessibleSites = (userData) => {
    const updatedUser = { ...userData };
    
    if (!updatedUser.metadata) {
        updatedUser.metadata = {};
    }
    
    if (!updatedUser.metadata.accessibleSites) {
        updatedUser.metadata.accessibleSites = {
            productionSites: { L: [] },
            consumptionSites: { L: [] }
        };
    }
    
    return updatedUser;
};

/**
 * Updates a user's site access when a new site is created/updated
 * @param {string} username - The username of the user
 * @param {string} companyId - The company ID
 * @param {string} siteId - The site ID
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Object>} The updated user object
 */
const updateUserSiteAccess = async (username, companyId, siteId, siteType) => {
    validateSiteType(siteType);
    const siteKey = `${companyId}_${siteId}`;
    let retryCount = 0;
    
    logger.info(`[SiteAccess] Updating ${siteType} site access for user ${username}`, {
        companyId,
        siteId,
        siteKey,
        retryCount: 0
    });

    while (retryCount < MAX_RETRIES) {
        let userData;
        try {
            // Get current user data with consistent read
            const result = await docClient.send(new GetCommand({
                TableName: TableNames.USERS,
                Key: { username },
                ConsistentRead: true
            }));
            userData = result.Item;

            if (!userData) {
                throw new Error(`User not found: ${username}`);
            }

            // Initialize metadata if it doesn't exist
            if (!userData.metadata) {
                userData.metadata = {};
            }
            if (!userData.metadata.accessibleSites) {
                userData.metadata.accessibleSites = {
                    productionSites: { L: [] },
                    consumptionSites: { L: [] }
                };
            }

            const listKey = `${siteType}Sites`;
            
            // Ensure the site list exists and is in the correct format
            if (!userData.metadata.accessibleSites[listKey] || !Array.isArray(userData.metadata.accessibleSites[listKey].L)) {
                userData.metadata.accessibleSites[listKey] = { L: [] };
            }

            const siteList = userData.metadata.accessibleSites[listKey].L;
            
            // Check if site already exists in the list
            const siteExists = siteList.some(site => site.S === siteKey);
            
            if (siteExists) {
                logger.info(`[SiteAccess] Site ${siteKey} already exists in ${username}'s ${siteType} sites`);
                return userData;
            }
            
            // Add the new site to the list
            siteList.push({ S: siteKey });
            
            // Update timestamps and version
            const currentVersion = userData.metadata.version || 0;
            const newVersion = currentVersion + 1;
            
            const updateParams = {
                TableName: TableNames.USERS,
                Key: { username },
                UpdateExpression: 'SET #metadata = :metadata, #updatedAt = :updatedAt',
                ConditionExpression: 'attribute_not_exists(version) OR #metadata.#version = :currentVersion',
                ExpressionAttributeNames: {
                    '#metadata': 'metadata',
                    '#updatedAt': 'updatedAt',
                    '#version': 'version'
                },
                ExpressionAttributeValues: {
                    ':metadata': {
                        ...userData.metadata,
                        version: newVersion,
                        updatedAt: new Date().toISOString()
                    },
                    ':updatedAt': new Date().toISOString(),
                    ':currentVersion': currentVersion
                },
                ReturnValues: 'ALL_NEW'
            };
            
            // Execute the update
            const { Attributes } = await docClient.send(new UpdateCommand(updateParams));
            
            logger.info(`[SiteAccess] Successfully updated ${siteType} site access for user ${username}`, {
                siteKey,
                version: newVersion,
                updatedSites: Attributes?.metadata?.accessibleSites?.[listKey]?.L?.length || 0
            });
            
            return Attributes || userData;
            
        } catch (error) {
            if ((error.name === 'ConditionalCheckFailedException' || error.name === 'TransactionCanceledException') && 
                retryCount < MAX_RETRIES - 1) {
                // Exponential backoff with jitter
                const baseDelay = 100 * Math.pow(2, retryCount);
                const jitter = Math.random() * 100; // Add up to 100ms of jitter
                const delay = Math.min(baseDelay + jitter, 5000); // Cap at 5 seconds
                
                logger.warn(`[SiteAccess] Version conflict for user ${username}, retry ${retryCount + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms...`, {
                    error: error.message,
                    currentVersion: userData?.metadata?.version,
                    siteKey
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
            }
            
            logger.error(`[SiteAccess] Error updating site access for user ${username} after ${retryCount} retries:`, {
                error: error.message,
                stack: error.stack,
                siteKey,
                currentVersion: userData?.metadata?.version,
                userData: userData ? 'exists' : 'not found'
            });
            
            // If we've exhausted retries, try one last time without the version check
            if (retryCount >= MAX_RETRIES - 1) {
                logger.warn(`[SiteAccess] Last resort: forcing update for user ${username} without version check`);
                try {
                    const updateParams = {
                        TableName: TableNames.USERS,
                        Key: { username },
                        UpdateExpression: 'SET #metadata = :metadata, #updatedAt = :updatedAt',
                        ExpressionAttributeNames: {
                            '#metadata': 'metadata',
                            '#updatedAt': 'updatedAt'
                        },
                        ExpressionAttributeValues: {
                            ':metadata': {
                                ...(userData?.metadata || {}),
                                accessibleSites: {
                                    ...(userData?.metadata?.accessibleSites || {
                                        productionSites: { L: [] },
                                        consumptionSites: { L: [] }
                                    }),
                                    [siteType + 'Sites']: {
                                        L: [
                                            ...(userData?.metadata?.accessibleSites?.[siteType + 'Sites']?.L || []),
                                            { S: siteKey }
                                        ]
                                    }
                                },
                                version: (userData?.metadata?.version || 0) + 1,
                                updatedAt: new Date().toISOString()
                            },
                            ':updatedAt': new Date().toISOString()
                        },
                        ReturnValues: 'ALL_NEW'
                    };
                    
                    const { Attributes } = await docClient.send(new UpdateCommand(updateParams));
                    logger.warn(`[SiteAccess] Successfully forced update for user ${username}`);
                    return Attributes || userData;
                } catch (forceError) {
                    logger.error(`[SiteAccess] Failed to force update for user ${username}:`, forceError);
                    throw new Error(`Failed to update user site access after ${MAX_RETRIES} retries and force attempt: ${forceError.message}`);
                }
            }
            
            throw error;
        }
    }
    
    throw new Error(`[SiteAccess] Failed to update site access for user ${username} after ${MAX_RETRIES} attempts`);
};

/**
 * Adds access to existing sites for a user
 * @param {string} username - The username of the user
 * @param {Array<string>} siteIds - Array of site IDs to add access to
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Object>} The updated user object
 */
const addExistingSiteAccess = async (username, siteIds, siteType) => {
    validateSiteType(siteType);
    
    if (!Array.isArray(siteIds)) {
        throw new Error('siteIds must be an array');
    }
    
    logger.info(`[SiteAccess] Adding ${siteType} site access for user ${username}`, {
        siteIds,
        siteType
    });
    
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
        try {
            // Get current user data
            const { Item: userData } = await docClient.send(new GetCommand({
                TableName: TableNames.USERS,
                Key: { username },
                ConsistentRead: true
            }));
            
            if (!userData) {
                throw new Error(`User not found: ${username}`);
            }
            
            // Initialize user data with accessibleSites if needed
            const updatedUser = initializeAccessibleSites(userData);
            const listKey = `${siteType}Sites`;
            
            // Ensure the site list exists and is in the correct format
            if (!updatedUser.metadata.accessibleSites[listKey] || !Array.isArray(updatedUser.metadata.accessibleSites[listKey].L)) {
                updatedUser.metadata.accessibleSites[listKey] = { L: [] };
            }
            
            const currentSites = new Set(updatedUser.metadata.accessibleSites[listKey].L.map(site => site.S));
            let hasChanges = false;
            
            // Add new sites that don't already exist
            siteIds.forEach(siteId => {
                if (!currentSites.has(siteId)) {
                    updatedUser.metadata.accessibleSites[listKey].L.push({ S: siteId });
                    hasChanges = true;
                }
            });
            
            if (!hasChanges) {
                logger.info(`[SiteAccess] No new sites to add for user ${username}`);
                return userData;
            }
            
            // Update timestamps
            updatedUser.metadata.updatedAt = new Date().toISOString();
            if (updatedUser.metadata.version !== undefined) {
                updatedUser.metadata.version += 1;
            } else {
                updatedUser.metadata.version = 1;
            }
            
            // Prepare update parameters
            const updateParams = {
                TableName: TableNames.USERS,
                Key: { username },
                UpdateExpression: 'SET #metadata = :metadata, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#metadata': 'metadata',
                    '#updatedAt': 'updatedAt'
                },
                ExpressionAttributeValues: {
                    ':metadata': updatedUser.metadata,
                    ':updatedAt': updatedUser.metadata.updatedAt
                },
                ReturnValues: 'ALL_NEW'
            };
            
            // Add version check for optimistic concurrency control
            if (userData.metadata?.version !== undefined) {
                updateParams.ConditionExpression = '#metadata.#version = :version';
                updateParams.ExpressionAttributeNames['#version'] = 'version';
                updateParams.ExpressionAttributeValues[':version'] = userData.metadata.version;
            }
            
            // Execute the update
            const { Attributes } = await dynamoDB.update(updateParams);
            logger.info(`[SiteAccess] Successfully added ${siteType} site access for user ${username}`, {
                siteIds,
                updatedSites: Attributes?.metadata?.accessibleSites?.[listKey]?.L?.length || 0
            });
            
            return Attributes;
            
        } catch (error) {
            if (error.name === 'ConditionalCheckFailedException' && retryCount < MAX_RETRIES - 1) {
                // Exponential backoff
                const delay = 100 * Math.pow(2, retryCount);
                logger.warn(`[SiteAccess] Version conflict for user ${username}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
            }
            
            logger.error(`[SiteAccess] Error adding site access for user ${username}:`, error);
            throw error;
        }
    }
    
    throw new Error(`[SiteAccess] Failed to add site access for user ${username} after ${MAX_RETRIES} attempts`);
};

/**
 * Removes site access for all users when a site is deleted
 * @param {string} companyId - The company ID
 * @param {string} siteId - The site ID to remove access for
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<boolean>} True if successful
 */
const removeSiteAccess = async (companyId, siteId, siteType) => {
    validateSiteType(siteType);
    const siteKey = `${companyId}_${siteId}`;
    const startTime = Date.now();
    
    logger.info(`[SiteAccess] Starting removal of ${siteType} site access for site: ${siteKey}`, {
        companyId,
        siteId,
        siteType,
        timestamp: new Date().toISOString()
    });
    
    try {
        // 1. First, find all users who have access to this site
        logger.debug(`[SiteAccess] Scanning for users with access to ${siteType} site: ${siteKey}`);
        
        const scanParams = {
            TableName: TableNames.USERS,
            FilterExpression: 'contains(metadata.accessibleSites.#siteTypeSites, :siteKey)',
            ExpressionAttributeNames: {
                '#siteTypeSites': `${siteType}Sites`,
                '#type': 'type' // In case 'type' is a reserved word
            },
            ExpressionAttributeValues: marshall({
                ':siteKey': siteKey
            }),
            ProjectionExpression: 'username, metadata, #type'
        };
        
        let users = [];
        let lastEvaluatedKey = null;
        let scanCount = 0;
        
        // Handle pagination in case there are many users
        do {
            if (lastEvaluatedKey) {
                scanParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const scanResult = await ddbDocClient.send(new ScanCommand(scanParams));
            users = users.concat(scanResult.Items || []);
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
            scanCount++;
            
            logger.debug(`[SiteAccess] Scan batch ${scanCount} completed, found ${scanResult.Items?.length || 0} users`);
            
        } while (lastEvaluatedKey);
        
        if (users.length === 0) {
            logger.info(`[SiteAccess] No users found with access to ${siteType} site ${siteKey}`);
            return true;
        }
        
        logger.info(`[SiteAccess] Found ${users.length} users with access to ${siteType} site ${siteKey}`);
        
        // 2. Process users in batches to avoid throttling
        const BATCH_SIZE = 25; // Process 25 users in parallel
        const BATCH_DELAY_MS = 100; // 100ms delay between batches
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const batchPromises = [];
            
            logger.debug(`[SiteAccess] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(users.length / BATCH_SIZE)}`);
            
            for (const user of batch) {
                batchPromises.push(
                    removeSiteAccessForUser(user, siteKey, siteType)
                        .then(() => successCount++)
                        .catch(error => {
                            errorCount++;
                            logger.error(`[SiteAccess] Error removing site access for user ${user.username}:`, error);
                        })
                );
            }
            
            // Wait for all promises in the batch to complete
            await Promise.all(batchPromises);
            
            // Add a small delay between batches to avoid throttling
            if (i + BATCH_SIZE < users.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
        
        const duration = Date.now() - startTime;
        logger.info(`[SiteAccess] Completed removal of ${siteType} site access for site ${siteKey}`, {
            totalUsers: users.length,
            successCount,
            errorCount,
            durationMs: duration,
            timestamp: new Date().toISOString()
        });
        
        return true;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`[SiteAccess] Failed to remove ${siteType} site access for site ${siteKey} after ${duration}ms`, {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
};

/**
 * Helper function to remove site access for a single user
 * @param {Object} user - The user object from DynamoDB
 * @param {string} siteKey - The site key in format 'companyId_siteId'
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<void>}
 */
async function removeSiteAccessForUser(user, siteKey, siteType) {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
        try {
            // Get the latest user data with a consistent read
            const { Item: userData } = await dynamoDB.get({
                TableName: TableNames.USERS,
                Key: { username: user.username },
                ConsistentRead: true
            });
            
            if (!userData) {
                logger.warn(`[SiteAccess] User not found: ${user.username}`);
                return;
            }
            
            // Initialize user data with accessibleSites if needed
            const updatedUser = initializeAccessibleSites(userData);
            const listKey = `${siteType}Sites`;
            
            // Ensure the site list exists and is in the correct format
            if (!updatedUser.metadata.accessibleSites[listKey] || !Array.isArray(updatedUser.metadata.accessibleSites[listKey].L)) {
                updatedUser.metadata.accessibleSites[listKey] = { L: [] };
            }
            
            const siteList = updatedUser.metadata.accessibleSites[listKey].L;
            const siteIndex = siteList.findIndex(site => site.S === siteKey);
            
            if (siteIndex === -1) {
                logger.debug(`[SiteAccess] Site ${siteKey} not found in user ${user.username}'s ${siteType} sites`);
                return;
            }
            
            // Remove the site from the list
            siteList.splice(siteIndex, 1);
            
            // Update timestamps and version
            const now = new Date().toISOString();
            updatedUser.metadata.updatedAt = now;
            updatedUser.updatedAt = now;
            
            if (updatedUser.metadata.version !== undefined) {
                updatedUser.metadata.version += 1;
            } else {
                updatedUser.metadata.version = 1;
            }
            
            // Prepare update parameters
            const updateParams = {
                TableName: TableNames.USERS,
                Key: { username: user.username },
                UpdateExpression: 'SET #metadata = :metadata, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#metadata': 'metadata',
                    '#updatedAt': 'updatedAt'
                },
                ExpressionAttributeValues: marshall({
                    ':metadata': updatedUser.metadata,
                    ':updatedAt': now
                }),
                ReturnValues: 'NONE',
                ConditionExpression: '#metadata.#version = :version',
                ExpressionAttributeNames: {
                    ...(userData.metadata?.version !== undefined && { '#version': 'version' })
                },
                ExpressionAttributeValues: {
                    ...(userData.metadata?.version !== undefined && { ':version': userData.metadata.version })
                }
            };
            
            // Execute the update
            await dynamoDB.update(updateParams);
            
            logger.debug(`[SiteAccess] Successfully removed ${siteType} site access for user ${user.username}`, {
                siteKey,
                remainingSites: siteList.length
            });
            
            return; // Success, exit retry loop
            
        } catch (error) {
            if (error.name === 'ConditionalCheckFailedException' && retryCount < MAX_RETRIES - 1) {
                // Exponential backoff with jitter
                const baseDelay = 100; // 100ms
                const maxJitter = 50; // 50ms
                const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * maxJitter;
                
                logger.warn(`[SiteAccess] Version conflict for user ${user.username}, retry ${retryCount + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
            }
            
            // For other errors or if we've exceeded max retries, log and rethrow
            logger.error(`[SiteAccess] Failed to remove site access for user ${user.username} after ${retryCount + 1} attempts`, {
                error: error.message,
                stack: error.stack,
                siteKey,
                siteType
            });
            
            throw error;
        }
    }
}

/**
 * Gets the list of sites a user has access to
 * @param {string} username - The username of the user
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Array<string>>} Array of site IDs the user has access to
 */
const getUserSites = async (username, siteType) => {
    validateSiteType(siteType);
    
    try {
        const { Item: userData } = await dynamoDB.get({
            TableName: TableNames.USERS,
            Key: { username },
            ProjectionExpression: 'metadata.accessibleSites'
        });
        
        if (!userData || !userData.metadata?.accessibleSites?.[`${siteType}Sites`]?.L) {
            return [];
        }
        
        return userData.metadata.accessibleSites[`${siteType}Sites`].L.map(site => site.S);
        
    } catch (error) {
        logger.error(`[SiteAccess] Error getting ${siteType} sites for user ${username}:`, error);
        throw error;
    }
};

/**
 * Gets all accessible sites for the current user
 * @param {string} username - The username of the current user
 * @param {string} userRole - The role of the current user
 * @returns {Promise<Object>} Object containing accessible production and consumption sites
 */
const getAccessibleSitesForUser = async (username, userRole) => {
    try {
        logger.info(`[SiteAccessService] Getting accessible sites for user: ${username}, role: ${userRole}`);
        
        // If user is admin, return all sites
        if (userRole === 'admin') {
            logger.debug('[SiteAccessService] User is admin, returning all sites');
            
            const [productionSites, consumptionSites] = await Promise.all([
                this.getAllSites('production'),
                this.getAllSites('consumption')
            ]);
            
            return {
                productionSites: productionSites || [],
                consumptionSites: consumptionSites || []
            };
        }
        
        // For non-admin users, get their accessible sites from user metadata
        const userParams = {
            TableName: TableNames.USERS,
            Key: { username }
        };
        
        const { Item: user } = await ddbDocClient.send(new GetCommand(userParams));
        
        if (!user) {
            logger.warn(`[SiteAccessService] User not found: ${username}`);
            return { productionSites: [], consumptionSites: [] };
        }
        
        // Initialize accessibleSites if it doesn't exist
        const accessibleSites = user.metadata?.accessibleSites || {
            productionSites: { L: [] },
            consumptionSites: { L: [] }
        };
        
        // Process production sites
        const productionSiteKeys = (accessibleSites.productionSites?.L || []).map(item => {
            const [companyId, siteId] = item.S.split('_');
            return { companyId, siteId };
        });
        
        // Process consumption sites
        const consumptionSiteKeys = (accessibleSites.consumptionSites?.L || []).map(item => {
            const [companyId, siteId] = item.S.split('_');
            return { companyId, siteId };
        });
        
        // Fetch site details in parallel
        const [productionSites, consumptionSites] = await Promise.all([
            this.getSitesBatch('production', productionSiteKeys),
            this.getSitesBatch('consumption', consumptionSiteKeys)
        ]);
        
        return {
            productionSites: productionSites || [],
            consumptionSites: consumptionSites || []
        };
        
    } catch (error) {
        logger.error(`[SiteAccessService] Error getting accessible sites: ${error.message}`, error);
        throw error;
    }
};

/**
 * Gets all sites of a specific type (admin only)
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @returns {Promise<Array>} Array of all sites of the specified type
 */
const getAllSites = async (siteType) => {
    validateSiteType(siteType);
    
    try {
        const params = {
            TableName: SITE_TABLES[siteType],
            ProjectionExpression: 'companyId, siteId, siteName, address, #status',
            ExpressionAttributeNames: {
                '#status': 'status'
            }
        };
        
        const { Items } = await ddbDocClient.send(new ScanCommand(params));
        return Items || [];
        
    } catch (error) {
        logger.error(`[SiteAccessService] Error getting all ${siteType} sites: ${error.message}`, error);
        throw error;
    }
};

/**
 * Gets multiple sites in a batch
 * @param {string} siteType - The type of site ('production' or 'consumption')
 * @param {Array} siteKeys - Array of { companyId, siteId } objects
 * @returns {Promise<Array>} Array of site details
 */
const getSitesBatch = async (siteType, siteKeys) => {
    if (!siteKeys.length) return [];
    
    try {
        const tableName = SITE_TABLES[siteType];
        const keys = siteKeys.map(({ companyId, siteId }) => ({
            companyId,
            siteId
        }));
        
        const params = {
            RequestItems: {
                [tableName]: {
                    Keys: keys,
                    ProjectionExpression: 'companyId, siteId, siteName, address, #status',
                    ExpressionAttributeNames: {
                        '#status': 'status'
                    }
                }
            }
        };
        
        const { Responses } = await ddbDocClient.send(new BatchGetCommand(params));
        return Responses?.[tableName] || [];
        
    } catch (error) {
        logger.error(`[SiteAccessService] Error getting ${siteType} sites batch: ${error.message}`, error);
        throw error;
    }
};

module.exports = {
    updateUserSiteAccess,
    addExistingSiteAccess,
    removeSiteAccess,
    removeSiteAccessForUser,
    getUserSites,
    getAccessibleSitesForUser,
    getAllSites,
    getSitesBatch
};
