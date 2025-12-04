const { 
    PutCommand,
    GetCommand,
    QueryCommand,
    ScanCommand,
    DeleteCommand
} = require('@aws-sdk/lib-dynamodb');
const Decimal = require('decimal.js');
const logger = require('../utils/logger');
const docClient = require('../utils/db');
const TableNames = require('../constants/tableNames');
const cleanupRelatedData = require('./cleanupRelatedData');

const TableName = TableNames.CONSUMPTION_SITES;

const getLastConsumptionSiteId = async (companyId) => {
    try {
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'companyId = :companyId',
            ExpressionAttributeValues: {
                ':companyId': companyId.toString()
            }
        }));

        if (!Items || Items.length === 0) return 0;
        const lastId = Math.max(...Items.map(item => Number(item.consumptionSiteId)));
        return lastId;
    } catch (error) {
        logger.error('[ConsumptionSiteDAL] GetLastId Error:', error);
        throw error;
    }
};

const createConsumptionSite = async (item) => {
    try {
        const now = new Date().toISOString();
        const lastId = await getLastConsumptionSiteId(item.companyId || '1');
        const newId = lastId + 1;

        // Ensure annualConsumption is properly formatted as a number
        let annualConsumption = 0;
        if (item.annualConsumption !== undefined && item.annualConsumption !== null) {
            // Convert to number and round to nearest integer
            annualConsumption = Math.round(Number(item.annualConsumption));
            // Ensure it's not negative
            annualConsumption = Math.max(0, annualConsumption);
        }

        const newItem = {
            companyId: String(item.companyId || '1').trim(),
            consumptionSiteId: newId.toString(),
            name: String(item.name || '').trim(),
            location: String(item.location || '').trim(),
            type: String(item.type || 'industrial').toLowerCase().trim(),
            annualConsumption: annualConsumption,
            annualConsumption_L: annualConsumption, // Legacy field for backward compatibility
            status: String(item.status || 'active').toLowerCase().trim(),
            version: 1,
            createdat: now,
            updatedat: now,
            timetolive: 0
        };

        // Create the new item
        await docClient.send(new PutCommand({
            TableName,
            Item: newItem
        }));

        // Add the siteKey to the response
        return {
            ...newItem,
            siteKey: `${newItem.companyId}_${newItem.consumptionSiteId}`
        };
    } catch (error) {
        logger.error('[ConsumptionSiteDAL] Create Error:', error);
        throw error;
    }
};

const getConsumptionSite = async (companyId, consumptionSiteId) => {
    try {
        const params = {
            TableName: TableName,
            Key: {
                companyId: companyId,
                consumptionSiteId: consumptionSiteId
            }
        };

        const result = await docClient.send(new GetCommand(params));
        
        if (!result.Item) {
            return null;
        }

        // Ensure annualConsumption is properly set from annualConsumption_L if not present
        const item = { ...result.Item };
        if (item.annualConsumption_L !== undefined && item.annualConsumption === undefined) {
            item.annualConsumption = item.annualConsumption_L;
        }
        
        // Ensure we have a valid number for annualConsumption
        if (item.annualConsumption !== undefined) {
            const numValue = Number(item.annualConsumption);
            item.annualConsumption = isNaN(numValue) ? 0 : Math.round(numValue);
        } else {
            item.annualConsumption = 0;
        }

        return item;
    } catch (error) {
        logger.error('Error getting consumption site:', { error, companyId, consumptionSiteId });
        throw error;
    }
};

const updateConsumptionSite = async (companyId, consumptionSiteId, updates) => {
    try {
        // First get the existing item
        const existing = await getConsumptionSite(companyId, consumptionSiteId);
        if (!existing) {
            const error = new Error('Consumption site not found');
            error.statusCode = 404;
            throw error;
        }

        const currentVersion = Number(existing.version) || 1;
        const newVersion = currentVersion + 1;

        // Process updates with proper type conversion
        let processedUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                switch (key) {
                    case 'annualConsumption':
                    case 'annualConsumption_L':
                    case 'contractDemand_KVA':
                    case 'drawalVoltage_KV':
                        processedUpdates[key] = Number(value) || 0;
                        break;
                    case 'type':
                    case 'status':
                        processedUpdates[key] = String(value).toLowerCase();
                        break;
                    case 'name':
                    case 'location':
                    case 'description':
                    case 'htscNo':
                        processedUpdates[key] = String(value).trim();
                        break;
                    default:
                        processedUpdates[key] = value;
                }
            }
        }

        // Construct the updated item
        const updatedItem = {
            ...existing,
            ...processedUpdates,
            version: newVersion,
            updatedat: new Date().toISOString()
        };

        // Keep annualConsumption and annualConsumption_L in sync
        if (updatedItem.annualConsumption !== undefined) {
            updatedItem.annualConsumption_L = updatedItem.annualConsumption;
        } else if (updatedItem.annualConsumption_L !== undefined) {
            updatedItem.annualConsumption = updatedItem.annualConsumption_L;
        }

        // Ensure all numeric fields are numbers
        const numericFields = ['annualConsumption', 'annualConsumption_L', 'contractDemand_KVA', 'drawalVoltage_KV'];
        for (const field of numericFields) {
            if (updatedItem[field] !== undefined) {
                updatedItem[field] = Number(updatedItem[field]) || 0;
            }
        }

        try {
            await docClient.send(new PutCommand({
                TableName,
                Item: updatedItem,
                ConditionExpression: 'version = :expectedVersion',
                ExpressionAttributeValues: {
                    ':expectedVersion': currentVersion
                }
            }));
        } catch (error) {
            if (error.name === 'ConditionalCheckFailedException') {
                const versionError = new Error('Version conflict. The record has been modified by another user.');
                versionError.code = 'VERSION_CONFLICT';
                versionError.currentVersion = currentVersion;
                versionError.status = 409;
                throw versionError;
            }
            throw error;
        }

        return updatedItem;
    } catch (error) {
        logger.error('[ConsumptionSiteDAL] Update Error:', error);
        throw error;
    }
};

