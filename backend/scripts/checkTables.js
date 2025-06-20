const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

async function checkTables() {
    try {
        const command = new ListTablesCommand({});
        const response = await client.send(command);
        console.log('Tables in DynamoDB Local:');
        console.log(response.TableNames);
        
        if (response.TableNames.includes('CaptiveTable')) {
            console.log('CaptiveTable exists!');
        } else {
            console.log('CaptiveTable does NOT exist!');
        }
    } catch (error) {
        console.error('Error checking tables:', error);
    } finally {
        client.destroy();
    }
}

checkTables();
