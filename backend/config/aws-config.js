const docClient = require('../utils/db');
const logger = require('../utils/logger');

// Test the connection
const testConnection = async () => {
    try {
        const { ListTablesCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        // Use a new DynamoDBClient for admin operations like listing tables
        const client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'us-east-1',
            endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
            }
        });
        await client.send(new ListTablesCommand({}));
        logger.info('Successfully connected to DynamoDB');
        return true;
    } catch (error) {
        logger.error('Error connecting to DynamoDB:', error);
        throw error;
    }
};

module.exports = {
    docClient,
    testConnection
};
