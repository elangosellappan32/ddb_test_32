const AllocationDAL = require('./allocationDAL');
const bankingDAL = require('../banking/bankingDAL');
const lapseService = require('../services/lapseService');
const logger = require('../utils/logger');
const { ALL_PERIODS } = require('../constants/periods');
const ValidationError = require('../utils/errors').ValidationError;
const productionSiteDAL = require('../productionSite/productionSiteDAL');

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
            if (!alloc.pk || !alloc.sk) {
                throw new ValidationError('Invalid allocation: missing pk or sk');
            }

            const [companyId, productionSiteId, consumptionSiteId] = alloc.pk.split('_');
            const month = alloc.sk;
            
            // Check if site exists
            const site = await productionSiteDAL.getItem(companyId, productionSiteId);
            if (!site) {
                throw new ValidationError(`Production site not found: ${productionSiteId}`);
            }
            
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
                } catch {
                    // Banking record doesn't exist yet
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
                            siteName: alloc.siteName || `${companyId}_${productionSiteId}`,
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
        }

        return res.status(201).json({ success: true, data: results });
    } catch (error) {
        logger.error('[AllocationController] Create Error:', error);
        next(error);
    }
};

const calculateTotal = (allocation) => {
    return ALL_PERIODS.reduce((sum, key) => sum + (Number(allocation[key]) || 0), 0);
};

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
        logger.error('[AllocationController] GetAllocations Error:', error);
        next(error);
    }
};

// Get all allocations (no month filter, for report page)
const getAllAllocations = async (req, res, next) => {
    try {
        // Fetch all allocations from the DB (no filter)
        const allocations = await allocationDAL.scanAll();
        res.json({
            success: true,
            data: allocations.map(transformAllocationRecord)
        });
    } catch (error) {
        logger.error('[AllocationController] getAllAllocations Error:', error);
        next(error);
    }
};

const updateAllocation = async (req, res, next) => {
    try {
        const { pk, sk } = req.params;
        const allocations = req.validatedAllocations || [];
        const alloc = allocations[0];
        if (!alloc) {
            return res.status(400).json({ success: false, message: 'No allocation provided' });
        }

        const [companyId, productionSiteId, consumptionSiteId] = pk.split('_');
        const month = sk;

        // Get site and check banking status
        const site = await productionSiteDAL.getItem(companyId, productionSiteId);
        if (!site) {
            return res.status(404).json({ success: false, message: 'Production site not found' });
        }
        const bankingEnabled = Number(site.banking || 0) === 1;

        // Get existing allocation and records
        const existing = await allocationDAL.getItem({ pk, sk });
        let bankingRecord = null;
        let existingLapse = null;

        // Initialize or get banking record if banking is enabled
        if (bankingEnabled) {
            try {
                bankingRecord = await bankingDAL.getBanking(`${companyId}_${productionSiteId}`, month);
            } catch {
                // Create new banking record if it doesn't exist
                bankingRecord = {
                    pk: `${companyId}_${productionSiteId}`,
                    sk: month,
                    companyId,
                    productionSiteId,
                    month,
                    createdat: new Date().toISOString(),
                    updatedat: new Date().toISOString()
                };
                // Initialize all periods to 0
                ALL_PERIODS.forEach(p => { bankingRecord[p] = 0; });
            }
        }

        // Get or initialize lapse record
        const lapseRecords = await lapseService.getLapsesByProductionSite(productionSiteId, month, month, companyId);
        existingLapse = lapseRecords?.[0] || null;
        const currentLapse = existingLapse?.allocated || {};

        // Create or update the allocation, preserving existing values for unchanged fields
        const merged = existing
            ? { 
                ...existing, 
                ...Object.fromEntries(
                    Object.entries(alloc).filter(([_, v]) => v !== undefined && v !== null)
                ),
                updatedat: new Date().toISOString() 
            }
            : { 
                ...alloc, 
                createdat: new Date().toISOString(), 
                updatedat: new Date().toISOString() 
            };
        
        const result = await allocationDAL.putItem(merged);

        // Handle each period's changes
        for (const period of ALL_PERIODS) {
            const oldVal = Number(existing?.[period] || 0);
            const newVal = Number(alloc[period] || 0);
            const delta = newVal - oldVal;
            
            if (delta === 0) continue; // Skip if no change

            if (bankingEnabled) {
                // Update banking record with the delta
                if (delta > 0) {
                    // Consumption increased: Add to banking
                    bankingRecord[period] = (Number(bankingRecord[period]) || 0) + delta;
                    bankingRecord.updatedat = new Date().toISOString();
                    await bankingDAL.putItem(bankingRecord);
                } else {
                    // Consumption decreased: Reduce banking
                    const freed = -delta;
                    const bankOld = Number(bankingRecord?.[period] || 0);
                    bankingRecord[period] = Math.max(0, bankOld - freed);
                    bankingRecord.updatedat = new Date().toISOString();
                    await bankingDAL.putItem(bankingRecord);
                }
            } else {
                // Non-banking site: Update lapse record
                const lapsePk = `${companyId}_${productionSiteId}`;
                const updatedLapse = { ...currentLapse };
                
                // Update only the changed period
                updatedLapse[period] = Math.max(0, (Number(updatedLapse[period]) || 0) + delta);
                
                if (existingLapse) {
                    await lapseService.update(lapsePk, month, {
                        allocated: updatedLapse,
                        updatedat: new Date().toISOString()
                    });
                } else {
                    await lapseService.create({
                        companyId,
                        productionSiteId,
                        month,
                        allocated: updatedLapse,
                        createdat: new Date().toISOString(),
                        updatedat: new Date().toISOString()
                    });
                }
            }
        }

        return res.json({ success: true, data: result });
    } catch (error) {
        logger.error('[AllocationController] Update Error:', error);
        next(error);
    }
};

