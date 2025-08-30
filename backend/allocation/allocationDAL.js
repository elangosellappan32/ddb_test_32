const {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
} = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const logger = require('../utils/logger');
const docClient = require('../utils/db');
const { formatMonthYearKey } = require('../utils/dateUtils');

class AllocationDAL {
  constructor() {
    this.docClient = docClient;
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

  async getItem({ pk, sk }) {
    const params = {
      TableName: this.tableName,
      Key: { pk, sk }
    };
    try {
      const { Item } = await this.docClient.send(new GetCommand(params));
      return Item || null;
    } catch (error) {
      logger.error('Error getting allocation item:', error);
      throw error;
    }
  }

  validateItem(item) {
    if (!item.pk || !item.sk) {
      throw new Error('Missing required fields: pk and sk');
    }
    this.validateSortKey(item.sk);

    // Numeric conversions and validations
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(period => {
      item[period] = Number(item[period] || 0);
      if (item[period] < 0) {
        throw new Error(`${period} cannot be negative`);
      }
    });

    // Charge validation
    item.charge = Number(item.charge || 0);
    if (![0, 1].includes(item.charge)) {
      throw new Error('Charge must be 0 or 1');
    }

    // Additional validations for charge=1
    if (item.charge === 1) {
      const totalAllocation = ['c1', 'c2', 'c3', 'c4', 'c5']
        .reduce((sum, period) => sum + (item[period] || 0), 0);
      
      if (totalAllocation === 0) {
        throw new Error('Cannot set charge=1 for an allocation with zero units');
      }
    }
  }

  // The main create/update method
  async createOrUpdateAllocation(item) {
    try {
      this.validateItem(item);
      const now = new Date().toISOString();

      // Get existing charge allocation for this month if any
      if (item.charge === 1) {
        const existingCharge = await this.getChargingAllocation(item.sk);
        if (existingCharge && existingCharge.pk !== item.pk) {
          throw new Error(`Month ${item.sk} already has an allocation with charge=1 for pk: ${existingCharge.pk}`);
        }
      }

      // Check if allocation exists and handle version
      const existing = await this.getAllocation(item.pk, item.sk);
      let allocation = {
        ...item,
        updatedAt: now,
        version: existing ? (existing.version || 0) + 1 : 1
      };

      // Set creation timestamp for new allocations
      if (!existing) {
        allocation.createdAt = now;
      } else if (existing.charge === 1 && item.charge === 0) {
        // If removing charge flag, ensure another allocation gets it
        const allMonthAllocations = await this.getAllocationsByMonth(item.sk);
        const otherAllocations = allMonthAllocations.filter(a => a.pk !== item.pk);
        
        if (otherAllocations.length > 0) {
          // Find the allocation with the highest total units to be the new charging allocation
          const newChargingAllocation = otherAllocations.reduce((max, curr) => {
            const maxTotal = ['c1', 'c2', 'c3', 'c4', 'c5']
              .reduce((sum, period) => sum + (max[period] || 0), 0);
            const currTotal = ['c1', 'c2', 'c3', 'c4', 'c5']
              .reduce((sum, period) => sum + (curr[period] || 0), 0);
            return currTotal > maxTotal ? curr : max;
          });
          
          // Set charge=1 on the new charging allocation
          await this.docClient.send(new UpdateCommand({
            TableName: this.tableName,
            Key: { pk: newChargingAllocation.pk, sk: newChargingAllocation.sk },
            UpdateExpression: 'SET charge = :charge, updatedAt = :updatedAt, version = :version',
            ExpressionAttributeValues: {
              ':charge': 1,
              ':updatedAt': now,
              ':version': (newChargingAllocation.version || 0) + 1
            }
          }));
        }
      }

      // Create or update the allocation
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: allocation
      }));

