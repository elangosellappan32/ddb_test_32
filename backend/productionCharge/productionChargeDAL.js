const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    QueryCommand,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');

const getAllCharges = async (companyId, productionSiteId) => {
    try {
        const pk = `${companyId}_${productionSiteId}`;
        logger.info('[ProductionChargeDAL] Getting all charges:', { pk });

        const params = {
            TableName: TableNames.PRODUCTION_CHARGE,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': pk
            }
        };

        const { Items = [] } = await docClient.send(new QueryCommand(params));
        return {
            data: Items,
            message: Items.length ? `Found ${Items.length} charges` : 'No charges found'
        };
    } catch (error) {
        logger.error('[ProductionChargeDAL] GetAll Error:', error);
        throw error;
    }
};

const getItem = async (pk, sk) => {
    try {
        logger.info('[ProductionChargeDAL] Getting charge:', { pk, sk });

        const params = {
            TableName: TableNames.PRODUCTION_CHARGE,
            Key: { pk, sk }
        };

        const { Item } = await docClient.send(new GetCommand(params));
        return Item;
    } catch (error) {
        logger.error('[ProductionChargeDAL] Get Error:', error);
        throw error;
    }
};

const create = async (item) => {
    try {
        logger.info('[ProductionChargeDAL] Creating charge:', { pk: item.pk, sk: item.sk });

        const now = new Date().toISOString();
        const enhancedItem = {
            ...item,
            version: 1,
            createdat: now,
            updatedat: now,
            timetolive: 0,
            // Initialize charge fields
            ...Array.from({ length: 10 }, (_, i) => ({
                [`c${String(i + 1).padStart(3, '0')}`]: 0
            })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
            ...Object.fromEntries(
                Object.entries(item)
                    .filter(([key]) => key.match(/^c\d{3}$/))
                    .map(([key, value]) => [key, Number(value)])
            )
        };

        const params = {
            TableName: TableNames.PRODUCTION_CHARGE,
            Item: enhancedItem
        };

        await docClient.send(new PutCommand(params));
        logger.info('[ProductionChargeDAL] Charge created successfully');
        return enhancedItem;
    } catch (error) {
        logger.error('[ProductionChargeDAL] Create Error:', error);
        throw error;
    }
};

const updateItem = async (pk, sk, updates) => {
    try {
        logger.info('[ProductionChargeDAL] Updating charge:', { pk, sk });

        const currentItem = await getItem(pk, sk);
        if (!currentItem) {
            throw new Error('Charge not found');
        }

        // Build update parts
        const updateParts = ['version = :newVersion', 'updatedat = :updatedat'];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {
            ':newVersion': currentItem.version + 1,
            ':updatedat': new Date().toISOString(),
            ':currentVersion': currentItem.version
        };

        // Add charge fields to update
        Object.entries(updates)
            .filter(([key]) => !['version', 'pk', 'sk', 'createdat', 'updatedat', 'timetolive'].includes(key))
            .forEach(([key, value]) => {
                updateParts.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = Number(value);
            });

        const params = {
            TableName: TableNames.PRODUCTION_CHARGE,
            Key: { pk, sk },
            UpdateExpression: `SET ${updateParts.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: 'version = :currentVersion',
            ReturnValues: 'ALL_NEW'
        };

        logger.info('[ProductionChargeDAL] Executing update with params:', {
            UpdateExpression: params.UpdateExpression,
            ExpressionAttributeNames: params.ExpressionAttributeNames,
            ExpressionAttributeValues: params.ExpressionAttributeValues
        });

        const { Attributes } = await docClient.send(new UpdateCommand(params));
        logger.info('[ProductionChargeDAL] Charge updated successfully');
        return Attributes;
    } catch (error) {
        logger.error('[ProductionChargeDAL] Update Error:', error);
        throw error;
    }
};

const deleteItem = async (pk, sk) => {
    try {
        logger.info('[ProductionChargeDAL] Deleting charge:', { pk, sk });

        const params = {
            TableName: TableNames.PRODUCTION_CHARGE,
            Key: { pk, sk },
            ReturnValues: 'ALL_OLD'
        };

        const { Attributes } = await docClient.send(new DeleteCommand(params));
        logger.info('[ProductionChargeDAL] Charge deleted successfully');
        return Attributes;
    } catch (error) {
        logger.error('[ProductionChargeDAL] Delete Error:', error);
        throw error;
    }
};

// Ensure exports are consistent
module.exports = {
    getAllCharges,
    getItem,
    create,
    updateItem,
    deleteItem
};