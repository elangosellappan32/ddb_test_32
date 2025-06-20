// Allocation Calculator
const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];

/**
 * Creates a deep copy of a unit with remaining values
 */
function createUnitWithRemaining(unit, isProduction = false) {
    if (!unit) {
        console.warn('Received undefined/null unit in createUnitWithRemaining');
        return null;
    }

    // Ensure we have valid period values
    const remaining = ALL_PERIODS.reduce((acc, period) => {
        const value = Number(unit[period]);
        acc[period] = !isNaN(value) ? value : 0;
        return acc;
    }, {});

    // Create base object with required fields
    return {
        id: unit.id,
        productionSiteId: isProduction ? (unit.productionSiteId || unit.id) : undefined,
        consumptionSiteId: !isProduction ? (unit.consumptionSiteId || unit.id) : undefined,
        siteName: unit.siteName || (isProduction ? unit.productionSite : unit.consumptionSite) || '',
        type: isProduction ? (unit.type || '').toUpperCase() : undefined,
        bankingEnabled: isProduction ? (unit.banking === 1) : undefined,
        month: unit.month,
        remaining
    };
}

/**
 * Checks if a unit has any remaining allocation in any period
 */
function hasRemainingAllocation(unit) {
    // Check if unit and unit.remaining exist before accessing
    if (!unit?.remaining) return false;
    return Object.values(unit.remaining).some(val => Number(val || 0) > 0);
}

/**
 * Applies shareholding percentage to an allocation amount
 */
function applyShareholding(amount, companyId, shareholdingPercentages) {
    const percentage = companyId ? (shareholdingPercentages[companyId] || 100) : 100;
    return Math.floor(amount * (percentage / 100));
}

/**
 * Creates a new allocation record
 */
function createAllocation(prod, cons, allocated = {}) {
    // Initialize all periods with zero
    const normalizedAllocation = ALL_PERIODS.reduce((acc, period) => {
        acc[period] = Number(allocated[period] || 0);
        return acc;
    }, {});

    return {
        productionSiteId: prod.productionSiteId,
        productionSite: prod.productionSite || prod.siteName,
        siteType: prod.type,
        siteName: prod.siteName,
        consumptionSiteId: cons.consumptionSiteId,
        consumptionSite: cons.consumptionSite || cons.siteName,
        month: cons.month,
        allocated: normalizedAllocation
    };
}

// Period prioritization is now handled directly in the calculateAllocations function

/**
 * Calculates allocations based on production, consumption, and shareholding percentages
 * @param {Object} params - The allocation parameters
 * @param {Array} params.productionUnits - Array of production units
 * @param {Array} params.consumptionUnits - Array of consumption units
 * @param {Array} params.bankingUnits - Array of banking units
 * @param {Object} params.manualAllocations - Manual allocation overrides
 * @param {Array} params.shareholdings - Array of shareholding records from captive table
 * @returns {Object} Allocation results
 */
