const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    PutCommand,
    GetCommand,
    QueryCommand,
    ScanCommand,
    UpdateCommand,
    DeleteCommand
} = require('@aws-sdk/lib-dynamodb');
const Decimal = require('decimal.js');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');

const docClient = require('../utils/db');
const TableName = TableNames.PRODUCTION_SITES;

const getLastProductionSiteId = async (companyId) => {
    try {
        // First, try to get the highest existing ID
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'companyId = :companyId',
            ExpressionAttributeValues: {
                ':companyId': companyId
            },
            // Sort in descending order by productionSiteId to get the highest ID first
            ScanIndexForward: false,
            Limit: 1
        }));

        if (!Items || Items.length === 0) {
            return 0;
        }

        // Get the highest ID
        const lastId = Items[0]?.productionSiteId;
        if (!lastId && lastId !== 0) {
            logger.warn(`[ProductionSiteDAL] Invalid productionSiteId found: ${lastId} for company ${companyId}`);
            return 0;
        }

        const numericId = Number(lastId);
        if (isNaN(numericId)) {
            logger.error(`[ProductionSiteDAL] Non-numeric productionSiteId found: ${lastId} for company ${companyId}`);
            throw new Error('Invalid production site ID format');
        }

        logger.debug(`[ProductionSiteDAL] Last production site ID for company ${companyId}: ${numericId}`);
        return numericId;
    } catch (error) {
        logger.error('[ProductionSiteDAL] Get Last ProductionSiteId Error:', error);
        throw error;
    }
};

const create = async (item) => {
    let retryCount = 0;
    const maxRetries = 3;
    let lastError;
    
    while (retryCount < maxRetries) {
        try {
            const now = new Date().toISOString();
            const lastId = await getLastProductionSiteId(item.companyId);
            const newId = lastId + 1;
            
            // Log the ID generation for debugging
            logger.debug(`[ProductionSiteDAL] Generating new production site ID. Last ID: ${lastId}, New ID: ${newId} for company ${item.companyId}`);
            
            // Add a small delay to help prevent race conditions
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            }
            
            // Normalize the annualProduction field
            const annualProduction = item.annualProduction_L || item.annualProduction || 0;

            // Parse and validate dateOfCommission
            let dateOfCommission = null;
            if (item.dateOfCommission) {
                try {
                    // Handle both string and Date objects
                    const date = item.dateOfCommission instanceof Date 
                        ? item.dateOfCommission 
                        : new Date(item.dateOfCommission);
                        
                    if (!isNaN(date.getTime())) {
                        // Store as ISO string in UTC
                        dateOfCommission = date.toISOString();
                    } else {
                        logger.warn(`[ProductionSiteDAL] Invalid dateOfCommission provided: ${item.dateOfCommission}`);
                    }
                } catch (error) {
                    logger.error(`[ProductionSiteDAL] Error parsing dateOfCommission: ${error.message}`);
                }
            }

            const newItem = {
                companyId: item.companyId,
                productionSiteId: newId,
                name: item.name,
                location: item.location,
                type: item.type,
                banking: new Decimal(item.banking || 0).toString(),
                capacity_MW: new Decimal(item.capacity_MW || 0).toString(),
                annualProduction_L: new Decimal(annualProduction).toString(),
                revenuePerUnit: new Decimal(item.revenuePerUnit || 0).toString(),
                htscNo: item.htscNo ? String(item.htscNo).trim() : '',
                injectionVoltage_KV: new Decimal(item.injectionVoltage_KV || 0).toString(),
                status: item.status,
                dateOfCommission: dateOfCommission,
                version: 1,
                createdat: now,
                updatedat: now,
                timetolive: 0
            };

            await docClient.send(new PutCommand({
                TableName,
                Item: newItem,
                ConditionExpression: 'attribute_not_exists(companyId) AND attribute_not_exists(productionSiteId)'
            }));

            // Add the siteKey to the response
            return {
                ...newItem,
                siteKey: `${newItem.companyId}_${newItem.productionSiteId}`
            };
        } catch (error) {
            lastError = error;
            if (error.name === 'ConditionalCheckFailedException' && retryCount < maxRetries - 1) {
                // Another process might have created a record with the same ID, retry
                retryCount++;
                logger.warn(`[ProductionSiteDAL] Race condition detected, retry ${retryCount}/${maxRetries}`);
                continue;
            }
            throw error;
        }
    }
    
    // If we've exhausted all retries, throw the last error
    logger.error(`[ProductionSiteDAL] Failed to create production site after ${maxRetries} attempts`);
    throw lastError || new Error('Failed to create production site');


};

