const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');


const create = async (item) => {
    try {
        // Check if item exists
        const existing = await getItem(item.pk, item.sk);
        
        if (existing) {
            // If exists, update it instead
            const updates = {
                ...item,
                version: existing.version // Use existing version for update
            };
            return await updateItem(item.pk, item.sk, updates);
        }

        // Create new item if doesn't exist
        const now = new Date().toISOString();
        const enhancedItem = {
            ...item,
            version: 1,
            createdat: now,
            updatedat: now,
            timetolive: 0
        };

        const params = {
            TableName: TableNames.PRODUCTION_UNIT,
            Item: enhancedItem
        };

        await docClient.send(new PutCommand(params));
        return enhancedItem;
    } catch (error) {
        logger.error('[ProductionUnitDAL] Create Error:', error);
        throw error;
    }
};

const getItem = async (pk, sk) => {
    try {
        const params = {
            TableName: TableNames.PRODUCTION_UNIT,
            Key: { pk, sk }
        };

        const { Item } = await docClient.send(new GetCommand(params));
        return Item;
    } catch (error) {
        logger.error('[ProductionUnitDAL] GetItem Error:', error);
        throw error;
    }
};

const updateItem = async (pk, sk, updates) => {
    try {
        // Get current item first
        const currentItem = await getItem(pk, sk);
        if (!currentItem) {
            throw new Error('Production unit not found');
        }

        // Check version match
        const currentVersion = currentItem.version;
        logger.info(`Checking versions - Current: ${currentVersion}, Received: ${updates.version}`);
        
        if (currentVersion !== updates.version) {
            const error = new Error(`Version mismatch - Current: ${currentVersion}, Received: ${updates.version}`);
            error.name = 'ConditionalCheckFailedException';
            error.currentVersion = currentVersion;
            throw error;
        }

        // Prepare update
        const now = new Date().toISOString();
        const newVersion = currentVersion + 1;

        // Build update expression
        let updateExpression = 'SET version = :newVersion, updatedat = :updatedat';
        const expressionAttributeNames = {};
        const expressionAttributeValues = {
            ':newVersion': newVersion,
            ':updatedat': now,
            ':currentVersion': currentVersion
        };

        // Add updated fields
        Object.entries(updates).forEach(([key, value]) => {
            if (!['version', 'pk', 'sk', 'createdat', 'updatedat', 'timetolive'].includes(key)) {
                updateExpression += `, #${key} = :${key}`;
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = value;
            }
        });

        const params = {
            TableName: TableNames.PRODUCTION_UNIT,
            Key: { pk, sk },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: 'version = :currentVersion',
            ReturnValues: 'ALL_NEW'
        };

        logger.info('Update params:', JSON.stringify(params, null, 2));

        const { Attributes } = await docClient.send(new UpdateCommand(params));
        return Attributes;
    } catch (error) {
        logger.error('[ProductionUnitDAL] UpdateItem Error:', error);
        throw error;
    }
};

const deleteItem = async (pk, sk) => {
    try {
        const params = {
            TableName: TableNames.PRODUCTION_UNIT,
            Key: { pk, sk },
            ReturnValues: 'ALL_OLD'
        };

        const { Attributes } = await docClient.send(new DeleteCommand(params));
        return Attributes;
    } catch (error) {
        logger.error('[ProductionUnitDAL] DeleteItem Error:', error);
        throw error;
    }
};

const getProductionUnitHistory = async (companyId, productionSiteId) => {
    try {
        const pk = `${companyId}_${productionSiteId}`;
        const params = {
            TableName: TableNames.PRODUCTION_UNIT,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': pk
            }
        };

        const { Items } = await docClient.send(new QueryCommand(params));
        return Items || [];
    } catch (error) {
        logger.error('[ProductionUnitDAL] GetHistory Error:', error);
        throw error;
    }
};

const getAllProductionUnits = async () => {
    try {
        const params = {
            TableName: TableNames.PRODUCTION_UNIT
        };

        const { Items } = await docClient.send(new ScanCommand(params));
        return Items || [];
    } catch (error) {
        logger.error('[ProductionUnitDAL] GetAll Error:', error);
        throw error;
    }
};

module.exports = {
    create,
    getItem,
    getAllProductionUnits,
    getProductionUnitHistory,
    updateItem,
    deleteItem
};