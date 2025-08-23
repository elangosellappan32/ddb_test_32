const { PutCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = require('../utils/db');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const { formatMonthYearKey } = require('../utils/dateUtils');
const { ALL_PERIODS } = require('../constants/periods');

class LapseDAL {
    constructor() {
        this.tableName = TableNames.LAPSE;
    }
    
    async getLapsesByPk(pk) {
        try {
            if (!pk) {
                throw new Error('Primary key (pk) is required');
            }
            
            const command = new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: {
                    ':pk': pk
                },
                // Sort by sort key (month) in ascending order
                ScanIndexForward: true
            });
            
            logger.debug(`[LapseDAL] Fetching lapses for PK: ${pk}`);
            const response = await docClient.send(command);
            return response.Items || [];
        } catch (error) {
            logger.error('[LapseDAL] getLapsesByPk Error:', error);
            throw error;
        }
    }

    validateSortKey(sk) {
        if (!sk || typeof sk !== 'string' || !/^(0[1-9]|1[0-2])\d{4}$/.test(sk)) {
            throw new Error(`Invalid sort key (sk): ${sk}. Must be in MMYYYY format (e.g., 042025)`);
        }
    }

    normalizeAllocated(allocated) {
        return ALL_PERIODS.reduce((acc, period) => {
            acc[period] = Math.round(Number(allocated?.[period] || 0));
            return acc;
        }, {});
    }

    async createLapse(lapseData) {
        try {
            this.validateSortKey(lapseData.sk);
            
            // Extract c1-c5 from allocated if present, or use root level values
            const { allocated, ...restData } = lapseData;
            const cValues = {
                c1: 0,
                c2: 0,
                c3: 0,
                c4: 0,
                c5: 0,
                ...(allocated || {}),
                ...restData
            };
            
            // Create item with c1-c5 at root level
            const item = {
                ...restData,
                c1: Number(cValues.c1) || 0,
                c2: Number(cValues.c2) || 0,
                c3: Number(cValues.c3) || 0,
                c4: Number(cValues.c4) || 0,
                c5: Number(cValues.c5) || 0,
                type: 'LAPSE',
                createdat: new Date().toISOString(),
                updatedat: new Date().toISOString()
            };
            
            // Remove allocated if it exists
            delete item.allocated;
            
            const command = new PutCommand({
                TableName: this.tableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
            });
            
            logger.debug(`[LapseDAL] Creating new lapse record: ${JSON.stringify(item)}`);
            await docClient.send(command);
            return item;
        } catch (error) {
            logger.error(`[LapseDAL] Error creating lapse record: ${error.message}`, { error });
            throw error;
        }
    }

    async updateLapse(pk, sk, updates) {
        try {
            if (!pk || !sk) {
                throw new Error('Both pk and sk are required for update');
            }
            
            this.validateSortKey(sk);
            
            // Extract c1-c5 from updates or from allocated if present
            const { allocated, ...restUpdates } = updates;
            const cValues = {
                c1: 0,
                c2: 0,
                c3: 0,
                c4: 0,
                c5: 0,
                ...(allocated || {}),
                ...restUpdates
            };
            
            // Build update expression for direct c1-c5 values
            const updateExpressions = ['SET updatedat = :updatedat'];
            const expressionAttributeValues = {
                ':updatedat': new Date().toISOString()
            };
            
            // Add c1-c5 to update expression
            ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((key, index) => {
                const value = Number(cValues[key]) || 0;
                updateExpressions.push(`${key} = :${key}`);
                expressionAttributeValues[`:${key}`] = value;
            });
            
            // Remove allocated if it exists in the item
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { pk, sk },
                UpdateExpression: updateExpressions.join(', '),
                ExpressionAttributeValues: expressionAttributeValues,
                // Remove allocated attribute if it exists
                UpdateExpression: `${updateExpressions.join(', ')} REMOVE allocated`,
                ReturnValues: 'ALL_NEW'
            });
            
            logger.debug(`[LapseDAL] Updating lapse record: ${pk}, ${sk}`, { 
                updates: {
                    ...restUpdates,
                    c1: cValues.c1,
                    c2: cValues.c2,
                    c3: cValues.c3,
                    c4: cValues.c4,
                    c5: cValues.c5
                }
            });
            
            const response = await docClient.send(command);
            return response.Attributes;
        } catch (error) {
            logger.error(`[LapseDAL] Error updating lapse record: ${error.message}`, { error, pk, sk });
            throw error;
        }
    }

    async getLapsesByMonth(companyId, month) {
        try {
            const sk = formatMonthYearKey(month);
            this.validateSortKey(sk);

            // Use scan with filter expression since we don't have a GSI on sk
            const command = new ScanCommand({
                TableName: this.tableName,
                FilterExpression: 'sk = :sk AND begins_with(pk, :companyPrefix)',
                ExpressionAttributeValues: {
                    ':sk': sk,
                    ':companyPrefix': `${companyId}_`
                }
            });

            logger.debug(`[LapseDAL] Getting lapses by month: ${companyId}, ${month}`, { 
                tableName: this.tableName,
                filterExpression: 'sk = :sk AND begins_with(pk, :companyPrefix)',
                expressionValues: {
                    sk,
                    companyPrefix: `${companyId}_`
                }
            });
            
            const response = await docClient.send(command);
            logger.debug(`[LapseDAL] Found ${response.Items?.length || 0} lapses for ${companyId}, ${month}`);
            return response.Items || [];
        } catch (error) {
            logger.error(`[LapseDAL] Error fetching lapses by month: ${error.message}`, { 
                error: error.stack, 
                companyId, 
                month 
            });
            throw error;
        }
    }

    async getLapsesByProductionSite(companyId, productionSiteId, fromMonth, toMonth) {
        try {
            if (!companyId || !productionSiteId) {
                throw new Error('Both companyId and productionSiteId are required');
            }
            
            const pk = `${companyId}_${productionSiteId}`;
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'pk = :pk',
                ExpressionAttributeValues: {
                    ':pk': pk
                },
                ScanIndexForward: true
            };
            
            if (fromMonth && toMonth) {
                params.KeyConditionExpression += ' AND sk BETWEEN :fromMonth AND :toMonth';
                params.ExpressionAttributeValues[':fromMonth'] = fromMonth;
                params.ExpressionAttributeValues[':toMonth'] = toMonth;
            }
            
            logger.debug(`[LapseDAL] Fetching lapses for production site: ${pk}`, { fromMonth, toMonth });
            const command = new QueryCommand(params);
            const response = await docClient.send(command);
            return response.Items || [];
        } catch (error) {
            logger.error(`[LapseDAL] Error fetching lapses for production site: ${error.message}`, { 
                error, 
                companyId, 
                productionSiteId, 
                fromMonth, 
                toMonth 
            });
            throw error;
        }
    }

    async deleteLapse(pk, sk) {
        try {
            if (!pk || !sk) {
                throw new Error('Both pk and sk are required for deletion');
            }
            
            const command = new DeleteCommand({
                TableName: this.tableName,
                Key: { pk, sk },
                ReturnValues: 'ALL_OLD'
            });
            
            logger.debug(`[LapseDAL] Deleting lapse record: ${pk}, ${sk}`);
            const response = await docClient.send(command);
            return response.Attributes;
        } catch (error) {
            logger.error(`[LapseDAL] Error deleting lapse record: ${error.message}`, { error, pk, sk });
            throw error;
        }
    }
}

module.exports = new LapseDAL();