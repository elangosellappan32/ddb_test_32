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
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'companyId = :companyId',
            ExpressionAttributeValues: {
                ':companyId': companyId
            }
        }));

        if (!Items || Items.length === 0) {
            return 0;
        }

        const lastId = Math.max(...Items.map(item => Number(item.productionSiteId)));
        return lastId;
    } catch (error) {
        logger.error('[ProductionSiteDAL] Get Last ProductionSiteId Error:', error);
        throw error;
    }
};

const create = async (item) => {
    try {
        const now = new Date().toISOString();
        const lastId = await getLastProductionSiteId(item.companyId);
        const newId = lastId + 1;

        // Normalize the annualProduction field
        const annualProduction = item.annualProduction_L || item.annualProduction || 0;

        const newItem = {
            companyId: item.companyId,
            productionSiteId: newId,
            name: item.name,
            location: item.location,
            type: item.type,
            banking: new Decimal(item.banking || 0).toString(),
            capacity_MW: new Decimal(item.capacity_MW || 0).toString(),
            annualProduction_L: new Decimal(annualProduction).toString(), // Store as annualProduction_L
            htscNo: item.htscNo ? String(item.htscNo).trim() : '', // Keep as string
            injectionVoltage_KV: new Decimal(item.injectionVoltage_KV || 0).toString(),
            status: item.status,
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
        logger.error('[ProductionSiteDAL] Create Error:', error);
        throw error;
    }
};

const getItem = async (companyId, productionSiteId) => {
    try {
        // Try with both string and number types for IDs
        const keysToTry = [
            // Try with original types first
            { companyId, productionSiteId },
            // Try with string types
            { companyId: String(companyId), productionSiteId: String(productionSiteId) },
            // Try with number types if they can be converted
            isNaN(Number(companyId)) ? null : { companyId: Number(companyId), productionSiteId: Number(productionSiteId) }
        ].filter(Boolean);

        for (const keySet of keysToTry) {
            try {
                const { Item } = await docClient.send(new GetCommand({
                    TableName,
                    Key: keySet
                }));
                if (Item) return Item;
            } catch (err) {
                // Continue to next key set
                continue;
            }
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

        const updatedItem = {
            ...existing,
            name: updates.name || existing.name,
            location: updates.location || existing.location,
            type: updates.type || existing.type,
            banking: new Decimal(banking).toString(),
            capacity_MW: updates.capacity_MW ? new Decimal(updates.capacity_MW).toString() : existing.capacity_MW,
            annualProduction_L: new Decimal(annualProduction).toString(),
            htscNo: updates.htscNo ? new Decimal(updates.htscNo).toString() : existing.htscNo,
            injectionVoltage_KV: updates.injectionVoltage_KV ? 
                new Decimal(updates.injectionVoltage_KV).toString() : 
                existing.injectionVoltage_KV,
            status: updates.status || existing.status,
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

const cleanupRelatedData = async (companyId, productionSiteId) => {
    const cleanupStats = { deletedUnits: 0, deletedCharges: 0 };
    
    // Create site ID in multiple formats for compatibility
    const siteIdFormats = [
        // Original format
        `${companyId}_${productionSiteId}`,
        // String format
        `${String(companyId)}_${String(productionSiteId)}`,
        // Number format if possible
        !isNaN(Number(companyId)) && !isNaN(Number(productionSiteId)) 
            ? `${Number(companyId)}_${Number(productionSiteId)}` 
            : null
    ].filter(Boolean);
    
    try {
        // Try each site ID format until we find the one that works
        let unitItems = [];
        let chargeItems = [];
        
        for (const siteId of siteIdFormats) {
            if (unitItems.length === 0) {
                try {
                    const units = await docClient.send(new QueryCommand({
                        TableName: TableNames.PRODUCTION_UNIT,
                        KeyConditionExpression: 'pk = :pk',
                        ExpressionAttributeValues: { ':pk': siteId }
                    }));
                    unitItems = units.Items || [];
                } catch (err) {
                    // Try next format
                    continue;
                }
            }
            
            if (chargeItems.length === 0) {
                try {
                    const charges = await docClient.send(new QueryCommand({
                        TableName: TableNames.PRODUCTION_CHARGE,
                        KeyConditionExpression: 'pk = :pk',
                        ExpressionAttributeValues: { ':pk': siteId }
                    }));
                    chargeItems = charges.Items || [];
                } catch (err) {
                    // Try next format
                    continue;
                }
            }
            
            // If we found both, no need to try other formats
            if (unitItems.length > 0 || chargeItems.length > 0) {
                break;
            }
        }
        // Batch the deletions in chunks to avoid overwhelming DynamoDB
        if (unitItems.length > 0) {
            for (let i = 0; i < unitItems.length; i += 25) {
                const batch = unitItems.slice(i, i + 25);
                await Promise.all(batch.map(item => 
                    docClient.send(new DeleteCommand({
                        TableName: TableNames.PRODUCTION_UNIT,
                        Key: { pk: item.pk, sk: item.sk }
                    }))
                ));
            }
            cleanupStats.deletedUnits = unitItems.length;
        }

        if (chargeItems.length > 0) {
            for (let i = 0; i < chargeItems.length; i += 25) {
                const batch = chargeItems.slice(i, i + 25);
                await Promise.all(batch.map(item => 
                    docClient.send(new DeleteCommand({
                        TableName: TableNames.PRODUCTION_CHARGE,
                        Key: { pk: item.pk, sk: item.sk }
                    }))
                ));
            }
            cleanupStats.deletedCharges = chargeItems.length;
        }

        logger.info(`[ProductionSiteDAL] Cleanup completed for site ${siteId}:`, cleanupStats);
        return cleanupStats;
    } catch (error) {
        logger.error(`[ProductionSiteDAL] Failed to cleanup site ${siteId}:`, error);
        throw error;
    }
};

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