const getItem = async (companyId, productionSiteId) => {
    try {
        // Normalize inputs: trim strings and keep original as fallback
        const companyIdStr = companyId !== undefined && companyId !== null ? String(companyId).trim() : companyId;
        const productionSiteIdStr = productionSiteId !== undefined && productionSiteId !== null ? String(productionSiteId).trim() : productionSiteId;

        // Build candidate key formats to try for Get calls
        const keysToTry = [];

        // Prefer string keys (most common in this codebase after normalization)
        keysToTry.push({ companyId: companyIdStr, productionSiteId: productionSiteIdStr });

        // If numeric values are possible, try number typed keys as well
        const companyIdNum = Number(companyIdStr);
        const productionSiteIdNum = Number(productionSiteIdStr);
        if (!isNaN(companyIdNum) && !isNaN(productionSiteIdNum)) {
            keysToTry.push({ companyId: companyIdNum, productionSiteId: productionSiteIdNum });
        }

        // Also try the raw originals as a last resort
        keysToTry.push({ companyId, productionSiteId });

        logger.debug('[ProductionSiteDAL] getItem trying key formats', { keys: keysToTry });

        for (const keySet of keysToTry) {
            try {
                const { Item } = await docClient.send(new GetCommand({
                    TableName,
                    Key: keySet
                }));
                if (Item) return Item;
            } catch (err) {
                logger.debug('[ProductionSiteDAL] getItem GetCommand failed for key set', { keySet, err: err?.message });
                // Continue to next key set
                continue;
            }
        }

        // As a fallback, try a Scan for items that match companyId and productionSiteId string value.
        // This is slower but helps in environments where key types/formatting differ.
        try {
            logger.debug('[ProductionSiteDAL] getItem falling back to Scan to locate site by productionSiteId');
            const productionIdToMatch = productionSiteIdStr || productionSiteId;
            const companyIdToMatch = companyIdStr || companyId;

            const filterExpressionParts = [];
            const expressionAttributeValues = {};

            if (companyIdToMatch !== undefined && companyIdToMatch !== null) {
                filterExpressionParts.push('companyId = :companyId');
                expressionAttributeValues[':companyId'] = companyIdToMatch;
            }
            if (productionIdToMatch !== undefined && productionIdToMatch !== null) {
                filterExpressionParts.push('productionSiteId = :productionSiteId');
                expressionAttributeValues[':productionSiteId'] = productionIdToMatch;
            }

            if (filterExpressionParts.length > 0) {
                const FilterExpression = filterExpressionParts.join(' AND ');
                const { Items } = await docClient.send(new ScanCommand({
                    TableName,
                    FilterExpression,
                    ExpressionAttributeValues: expressionAttributeValues,
                    Limit: 1
                }));
                if (Items && Items.length) return Items[0];
            }
        } catch (scanErr) {
            logger.debug('[ProductionSiteDAL] getItem Scan fallback failed', { err: scanErr?.message });
        }

        return null; // No item found with any key combination
    } catch (error) {
        logger.error('[ProductionSiteDAL] Get Item Error:', error);
        throw error;
    }
};

