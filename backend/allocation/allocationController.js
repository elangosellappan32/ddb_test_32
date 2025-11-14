const AllocationDAL = require('./allocationDAL');
const bankingDAL = require('../banking/bankingDAL');
const lapseService = require('../services/lapseService');
const AuthDAL = require('../auth/authDal');
const logger = require('../utils/logger');
const { ALL_PERIODS } = require('../constants/periods');
const ValidationError = require('../utils/errors').ValidationError;
const productionSiteDAL = require('../productionSite/productionSiteDAL');
const docClient = require('../utils/db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');

const allocationDAL = new AllocationDAL();
const authDAL = new AuthDAL();

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

        // Get company ID from authenticated user with multiple fallbacks
        let userCompanyId = req.user?.companyId;
        
        // Fallback 1: Try to get from metadata
        if (!userCompanyId) {
            userCompanyId = req.user?.metadata?.companyId;
        }
        
        // Fallback 2: Try to get from metadata.accessibleSites
        if (!userCompanyId && req.user?.metadata?.accessibleSites?.companyId) {
            userCompanyId = req.user.metadata.accessibleSites.companyId;
        }
        
        // Fallback 3: Try to get from companyIds array (first one)
        if (!userCompanyId && Array.isArray(req.user?.companyIds) && req.user.companyIds.length > 0) {
            userCompanyId = req.user.companyIds[0];
        }
        
        // Log company ID extraction for debugging
        logger.info('Company ID extraction for user:', {
            userId: req.user?.userId,
            directCompanyId: req.user?.companyId,
            directCompanyIdType: typeof req.user?.companyId,
            metadataCompanyId: req.user?.metadata?.companyId,
            metadataCompanyIdType: typeof req.user?.metadata?.companyId,
            accessibleSitesCompanyId: req.user?.metadata?.accessibleSites?.companyId,
            accessibleSitesCompanyIdType: typeof req.user?.metadata?.accessibleSites?.companyId,
            companyIds: req.user?.companyIds,
            extractedCompanyId: userCompanyId,
            extractedCompanyIdType: typeof userCompanyId,
            userKeys: req.user ? Object.keys(req.user) : [],
            allocationCount: allocations.length
        });
        
        if (!userCompanyId) {
            logger.error('No company ID found in user session - detailed info:', { 
                userId: req.user?.userId,
                userName: req.user?.username,
                userRole: req.user?.role,
                userObject: JSON.stringify(req.user, null, 2),
                requestPath: req.path,
                requestMethod: req.method
            });
            return res.status(403).json({ 
                success: false, 
                message: 'User company information not found',
                debug: {
                    userId: req.user?.userId,
                    directCompanyId: req.user?.companyId,
                    availableKeys: req.user ? Object.keys(req.user) : []
                }
            });
        }
        
        // Ensure companyId is converted to string for consistency
        userCompanyId = String(userCompanyId);
        logger.info('Company ID set to:', { userCompanyId, type: typeof userCompanyId });

        const results = [];
        let effectiveCompanyId; // Declare here so it's accessible in all catch blocks
        let productionSiteId;
        let consumptionSiteId;
        let month;
        
        // Process each allocation sequentially to properly handle lapse and banking units
        for (const alloc of allocations) {
            try {
                if (!alloc.pk || !alloc.sk) {
                    throw new ValidationError('Invalid allocation: missing pk or sk');
                }

                const [pkCompanyId, pSiteId, cSiteId] = alloc.pk.split('_');
                productionSiteId = pSiteId;
                consumptionSiteId = cSiteId;
                month = alloc.sk;
                
                // Log the allocation being processed
                logger.info(`Processing allocation`, {
                    pk: alloc.pk,
                    sk: alloc.sk,
                    pkCompanyId,
                    productionSiteId,
                    consumptionSiteId,
                    month,
                    userCompanyId,
                    userId: req.user?.userId,
                    allocationMetadata: alloc._allocationMetadata,
                    changedPeriods: alloc._changedPeriods
                });
                
                if (!productionSiteId) {
                    throw new ValidationError('Missing production site ID in allocation PK');
                }
                
                // Use the company ID from the PK, which was set by the frontend based on production site ownership
                effectiveCompanyId = pkCompanyId;
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
                        bankingRecord = await bankingDAL.getBanking(`${effectiveCompanyId}_${productionSiteId}`, month);
                    } catch (error) {
                        logger.info('No existing banking record found, will create if needed', {
                            companyId: effectiveCompanyId,
                            productionSiteId,
                            month
                        });
                    }
                }

                // Fetch existing lapse record
                const lapseRecords = await lapseService.getLapsesByProductionSite(productionSiteId, month, month, effectiveCompanyId);
                if (lapseRecords?.length) {
                    existingLapse = lapseRecords[0];
                }

                // Create or update the allocation
                const merged = existingAlloc
                    ? { ...existingAlloc, ...alloc, updatedat: new Date().toISOString() }
                    : { ...alloc, createdat: new Date().toISOString(), updatedat: new Date().toISOString() };
                
                // Track which periods were actually changed (not just sent as 0)
                const changedPeriods = [];
                let hasChanges = false;
                
                for (const period of ALL_PERIODS) {
                    const oldVal = Number(existingAlloc?.[period] || 0);
                    const newVal = Number(alloc[period] || 0);
                    
                    if (oldVal !== newVal) {
                        hasChanges = true;
                        changedPeriods.push(period);
                        logger.debug(`[AllocationController] Period ${period} changed: ${oldVal} -> ${newVal}`);
                    }
                }

                let result;
                if (hasChanges) {
                    result = await allocationDAL.putItem(merged);
                    logger.info(`[AllocationController] Updated allocation`, {
                        pk: alloc.pk,
                        sk: alloc.sk,
                        changedPeriods,
                        changeCount: changedPeriods.length
                    });
                } else {
                    // Return the existing record as is if no changes
                    result = existingAlloc || merged;
                    result.unchanged = true; // Flag to indicate no changes were made
                    logger.debug(`[AllocationController] No changes for allocation`, {
                        pk: alloc.pk,
                        sk: alloc.sk
                    });
                }
                results.push(result);

                // Handle each period's changes - only process periods that actually changed
                for (const period of changedPeriods) {
                    const oldVal = Number(existingAlloc?.[period] || 0);
                    const newVal = Number(alloc[period] || 0);
                    const delta = newVal - oldVal;
                    
                    logger.debug(`[AllocationController] Processing period ${period}`, {
                        oldVal,
                        newVal,
                        delta,
                        bankingEnabled
                    });

                    if (bankingEnabled) {
                        // Handle banking site logic
                        if (!bankingRecord) {
                            // Ensure the allocation PK uses the effective company ID
                            const pkParts = alloc.pk.split('_');
                            if (pkParts[0] !== effectiveCompanyId) {
                                pkParts[0] = effectiveCompanyId;
                                alloc.pk = pkParts.join('_');
                                logger.info(`Updated allocation PK to use effective company ID`, {
                                    oldPk: alloc.pk,
                                    newPk: alloc.pk,
                                    effectiveCompanyId
                                });
                            }
                            // Create new banking record if it doesn't exist
                            bankingRecord = {
                                pk: `${effectiveCompanyId}_${productionSiteId}`,
                                sk: month,
                                companyId: effectiveCompanyId,
                                productionSiteId,
                                month,
                                siteName: site.siteName || `${effectiveCompanyId}_${productionSiteId}`,
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
                                logger.info(`Created new banking record`, {
                                    pk: bankingRecord.pk,
                                    sk: bankingRecord.sk,
                                    companyId: effectiveCompanyId,
                                    productionSiteId
                                });
                            } catch (error) {
                                logger.error('Error creating banking record', {
                                    error: error.message,
                                    companyId: effectiveCompanyId,
                                    productionSiteId,
                                    month
                                });
                                throw error;
                            }
                        }

                        // Update banking record with delta
                        const currentBanking = Number(bankingRecord[period] || 0);
                        bankingRecord[period] = currentBanking + delta;
                        bankingRecord.updatedat = new Date().toISOString();

                        // Save updated banking record
                        try {
                            await bankingDAL.putItem(bankingRecord);
                            logger.debug(`Updated banking record`, {
                                pk: bankingRecord.pk,
                                sk: bankingRecord.sk,
                                period,
                                delta,
                                newValue: bankingRecord[period]
                            });
                        } catch (error) {
                            logger.error('Error updating banking record', {
                                error: error.message,
                                companyId: effectiveCompanyId,
                                productionSiteId,
                                month,
                                period
                            });
                            throw error;
                        }
                    } else {
                        // Handle non-banking (lapse) logic
                        const lapsePk = `${effectiveCompanyId}_${productionSiteId}`;
                        const lapseUpdates = existingLapse?.allocated || {};
                        
                        // Only update the periods that are being changed
                        if (delta > 0) {
                            lapseUpdates[period] = (Number(lapseUpdates[period]) || 0) + delta;
                            
                            if (!existingLapse) {
                                // Create new lapse record if it doesn't exist
                                await lapseService.create({
                                    companyId: effectiveCompanyId,
                                    productionSiteId,
                                    month,
                                    allocated: { [period]: delta },
                                    siteName: site.siteName || `${effectiveCompanyId}_${productionSiteId}`
                                });
                            } else {
                                // Update existing lapse record
                                await lapseService.update(lapsePk, month, { 
                                    allocated: lapseUpdates,
                                    updatedat: new Date().toISOString()
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('Error processing allocation', {
                    error: error.message,
                    companyId: effectiveCompanyId,
                    productionSiteId,
                    month,
                    stack: error.stack
                });
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