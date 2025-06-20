const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const cleanupRelatedData = async (companyId, consumptionSiteId) => {
    const siteId = `${companyId}_${consumptionSiteId}`;
    logger.info(`[ConsumptionSiteDAL] Starting cleanup for site ${siteId}`);
    
    const cleanupStats = {
        deletedUnits: 0
    };

    try {
        // 1. Delete all consumption units for this site
        const { Items: unitItems } = await docClient.send(new QueryCommand({
            TableName: TableNames.CONSUMPTION_UNIT,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': siteId
            }
        }));

        // Delete units in batches of 25 to avoid throttling
        for (let i = 0; i < unitItems?.length || 0; i += 25) {
            const batch = unitItems.slice(i, i + 25);
            await Promise.all(batch.map(item =>
                docClient.send(new DeleteCommand({
                    TableName: TableNames.CONSUMPTION_UNIT,
                    Key: { pk: item.pk, sk: item.sk }
                }))
            ));
        }
        cleanupStats.deletedUnits = unitItems?.length || 0;

        logger.info(`[ConsumptionSiteDAL] Cleanup completed for site ${siteId}:`, cleanupStats);
        return cleanupStats;
    } catch (error) {
        logger.error(`[ConsumptionSiteDAL] Failed to cleanup site ${siteId}:`, error);
        throw error;
    }
};

module.exports = cleanupRelatedData;
