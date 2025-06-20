const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    PutCommand,
    GetCommand,
    QueryCommand,
    DeleteCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const docClient = require('../utils/db');
const TableNames = require('../constants/tableNames');

const TableName = TableNames.CONSUMPTION_UNIT;

const createConsumptionUnit = async (item) => {
    try {
        // First check if item exists
        const existing = await getConsumptionUnit(item.pk, item.sk);
        if (existing) {
            const error = new Error('Consumption unit already exists for this period');
            error.statusCode = 409;
            throw error;
        }

        // If not exists, create new item
        await docClient.send(new PutCommand({
            TableName,
            Item: item
        }));

        return item;
    } catch (error) {
        logger.error('[ConsumptionUnitDAL] Create Error:', error);
        
        // Handle specific DynamoDB errors
        if (error.name === 'ConditionalCheckFailedException') {
            const customError = new Error('Consumption unit already exists for this period');
            customError.statusCode = 409;
            throw customError;
        }
        
        throw error;
    }
};

const getConsumptionUnit = async (pk, sk) => {
    try {
        const { Item } = await docClient.send(new GetCommand({
            TableName,
            Key: { pk, sk }
        }));
        return Item;
    } catch (error) {
        logger.error('[ConsumptionUnitDAL] Get Error:', error);
        throw error;
    }
};

const getAllConsumptionUnits = async (pk = null) => {
    try {
        if (pk) {
            // If pk is provided, query by pk
            const { Items } = await docClient.send(new QueryCommand({
                TableName,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: {
                    ':pk': pk
                }
            }));
            return Items || [];
        } else {
            // If no pk is provided, scan all items
            const { Items } = await docClient.send(new ScanCommand({
                TableName
            }));
            return Items || [];
        }
    } catch (error) {
        logger.error('[ConsumptionUnitDAL] GetAll Error:', error);
        throw error;
    }
};

const updateConsumptionUnit = async (pk, sk, updateData) => {
    try {
        const now = new Date().toISOString();
        const item = {
            ...updateData,
            updatedat: now
        };

        await docClient.send(new PutCommand({
            TableName,
            Item: item,
            ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
        }));

        return item;
    } catch (error) {
        logger.error('[ConsumptionUnitDAL] Update Error:', error);
        throw error;
    }
};

const deleteConsumptionUnit = async (pk, sk) => {
    try {
        const command = new DeleteCommand({
            TableName,
            Key: { pk, sk },
            ReturnValues: 'ALL_OLD'
        });
        
        const { Attributes } = await docClient.send(command);
        return Attributes;
    } catch (error) {
        logger.error('[ConsumptionUnitDAL] Delete Error:', error);
        throw error;
    }
};

module.exports = {
    createConsumptionUnit,
    getConsumptionUnit,
    getAllConsumptionUnits,
    updateConsumptionUnit,
    deleteConsumptionUnit
};