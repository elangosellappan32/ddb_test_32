const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

async function describeTable() {
    try {
        const command = new DescribeTableCommand({
            TableName: 'CaptiveTable'
        });
        const response = await client.send(command);
        console.log('Table description:');
        console.log(JSON.stringify(response.Table, null, 2));
    } catch (error) {
        console.error('Error describing table:', error);
    } finally {
        client.destroy();
    }
}

describeTable();
