// Energy Allocation Service
// Handles allocation of energy from production to consumption sites
// with support for peak/off-peak periods, banking, and lapse tracking

// Constants
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];
const ALL_PERIODS = [...NON_PEAK_PERIODS, ...PEAK_PERIODS];

/**
 * Checks if allocation from source period to target period is allowed
 * @param {string} sourcePeriod - The source period (c1-c5)
 * @param {string} targetPeriod - The target period (c1-c5)
 * @returns {boolean} - True if allocation is allowed
 */
function isAllocationAllowed(sourcePeriod, targetPeriod) {
  // Peak units can be used for any period
  if (PEAK_PERIODS.includes(sourcePeriod)) return true;
  // Non-peak units can only be used for the same period
  return sourcePeriod === targetPeriod;
}

/**
 * Deep clones an object with unit values
 * @param {Object} obj - Object with c1-c5 properties
 * @returns {Object} Deep cloned object
 */
function cloneUnits(obj) {
  return JSON.parse(JSON.stringify({
    c1: +obj.c1 || 0,
    c2: +obj.c2 || 0,
    c3: +obj.c3 || 0,
    c4: +obj.c4 || 0,
    c5: +obj.c5 || 0
  }));
}

/**
 * Advanced Energy Allocation Calculator
 * 
 * Allocates energy from production to consumption sites following these rules:
 * 1. Peak units (c2, c3) can be used for any period, non-peak only for matching periods
 * 2. Allocation order: Solar → Wind (non-banking) → Wind (banking) → Banked units
 * 3. Only wind farms with banking enabled can bank unused units
 * 4. Solar and non-banking wind farms have their unused units lapsed
 * 
 * @param {Object} params - Input parameters
 * @param {Array} params.productionUnits - Array of production units
 * @param {Array} params.consumptionUnits - Array of consumption units
 * @param {Array} params.bankingUnits - Array of banked units from previous periods
 * @returns {Object} Allocation results including allocations, banking, and lapsed units
 */