export function calculateAllocations({ 
    productionUnits = [], 
    consumptionUnits = [], 
    bankingUnits = [], 
    manualAllocations = {},
    shareholdings = []
}) {
    const shareholdingPercentages = shareholdings.reduce((acc, curr) => {
        acc[curr.shareholderCompanyId] = curr.shareholdingPercentage;
        return acc;
    }, {});
    
    console.group('🔄 Running Allocation Calculation');
    
    try {
        // Initialize units with remaining values and filter out null/invalid units
        const prodUnits = productionUnits
            .map(u => createUnitWithRemaining(u, true))
            .filter(u => u !== null);

        const consUnits = consumptionUnits
            .map(u => createUnitWithRemaining(u, false))
            .filter(u => u !== null);

        const bankUnits = bankingUnits
            .map(u => {
                if (!u) return null;
                const unit = { ...u };
                // Ensure period values are numbers
                ALL_PERIODS.forEach(period => {
                    unit[period] = Number(unit[period] || 0);
                });
                return unit;
            })
            .filter(u => u !== null);

        if (prodUnits.length === 0 || consUnits.length === 0) {
            console.warn('No valid production or consumption units to process');
            return {
                allocations: [],
                bankingAllocations: [],
                lapseAllocations: [],
                remainingProduction: [],
                remainingConsumption: []
            };
        }

        // Track allocations
        const allocations = [];
        const bankingAllocations = [];
        const lapseAllocations = [];
        const processBankingUnits = new Map();

        // Helper function to create or update allocation
        function allocateUnits(source, target, period, amount, type = null) {
            let allocation = allocations.find(a => 
                a.productionSiteId === source.productionSiteId && 
                a.consumptionSiteId === target.consumptionSiteId
            );

            if (!allocation) {
                allocation = createAllocation(source, target);
                if (type) allocation.type = type;
                allocations.push(allocation);
            }

            allocation.allocated[period] = (allocation.allocated[period] || 0) + amount;
            return allocation;
        }

        // Sort consumption units by highest need first
        const sortedConsUnits = [...consUnits].sort((a, b) => {
            // Calculate total peak and non-peak needs
            const aPeak = PEAK_PERIODS.reduce((sum, p) => sum + Number(a.remaining[p] || 0), 0);
            const bPeak = PEAK_PERIODS.reduce((sum, p) => sum + Number(b.remaining[p] || 0), 0);
            // Prioritize units with peak period needs
            if (aPeak !== bPeak) return bPeak - aPeak;
            // Then by total consumption
            return Object.values(b.remaining).reduce((s, v) => s + v, 0) - 
                   Object.values(a.remaining).reduce((s, v) => s + v, 0);
        });

        // Classify production sources
        const solarUnits = prodUnits.filter(u => u.type === 'SOLAR');
        const windUnits = prodUnits.filter(u => u.type === 'WIND' && !u.bankingEnabled);
        const bankingWindUnits = prodUnits.filter(u => u.type === 'WIND' && u.bankingEnabled);

        // First pass: Handle peak periods (c2, c3)
        PEAK_PERIODS.forEach(period => {
            console.log(`\nProcessing PEAK period ${period}:`);

            // Calculate total peak needs
            const totalPeakConsumption = sortedConsUnits.reduce((sum, unit) => 
                sum + Number(unit.remaining[period] || 0), 0);

            if (totalPeakConsumption <= 0) {
                console.log(`No consumption needs for peak period ${period}`);
                return;
            }

            // Allocation Priority for Peak Periods
            // 1. Solar units
            allocateProductionUnits(solarUnits, sortedConsUnits, period, shareholdingPercentages, allocateUnits);

            // 2. Regular wind units
            allocateProductionUnits(windUnits, sortedConsUnits, period, shareholdingPercentages, allocateUnits);

            // 3. Banking-enabled wind units
            allocateProductionUnits(bankingWindUnits, sortedConsUnits, period, shareholdingPercentages, allocateUnits);
            
            // Handle remaining production for banking or lapse
            handleRemainingProduction(period, [...solarUnits, ...windUnits, ...bankingWindUnits], 
                sortedConsUnits, bankingAllocations, lapseAllocations, createAllocation);

            // 4. Use banking units if needed (last resort)
            const remainingPeakConsumption = sortedConsUnits.reduce((sum, unit) => 
                sum + Number(unit.remaining[period] || 0), 0);

            if (remainingPeakConsumption > 0) {
                console.log(`Using banking units for remaining ${remainingPeakConsumption} peak units in ${period}`);
                const sortedBankUnits = [...bankUnits]
                    .filter(bank => Number(bank[period] || 0) > 0)
                    .sort((a, b) => Number(b[period] || 0) - Number(a[period] || 0));

                allocateBankingUnits(sortedBankUnits, sortedConsUnits, period, 
                    shareholdingPercentages, processBankingUnits, allocateUnits);
            }
        });

        // Second pass: Handle non-peak periods (c1, c4, c5)
        NON_PEAK_PERIODS.forEach(period => {
            console.log(`\nProcessing NON-PEAK period ${period}:`);

            // Calculate total non-peak needs
            const totalNonPeakConsumption = sortedConsUnits.reduce((sum, unit) => 
                sum + Number(unit.remaining[period] || 0), 0);

            if (totalNonPeakConsumption <= 0) {
                console.log(`No consumption needs for non-peak period ${period}`);
                return;
            }

            // Allocation Priority for Non-Peak Periods
            // 1. Solar units
            allocateProductionUnits(solarUnits, sortedConsUnits, period, shareholdingPercentages, allocateUnits);

            // 2. Banking-enabled wind units (prefer using banking-enabled wind for non-peak)
            allocateProductionUnits(bankingWindUnits, sortedConsUnits, period, shareholdingPercentages, allocateUnits);

            // 3. Regular wind units
            allocateProductionUnits(windUnits, sortedConsUnits, period, shareholdingPercentages, allocateUnits);
            
            // Handle remaining production for banking or lapse
            handleRemainingProduction(period, [...solarUnits, ...windUnits, ...bankingWindUnits], 
                sortedConsUnits, bankingAllocations, lapseAllocations, createAllocation);

            // 4. Use banking units if absolutely necessary (last resort)
            const remainingNonPeakConsumption = sortedConsUnits.reduce((sum, unit) => 
                sum + Number(unit.remaining[period] || 0), 0);

            if (remainingNonPeakConsumption > 0) {
                console.log(`Using banking units for remaining ${remainingNonPeakConsumption} non-peak units in ${period}`);
                const sortedBankUnits = [...bankUnits]
                    .filter(bank => Number(bank[period] || 0) > 0)
                    .sort((a, b) => Number(b[period] || 0) - Number(a[period] || 0));

                allocateBankingUnits(sortedBankUnits, sortedConsUnits, period, 
                    shareholdingPercentages, processBankingUnits, allocateUnits);
            }
        });

        // Return only allocations with proper period initialization
        console.groupEnd();
        
        // Ensure all allocations have all periods initialized with zeros
        const normalizeAllocation = (alloc) => {
            if (!alloc?.allocated) return null;
            
            // Create a new object to avoid modifying the original
            return {
                ...alloc,
                allocated: ALL_PERIODS.reduce((acc, period) => {
                    acc[period] = Number(alloc.allocated[period] || 0);
                    return acc;
                }, {})
            };
        };

        // Filter for allocations that have non-zero values
        const hasNonZeroValues = (alloc) =>
            alloc && Object.values(alloc.allocated).some(v => v !== 0);

        // Process and normalize banking records
        const bankingRecords = [...processBankingUnits.values()]
            .map(normalizeAllocation)
            .filter(bank => {
                // Keep banking records that have either positive (banked) or negative (used) values
                return bank && Object.values(bank.allocated).some(v => v !== 0);
            });

        // Separate banking and usage records
        const bankingUsageRecords = bankingRecords.filter(bank => 
            Object.values(bank.allocated).some(v => v < 0)
        );

        const bankingStorageRecords = bankingRecords.filter(bank => 
            bank.consumptionSiteId === 'BANK' &&
            Object.values(bank.allocated).some(v => v > 0)
        );

        return {
            // Regular allocations (excluding banking)
            allocations: allocations
                .filter(a => a.type !== 'BANKING')
                .map(normalizeAllocation)
                .filter(hasNonZeroValues),

            // Banking allocations - both stored and used
            bankingAllocations: [
                ...bankingStorageRecords,
                ...bankingUsageRecords,
                ...bankingAllocations
                    .map(normalizeAllocation)
                    .filter(hasNonZeroValues)
            ],

            // Lapse allocations
            lapseAllocations: lapseAllocations
                .map(normalizeAllocation)
                .filter(hasNonZeroValues),

            // Remaining units
            remainingProduction: prodUnits.filter(hasRemainingAllocation),
            remainingConsumption: consUnits.filter(hasRemainingAllocation)
        };
    } catch (error) {
        console.error('Error in calculateAllocations:', error);
        throw error;
    }
}