const updateItem = async (companyId, productionSiteId, updates) => {
    try {
        // Ensure consistent type conversion (to number) as stored in the database
        const companyIdNum = Number(companyId);
        const productionSiteIdNum = Number(productionSiteId);
        
        if (isNaN(companyIdNum) || isNaN(productionSiteIdNum)) {
            throw new Error('Invalid companyId or productionSiteId');
        }

        const existing = await getItem(companyIdNum, productionSiteIdNum);
        
        if (!existing) {
            throw new Error('Item not found');
        }

        if (existing.version !== updates.version) {
            throw new Error('Version mismatch');
        }

        // Handle annualProduction field consistently
        let annualProduction;
        if (updates.annualProduction_L !== undefined) {
            annualProduction = updates.annualProduction_L;
        } else if (updates.annualProduction !== undefined) {
            annualProduction = updates.annualProduction;
        } else {
            annualProduction = existing.annualProduction_L;
        }

        // Force banking to 0 if status is Inactive or Maintenance
        const banking = (updates.status === 'Inactive' || updates.status === 'Maintenance') ? 0 : 
                       (updates.banking !== undefined ? updates.banking : existing.banking);

        // Parse and validate dateOfCommission
        let dateOfCommission = existing.dateOfCommission;
        if ('dateOfCommission' in updates) {
            try {
                if (updates.dateOfCommission) {
                    // Handle both string and Date objects
                    const date = updates.dateOfCommission instanceof Date 
                        ? updates.dateOfCommission 
                        : new Date(updates.dateOfCommission);
                        
                    if (!isNaN(date.getTime())) {
                        // Store as ISO string in UTC
                        dateOfCommission = date.toISOString();
                    } else {
                        logger.warn(`[ProductionSiteDAL] Invalid dateOfCommission provided in update: ${updates.dateOfCommission}`);
                        // Keep the existing date if the new one is invalid
                        dateOfCommission = existing.dateOfCommission;
                    }
                } else {
                    // If dateOfCommission is explicitly set to null/empty
                    dateOfCommission = null;
                }
            } catch (error) {
                logger.error(`[ProductionSiteDAL] Error parsing dateOfCommission in update: ${error.message}`);
                // Keep the existing date on error
                dateOfCommission = existing.dateOfCommission;
            }
        }

        const updatedItem = {
            ...existing,
            name: updates.name || existing.name,
            location: updates.location || existing.location,
            type: updates.type || existing.type,
            banking: new Decimal(banking).toString(),
            capacity_MW: updates.capacity_MW ? new Decimal(updates.capacity_MW).toString() : existing.capacity_MW,
            annualProduction_L: new Decimal(annualProduction).toString(),
            revenuePerUnit: updates.revenuePerUnit !== undefined ? new Decimal(updates.revenuePerUnit).toString() : (existing.revenuePerUnit || '0'),
            htscNo: updates.htscNo ? String(updates.htscNo).trim() : existing.htscNo,
            injectionVoltage_KV: updates.injectionVoltage_KV ? 
                new Decimal(updates.injectionVoltage_KV).toString() : 
                existing.injectionVoltage_KV,
            status: updates.status || existing.status,
            dateOfCommission: dateOfCommission,
            version: existing.version + 1,
            updatedat: new Date().toISOString()
        };

        await docClient.send(new PutCommand({
            TableName,
            Item: updatedItem,
            ConditionExpression: 'version = :expectedVersion',
            ExpressionAttributeValues: {
                ':expectedVersion': updates.version
            }
        }));

        return updatedItem;
    } catch (error) {
        logger.error('[ProductionSiteDAL] Update Error:', error);
        throw error;
    }
};

const cleanupRelatedData = require('./cleanupRelatedData');

