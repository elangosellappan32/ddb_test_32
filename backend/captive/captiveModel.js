const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    PutCommand, 
    QueryCommand, 
    UpdateCommand, 
    DeleteCommand 
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');

// Configure DynamoDB client
const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});
const docClient = DynamoDBDocumentClient.from(client);

// Create a new Captive entry
exports.createCaptiveEntry = async (generatorCompanyId, shareholderCompanyId, effectiveFrom, shareholdingPercentage) => {
    const params = {
        TableName: TableNames.CAPTIVE,
        Item: {
            generatorCompanyId,
            shareholderCompanyId,
            effectiveFrom,
            shareholdingPercentage
        }
    };

    try {
        await docClient.send(new PutCommand(params));
        return params.Item;
    } catch (error) {
        console.error('Error creating Captive entry:', error);
        throw error;
    }
};

// Get Captive entries by Generator Company ID
exports.getCaptiveEntriesByGenerator = async (generatorCompanyId) => {
    const params = {
        TableName: TableNames.CAPTIVE,
        KeyConditionExpression: 'generatorCompanyId = :generatorId',
        ExpressionAttributeValues: {
            ':generatorId': generatorCompanyId
        }
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        return Items || [];
    } catch (error) {
        console.error('Error fetching Captive entries by Generator:', error);
        throw error;
    }
};

// Get Captive entries by Shareholder Company ID
exports.getCaptiveEntriesByShareholder = async (shareholderCompanyId) => {
    const params = {
        TableName: TableNames.CAPTIVE,
        IndexName: 'shareholderCompanyId-index', // Note: This requires a GSI which we removed
        KeyConditionExpression: 'shareholderCompanyId = :shareholderId',
        ExpressionAttributeValues: {
            ':shareholderId': shareholderCompanyId
        }
    };

    try {
        // Since we removed the GSI, this method will need to be modified
        // For now, it will do a full table scan, which is not efficient
        const { Items } = await docClient.send(new QueryCommand({
            TableName: TableNames.CAPTIVE,
            FilterExpression: 'shareholderCompanyId = :shareholderId',
            ExpressionAttributeValues: {
                ':shareholderId': shareholderCompanyId
            }
        }));
        return Items || [];
    } catch (error) {
        console.error('Error fetching Captive entries by Shareholder:', error);
        throw error;
    }
};

// Update a Captive entry
exports.updateCaptiveEntry = async (generatorCompanyId, shareholderCompanyId, effectiveFrom, shareholdingPercentage) => {
    const params = {
        TableName: TableNames.CAPTIVE,
        Key: {
            generatorCompanyId,
            shareholderCompanyId
        },
        UpdateExpression: 'SET effectiveFrom = :effectiveFrom, shareholdingPercentage = :shareholdingPercentage',
        ExpressionAttributeValues: {
            ':effectiveFrom': effectiveFrom,
            ':shareholdingPercentage': shareholdingPercentage
        },
        ReturnValues: 'ALL_NEW'
    };

    try {
        const { Attributes } = await docClient.send(new UpdateCommand(params));
        return Attributes;
    } catch (error) {
        console.error('Error updating Captive entry:', error);
        throw error;
    }
};

// Delete a Captive entry
exports.deleteCaptiveEntry = async (generatorCompanyId, shareholderCompanyId) => {
    const params = {
        TableName: TableNames.CAPTIVE,
        Key: {
            generatorCompanyId,
            shareholderCompanyId
        }
    };

    try {
        await docClient.send(new DeleteCommand(params));
    } catch (error) {
        console.error('Error deleting Captive entry:', error);
        throw error;
    }
};
