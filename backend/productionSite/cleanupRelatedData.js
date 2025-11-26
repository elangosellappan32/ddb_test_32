const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');
const allocationService = require('../services/allocationService');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Cleanup all related data for a production site before deletion
 * - Deletes all production units
 * - Deletes all production charges
 * - Deletes all banking records
 * - Deletes all lapse records
 * - Deletes all allocation records
 */
const cleanupRelatedData = async (companyId, productionSiteId) => {
    const siteId = `${companyId}_${productionSiteId}`;
    logger.info(`[ProductionSiteDAL] Starting cleanup for site ${siteId}`, {
        companyId,
        productionSiteId
    });
    
    const cleanupStats = {
        deletedUnits: 0,
        deletedCharges: 0,
        deletedBanking: 0,
        deletedLapse: 0,
        deletedAllocations: 0
    };

    try {
        // 1. Delete all production units
        const { Items: unitItems = [] } = await docClient.send(new QueryCommand({
            TableName: TableNames.PRODUCTION_UNIT,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': siteId
            }
        }));

        if (unitItems.length > 0) {
            for (let i = 0; i < unitItems.length; i += 25) {
                const batch = unitItems.slice(i, i + 25);
                await Promise.all(batch.map(item =>
                    docClient.send(new DeleteCommand({
                        TableName: TableNames.PRODUCTION_UNIT,
                        Key: { pk: item.pk, sk: item.sk }
                    }))
                ));
            }
            cleanupStats.deletedUnits = unitItems.length;
            logger.info(`[ProductionSiteDAL] Deleted ${unitItems.length} production units for site ${siteId}`);
        }

        // 2. Delete all production charges
        const { Items: chargeItems = [] } = await docClient.send(new QueryCommand({
            TableName: TableNames.PRODUCTION_CHARGE,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': siteId
            }
        }));

        if (chargeItems.length > 0) {
            for (let i = 0; i < chargeItems.length; i += 25) {
                const batch = chargeItems.slice(i, i + 25);
                await Promise.all(batch.map(item =>
                    docClient.send(new DeleteCommand({
                        TableName: TableNames.PRODUCTION_CHARGE,
                        Key: { pk: item.pk, sk: item.sk }
                    }))
                ));
            }
            cleanupStats.deletedCharges = chargeItems.length;
            logger.info(`[ProductionSiteDAL] Deleted ${chargeItems.length} production charges for site ${siteId}`);
        }

        // 3. Delete all banking records
        const { Items: bankingItems = [] } = await docClient.send(new QueryCommand({
            TableName: TableNames.BANKING,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': siteId
            }
        }));

        if (bankingItems.length > 0) {
            for (let i = 0; i < bankingItems.length; i += 25) {
                const batch = bankingItems.slice(i, i + 25);
                await Promise.all(batch.map(item =>
                    docClient.send(new DeleteCommand({
                        TableName: TableNames.BANKING,
                        Key: { pk: item.pk, sk: item.sk }
                    }))
                ));
            }
            cleanupStats.deletedBanking = bankingItems.length;
            logger.info(`[ProductionSiteDAL] Deleted ${bankingItems.length} banking records for site ${siteId}`);
        }

        // 4. Delete all lapse records
        const { Items: lapseItems = [] } = await docClient.send(new QueryCommand({
            TableName: TableNames.LAPSE,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
                ':pk': siteId
            }
        }));

        if (lapseItems.length > 0) {
            for (let i = 0; i < lapseItems.length; i += 25) {
                const batch = lapseItems.slice(i, i + 25);
                await Promise.all(batch.map(item =>
                    docClient.send(new DeleteCommand({
                        TableName: TableNames.LAPSE,
                        Key: { pk: item.pk, sk: item.sk }
                    }))
                ));
            }
            cleanupStats.deletedLapse = lapseItems.length;
            logger.info(`[ProductionSiteDAL] Deleted ${lapseItems.length} lapse records for site ${siteId}`);
        }

        // 5. Delete all allocation records for this production site using the allocation service
        try {
            const allocationCleanupResult = await allocationService.cleanupSiteAllocations(companyId, {
                productionSiteId: productionSiteId
            });
            cleanupStats.deletedAllocations = allocationCleanupResult.deletedCount;
            logger.info(`[ProductionSiteDAL] Deleted ${allocationCleanupResult.deletedCount} allocation records for site ${siteId}`);
        } catch (error) {
            logger.error(`[ProductionSiteDAL] Error deleting allocation records for site ${siteId}:`, error);
            // Continue with cleanup even if allocation deletion fails
        }

        logger.info(`[ProductionSiteDAL] Cleanup completed for site ${siteId}:`, cleanupStats);
        return cleanupStats;
    } catch (error) {
        logger.error(`[ProductionSiteDAL] Failed to cleanup site ${siteId}:`, error);
        throw error;
    }
};

module.exports = cleanupRelatedData;