const deleteAllocation = async (pk, sk) => {
    try {
        await allocationDAL.deleteAllocation(pk, sk);
    } catch (error) {
        logger.error('[AllocationController] Delete Error:', error);
        throw error;
    }
};

// Transform FormVB data by grouping c1-c5 and additional fields
function transformFormVBData(data) {
    const baseData = {
        title: 'FORMAT V-B',
        financialYear: data.financialYear || '',
        siteMetrics: []
    };

    if (!data.consumptionSites || !Array.isArray(data.consumptionSites)) {
        return baseData;
    }

    baseData.siteMetrics = data.consumptionSites.map(site => {
        const siteGeneration = Number(site.generation || 0);
        const siteAuxiliary = Number(site.auxiliaryConsumption || site.auxiliary || 0);
        const siteNetGeneration = siteGeneration - siteAuxiliary;
        const verificationCriteria = siteNetGeneration * 0.51;
        
        // Get site name from the most reliable source first
        const siteName = site.name || site.siteName || 'Unnamed Site';
        
        // Get equity shares from the most reliable source
        const equityShares = site.equityShares || 
                            (site.shares ? (site.shares.certificates || 0) : 0);
        
        // Get allocation percentage from the most reliable source
        let allocationPercentage = 0;
        if (site.allocationPercentage) {
            allocationPercentage = Number(site.allocationPercentage);
        } else if (site.shares?.ownership) {
            allocationPercentage = Number(site.shares.ownership.replace('%', '')) || 0;
        }
        
        return {
            siteName: siteName,
            equityShares: equityShares,
            allocationPercentage: allocationPercentage,
            annualGeneration: siteGeneration,
            auxiliaryConsumption: siteAuxiliary,
            verificationCriteria: verificationCriteria,
            permittedConsumption: {
                withZero: verificationCriteria,
                minus10: verificationCriteria * 0.9,
                plus10: verificationCriteria * 1.1
            },
            actualConsumption: Number(site.actualConsumption || site.actual || 0),
            normsCompliance: site.normsCompliance !== undefined ? 
                           site.normsCompliance : 
                           (site.norms === 'Yes')
        };
    });

    return baseData;
}

// FormVB related functions
const getFormVBData = async (req, res, next) => {
    try {
        const { financialYear } = req.params;
        if (!financialYear) {
            return res.status(400).json({
                success: false,
                message: 'Financial year is required'
            });
        }

        const allocations = await allocationDAL.getAllAllocatedUnits();
        const consumptionSites = await consumptionSiteDAL.getAllConsumptionSites();
        
        const formVBData = transformFormVBData({
            financialYear,
            consumptionSites: consumptionSites.map(site => {
                const siteAllocations = allocations.filter(a => a.consumptionSiteId === site.consumptionSiteId);
                return {
                    ...site,
                    generation: siteAllocations.reduce((sum, a) => sum + calculateTotal(a), 0),
                    auxiliary: site.auxiliaryConsumption || 0
                };
            })
        });

        res.json({
            success: true,
            data: formVBData
        });
    } catch (error) {
        logger.error('[AllocationController] GetFormVBData Error:', error);
        next(error);
    }
};