function calculateAllocations({ productionUnits = [], consumptionUnits = [], bankingUnits = [] }) {
  console.log('[calculateAllocations] Starting allocation process');
  
  // Ensure all production units have proper initialization
  productionUnits = productionUnits.map(unit => ({
    ...unit,
    type: (unit.type || 'solar').toUpperCase(),
    unitBankingEnabled: unit.unitBankingEnabled ?? (unit.type?.toUpperCase() === 'WIND' && Number(unit.banking) === 1),
    productionSiteId: unit.productionSiteId || unit.id,
    productionSite: unit.productionSite || unit.siteName,
    siteName: unit.siteName || `Production-${unit.id}`,
    month: unit.month
  }));

  // Log initial state
  console.log(`[calculateAllocations] Processing ${productionUnits.length} production units, ${consumptionUnits.length} consumption units, ${bankingUnits.length} banking units`);
  
  // Prepare data structures
  const allocations = [];
  const newBankingAllocations = [];
  const lapsedAllocations = [];

  // Process input units
  const processProductionUnit = (unit) => {
    const processed = {
      ...unit,
      productionSiteId: unit.productionSiteId || unit.id,
      productionSite: unit.productionSite || unit.siteName,
      siteName: unit.siteName,
      type: (unit.type || '').toUpperCase(),
      bankingEnabled: unit.unitBankingEnabled ?? (unit.type?.toUpperCase() === 'WIND' && Number(unit.banking) === 1),
      remaining: cloneUnits(unit)
    };
    
    console.log(`[processProductionUnit] Processed unit ${processed.productionSiteId} (${processed.type}):`, 
      `banking=${processed.bankingEnabled}`, 
      `remaining=`, processed.remaining);
      
    return processed;
  };

  const processConsumptionUnit = (unit) => ({
    ...unit,
    consumptionSiteId: unit.consumptionSiteId || unit.id,
    consumptionSite: unit.consumptionSite || unit.siteName,
    remaining: cloneUnits(unit)
  });

  // Process all units with enhanced logging
  console.log('[calculateAllocations] Processing production units');
  const prodUnits = productionUnits.map(processProductionUnit);
  
  console.log('[calculateAllocations] Processing consumption units');
  const consUnits = consumptionUnits.map(unit => {
    const processed = processConsumptionUnit(unit);
    console.log(`[processConsumptionUnit] Processed consumption unit ${processed.consumptionSiteId}:`, 
      `remaining=`, processed.remaining);
    return processed;
  });
  
  console.log('[calculateAllocations] Processing banked units');
  const bankUnits = bankingUnits.map(u => {
    const processed = {
      ...processProductionUnit(u),
      isBanked: true
    };
    console.log(`[processBankedUnit] Processed banked unit ${processed.productionSiteId}:`, 
      `remaining=`, processed.remaining);
    return processed;
  });

  // Categorize production units
  const solarUnits = prodUnits.filter(u => u.type === 'SOLAR');
  const windUnits = prodUnits.filter(u => u.type === 'WIND' && !u.bankingEnabled);
  const bankingWindUnits = prodUnits.filter(u => u.type === 'WIND' && u.bankingEnabled);

  // Sort consumption sites by priority (first selected site first, then by month and name)
  const sortedConsUnits = [...consUnits].sort((a, b) => {
    if (a.month && b.month) {
      const monthA = parseInt(a.month.substring(0, 2));
      const monthB = parseInt(b.month.substring(0, 2));
      const yearA = parseInt(a.month.substring(2));
      const yearB = parseInt(b.month.substring(2));
      if (yearA !== yearB) return yearA - yearB;
      if (monthA !== monthB) return monthA - monthB;
    }
    return (a.siteName || '').localeCompare(b.siteName || '');
  });

  /**
   * Allocates units from a production source to consumption sites
   * @param {Object} source - Production source (solar, wind, or banked units)
   * @param {string} sourceType - Type of source ('solar', 'wind', 'banked')
   * @param {boolean} isBanking - Whether to bank unused units (for wind with banking)
   */
  const allocateFromSource = (source, sourceType, isBanking = false) => {
    const allocation = {
      productionSiteId: source.productionSiteId,
      productionSite: source.productionSite,
      siteType: source.type,
      siteName: source.siteName,
      month: source.month,
      allocated: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 }
    };

    // Track remaining capacity per period
    const remaining = cloneUnits(source.remaining);
    let hasAllocation = false;

    // Try to allocate to each consumption site
    for (const cons of sortedConsUnits) {
      if (!cons.month || (source.month && cons.month !== source.month)) continue;

      // Create allocation record for this consumption site
      const siteAllocation = {
        ...allocation,
        consumptionSiteId: cons.consumptionSiteId,
        consumptionSite: cons.consumptionSite,
        allocated: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 }
      };

      // Try to allocate for each period
      for (const period of ALL_PERIODS) {
        if (cons.remaining[period] <= 0) continue;

        // Find available units in source that can be allocated to this period
        for (const srcPeriod of ALL_PERIODS) {
          if (remaining[srcPeriod] <= 0) continue;
          if (!isAllocationAllowed(srcPeriod, period)) continue;

          const allocAmount = Math.min(
            remaining[srcPeriod],
            cons.remaining[period]
          );

          if (allocAmount > 0) {
            remaining[srcPeriod] -= allocAmount;
            cons.remaining[period] -= allocAmount;
            siteAllocation.allocated[period] += allocAmount;
            hasAllocation = true;
          }
        }
      }

      // Add allocation if any units were allocated to this site
      if (Object.values(siteAllocation.allocated).some(v => v > 0)) {
        allocations.push(siteAllocation);
      }
    }

    // Handle unused units (bank or lapse)
    const unused = Object.entries(remaining).reduce((sum, [_, val]) => sum + val, 0);
    if (unused > 0) {
      if (isBanking) {
        // Bank unused units
        newBankingAllocations.push({
          productionSiteId: source.productionSiteId,
          productionSite: source.productionSite,
          siteName: source.siteName,
          month: source.month,
          banked: remaining
        });
      } else {
        // Add to lapsed units
        lapsedAllocations.push({
          productionSiteId: source.productionSiteId,
          productionSite: source.productionSite,
          siteName: source.siteName,
          month: source.month,
          lapsed: remaining
        });
      }
    }

    return hasAllocation;
  };

  // Execute allocation in priority order
  console.log('[calculateAllocations] Starting main allocation phase');
  const allocationOrder = [
    { sources: solarUnits, type: 'solar', bank: false },
    { sources: windUnits, type: 'wind', bank: false },
    { sources: bankingWindUnits, type: 'wind', bank: true },
    { sources: bankUnits, type: 'banked', bank: false }
  ];

  for (const { sources, type, bank } of allocationOrder) {
    console.log(`[calculateAllocations] Processing ${type} sources (banking: ${bank})`);
    for (const source of sources) {
      console.log(`[calculateAllocations] Allocating from ${source.type} source ${source.productionSiteId || 'banked'}`);
      allocateFromSource(source, type, bank);
    }
  }

  // Final allocation pass to handle any remaining consumption
  const finalAllocationPass = () => {
    console.log('[finalAllocationPass] Starting final allocation pass for remaining consumption');
    
    let totalRemainingConsumption = 0;
    let totalRemainingProduction = 0;
    
    // Calculate total remaining consumption and production
    sortedConsUnits.forEach(cons => {
      ALL_PERIODS.forEach(period => {
        totalRemainingConsumption += cons.remaining[period] || 0;
      });
    });
    
    // Get all remaining production from all sources
    const allRemainingProduction = [
      ...solarUnits,
      ...windUnits,
      ...bankingWindUnits
    ].reduce((total, source) => {
      ALL_PERIODS.forEach(period => {
        total += source.remaining[period] || 0;
      });
      return total;
    }, 0);
    
    console.log(`[finalAllocationPass] Remaining consumption: ${totalRemainingConsumption}, Remaining production: ${allRemainingProduction}`);
    
    // If there's remaining consumption and production, try to allocate it
    if (totalRemainingConsumption > 0 && allRemainingProduction > 0) {
      console.log('[finalAllocationPass] Attempting to allocate remaining production to remaining consumption');
      
      for (const cons of sortedConsUnits) {
        for (const period of ALL_PERIODS) {
          if (cons.remaining[period] <= 0) continue;
          
          // Try all sources
          const sources = [...solarUnits, ...windUnits, ...bankingWindUnits];
          for (const source of sources) {
            for (const srcPeriod of ALL_PERIODS) {
              if (source.remaining[srcPeriod] <= 0) continue;
              
              const allocAmount = Math.min(
                source.remaining[srcPeriod],
                cons.remaining[period]
              );
              
              if (allocAmount > 0) {
                source.remaining[srcPeriod] -= allocAmount;
                cons.remaining[period] -= allocAmount;
                
                // Create or update allocation
                const existingAlloc = allocations.find(a => 
                  a.productionSiteId === source.productionSiteId &&
                  a.consumptionSiteId === cons.consumptionSiteId
                );
                
                if (existingAlloc) {
                  existingAlloc.allocated[period] = (existingAlloc.allocated[period] || 0) + allocAmount;
                } else {
                  allocations.push({
                    productionSiteId: source.productionSiteId,
                    productionSite: source.productionSite,
                    siteType: source.type,
                    siteName: source.siteName,
                    month: source.month,
                    consumptionSiteId: cons.consumptionSiteId,
                    consumptionSite: cons.consumptionSite,
                    allocated: { [period]: allocAmount }
                  });
                }
                
                console.log(`[finalAllocationPass] Allocated ${allocAmount} from ${source.productionSiteId} (${srcPeriod}) to ${cons.consumptionSiteId} (${period})`);
              }
            }
          }
        }
      }
    }
  };
  
  // Run the final allocation pass
  finalAllocationPass();

  // Calculate final remaining consumption and production
  const remainingConsumption = sortedConsUnits.reduce((total, cons) => {
    return total + Object.values(cons.remaining || {}).reduce((sum, val) => sum + val, 0);
  }, 0);
  
  const remainingProduction = [...solarUnits, ...windUnits, ...bankingWindUnits].reduce((total, source) => {
    return total + Object.values(source.remaining || {}).reduce((sum, val) => sum + val, 0);
  }, 0);

  // Log final summary
  console.log('=== FINAL ALLOCATION SUMMARY ===');
  console.log('Total allocations:', allocations.length);
  console.log('Total banking allocations:', newBankingAllocations.length);
  console.log('Total lapsed allocations:', lapsedAllocations.length);
  console.log('Remaining consumption:', remainingConsumption);
  console.log('Remaining production:', remainingProduction);
  console.log('===============================');

  return {
    allocations,
    bankingAllocations: newBankingAllocations,
    lapseAllocations: lapsedAllocations,
    remainingConsumption,
    remainingProduction
  };
}

module.exports = {
  calculateAllocations
};
