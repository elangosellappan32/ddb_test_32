const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');

// Create DynamoDB client
const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
    }
});

// Create DynamoDB Document Client with proper configuration
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
        convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
        wrapNumbers: false
    }
});

// Test the connection
const testConnection = async () => {
    try {
        const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
        await client.send(new ListTablesCommand({}));
        logger.info('Successfully connected to DynamoDB');
        return true;
    } catch (error) {
        logger.error('Error connecting to DynamoDB:', error);
        throw error;
    }
};

module.exports = {
    client,
    docClient,
    testConnection
};
