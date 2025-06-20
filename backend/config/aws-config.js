const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');

// Configure the DynamoDB client
const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
    }
});

// Create the DynamoDB Document Client
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient, {
    marshallOptions: {
        // Whether to automatically convert empty strings, blobs, and sets to `null`
        convertEmptyValues: false,
        // Whether to remove undefined values while marshalling
        removeUndefinedValues: true,
        // Whether to convert typeof object to map attribute
        convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
        // Whether to return numbers as a string instead of converting them to native JavaScript numbers
        wrapNumbers: false,
    },
});

// Test the connection
const testConnection = async () => {
    try {
        const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
        await dynamoDBClient.send(new ListTablesCommand({}));
        logger.info('Successfully connected to DynamoDB');
        return true;
    } catch (error) {
        logger.error('Error connecting to DynamoDB:', error);
        throw error;
    }
};

module.exports = {
    dynamoDBClient,
    ddbDocClient,
    testConnection
};
