const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    UpdateCommand,
    GetCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('./logger');

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000'
});

const docClient = DynamoDBDocumentClient.from(client);

const getCurrentValue = async (counterId) => {
    try {
        const command = new GetCommand({
            TableName: TableNames.COUNTERS,
            Key: { pk: counterId }
        });

        const response = await docClient.send(command);
        
        logger.info('Counter', 'Current Value Retrieved', {
            counterId,
            currentValue: response.Item?.currentValue || 0
        });

        return response.Item?.currentValue || 0;
    } catch (error) {
        logger.error('Counter', 'Get Current Value Failed', {
            error: error.message,
            stack: error.stack,
            counterId
        });
        throw error;
    }
};

const getNextId = async (counterId) => {
    try {
        // Log counter request
        logger.info('Counter', 'Next ID Requested', {
            counterId,
            table: TableNames.COUNTERS
        });

        const params = {
            TableName: TableNames.COUNTERS,
            Key: { pk: counterId },
            UpdateExpression: 'SET #val = if_not_exists(#val, :start) + :increment',
            ExpressionAttributeNames: {
                '#val': 'currentValue'
            },
            ExpressionAttributeValues: {
                ':start': 0,
                ':increment': 1
            },
            ReturnValues: 'UPDATED_NEW'
        };

        const { Attributes } = await docClient.send(new UpdateCommand(params));
        
        // Log successful increment
        logger.info('Counter', 'Next ID Generated', {
            counterId,
            newValue: Attributes.currentValue
        });

        return Attributes.currentValue;
    } catch (error) {
        logger.error('Counter', 'Next ID Generation Failed', {
            error: error.message,
            stack: error.stack,
            counterId,
            table: TableNames.COUNTERS
        });
        throw error;
    }
};

const resetCounter = async (counterId) => {
    try {
        const params = {
            TableName: TableNames.COUNTERS,
            Key: { pk: counterId },
            UpdateExpression: 'SET #val = :zero',
            ExpressionAttributeNames: {
                '#val': 'currentValue'
            },
            ExpressionAttributeValues: {
                ':zero': 0
            },
            ReturnValues: 'UPDATED_NEW'
        };

        logger.info('Counter', 'Counter Reset Requested', {
            counterId
        });

        const { Attributes } = await docClient.send(new UpdateCommand(params));
        
        logger.info('Counter', 'Counter Reset Success', {
            counterId,
            resetValue: Attributes.currentValue
        });

        return Attributes.currentValue;
    } catch (error) {
        logger.error('Counter', 'Counter Reset Failed', {
            error: error.message,
            stack: error.stack,
            counterId
        });
        throw error;
    }
};

module.exports = {
    getCurrentValue,
    getNextId,
    resetCounter
};