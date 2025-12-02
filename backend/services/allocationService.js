const { PEAK_PERIODS, NON_PEAK_PERIODS, ALL_PERIODS } = require('../constants/periods');
const validationService = require('./validationService');
const allocationDAL = require('../allocation/allocationDAL');
const logger = require('../utils/logger');
const allocationCalculator = require('./allocationCalculatorService');
const notificationService = require('./notificationService');
const ValidationUtil = require('../utils/validation');
const { ValidationError, DatabaseError } = require('../utils/errors');
const bankingDAL = require('../banking/bankingDAL');
const lapseDAL = require('../lapse/lapseDAL');
const { ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = require('../utils/db');

class AllocationService {
    static instance = null;

    constructor() {
        this.allocationDAL = new allocationDAL();
        this.bankingDAL = bankingDAL;
        this.lapseDAL = lapseDAL;
        this.pendingTransactions = new Map();
        this.lockTimeout = 30000; // 30 seconds
    }

    static getInstance() {
        if (!AllocationService.instance) {
            AllocationService.instance = new AllocationService();
        }
        return AllocationService.instance;
    }

    async createAllocation(data) {
        const timer = logger.startTimer();
        let transactionId = null;

        try {
            // Normalize and validate data
            const validation = validationService.validateAllocation(data);
            if (!validation.isValid) {
                throw {
                    statusCode: 400,
                    message: 'Validation failed',
                    errors: validation.errors
                };
            }

            const normalizedData = validation.normalizedData;
            transactionId = this.generateTransactionId();

            // Try to acquire lock
            await this.acquireLock(normalizedData.productionSiteId, transactionId);

            // Create the allocation record
            const allocation = await this.allocationDAL.createAllocation(normalizedData);

            // If this is a banking allocation, update banking records
            if (normalizedData.type === 'BANKING') {
                await this.handleBankingCreation(normalizedData, transactionId);
            }

            // If this is a lapse allocation, create lapse record
            if (normalizedData.type === 'LAPSE') {
                await this.handleLapseCreation(normalizedData, transactionId);
            }

            // Notify clients
            await notificationService.emit('allocation.created', allocation);

            timer.end('Allocation Created', {
                allocationId: allocation.pk,
                transactionId
            });

            return allocation;

        } catch (error) {
            logger.error('[AllocationService] Create Error:', error);
            if (transactionId) {
                await this.rollbackTransaction(transactionId);
            }
            throw error;
        } finally {
            if (transactionId && data.productionSiteId) {
                await this.releaseLock(data.productionSiteId, transactionId);
            }
        }
    }

    async createBatchAllocation(allocations) {
        // Validate all allocations first
        const validations = allocations.map(allocation => 
            validationService.validateAllocation(allocation)
        );

        const invalidValidations = validations.filter(v => !v.isValid);
        if (invalidValidations.length > 0) {
            throw {
                statusCode: 400,
                message: 'Validation failed for some allocations',
                errors: invalidValidations.map(v => v.errors)
            };
        }

        const transactionId = this.generateTransactionId();

        try {
            // Create all allocations
            const results = await Promise.all(
                validations.map(async v => {
                    const allocation = await this.allocationDAL.createAllocation(v.normalizedData);
                    
                    // Handle banking/lapse records
                    if (v.normalizedData.type === 'BANKING') {
                        await this.handleBankingCreation(v.normalizedData, transactionId);
                    } else if (v.normalizedData.type === 'LAPSE') {
                        await this.handleLapseCreation(v.normalizedData, transactionId);
                    }

                    return allocation;
                })
            );

            // Notify for batch creation
            await notificationService.emit('allocation.batchCreated', results);

            return results;

        } catch (error) {
            logger.error('[AllocationService] Batch Create Error:', error);
            await this.rollbackTransaction(transactionId);
            throw error;
        }
    }

    async handleBankingCreation(bankingData, transactionId) {
        try {
            const total = this.calculateAllocationTotal(bankingData);
            await this.bankingDAL.create({
                siteId: bankingData.productionSiteId,
                amount: total,
                type: 'credit',
                date: new Date().toISOString(),
                transactionId,
                month: bankingData.month
            });
        } catch (error) {
            logger.error('[AllocationService] Banking Creation Error:', error);
            throw error;
        }
    }

    async handleLapseCreation(lapseData, transactionId) {
        try {
            const total = this.calculateAllocationTotal(lapseData);
            await this.lapseDAL.createLapse({
                ...lapseData,
                amount: total,
                transactionId
            });
        } catch (error) {
            logger.error('[AllocationService] Lapse Creation Error:', error);
            throw error;
        }
    }

    async updateAllocation(id, updateData) {
        const timer = logger.startTimer();
        let transactionId = null;

        try {
            // Validate update data
            ValidationUtil.validateId(id);
            ValidationUtil.validateAllocationData(updateData);

            // Get existing allocation
            const existingAllocation = await this.allocationDAL.get(id);
            if (!existingAllocation) {
                throw new ValidationError('Allocation not found');
            }

            // Generate transaction ID and acquire lock
            transactionId = this.generateTransactionId();
            await this.acquireLock(existingAllocation.productionSiteId, transactionId);

            // Recalculate allocation
            const calculationResult = allocationCalculator.calculateAllocation(
                updateData.productionAmount,
                updateData.consumptionAmount,
                { minThreshold: updateData.minThreshold }
            );

            // Handle banking changes
            if (calculationResult.productionRemainder !== existingAllocation.productionRemainder) {
                await this.handleBankingUpdate(
                    existingAllocation,
                    calculationResult,
                    transactionId
                );
            }

            // Validate charge if it's being updated
            if (updateData.charge !== undefined) {
                await this.validateAllocationCharge(existingAllocation.sk, existingAllocation.pk, updateData.charge);
            }

            // Update allocation record
            const updatedAllocation = await this.allocationDAL.update(id, {
                ...updateData,
                ...calculationResult,
                transactionId,
                charge: updateData.charge ? 1 : 0, // Store as 1/0 in database
                version: existingAllocation.version + 1
            });

            // Notify clients
            await notificationService.emit('allocation.updated', updatedAllocation);

            timer.end('Allocation Updated', {
                allocationId: id,
                transactionId
            });

            return updatedAllocation;

        } catch (error) {
            logger.error('Allocation Update Failed', {
                error: error.message,
                stack: error.stack,
                allocationId: id,
                transactionId
            });

            if (transactionId) {
                await this.rollbackTransaction(transactionId);
            }

            throw error;
        } finally {
            if (transactionId) {
                await this.releaseLock(updateData.productionSiteId, transactionId);
            }
        }
    }

    async deleteAllocation(id) {
        const timer = logger.startTimer();
        let transactionId = null;

        try {
            ValidationUtil.validateId(id);

            const allocation = await this.allocationDAL.get(id);
            if (!allocation) {
                throw new ValidationError('Allocation not found');
            }

            transactionId = this.generateTransactionId();
            await this.acquireLock(allocation.productionSiteId, transactionId);

            // Delete related records
            await Promise.all([
                this.bankingDAL.deleteByAllocationId(id),
                this.lapseDAL.deleteByAllocationId(id)
            ]);

            // Delete allocation
            await this.allocationDAL.delete(id);

            // Notify clients
            await notificationService.emit('allocation.deleted', { id, ...allocation });

            timer.end('Allocation Deleted', {
                allocationId: id,
                transactionId
            });

        } catch (error) {
            logger.error('Allocation Deletion Failed', {
                error: error.message,
                stack: error.stack,
                allocationId: id,
                transactionId
            });

            if (transactionId) {
                await this.rollbackTransaction(transactionId);
            }

            throw error;
        } finally {
            if (transactionId) {
                await this.releaseLock(allocation.productionSiteId, transactionId);
            }
        }
    }

    async handleBankingUpdate(existingAllocation, newCalculation, transactionId) {
        // Reverse previous banking if it exists
        if (existingAllocation.bankingDetails) {
            await this.bankingDAL.create({
                siteId: existingAllocation.productionSiteId,
                amount: -existingAllocation.bankingDetails.bankableAmount,
                type: 'debit',
                date: existingAllocation.date,
                transactionId,
                allocationId: existingAllocation.id
            });
        }

        // Create new banking record if needed
        if (newCalculation.bankingDetails?.bankableAmount > 0) {
            await this.bankingDAL.create({
                siteId: existingAllocation.productionSiteId,
                amount: newCalculation.bankingDetails.bankableAmount,
                type: 'credit',
                date: existingAllocation.date,
                transactionId,
                allocationId: existingAllocation.id
            });
        }
    }

    generateTransactionId() {
        return `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async acquireLock(resourceId, transactionId) {
        const lockKey = `lock:${resourceId}`;
        const currentLock = this.pendingTransactions.get(lockKey);

        if (currentLock && Date.now() - currentLock.timestamp < this.lockTimeout) {
            throw new Error('Resource is locked by another transaction');
        }

        this.pendingTransactions.set(lockKey, {
            transactionId,
            timestamp: Date.now()
        });
    }

    async releaseLock(resourceId, transactionId) {
        const lockKey = `lock:${resourceId}`;
        const currentLock = this.pendingTransactions.get(lockKey);

        if (currentLock && currentLock.transactionId === transactionId) {
            this.pendingTransactions.delete(lockKey);
        }
    }

    async rollbackTransaction(transactionId) {
        try {
            await Promise.all([
                this.allocationDAL.deleteByTransactionId(transactionId),
                this.bankingDAL.deleteByTransactionId(transactionId),
                this.lapseDAL.deleteByTransactionId(transactionId)
            ]);

            logger.info('Transaction Rolled Back', { transactionId });
        } catch (error) {
            logger.error('Transaction Rollback Failed', {
                error: error.message,
                transactionId
            });
            throw new DatabaseError('Failed to rollback transaction');
        }
    }

    calculateAllocationTotal(allocation) {
        if (!allocation?.allocated) return 0;
        const normalized = validationService.normalizeAllocatedValues(allocation.allocated);
        return ALL_PERIODS.reduce((sum, period) => sum + (normalized[period] || 0), 0);
    }

    calculatePeakTotal(allocation) {
        if (!allocation?.allocated) return 0;
        const normalized = validationService.normalizeAllocatedValues(allocation.allocated);
        return PEAK_PERIODS.reduce((sum, period) => sum + normalized[period], 0);
    }

    calculateNonPeakTotal(allocation) {
        if (!allocation?.allocated) return 0;
        const normalized = validationService.normalizeAllocatedValues(allocation.allocated);
        return NON_PEAK_PERIODS.reduce((sum, period) => sum + normalized[period], 0);
    }

    calculateAllocationSummary(allocations) {
        const summary = {
            total: 0,
            peak: 0,
            nonPeak: 0,
            regular: { count: 0, total: 0 },
            banking: { count: 0, total: 0 },
            lapse: { count: 0, total: 0 }
        };

        if (!Array.isArray(allocations)) return summary;

        allocations.forEach(allocation => {
            const total = this.calculateAllocationTotal(allocation);
            summary.total += total;
            summary.peak += this.calculatePeakTotal(allocation);
            summary.nonPeak += this.calculateNonPeakTotal(allocation);

            switch (allocation.type?.toUpperCase()) {
                case 'BANKING':
                    summary.banking.total += total;
                    summary.banking.count++;
                    break;
                case 'LAPSE':
                    summary.lapse.total += total;
                    summary.lapse.count++;
                    break;
                default:
                    summary.regular.total += total;
                    summary.regular.count++;
            }
        });

        return summary;
    }

    /**
     * Fetch allocations by month and optional type filter.
     * @param {string} month - The month for which to fetch allocations
     * @param {string} type - Optional type filter (e.g., 'BANKING', 'LAPSE')
     * @param {Object} options - Additional options for filtering
     * @param {boolean} options.charge - If specified, filter by charge status
     */
    async getAllocations(month, type, options = {}) {
        try {
            const filterBy = {};
            if (type) {
                filterBy.type = type;
            }
            
            // Add charge filter if specified
            if (options.charge !== undefined) {
                filterBy.charge = options.charge ? 1 : 0;
            }
            
            const allocations = await this.allocationDAL.getAllocations(month, filterBy);
            
            // Transform charge values to boolean for consistency
            return allocations.map(allocation => ({
                ...allocation,
                charge: allocation.charge === 1 || allocation.charge === true,
                allocated: allocation.allocated ? {
                    ...allocation.allocated,
                    charge: allocation.allocated.charge === 1 || allocation.allocated.charge === true
                } : undefined
            }));
        } catch (error) {
            logger.error('[AllocationService] GetAllocations Error:', error);
            throw error;
        }
    }

    /**
     * Validate that only one allocation can be charged per month
     * @param {string} month - The month in MMYYYY format
     * @param {string} pk - The primary key of the current allocation
     * @param {boolean} currentCharge - Whether the current allocation should be charged
     * @returns {Promise<boolean>} - Returns true if validation passes
     */
    async validateAllocationCharge(month, pk, currentCharge) {
        try {
            // If not setting charge to true, no need to validate
            if (!currentCharge) {
                return true;
            }
            
            // Check if any other allocation in the same month has charge=true
            const existingChargedAllocations = await this.allocationDAL.getAllocations(month, { charge: 1 });
            const existingCharged = existingChargedAllocations.find(a => a.pk !== pk);
            
            if (existingCharged) {
                throw new Error('Only one allocation can be marked as chargeable per month');
            }
            
            return true;
        } catch (error) {
            logger.error('[AllocationService] Error validating allocation charge:', error);
            throw error;
        }
    }

    /**
     * Clean up allocations for a production or consumption site
     * @param {string} companyId - The company ID
     * @param {Object} options - Options for cleanup
     * @param {string} [options.productionSiteId] - The production site ID to clean up allocations for
     * @param {string} [options.consumptionSiteId] - The consumption site ID to clean up allocations for
     * @returns {Promise<Object>} - The cleanup statistics
     */
    async cleanupSiteAllocations(companyId, { productionSiteId, consumptionSiteId } = {}) {
        if (!companyId) {
            throw new Error('Company ID is required');
        }

        if (!productionSiteId && !consumptionSiteId) {
            throw new Error('Either productionSiteId or consumptionSiteId must be provided');
        }

        try {
            // Build filter expression based on what IDs we have
            let filterExpression = 'contains(pk, :companyId)';
            let expressionAttributeValues = {
                ':companyId': `${companyId}_`
            };

            // Add filters for production site ID and/or consumption site ID
            if (productionSiteId && consumptionSiteId) {
                // Both IDs provided - find allocations where either matches
                filterExpression += ' AND (contains(pk, :prodId) OR contains(pk, :consId))';
                expressionAttributeValues[':prodId'] = `_${productionSiteId}_`;
                expressionAttributeValues[':consId'] = `_${consumptionSiteId}`;
            } else if (productionSiteId) {
                // Production site only - find allocations where production site ID matches
                filterExpression += ' AND contains(pk, :prodId)';
                expressionAttributeValues[':prodId'] = `_${productionSiteId}_`;
            } else {
                // Consumption site only - find allocations where consumption site ID matches
                filterExpression += ' AND contains(pk, :consId)';
                expressionAttributeValues[':consId'] = `_${consumptionSiteId}`;
            }

            // Find all matching allocations
            const params = {
                TableName: this.allocationDAL.tableName,
                FilterExpression: filterExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ProjectionExpression: 'pk, sk'
            };

            const { Items: allocations = [] } = await docClient.send(new ScanCommand(params));
            
            // Additional validation to ensure exact matching of the site IDs
            let filteredAllocations = allocations;
            if (productionSiteId || consumptionSiteId) {
                filteredAllocations = allocations.filter(item => {
                    const pkParts = item.pk.split('_');
                    if (pkParts.length !== 3) return false;
                    
                    const [pkCompanyId, pkProductionSiteId, pkConsumptionSiteId] = pkParts;
                    
                    // Must match company ID
                    if (pkCompanyId !== companyId) return false;
                    
                    // If production site ID is provided, it must match
                    if (productionSiteId && pkProductionSiteId !== productionSiteId) return false;
                    
                    // If consumption site ID is provided, it must match
                    if (consumptionSiteId && pkConsumptionSiteId !== consumptionSiteId) return false;
                    
                    return true;
                });
            }
            
            if (filteredAllocations.length === 0) {
                return { deletedCount: 0 };
            }

            // Delete allocations in batches
            const BATCH_SIZE = 25;
            for (let i = 0; i < filteredAllocations.length; i += BATCH_SIZE) {
                const batch = filteredAllocations.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(item =>
                    this.allocationDAL.docClient.send(new DeleteCommand({
                        TableName: this.allocationDAL.tableName,
                        Key: {
                            pk: item.pk,
                            sk: item.sk
                        }
                    }))
                ));
            }

            logger.info(`Deleted ${filteredAllocations.length} allocations`, {
                companyId,
                productionSiteId,
                consumptionSiteId,
                totalFound: allocations.length,
                actuallyDeleted: filteredAllocations.length,
                matchingLogic: productionSiteId && consumptionSiteId ? 'OR logic (either matches)' : 
                              productionSiteId ? 'Production site match' : 'Consumption site match'
            });

            return { deletedCount: filteredAllocations.length };

        } catch (error) {
            logger.error('Error cleaning up site allocations:', error, {
                companyId,
                productionSiteId,
                consumptionSiteId
            });
            throw error;
        }
    }
}

module.exports = AllocationService.getInstance();