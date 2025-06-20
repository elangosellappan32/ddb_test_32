const { 
    DynamoDBDocumentClient, 
    GetCommand,
    QueryCommand,
    ScanCommand,
    PutCommand,
    UpdateCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');

const TableName = TableNames.CAPTIVE;

const getCaptive = async (generatorCompanyId, shareholderCompanyId) => {
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
        logger.error('Error in getCaptive:', error);
        throw error;
    }
};

const getCaptivesByGenerator = async (generatorCompanyId) => {
    try {
        const { Items } = await docClient.send(new QueryCommand({
            TableName,
            KeyConditionExpression: 'generatorCompanyId = :generatorId',
            ExpressionAttributeValues: {
                ':generatorId': Number(generatorCompanyId)
            }
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error in getCaptivesByGenerator:', error);
        throw error;
    }
};

const getCaptivesByShareholder = async (shareholderCompanyId) => {
    try {
        // Since we don't have a GSI, we need to scan the table
        const { Items } = await docClient.send(new ScanCommand({
            TableName,
            FilterExpression: 'shareholderCompanyId = :shareholderId',
            ExpressionAttributeValues: {
                ':shareholderId': Number(shareholderCompanyId)
            }
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error in getCaptivesByShareholder:', error);
        throw error;
    }
};

const getAllCaptives = async () => {
    try {
        const { Items } = await docClient.send(new ScanCommand({
            TableName
        }));
        return Items || [];
    } catch (error) {
        logger.error('Error in getAllCaptives:', error);
        throw error;
    }
};

const createCaptive = async (generatorCompanyId, shareholderCompanyId, effectiveFrom, shareholdingPercentage, consumptionSiteId) => {
    try {
        const item = {
            generatorCompanyId: Number(generatorCompanyId),
            shareholderCompanyId: Number(shareholderCompanyId),
            effectiveFrom,
            shareholdingPercentage,
            consumptionSiteId,
            createdat: new Date().toISOString(),
            updatedat: new Date().toISOString()
        };

        await docClient.send(new PutCommand({
            TableName,
            Item: item,
            ConditionExpression: 'attribute_not_exists(generatorCompanyId) AND attribute_not_exists(shareholderCompanyId)'
        }));

        return item;
    } catch (error) {
        logger.error('Error in createCaptive:', error);
        throw error;
    }
};

const updateCaptive = async (generatorCompanyId, shareholderCompanyId, effectiveFrom, shareholdingPercentage, consumptionSiteId) => {
    try {
        const { Attributes } = await docClient.send(new UpdateCommand({
            TableName,
            Key: {
                generatorCompanyId: Number(generatorCompanyId),
                shareholderCompanyId: Number(shareholderCompanyId)
            },
            UpdateExpression: 'SET effectiveFrom = :effectiveFrom, shareholdingPercentage = :shareholdingPercentage, consumptionSiteId = :consumptionSiteId, updatedat = :updatedat',
            ExpressionAttributeValues: {
                ':effectiveFrom': effectiveFrom,
                ':shareholdingPercentage': shareholdingPercentage,
                ':consumptionSiteId': consumptionSiteId,
                ':updatedat': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        }));

        return Attributes;
    } catch (error) {
        logger.error('Error in updateCaptive:', error);
        throw error;
    }
};

module.exports = {
    getCaptive,
    getCaptivesByGenerator,
    getCaptivesByShareholder,
    getAllCaptives,
    createCaptive,
    updateCaptive
};
