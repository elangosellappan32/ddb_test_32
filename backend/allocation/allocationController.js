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
        
        // Process each allocation sequentially to properly handle lapse units
        for (const alloc of allocations) {
            if (!alloc.pk || !alloc.sk) {
                throw new ValidationError('Invalid allocation: missing pk or sk');
            }

            const [companyId, productionSiteId, consumptionSiteId] = alloc.pk.split('_');
            const month = alloc.sk;
            
            // Check if site has banking enabled
            const site = await productionSiteDAL.getItem(companyId, productionSiteId);
            if (!site) {
                throw new ValidationError(`Production site not found: ${productionSiteId}`);
            }
            
            // Determine if site has banking enabled
            const bankingEnabled = Number(site.banking || 0) === 1;

            // Store the allocation
            const result = await allocationDAL.putItem(alloc);
            results.push(result);

            if (!bankingEnabled) {
                // For non-banking sites, calculate unused units and add to lapse
                const lapseRecords = await lapseService.getLapsesByProductionSite(productionSiteId, month, month, companyId);
                let existingLapse = lapseRecords?.[0];
                const lapsePk = `${companyId}_${productionSiteId}`;

                // Calculate lapse amounts for each period
                const lapseUpdates = {};
                for (const period of ALL_PERIODS) {
                    const allocated = Number(alloc[period] || 0);
                    if (allocated > 0) {
                        const existingLapseAmount = Number(existingLapse?.allocated?.[period] || 0);
                        lapseUpdates[period] = existingLapseAmount + allocated;
                    }
                }

                if (Object.keys(lapseUpdates).length > 0) {
                    if (existingLapse) {
                        // Update existing lapse record
                        await lapseService.update(lapsePk, month, { 
                            allocated: lapseUpdates,
                            updatedat: new Date().toISOString()
                        });
                    } else {
                        // Create new lapse record
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
        const merged = existing
            ? { ...existing, ...alloc, pk, sk, updatedat: new Date().toISOString() }
            : { ...alloc, pk, sk, createdat: new Date().toISOString(), updatedat: new Date().toISOString() };
        
        const result = await allocationDAL.putItem(merged);

        // Handle each period's changes
        for (const period of ALL_PERIODS) {
            const oldVal = Number(existing?.[period] || 0);
            const newVal = Number(alloc[period] || 0);
            const delta = newVal - oldVal;
            
            if (delta === 0) continue;

            if (bankingEnabled) {
                // Banking site logic
                if (delta > 0) {
                    // Consumption increased: Try to use banked units first
                    const bankOld = Number(bankingRecord?.[period] || 0);
                    const reduce = Math.min(bankOld, delta);
                    
                    if (reduce > 0) {
                        // Reduce banking
                        await bankingDAL.updateBanking(`${companyId}_${productionSiteId}`, month, {
                            [period]: bankOld - reduce,
                            updatedat: new Date().toISOString()
                        });
                    }
                    
                    const leftover = delta - reduce;
                    if (leftover > 0) {
                        // Add remaining to lapse
                        if (existingLapse) {
                            const lapseOld = Number(existingLapse.allocated?.[period] || 0);
                            await lapseService.update(`${companyId}_${productionSiteId}`, month, {
                                allocated: { [period]: lapseOld + leftover },
                                updatedat: new Date().toISOString()
                            });
                        } else {
                            await lapseService.create({
                                companyId,
                                productionSiteId,
                                month,
                                allocated: { [period]: leftover },
                                createdat: new Date().toISOString(),
                                updatedat: new Date().toISOString()
                            });
                        }
                    }
                } else {
                    // Consumption decreased: Add to banking
                    const freed = -delta;
                    const bankOld = Number(bankingRecord?.[period] || 0);
                    await bankingDAL.updateBanking(`${companyId}_${productionSiteId}`, month, {
                        [period]: bankOld + freed,
                        updatedat: new Date().toISOString()
                    });
                }
            } else {
                // Non-banking site: Direct lapse handling
                const lapsePk = `${companyId}_${productionSiteId}`;
                
                if (delta > 0) {
                    // Allocation increased: Add to lapse
                    if (existingLapse) {
                        const lapseOld = Number(existingLapse.allocated?.[period] || 0);
                        await lapseService.update(lapsePk, month, {
                            allocated: { [period]: lapseOld + delta },
                            updatedat: new Date().toISOString()
                        });
                    } else {
                        await lapseService.create({
                            companyId,
                            productionSiteId,
                            month,
                            allocated: { [period]: delta },
                            createdat: new Date().toISOString(),
                            updatedat: new Date().toISOString()
                        });
                    }
                } else {
                    // Allocation decreased: Reduce lapse
                    if (existingLapse) {
                        const lapseOld = Number(existingLapse.allocated?.[period] || 0);
                        const newLapse = Math.max(0, lapseOld - (-delta)); // -delta because delta is negative
                        await lapseService.update(lapsePk, month, {
                            allocated: { [period]: newLapse },
                            updatedat: new Date().toISOString()
                        });
                    }
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