const deleteConsumptionSite = async (companyId, consumptionSiteId) => {
    const timer = logger.startTimer();
    let cleanupResult = null;
    
    try {
        // 1. Check if site exists
        const existingSite = await getConsumptionSite(companyId, consumptionSiteId);
        if (!existingSite) {
            throw new Error('Consumption site not found');
        }

        // 2. Clean up related data
        try {
            cleanupResult = await cleanupRelatedData(companyId, consumptionSiteId);
            logger.info(`[ConsumptionSiteDAL] Cleaned up related data for site ${companyId}/${consumptionSiteId}`, cleanupResult);
        } catch (cleanupError) {
            logger.error(`[ConsumptionSiteDAL] Error cleaning up related data for site ${companyId}/${consumptionSiteId}:`, cleanupError);
            // Continue with deletion even if cleanup fails
        }
        
        // 3. Delete the site itself
        const { Attributes } = await docClient.send(new DeleteCommand({
            TableName,
            Key: { 
                companyId: companyId.toString(),
                consumptionSiteId: consumptionSiteId.toString()
            },
            ReturnValues: 'ALL_OLD',
            ConditionExpression: 'attribute_exists(companyId) AND attribute_exists(consumptionSiteId)'
        }));
        
        if (!Attributes) {
            throw new Error('No item found with the provided keys');
        }

        timer.end('Consumption site deletion completed');
        return {
            ...Attributes,
            relatedDataCleanup: cleanupResult
        };
    } catch (error) {
        logger.error('[ConsumptionSiteDAL] Delete Error:', {
            error,
            companyId,
            consumptionSiteId,
            cleanupResult
        });
        throw error;
    }
};

const getAllConsumptionSites = async () => {
    try {
        const { Items } = await docClient.send(new ScanCommand({
            TableName
        }));

        // Return empty array if no items found
        if (!Items) {
            logger.info('[ConsumptionSiteDAL] No items found in table');
            return [];
        }

        // Transform and validate each item
        return Items.map(item => ({
            companyId: String(item.companyId || '1'),
            consumptionSiteId: String(item.consumptionSiteId),
            name: item.name || 'Unnamed Site',
            type: (item.type || 'unknown').toLowerCase(),
            location: item.location || 'Unknown Location',
            status: (item.status || 'active').toLowerCase(),
            version: Number(item.version || 1),
            timetolive: Number(item.timetolive || 0),
            annualConsumption: Number(item.annualConsumption || 0),
            createdat: item.createdat || new Date().toISOString(),
            updatedat: item.updatedat || new Date().toISOString()
        }));
    } catch (error) {
        logger.error('[ConsumptionSiteDAL] GetAll Error:', error);
        throw error;
    }
};

const getByCompanyId = async (companyId) => {
    try {
        // Ensure companyId is converted to string for matching with stored values
        const companyIdStr = String(companyId);
        logger.info(`[ConsumptionSiteDAL] Fetching consumption sites for company: ${companyIdStr}`);
        
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'companyId = :companyId',
            ExpressionAttributeValues: {
                ':companyId': companyIdStr
            }
        }));

        if (!Items || Items.length === 0) {
            logger.info(`[ConsumptionSiteDAL] No consumption sites found for company ${companyIdStr}`);
            return [];
        }

        logger.info(`[ConsumptionSiteDAL] Found ${Items.length} consumption sites for company ${companyIdStr}`);
        return Items.map(item => ({
            companyId: String(item.companyId),
            consumptionSiteId: String(item.consumptionSiteId),
            name: item.name || 'Unnamed Site',
            location: item.location || 'Unknown Location'
        }));
    } catch (error) {
        logger.error(`[ConsumptionSiteDAL] GetByCompanyId Error for company ${companyId}:`, error);
        throw error;
    }
};

module.exports = {
    createConsumptionSite,
    getConsumptionSite,
    getAllConsumptionSites,
    updateConsumptionSite,
    deleteConsumptionSite,
    getLastConsumptionSiteId,
    getByCompanyId
};
