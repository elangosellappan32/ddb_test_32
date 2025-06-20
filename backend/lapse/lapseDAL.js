const { 
    PutCommand, 
    UpdateCommand, 
    QueryCommand, 
    DeleteCommand 
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const { formatMonthYearKey } = require('../utils/dateUtils');
const { ALL_PERIODS } = require('../constants/periods');
const docClient = require('../utils/db');

class LapseDAL {
    constructor() {
        this.tableName = TableNames.LAPSE;
    }

    validateSortKey(sk) {
        if (!sk || typeof sk !== 'string' || !/^(0[1-9]|1[0-2])\d{4}$/.test(sk)) {
            throw new Error(`Invalid sort key (sk): ${sk}. Must be in MMYYYY format (e.g., 042025)`);
        }
    }

    async createLapse(lapseData) {
        try {
            this.validateSortKey(lapseData.sk);
            
            // Normalize allocated values
            const normalizedAllocated = ALL_PERIODS.reduce((acc, period) => {
                acc[period] = Math.round(Number(lapseData.allocated?.[period] || 0));
                return acc;
            }, {});

            const item = {
                ...lapseData,
                allocated: normalizedAllocated,
                type: 'LAPSE',
                createdat: new Date().toISOString(),
                updatedat: new Date().toISOString()
            };

            const command = new PutCommand({
                TableName: this.tableName,
                Item: item
            });

            logger.debug('[LapseDAL] Creating lapse item:', { pk: item.pk, sk: item.sk });
            await docClient.send(command);
            return item;
        } catch (error) {
            logger.error('[LapseDAL] createLapse error:', error);
            throw error;
        }
    }

    async updateLapse(pk, sk, updates) {
        try {
            this.validateSortKey(sk);
            
            // Normalize allocated values if present
            if (updates.allocated) {
                updates.allocated = ALL_PERIODS.reduce((acc, period) => {
                    acc[period] = Math.round(Number(updates.allocated[period] || 0));
                    return acc;
                }, {});
            }

            const updateData = {
                ...updates,
                updatedat: new Date().toISOString()
            };

            const updateExpression = [];
            const expressionAttributeValues = {};
            const expressionAttributeNames = {};

            Object.entries(updateData).forEach(([key, value]) => {
                if (value !== undefined) {
                    const attrKey = `#${key}`;
                    const attrValue = `:${key}`;
                    updateExpression.push(`${attrKey} = ${attrValue}`);
                    expressionAttributeValues[attrValue] = value;
                    expressionAttributeNames[attrKey] = key;
                }
            });

            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { pk, sk },
                UpdateExpression: `SET ${updateExpression.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            });

            logger.debug('[LapseDAL] Updating lapse item:', { pk, sk, updates: updateData });
            const response = await docClient.send(command);
            return response.Attributes;
        } catch (error) {
            logger.error('[LapseDAL] updateLapse error:', error);
            throw error;
        }
    }

    async getLapsesByMonth(companyId, month) {
        try {
            const sk = formatMonthYearKey(month);
            this.validateSortKey(sk);

            const command = new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'pk = :pk AND sk = :sk',
                ExpressionAttributeValues: {
                    ':pk': String(companyId),
                    ':sk': sk
                }
            });

            logger.debug('[LapseDAL] Getting lapses by month:', { companyId, month: sk });
            const response = await docClient.send(command);
            return response.Items || [];
        } catch (error) {
            logger.error('[LapseDAL] getLapsesByMonth error:', error);
            throw error;
        }
    }

    async getLapsesByProductionSite(companyId, productionSiteId, fromMonth, toMonth) {
        try {
            const fromSk = formatMonthYearKey(fromMonth);
            const toSk = formatMonthYearKey(toMonth);
            this.validateSortKey(fromSk);
            this.validateSortKey(toSk);

            const pk = `${companyId}_${productionSiteId}`;
            const command = new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':from': fromSk,
                    ':to': toSk
                }
            });

            logger.debug('[LapseDAL] Getting lapses by production site:', { pk, fromMonth: fromSk, toMonth: toSk });
            const response = await docClient.send(command);
            return response.Items || [];
        } catch (error) {
            logger.error('[LapseDAL] getLapsesByProductionSite error:', error);
            throw error;
        }
    }

    async deleteLapse(pk, sk) {
        try {
            this.validateSortKey(sk);
            
            const command = new DeleteCommand({
                TableName: this.tableName,
                Key: { pk, sk },
                ReturnValues: 'ALL_OLD'
            });

            logger.debug('[LapseDAL] Deleting lapse item:', { pk, sk });
            const response = await docClient.send(command);
            return response.Attributes;
        } catch (error) {
            logger.error('[LapseDAL] deleteLapse error:', error);
            throw error;
        }
    }
}

module.exports = new LapseDAL();