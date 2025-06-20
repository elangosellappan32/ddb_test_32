const BaseDAL = require('../common/baseDAL');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const { formatMonthYearKey } = require('../utils/dateUtils');
const docClient = require('../utils/db');

class AllocationDAL extends BaseDAL {
    constructor() {
        super(TableNames.ALLOCATION);
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

            let expression = 'sk = :sk';
            const values = { ':sk': sk };

            if (filterBy.type) {
                expression += ' AND #type = :type';
                values[':type'] = filterBy.type;
            }

            return await this.queryItems({
                expression,
                values,
                names: filterBy.type ? { '#type': 'type' } : undefined
            });
        } catch (error) {
            logger.error(`[AllocationDAL] GetAllocations Error for month ${JSON.stringify(month)}:`, error);
            throw error;
        }
    }

    async getAllocationsByMonth(month) {
        try {
            const sk = formatMonthYearKey(month);
            this.validateSortKey(sk);

            return await this.queryItems({
                expression: 'sk = :sk',
                values: { ':sk': sk }
            });
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

            return await this.queryItems({
                expression: 'contains(pk, :search) AND sk BETWEEN :from AND :to',
                values: {
                    ':search': `${companyId}_${consumptionSiteId}`,
                    ':from': fromSk,
                    ':to': toSk
                }
            });
        } catch (error) {
            logger.error('[AllocationDAL] GetByConsumptionSite Error:', error);
            throw error;
        }
    }

    async deleteAllocation(companyId, productionSiteId, consumptionSiteId, sk) {
        try {
            this.validateSortKey(sk);
            const pk = this.generatePK(companyId, productionSiteId, consumptionSiteId);
            return await this.deleteItem({ pk, sk });
        } catch (error) {
            logger.error('[AllocationDAL] Delete Error:', error);
            throw error;
        }
    }

    // Scan all items in the table (for report page, no filter)
    async scanAll() {
        return await this.scanTable();
    }

    async getAllAllocations() {
        try {
            return await this.scanAll();
        } catch (error) {
            logger.error('[AllocationDAL] GetAllAllocations Error:', error);
            throw error;
        }
    }

    // Get all allocations without any month filter for report calculations
    async getAllAllocatedUnits() {
        try {
            const items = await this.scanTable();
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