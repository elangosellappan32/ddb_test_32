const AllocationDAL = require('./allocationDAL');
const bankingDAL = require('../banking/bankingDAL');
const lapseService = require('../services/lapseService');
const logger = require('../utils/logger');
const { ALL_PERIODS } = require('../constants/periods');
const ValidationError = require('../utils/errors').ValidationError;
const productionSiteDAL = require('../productionSite/productionSiteDAL');
const docClient = require('../utils/db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

const allocationDAL = new AllocationDAL();

// Transform allocation/banking/lapse record to group c1-c5 under allocated
function transformAllocationRecord(record) {
  if (!record) return record;
  const { c1, c2, c3, c4, c5, ...rest } = record;
  return {
    ...rest,
    allocated: { c1, c2, c3, c4, c5 }
  };
}

const createAllocation = async (req, res, next) => {
    try {
        const allocations = req.validatedAllocations || [];
        if (!allocations.length) {
            return res.status(400).json({ success: false, message: 'No allocations provided' });
        }

        const results = [];
        
        // Process each allocation sequentially to properly handle lapse and banking units
        for (const alloc of allocations) {
            try {
                if (!alloc.pk || !alloc.sk) {
                    throw new ValidationError('Invalid allocation: missing pk or sk');
                }

                const [companyId, productionSiteId, consumptionSiteId] = alloc.pk.split('_');
                const month = alloc.sk;
                
                // Log the allocation being processed
                console.log(`Processing allocation:`, {
                    pk: alloc.pk,
                    sk: alloc.sk,
                    companyId,
                    productionSiteId,
                    consumptionSiteId,
                    month,
                    alloc
                });
                
                if (!companyId) {
                    throw new ValidationError('Missing company ID in allocation PK');
                }
                
                if (!productionSiteId) {
                    throw new ValidationError('Missing production site ID in allocation PK');
                }
                
                // Get the company ID from the allocation data if available, otherwise use from URL
                const effectiveCompanyId = alloc.companyId || companyId;
                console.log(`Looking up production site ${productionSiteId} for company ${effectiveCompanyId}`);
                
                // Try to find the production site using the exact ID from the PK
                let site = null;
                try {
                    // First try with the effective company ID
                    site = await productionSiteDAL.getItem(effectiveCompanyId, productionSiteId);
                    
                    if (!site) {
                        console.log('Site not found with company ID, trying with productionSiteId only');
                        // Try alternative lookup by productionSiteId only if not found
                        const { Items: sites } = await docClient.send(new ScanCommand({
                            TableName: 'ProductionSiteTable',
                            FilterExpression: 'productionSiteId = :productionSiteId',
                            ExpressionAttributeValues: {
                                ':productionSiteId': productionSiteId
                            },
                            Limit: 1
                        }));
                        
                        site = sites && sites.length > 0 ? sites[0] : null;
                    }
                } catch (error) {
                    console.error('Error fetching production site:', error);
                    throw new Error(`Error looking up production site: ${error.message}`);
                }
                
                // If site not found, provide helpful error message
                if (!site) {
                    const { Items: allSites = [] } = await docClient.send(new ScanCommand({
                        TableName: 'ProductionSiteTable',
                        Limit: 20 // Limit to prevent too much data
                    }));
                    
                    const availableSites = allSites.map(s => ({
                        name: s.siteName || s.name || 'Unnamed',
                        id: s.productionSiteId || s.id,
                        companyId: s.companyId,
                        pk: s.pk
                    }));
                    
                    throw new ValidationError(
                        `Production site not found. Requested: ${productionSiteId} (Company: ${effectiveCompanyId}). ` +
                        `Available production sites (${availableSites.length}): ${availableSites.map(s => 
                            `${s.name} (ID: ${s.id}, Company: ${s.companyId})`
                        ).join('; ')}`
                    );
                }
                
                // Process the allocation with the found site
                const bankingEnabled = Number(site.banking || 0) === 1;
                const type = alloc.type?.toUpperCase() || 'ALLOCATION';

                // Get existing records
                const existingAlloc = await allocationDAL.getItem({ pk: alloc.pk, sk: alloc.sk });
                let bankingRecord = null;
                let existingLapse = null;

                // Fetch banking record if banking is enabled
                if (bankingEnabled) {
                    try {
                        bankingRecord = await bankingDAL.getBanking(`${companyId}_${productionSiteId}`, month);
                    } catch (error) {
                        console.log('No existing banking record found, will create if needed');
                    }
                }

                // Fetch existing lapse record
                const lapseRecords = await lapseService.getLapsesByProductionSite(productionSiteId, month, month, companyId);
                if (lapseRecords?.length) {
                    existingLapse = lapseRecords[0];
                }

                // Create or update the allocation
                const merged = existingAlloc
                    ? { ...existingAlloc, ...alloc, updatedat: new Date().toISOString() }
                    : { ...alloc, createdat: new Date().toISOString(), updatedat: new Date().toISOString() };
                
                // Only update if there are actual changes
                const hasChanges = ALL_PERIODS.some(period => {
                    const oldVal = Number(existingAlloc?.[period] || 0);
                    const newVal = Number(alloc[period] || 0);
                    return oldVal !== newVal;
                });

                let result;
                if (hasChanges) {
                    result = await allocationDAL.putItem(merged);
                } else {
                    // Return the existing record as is if no changes
                    result = existingAlloc || merged;
                    result.unchanged = true; // Flag to indicate no changes were made
                }
                results.push(result);

                // Handle each period's changes
                for (const period of ALL_PERIODS) {
                    const oldVal = Number(existingAlloc?.[period] || 0);
                    const newVal = Number(alloc[period] || 0);
                    const delta = newVal - oldVal;
                    
                    if (delta === 0) continue;

                    if (bankingEnabled) {
                        // Handle banking site logic
                        if (!bankingRecord) {
                            // Create new banking record if it doesn't exist
                            bankingRecord = {
                                pk: `${companyId}_${productionSiteId}`,
                                sk: month,
                                companyId,
                                productionSiteId,
                                month,
                                siteName: site.siteName || `${companyId}_${productionSiteId}`,
                                type: 'BANKING',
                                status: 'active',
                                createdat: new Date().toISOString(),
                                updatedat: new Date().toISOString()
                            };
                            
                            // Initialize all periods to 0
                            ALL_PERIODS.forEach(p => {
                                bankingRecord[p] = 0;
                            });
                            
                            // Save the new banking record
                            try {
                                await bankingDAL.putItem(bankingRecord);
                                logger.info(`Created new banking record for ${bankingRecord.pk} ${bankingRecord.sk}`);
                            } catch (error) {
                                logger.error('Failed to create banking record:', error);
                                throw error;
                            }
                        }

                        // Update banking record
                        bankingRecord[period] = (Number(bankingRecord[period]) || 0) + delta;
                        bankingRecord.updatedat = new Date().toISOString();
                        await bankingDAL.putItem(bankingRecord);
                    } else {
                        // Handle non-banking (lapse) logic
                        const lapsePk = `${companyId}_${productionSiteId}`;
                        const lapseUpdates = existingLapse?.allocated || {};
                        
                        // Only update the periods that are being changed
                        if (delta > 0) {
                            lapseUpdates[period] = (Number(lapseUpdates[period]) || 0) + delta;
                        }

                        if (existingLapse) {
                            await lapseService.update(lapsePk, month, { 
                                allocated: lapseUpdates,
                                updatedat: new Date().toISOString()
                            });
                        } else {
                            await lapseService.create({
                                companyId,
                                productionSiteId,
                                month,
                                allocated: lapseUpdates,
                                createdat: new Date().toISOString(),
                                updatedat: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing allocation:', error);
                throw error; // Re-throw to be caught by the outer catch
            }
        }

        return res.status(201).json({ success: true, data: results });
    } catch (error) {
        logger.error('[AllocationController] Create Error:', error);
        next(error);
    }
};

// Calculate total allocation across all periods
const calculateTotal = (allocation) => {
    return ALL_PERIODS.reduce((sum, key) => sum + (Number(allocation[key]) || 0), 0);
};

// Get allocations for a specific month
const getAllocations = async (req, res, next) => {
    try {
        const { month } = req.params;
        if (!month) {
            throw new ValidationError('Month parameter is required');
        }
        const allocations = await allocationDAL.getAllocations(month);
        // fetch banking and lapse records for this month
        const allBanking = await bankingDAL.getAllBanking();
        const banking = allBanking.filter(item => item.sk === month);
        const lapseRecords = await lapseService.getLapsesByMonth(month);
        res.json({
            success: true,
            data: allocations.map(transformAllocationRecord),
            banking: banking.map(transformAllocationRecord),
            lapse: lapseRecords.map(transformAllocationRecord)
        });
    } catch (error) {
        logger.error('Error getting allocations:', error);
        next(error);
    }
};

// Get all allocations (no month filter, for report page)
const getAllAllocations = async (req, res, next) => {
    try {
        const allocations = await allocationDAL.getAllAllocations();
        res.json({ success: true, data: allocations });
    } catch (error) {
        logger.error('Error getting all allocations:', error);
        next(error);
    }
};

// Update an existing allocation
const updateAllocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        if (!id) {
            throw new ValidationError('Allocation ID is required');
        }
        
        const updated = await allocationDAL.updateItem(id, updates);
        res.json({ success: true, data: updated });
    } catch (error) {
        logger.error('Error updating allocation:', error);
        next(error);
    }
};

// Delete an allocation
const deleteAllocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            throw new ValidationError('Allocation ID is required');
        }
        
        await allocationDAL.deleteItem(id);
        res.json({ success: true, message: 'Allocation deleted successfully' });
    } catch (error) {
        logger.error('Error deleting allocation:', error);
        next(error);
    }
};

// Transform FormVB data by grouping c1-c5 and additional fields
const transformFormVBData = (data) => {
    if (!data) return null;
    
    const { c1, c2, c3, c4, c5, ...rest } = data;
    return {
        ...rest,
        allocated: { c1, c2, c3, c4, c5 }
    };
};

// FormVB related functions
const getFormVBData = async (req, res, next) => {
    try {
        const { month } = req.params;
        if (!month) {
            throw new ValidationError('Month parameter is required');
        }
        
        // Get allocations for the month
        const allocations = await allocationDAL.getAllocations(month);
        
        // Transform the data
        const transformed = allocations.map(transformFormVBData);
        
        res.json({
            success: true,
            data: transformed
        });
    } catch (error) {
        logger.error('Error getting FormVB data:', error);
        next(error);
    }
};

// Update FormVB site data
const updateFormVBSite = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        if (!id) {
            throw new ValidationError('Site ID is required');
        }
        
        // Update the site data
        const updated = await allocationDAL.updateItem(id, updates);
        
        res.json({
            success: true,
            data: updated
        });
    } catch (error) {
        logger.error('Error updating FormVB site:', error);
        next(error);
    }
};