// Helper function to allocate production units to consumption units

// Helper function to allocate production units to consumption units
function allocateProductionUnits(prodUnits, consUnits, period, shareholdingPercentages, allocateFn) {
    // Sort production units by highest available units first
    prodUnits.sort((a, b) => Number(b.remaining[period]) - Number(a.remaining[period]));

    // For each production unit
    prodUnits.forEach(prod => {
        // Sort consumption units by highest need first to maximize allocation
        const sortedConsUnits = consUnits
            .filter(cons => cons.remaining[period] > 0)
            .sort((a, b) => Number(b.remaining[period]) - Number(a.remaining[period]));

        sortedConsUnits.forEach(cons => {
            if (prod.remaining[period] <= 0 || cons.remaining[period] <= 0) return;

            const available = Number(prod.remaining[period]);
            const needed = Number(cons.remaining[period]);
            const toAllocate = Math.min(available, needed);
            const allocated = applyShareholding(toAllocate, prod.companyId, shareholdingPercentages);

            if (allocated > 0) {
                allocateFn(prod, cons, period, allocated);
                prod.remaining[period] -= allocated;
                cons.remaining[period] -= allocated;
                console.log(`Allocated ${allocated} units from ${prod.productionSiteId} (${prod.type}) to ${cons.consumptionSiteId} in period ${period}`);
            }
        });
    });
}

