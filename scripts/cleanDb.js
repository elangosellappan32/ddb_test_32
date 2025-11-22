const { DynamoDBClient, DeleteTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const TableNames = require('../backend/constants/tableNames');

// Initialize DynamoDB client
const client = new DynamoDBClient({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local'
    }
});

/**
 * Deletes all DynamoDB tables defined in TableNames
 */
async function cleanDatabase() {
    try {
        // Get all table names from the constants
        const allTableNames = Object.values(TableNames);
        console.log('Starting to clean up database tables...');

        // Delete each table
        for (const tableName of allTableNames) {
            try {
                const command = new DeleteTableCommand({ TableName: tableName });
                await client.send(command);
                console.log(`Successfully deleted table: ${tableName}`);
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                if (error.name === 'ResourceNotFoundException') {
                    console.log(`Table does not exist: ${tableName}`);
                } else {
                    console.error(`Error deleting table ${tableName}:`, error.message);
                }
            }
        }

        console.log('Database cleanup completed!');
    } catch (error) {
        console.error('Error during database cleanup:', error);
        throw error;
    } finally {
        // Close the client connection
        client.destroy();
    }
}

// Run the cleanup
cleanDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Failed to clean database:', error);
        process.exit(1);
    });