// Get charging allocation
const getChargingAllocation = async (req, res, next) => {
    try {
        const { month } = req.params;
        if (!month) {
            throw new ValidationError('Month parameter is required');
        }
        
        // Get charging allocations for the month
        const allocations = await allocationDAL.getChargingAllocations(month);
        
        res.json({
            success: true,
            data: allocations
        });
    } catch (error) {
        logger.error('Error getting charging allocations:', error);
        next(error);
    }
};

// Get filtered allocations
const getFilteredAllocations = async (req, res, next) => {
    try {
        const { startDate, endDate, siteType, status } = req.query;
        
        // Build filter object
        const filters = {};
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (siteType) filters.siteType = siteType;
        if (status) filters.status = status;
        
        // Get filtered allocations
        const allocations = await allocationDAL.getFilteredAllocations(filters);
        
        res.json({
            success: true,
            data: allocations
        });
    } catch (error) {
        logger.error('Error getting filtered allocations:', error);
        next(error);
    }
};

// Export all controller functions
module.exports = {
    createAllocation,
    getAllocations,
    getAllAllocations,
    updateAllocation,
    deleteAllocation,
    transformAllocationRecord,
    transformFormVBData,
    getFormVBData,
    updateFormVBSite,
    getChargingAllocation,
    getFilteredAllocations,
    calculateTotal
};