// Helper function to handle remaining production
function handleRemainingProduction(period, prodUnits, consUnits, bankingAllocs, lapseAllocs, createAlloc) {
    if (!period || !Array.isArray(prodUnits) || !Array.isArray(consUnits)) {
        console.warn('Invalid arguments in handleRemainingProduction');
        return;
    }

    // Filter out invalid units first
    const validProdUnits = prodUnits.filter(prod => 
        prod && prod.remaining && typeof prod.remaining === 'object'
    );

    validProdUnits.forEach(prod => {
        const remaining = Math.max(0, Number(prod.remaining[period] || 0));
        if (remaining <= 0) return;

        // Validate critical fields
        if (!prod.productionSiteId) {
            console.warn('Production unit missing productionSiteId', prod);
            return;
        }

        try {
            // Initialize all periods with zero
            const baseAllocation = ALL_PERIODS.reduce((acc, p) => {
                acc[p] = p === period ? remaining : 0;
                return acc;
            }, {});

            // Create base record with all required fields
            const baseRecord = {
                productionSiteId: prod.productionSiteId,
                productionSite: prod.productionSite || prod.siteName || '',
                siteType: prod.type || '',
                siteName: prod.siteName || '',
                month: prod.month,
                allocated: baseAllocation,
                version: 1,
                ttl: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (prod.bankingEnabled) {
                // For peak periods or when no more consumption needs, bank the units
                if (PEAK_PERIODS.includes(period) || !hasRemainingAllocation(consUnits)) {
                    const bankingRecord = {
                        ...baseRecord,
                        consumptionSiteId: 'BANK',
                        consumptionSite: 'Banking',
                        type: 'BANKING'
                    };
                    
                    // Look for existing banking record for this production site
                    const existingBankingIndex = bankingAllocs.findIndex(b => 
                        b.productionSiteId === prod.productionSiteId
                    );

                    if (existingBankingIndex >= 0) {
                        // Update existing banking record
                        const existing = bankingAllocs[existingBankingIndex];
                        existing.allocated[period] = (existing.allocated[period] || 0) + remaining;
                        existing.updatedAt = new Date().toISOString();
                    } else {
                        // Add new banking record
                        bankingAllocs.push(bankingRecord);
                    }

                    console.log(`Banked ${remaining} units from ${prod.productionSiteId} for ${period}`);
                }
            } else {
                // Create lapse record
                const lapseRecord = {
                    ...baseRecord,
                    consumptionSiteId: 'LAPSE',
                    consumptionSite: 'Lapsed',
                    type: 'LAPSE'
                };

                // Look for existing lapse record for this production site
                const existingLapseIndex = lapseAllocs.findIndex(l => 
                    l.productionSiteId === prod.productionSiteId
                );

                if (existingLapseIndex >= 0) {
                    // Update existing lapse record
                    const existing = lapseAllocs[existingLapseIndex];
                    existing.allocated[period] = (existing.allocated[period] || 0) + remaining;
                    existing.updatedAt = new Date().toISOString();
                } else {
                    // Add new lapse record
                    lapseAllocs.push(lapseRecord);
                }

                console.log(`Lapsed ${remaining} units from ${prod.productionSiteId} for ${period}`);
            }
        } catch (err) {
            console.error('Error handling remaining production:', err, { prod, period });
        }
    });
}

// Helper function to allocate banking units
function allocateBankingUnits(bankUnits, consUnits, period, shareholdingPercentages, processBankingUnits, allocateFn) {
    // Sort banking units by highest available units first
    bankUnits.sort((a, b) => Number(b[period]) - Number(a[period]));

    // Sort consumption units by highest need first
    const sortedConsUnits = consUnits
        .filter(cons => cons.remaining[period] > 0)
        .sort((a, b) => Number(b.remaining[period]) - Number(a.remaining[period]));

    // For each consumption unit with remaining need
    sortedConsUnits.forEach(cons => {
        const needed = Number(cons.remaining[period] || 0);
        if (needed <= 0) return;

        // Try to fulfill the need with banking units
        bankUnits.forEach(bank => {
            if (needed <= 0 || bank[period] <= 0) return;

            const available = Number(bank[period]);
            const toAllocate = Math.min(available, needed);
            const allocated = applyShareholding(toAllocate, bank.companyId, shareholdingPercentages);

            if (allocated > 0) {
                // Initialize banking tracking if not exists
                if (!processBankingUnits.has(bank.productionSiteId)) {
                    // Create a banking allocation record with all periods initialized to 0
                    const bankingAllocation = {
                        productionSiteId: bank.productionSiteId,
                        productionSite: bank.productionSite || bank.siteName || '',
                        siteType: 'WIND',
                        siteName: bank.siteName || '',
                        consumptionSiteId: 'BANK',
                        consumptionSite: 'Banking',
                        month: bank.month,
                        type: 'BANKING',
                        allocated: ALL_PERIODS.reduce((acc, p) => {
                            acc[p] = 0;
                            return acc;
                        }, {}),
                        version: 1,
                        ttl: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    processBankingUnits.set(bank.productionSiteId, bankingAllocation);
                }

                // Create a new banking usage record with negative allocation
                const bankingUsage = {
                    productionSiteId: bank.productionSiteId,
                    productionSite: bank.productionSite || bank.siteName || '',
                    siteType: 'WIND',
                    siteName: bank.siteName || '',
                    consumptionSiteId: cons.consumptionSiteId,
                    consumptionSite: cons.consumptionSite || cons.siteName || '',
                    month: bank.month,
                    type: 'BANKING',
                    allocated: ALL_PERIODS.reduce((acc, p) => {
                        // Store negative value for the period where banking was used
                        acc[p] = p === period ? -allocated : 0;
                        return acc;
                    }, {}),
                    version: 1,
                    ttl: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Record the allocation and update remainings
                allocateFn(bank, cons, period, allocated, 'BANKING');
                bank[period] -= allocated;
                cons.remaining[period] -= allocated;

                // Update the banking tracker
                const bankingTracker = processBankingUnits.get(bank.productionSiteId);
                bankingTracker.allocated[period] = (bankingTracker.allocated[period] || 0) - allocated;
                bankingTracker.updatedAt = new Date().toISOString();

                // Add the banking usage record to the tracking map with a unique key
                const usageKey = `${bank.productionSiteId}_${cons.consumptionSiteId}_${period}`;
                processBankingUnits.set(usageKey, bankingUsage);

                console.log(`Used ${allocated} banking units from ${bank.productionSiteId} for ${cons.consumptionSiteId} in ${period} (Remaining: ${bank[period]})`);
            }
        });
    });
}
