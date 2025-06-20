const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

async function scanTable() {
    try {
        const command = new ScanCommand({
            TableName: 'CaptiveTable'
        });
        const response = await client.send(command);
        
        console.log('Items in CaptiveTable:');
        response.Items.forEach(item => {
            console.log(unmarshall(item));
        });
    } catch (error) {
        console.error('Error scanning table:', error);
    } finally {
        client.destroy();
    }
}

scanTable();