const updateFormVBSite = async (req, res, next) => {
    try {
        const { companyId, siteId } = req.params;
        const updates = req.body;

        // Validate and normalize update data
        const validatedUpdates = {
            equityShares: Number(updates.equityShares || 0),
            allocationPercentage: Number(updates.allocationPercentage || 0),
            annualGeneration: Number(updates.annualGeneration || 0),
            auxiliaryConsumption: Number(updates.auxiliaryConsumption || 0),
            actualConsumption: Number(updates.actualConsumption || 0)
        };

        // Calculate derived fields
        const verificationCriteria = (validatedUpdates.annualGeneration - validatedUpdates.auxiliaryConsumption) * 0.51;
        validatedUpdates.verificationCriteria = verificationCriteria;

        // Update permittedConsumption values
        validatedUpdates.permittedConsumption = {
            base: validatedUpdates.annualGeneration,
            minus10: validatedUpdates.annualGeneration * 0.9,
            plus10: validatedUpdates.annualGeneration * 1.1
        };

        // Check norms compliance
        validatedUpdates.normsCompliance = validatedUpdates.actualConsumption >= verificationCriteria;

        // Update consumption site
        await consumptionSiteDAL.updateConsumptionSite(companyId, siteId, {
            equityShares: validatedUpdates.equityShares,
            allocationPercentage: validatedUpdates.allocationPercentage,
            auxiliaryConsumption: validatedUpdates.auxiliaryConsumption,
            version: (updates.version || 0) + 1,
            updatedat: new Date().toISOString()
        });

        // Update allocation records
        const existingAllocations = await allocationDAL.getAllocationsByConsumptionSite(companyId, siteId);
        if (existingAllocations?.length > 0) {
            await Promise.all(existingAllocations.map(allocation => {
                const totalAllocation = calculateTotal(allocation);
                const scaleFactor = validatedUpdates.annualGeneration / totalAllocation;
                
                const updatedAllocation = {
                    ...allocation,
                    c1: Number(allocation.c1 || 0) * scaleFactor,
                    c2: Number(allocation.c2 || 0) * scaleFactor,
                    c3: Number(allocation.c3 || 0) * scaleFactor,
                    c4: Number(allocation.c4 || 0) * scaleFactor,
                    c5: Number(allocation.c5 || 0) * scaleFactor,
                    version: (allocation.version || 0) + 1,
                    updatedat: new Date().toISOString()
                };
                
                return allocationDAL.putItem(updatedAllocation);
            }));
        }

        res.json({
            success: true,
            data: validatedUpdates
        });
    } catch (error) {
        logger.error('[AllocationController] UpdateFormVBSite Error:', error);
        next(error);
    }
};

const getChargingAllocation = async (req, res, next) => {
    try {
        const { month } = req.params;
        if (!month) {
            throw new ValidationError('Month parameter is required');
        }
        const allocations = await allocationDAL.getAllocations(month);
        // Filter and return only charging-related allocations
        const chargingAllocations = allocations.filter(alloc => alloc.isCharging === true);
        res.json({
            success: true,
            data: chargingAllocations.map(transformAllocationRecord)
        });
    } catch (error) {
        logger.error('[AllocationController] GetChargingAllocation Error:', error);
        next(error);
    }
};

const getFilteredAllocations = async (req, res, next) => {
    try {
        const { month } = req.params;
        const { charge = false } = req.query;
        
        if (!month) {
            throw new ValidationError('Month parameter is required');
        }
        
        const allocations = await allocationDAL.getAllocations(month);
        // Filter based on charge parameter
        const filteredAllocations = charge === 'true' 
            ? allocations.filter(alloc => alloc.isCharging === true)
            : allocations.filter(alloc => !alloc.isCharging);
            
        res.json({
            success: true,
            data: filteredAllocations.map(transformAllocationRecord)
        });
    } catch (error) {
        logger.error('[AllocationController] GetFilteredAllocations Error:', error);
        next(error);
    }
};

module.exports = {
    createAllocation,
    getAllocations,
    calculateTotal,
    updateAllocation,
    deleteAllocation,
    getAllAllocations,
    getFormVBData,
    updateFormVBSite,
    getChargingAllocation,
    getFilteredAllocations
};