const { QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const { formatMonthYearKey } = require('../utils/dateUtils');
const docClient = require('../utils/db');

class AllocationDAL {
    constructor() {
        this.tableName = TableNames.ALLOCATION;
    }

    generatePK(companyId, productionSiteId, consumptionSiteId) {
        return `${companyId}_${productionSiteId}_${consumptionSiteId}`;
    }

    validateSortKey(sk) {
        if (!sk || typeof sk !== 'string' || !/^(0[1-9]|1[0-2])\d{4}$/.test(sk)) {
            throw new Error(`Invalid sort key (sk): ${sk}. Must be in MMYYYY format (e.g., 042025)`);
        }
    }

    async getAllocations(month, filterBy = {}) {
        try {
            const sk = formatMonthYearKey(month);
            this.validateSortKey(sk);

            let KeyConditionExpression = 'sk = :sk';
            let ExpressionAttributeValues = { ':sk': sk };
            let ExpressionAttributeNames = undefined;
            let FilterExpression = undefined;

            if (filterBy.type) {
                FilterExpression = '#type = :type';
                ExpressionAttributeValues[':type'] = filterBy.type;
                ExpressionAttributeNames = { '#type': 'type' };
            }

            const params = {
                TableName: this.tableName,
                IndexName: undefined, // add if you use GSI
                KeyConditionExpression,
                ExpressionAttributeValues,
            };
            if (ExpressionAttributeNames) params.ExpressionAttributeNames = ExpressionAttributeNames;
            if (FilterExpression) params.FilterExpression = FilterExpression;

            const { Items } = await docClient.send(new QueryCommand(params));
            return Items || [];
        } catch (error) {
            logger.error(`[AllocationDAL] GetAllocations Error for month ${JSON.stringify(month)}:`, error);
            throw error;
        }
    }

    async getAllocationsByMonth(month) {
        try {
            const sk = formatMonthYearKey(month);
            this.validateSortKey(sk);

            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'sk = :sk',
                ExpressionAttributeValues: { ':sk': sk }
            };
            const { Items } = await docClient.send(new QueryCommand(params));
            return Items || [];
        } catch (error) {
            logger.error('[AllocationDAL] GetByMonth Error:', error);
            throw error;
        }
    }

    async getAllocationsByConsumptionSite(companyId, consumptionSiteId, fromMonth, toMonth) {
        try {
            const fromSk = formatMonthYearKey(fromMonth);
            const toSk = formatMonthYearKey(toMonth);
            this.validateSortKey(fromSk);
            this.validateSortKey(toSk);

            const params = {
                TableName: this.tableName,
                FilterExpression: 'contains(pk, :search) AND sk BETWEEN :from AND :to',
                ExpressionAttributeValues: {
                    ':search': `${companyId}_${consumptionSiteId}`,
                    ':from': fromSk,
                    ':to': toSk
                }
            };
            const { Items } = await docClient.send(new ScanCommand(params));
            return Items || [];
        } catch (error) {
            logger.error('[AllocationDAL] GetByConsumptionSite Error:', error);
            throw error;
        }
    }

    async deleteAllocation(companyId, productionSiteId, consumptionSiteId, sk) {
        try {
            this.validateSortKey(sk);
            const pk = this.generatePK(companyId, productionSiteId, consumptionSiteId);
            const params = {
                TableName: this.tableName,
                Key: { pk, sk },
                ReturnValues: 'ALL_OLD'
            };
            const result = await docClient.send(new DeleteCommand(params));
            return result.Attributes;
        } catch (error) {
            logger.error('[AllocationDAL] Delete Error:', error);
            throw error;
        }
    }

    async scanAll() {
        const { Items } = await docClient.send(new ScanCommand({ TableName: this.tableName }));
        return Items || [];
    }

    async getAllAllocations() {
        try {
            return await this.scanAll();
        } catch (error) {
            logger.error('[AllocationDAL] GetAllAllocations Error:', error);
            throw error;
        }
    }

    async getAllAllocatedUnits() {
        try {
            const items = await this.scanAll();
            return items.map(item => ({
                ...item,
                c1: Number(item.c1 || 0),
                c2: Number(item.c2 || 0),
                c3: Number(item.c3 || 0),
                c4: Number(item.c4 || 0),
                c5: Number(item.c5 || 0)
            }));
        } catch (error) {
            logger.error('[AllocationDAL] GetAllAllocatedUnits Error:', error);
            throw error;
        }
    }
}

module.exports = new AllocationDAL();