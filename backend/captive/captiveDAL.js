const { 
    GetCommand, 
    QueryCommand, 
    ScanCommand, 
    PutCommand,
    UpdateCommand,
    DeleteCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');

const TableName = TableNames.CAPTIVE;
// Get all captive entries
const getAllCaptives = async () => {
    try {
        const { Items } = await docClient.send(new ScanCommand({ TableName }));
        return Items || [];
    } catch (error) {
        logger.error('Error getting all captive entries:', error);
        throw error;
    }
};

// Get captives by generator company ID
const getCaptivesByGenerator = async (generatorCompanyId) => {
    try {
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'generatorCompanyId = :generatorCompanyId',
            ExpressionAttributeValues: {
                ':generatorCompanyId': Number(generatorCompanyId)
            }
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error getting captives by generator company:', error);
        throw error;
    }
};

// Get captives by shareholder company ID
const getCaptivesByShareholder = async (shareholderCompanyId) => {
    try {
        // Using scan since we need to query on a non-key attribute
        const { Items } = await docClient.send(new ScanCommand({
            TableName,
            FilterExpression: 'shareholderCompanyId = :shareholderCompanyId',
            ExpressionAttributeValues: {
                ':shareholderCompanyId': Number(shareholderCompanyId)
            }
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error getting captives by shareholder company:', error);
        throw error;
    }
};



// Get a specific captive entry by generator and shareholder company IDs
const getCaptiveByCompanies = async (generatorCompanyId, shareholderCompanyId) => {
    try {
        const { Item } = await docClient.send(new GetCommand({
            TableName,
            Key: {
                generatorCompanyId: Number(generatorCompanyId),
                shareholderCompanyId: Number(shareholderCompanyId)
            }
        }));
        return Item;
    } catch (error) {
        logger.error('Error getting captive entry by companies:', error);
        throw error;
    }
};

// Create a new captive entry
const createCaptive = async (captiveData) => {
    try {
        const now = new Date().toISOString();
        const item = {
            generatorCompanyId: Number(captiveData.generatorCompanyId),
            shareholderCompanyId: Number(captiveData.shareholderCompanyId),
            generatorCompanyName: captiveData.generatorCompanyName,
            shareholderCompanyName: captiveData.shareholderCompanyName,
            allocationPercentage: Number(captiveData.allocationPercentage || 0),
            allocationStatus: captiveData.allocationStatus || 'active',
            createdAt: now,
            updatedAt: now
        };

        await docClient.send(new PutCommand({
            TableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(generatorCompanyId) AND attribute_not_exists(shareholderCompanyId)'
        }));
        
        return item;
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            throw new Error('A captive entry with these companies already exists');
        }
        logger.error('Error creating captive entry:', error);
        throw error;
    }
};

// Update an existing captive entry
const updateCaptive = async (generatorCompanyId, shareholderCompanyId, updateData) => {
    try {
        // First, get the current item to check if it's locked
        const currentItem = await getCaptiveByCompanies(generatorCompanyId, shareholderCompanyId);
        
        if (currentItem && currentItem.isLocked) {
            throw new Error('Cannot update locked allocation');
        }

        const now = new Date().toISOString();
        const { generatorCompanyId: gc, shareholderCompanyId: sc, ...updates } = updateData; // Remove key fields from updates

        const updateExpressions = [];
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        // Add updates for each field
        Object.entries(updates).forEach(([key, value], index) => {
            if (value !== undefined && key !== 'consumptionSiteName') {  // Skip consumptionSiteName
                const attrName = `#attr${index}`;
                const attrValue = `:val${index}`;
                updateExpressions.push(`${attrName} = ${attrValue}`);
                expressionAttributeNames[attrName] = key;
                expressionAttributeValues[attrValue] = key === 'allocationPercentage' ? Number(value) : value;
            }
        });

        // Add updatedAt timestamp
        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = now;

        const { Attributes } = await docClient.send(new UpdateCommand({
            TableName,
            Key: {
                generatorCompanyId: Number(generatorCompanyId),
                shareholderCompanyId: Number(shareholderCompanyId)
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }));

        return Attributes;
    } catch (error) {
        logger.error('Error updating captive entry:', error);
        throw error;
    }
};

// Delete a captive entry
const deleteCaptive = async (generatorCompanyId, shareholderCompanyId) => {
    try {
        const { Attributes } = await docClient.send(new DeleteCommand({
            TableName,
            Key: {
                generatorCompanyId: Number(generatorCompanyId),
                shareholderCompanyId: Number(shareholderCompanyId)
            },
            ReturnValues: 'ALL_OLD'
        }));
        return Attributes;
    } catch (error) {
        logger.error('Error deleting captive entry:', error);
        throw error;
    }
};

// Batch upsert captive entries (create if not exists, otherwise update)
const batchUpsertCaptives = async (entries) => {
    try {
        const results = [];

        for (const entry of entries) {
            const existing = await getCaptiveByCompanies(entry.generatorCompanyId, entry.shareholderCompanyId);

            if (!existing) {
                const created = await createCaptive({
                    generatorCompanyId: entry.generatorCompanyId,
                    shareholderCompanyId: entry.shareholderCompanyId,
                    generatorCompanyName: entry.generatorCompanyName,
                    shareholderCompanyName: entry.shareholderCompanyName,
                    allocationPercentage: entry.allocationPercentage,
                    allocationStatus: entry.allocationStatus || 'active'
                });
                results.push(created);
            } else {
                const updated = await updateCaptive(entry.generatorCompanyId, entry.shareholderCompanyId, {
                    allocationPercentage: entry.allocationPercentage,
                    allocationStatus: entry.allocationStatus || 'active',
                    generatorCompanyName: entry.generatorCompanyName,
                    shareholderCompanyName: entry.shareholderCompanyName
                });
                results.push(updated);
            }
        }

        return results;
    } catch (error) {
        logger.error('Error in batchUpsertCaptives:', error);
        throw error;
    }
};

module.exports = {
    getAllCaptives,
    getCaptivesByGenerator,
    getCaptivesByShareholder,
    getCaptiveByCompanies,
    createCaptive,
    updateCaptive,
    deleteCaptive,
    batchUpsertCaptives
};