const deleteItem = async (companyId, productionSiteId) => {
    const timer = logger.startTimer();
    let cleanupResult = null;
    
    try {
        // Ensure IDs are strings for consistent comparison
        const companyIdStr = String(companyId);
        const productionSiteIdStr = String(productionSiteId);
        
        logger.info(`[ProductionSiteDAL] Starting deletion for site ${companyIdStr}/${productionSiteIdStr}`);
        
        // 1. Check if site exists
        const existingSite = await getItem(companyIdStr, productionSiteIdStr);
        if (!existingSite) {
            throw new Error(`Production site not found: ${companyIdStr}/${productionSiteIdStr}`);
        }

        // 2. Clean up related data
        try {
            cleanupResult = await cleanupRelatedData(companyIdStr, productionSiteIdStr);
            logger.info(`[ProductionSiteDAL] Cleanup completed for site ${companyIdStr}/${productionSiteIdStr}`, cleanupResult);
        } catch (cleanupError) {
            logger.error(`[ProductionSiteDAL] Error during cleanup for site ${companyIdStr}/${productionSiteIdStr}:`, cleanupError);
            // Continue with deletion even if cleanup fails
        }
        
        // 3. Delete the site itself - try multiple key formats
        let deletedItem = null;
        const keysToTry = [
            // Try with string types first (most common)
            { companyId: companyIdStr, productionSiteId: productionSiteIdStr },
            // Try with number types if they can be converted
            !isNaN(Number(companyIdStr)) && !isNaN(Number(productionSiteIdStr)) 
                ? { 
                    companyId: Number(companyIdStr), 
                    productionSiteId: Number(productionSiteIdStr) 
                  } 
                : null,
            // Try with original types as fallback
            { companyId, productionSiteId }
        ].filter(Boolean);

        logger.debug(`[ProductionSiteDAL] Trying key formats for deletion:`, keysToTry);
        
        for (const keySet of keysToTry) {
            try {
                logger.debug(`[ProductionSiteDAL] Trying delete with key set:`, keySet);
                const { Attributes } = await docClient.send(new DeleteCommand({
                    TableName,
                    Key: keySet,
                    ReturnValues: 'ALL_OLD',
                    ConditionExpression: 'attribute_exists(companyId) AND attribute_exists(productionSiteId)'
                }));
                
                if (Attributes) {
                    deletedItem = Attributes;
                    logger.info(`[ProductionSiteDAL] Successfully deleted item with keys:`, keySet);
                    break;
                }
            } catch (err) {
                logger.debug(`[ProductionSiteDAL] Delete attempt failed with key set ${JSON.stringify(keySet)}:`, err.message);
                // Continue to next key set
                continue;
            }
        }

        if (!deletedItem) {
            throw new Error(`Failed to delete production site - no matching item found for ${companyIdStr}/${productionSiteIdStr}`);
        }

        timer.end('Production site deletion completed');
        
        return {
            ...deletedItem,
            relatedDataCleanup: cleanupResult || { deletedUnits: 0, deletedCharges: 0 }
        };
        
    } catch (error) {
        const errorMessage = `[ProductionSiteDAL] Delete Error for site ${companyId}/${productionSiteId}: ${error.message}`;
        logger.error(errorMessage, {
            error,
            companyId,
            productionSiteId,
            cleanupResult,
            stack: error.stack
        });
        
        // Re-throw with more context
        error.message = `Failed to delete production site: ${error.message}`;
        throw error;
    }
};

const getAllItems = async () => {
    try {
        const { Items } = await docClient.send(new ScanCommand({
            TableName
        }));
        return Items || [];
    } catch (error) {
        logger.error('[ProductionSiteDAL] GetAll Error:', error);
        throw error;
    }
};

const getAllProductionSites = async () => {
    try {
        logger.info('[ProductionSiteDAL] Fetching all production sites...');
        
        const { Items } = await docClient.send(new ScanCommand({
            TableName
        }));

        // Return empty array if no items found
        if (!Items) {
            logger.info('[ProductionSiteDAL] No items found in table');
            return [];
        }

        logger.info(`[ProductionSiteDAL] Found ${Items.length} production sites`);

        // Transform and validate each item
        return Items.map(item => ({
            companyId: String(item.companyId || '1'),
            productionSiteId: String(item.productionSiteId),
            name: item.name || 'Unnamed Site',
            type: (item.type || 'unknown').toLowerCase(),
            location: item.location || 'Unknown Location',
            status: (item.status || 'active').toLowerCase(),
            version: Number(item.version || 1),
            capacity_MW: item.capacity_MW || '0',
            annualProduction_L: item.annualProduction_L || '0',
            htscNo: item.htscNo || '0',
            injectionVoltage_KV: item.injectionVoltage_KV || '0',
            banking: String(item.banking || '0'),
            revenuePerUnit: item.revenuePerUnit || '0',
            dateOfCommission: item.dateOfCommission || null,
            createdat: item.createdat || new Date().toISOString(),
            updatedat: item.updatedat || new Date().toISOString()
        }));
    } catch (error) {
        logger.error('[ProductionSiteDAL] GetAll Error:', error);
        throw error;
    }
};

module.exports = {
    create,
    getItem,
    updateItem,
    deleteItem,
    getAllProductionSites,
    getLastProductionSiteId
};
