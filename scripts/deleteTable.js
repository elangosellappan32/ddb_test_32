const { DynamoDBClient, DeleteTableCommand } = require("@aws-sdk/client-dynamodb");
const TableNames = require('../backend/constants/tableNames');

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

async function deleteTable() {
    try {
        await client.send(new DeleteTableCommand({ TableName: TableNames.CAPTIVE }));
        console.log('Captive table deleted successfully');
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            console.log('Table does not exist');
        } else {
            console.error('Error deleting table:', error);
        }
    }
}

deleteTable();
