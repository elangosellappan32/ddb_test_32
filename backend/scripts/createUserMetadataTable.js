const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');

const dynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
    }
});

const createUserMetadataTable = async () => {
    const params = {
        TableName: TableNames.USER_METADATA,
        KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' }  // Partition key
        ],
        AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: {
            StreamEnabled: false
        }
    };

    try {
        logger.info(`Creating table ${TableNames.USER_METADATA}...`);
        await dynamoDBClient.send(new CreateTableCommand(params));
        logger.info(`Table ${TableNames.USER_METADATA} created successfully`);
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            logger.info(`Table ${TableNames.USER_METADATA} already exists`);
        } else {
            logger.error(`Error creating table ${TableNames.USER_METADATA}:`, error);
            throw error;
        }
    }
};

// Execute the table creation
createUserMetadataTable()
    .then(() => {
        logger.info('Table creation process completed');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('Error in table creation process:', error);
        process.exit(1);
    });