      return allocation;
    } catch (error) {
      logger.error('[AllocationDAL] CreateOrUpdate Error:', error);
      throw error;
    }
  }

  // Alias for legacy compatibility
  async putItem(item) {
    return this.createOrUpdateAllocation(item);
  }

  async getAllocation(pk, sk) {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { pk, sk }
      }));
      return result.Item || null;
    } catch (error) {
      logger.error('[AllocationDAL] Get Error:', error);
      throw error;
    }
  }

  async deleteAllocation(companyId, productionSiteId, consumptionSiteId, sk) {
    try {
      this.validateSortKey(sk);
      const pk = this.generatePK(companyId, productionSiteId, consumptionSiteId);

      // Check if this is the charging allocation
      const allocation = await this.getAllocation(pk, sk);
      if (allocation?.charge === 1) {
        // Find a new allocation to set as charging
        const monthAllocations = await this.getAllocationsByMonth(sk);
        const otherAllocations = monthAllocations.filter(a => a.pk !== pk);
        
        if (otherAllocations.length > 0) {
          const newChargingAllocation = otherAllocations.reduce((max, curr) => {
            const maxTotal = ['c1', 'c2', 'c3', 'c4', 'c5']
              .reduce((sum, period) => sum + (max[period] || 0), 0);
            const currTotal = ['c1', 'c2', 'c3', 'c4', 'c5']
              .reduce((sum, period) => sum + (curr[period] || 0), 0);
            return currTotal > maxTotal ? curr : max;
          });

          await this.docClient.send(new UpdateCommand({
            TableName: this.tableName,
            Key: { pk: newChargingAllocation.pk, sk: newChargingAllocation.sk },
            UpdateExpression: 'SET charge = :charge, updatedAt = :updatedAt, version = :version',
            ExpressionAttributeValues: {
              ':charge': 1,
              ':updatedAt': new Date().toISOString(),
              ':version': (newChargingAllocation.version || 0) + 1
            }
          }));
        }
      }

      const result = await this.docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { pk, sk },
        ReturnValues: 'ALL_OLD'
      }));

      return result.Attributes || null;
    } catch (error) {
      logger.error('[AllocationDAL] Delete Error:', error);
      throw error;
    }
  }

  async getAllocationsByMonth(month) {
    try {
      const sk = formatMonthYearKey(month);
      this.validateSortKey(sk);

      const params = {
        TableName: this.tableName,
        FilterExpression: 'sk = :sk',
        ExpressionAttributeValues: { ':sk': sk }
      };

      const result = await this.docClient.send(new ScanCommand(params));
      return result.Items || [];
    } catch (error) {
      logger.error('[AllocationDAL] GetByMonth Error:', error);
      throw error;
    }
  }

  async getAllocations(month, filterBy = {}) {
    try {
      const sk = formatMonthYearKey(month);
      this.validateSortKey(sk);

      let params = {
        TableName: this.tableName,
        FilterExpression: 'sk = :sk',
        ExpressionAttributeValues: { ':sk': sk }
      };

      // Add charge filter if specified
      if (filterBy.charge !== undefined) {
        params.FilterExpression += ' AND charge = :charge';
        params.ExpressionAttributeValues[':charge'] = Number(filterBy.charge);
      }

      if (filterBy.type) {
        params.FilterExpression += ' AND #type = :type';
        params.ExpressionAttributeNames = { '#type': 'type' };
        params.ExpressionAttributeValues[':type'] = filterBy.type;
      }

      const result = await this.docClient.send(new ScanCommand(params));
      return result.Items || [];
    } catch (error) {
      logger.error('[AllocationDAL] GetAllocations Error:', error);
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
        FilterExpression: 'contains(pk, :cid) AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':cid': `${companyId}_${consumptionSiteId}`,
          ':from': fromSk,
          ':to': toSk
        }
      };

      const result = await this.docClient.send(new ScanCommand(params));
      return result.Items || [];
    } catch (error) {
      logger.error('[AllocationDAL] GetByConsumptionSite Error:', error);
      throw error;
    }
  }

  async getAllAllocations() {
    try {
      const result = await this.docClient.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'attribute_exists(sk)'
      }));
      return result.Items || [];
    } catch (error) {
      logger.error('[AllocationDAL] GetAllAllocations Error:', error);
      throw error;
    }
  }

  async getAllAllocatedUnits() {
    try {
      const result = await this.docClient.send(new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression: 'pk, sk, c1, c2, c3, c4, c5, charge',
        FilterExpression: 'attribute_exists(sk)'
      }));

      return (result.Items || []).map(item => ({
        ...item,
        c1: Number(item.c1 || 0),
        c2: Number(item.c2 || 0),
        c3: Number(item.c3 || 0),
        c4: Number(item.c4 || 0),
        c5: Number(item.c5 || 0),
        charge: Number(item.charge || 0)
      }));
    } catch (error) {
      logger.error('[AllocationDAL] GetAllAllocatedUnits Error:', error);
      throw error;
    }
  }

  async getChargingAllocation(month) {
    try {
      const allocations = await this.getAllocationsByMonth(month);
      return allocations.find(a => a.charge === 1) || null;
    } catch (error) {
      logger.error('[AllocationDAL] GetChargingAllocation Error:', error);
      throw error;
    }
  }
}

module.exports = AllocationDAL;
