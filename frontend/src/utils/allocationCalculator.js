// allocationCalculator.js

const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];
const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];

function isPeak(p) {
  return PEAK_PERIODS.includes(p);
}

function isCompatible(prodPeriod, consPeriod) {
  if (isPeak(prodPeriod) && isPeak(consPeriod)) return true;
  if (isPeak(prodPeriod) && !isPeak(consPeriod)) return true;
  if (!isPeak(prodPeriod) && !isPeak(consPeriod)) return true;
  if (!isPeak(prodPeriod) && isPeak(consPeriod)) return false;
  return false;
}

// Create unit from raw DB/API record
function createUnitWithRemaining(unit, isProduction = false) {
  const remaining = ALL_PERIODS.reduce((acc, period) => {
    acc[period] = Number(unit[period] || 0);
    return acc;
  }, {});

  // Enhanced bankingEnabled detection with multiple fallbacks
  let bankingEnabled = false;
  if (isProduction) {
    // Check all possible fields that might indicate banking is enabled
    bankingEnabled = [
      unit.bankingEnabled,
      unit.banking === 1,
      unit.banking === true,
      unit.banking === '1',
      unit.banking === 'true',
      unit.type === 'WIND'  // Default WIND to banking enabled if not specified
    ].some(Boolean);

    console.log(`[createUnitWithRemaining] Banking status for ${unit.id} (${unit.type}):`, {
      bankingEnabled,
      banking: unit.banking,
      unitBankingEnabled: unit.bankingEnabled,
      type: unit.type,
      isProduction
    });
  }

  console.group(`[createUnitWithRemaining] Created ${isProduction ? 'production' : 'consumption'} unit`);
  console.log('Unit ID:', unit.id);
  console.log('Type:', unit.type);
  console.log('Banking Enabled:', bankingEnabled);
  console.log('Remaining:', remaining);
  console.log('Source Data:', {
    banking: unit.banking,
    bankingEnabled: unit.bankingEnabled,
    isProduction
  });
  console.groupEnd();

  // Create the unit with all necessary properties
  const result = {
    id: unit.id,
    productionSiteId: isProduction ? (unit.productionSiteId || unit.id) : undefined,
    consumptionSiteId: !isProduction ? (unit.consumptionSiteId || unit.id) : undefined,
    siteName: unit.siteName || '',
    type: (unit.type || '').toUpperCase(),
    companyId: unit.companyId,
    month: unit.month,
    remaining,
    bankingEnabled,
    // Preserve original data for debugging
    _original: { ...unit },
    // Add metadata for tracking
    _meta: {
      createdAt: new Date().toISOString(),
      source: 'createUnitWithRemaining',
      isProduction
    }
  };

  return result;
}

function hasRemaining(unit) {
  return unit && Object.values(unit.remaining).some(val => Number(val || 0) > 0);
}

function applyShareholding(amount, companyId, sharePercentMap) {
  const share = sharePercentMap[companyId] || 100;
  return Math.floor((amount * share) / 100);
}

function createAllocationRecord(prod, cons, month) {
  return {
    productionSiteId: prod.productionSiteId,
    productionSite: prod.siteName,
    consumptionSiteId: cons?.consumptionSiteId || '',
    consumptionSite: cons?.siteName || '',
    siteType: prod.type,
    siteName: prod.siteName,
    month,
    type: 'ALLOCATION',
    allocated: Object.fromEntries(ALL_PERIODS.map(p => [p, 0])),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function calculateAllocations({
  productionUnits = [],
  consumptionUnits = [],
  bankingUnits = [],
  manualAllocations = {},
  shareholdings = [],
  month = ''
}) {
  // Parse the allocation month and year
  const allocationMonth = month || `${String(new Date().getMonth() + 1).padStart(2, '0')}${new Date().getFullYear()}`;
  const monthStr = allocationMonth.slice(0, 2);
  const yearStr = allocationMonth.slice(2);
  const selectedMonth = parseInt(monthStr, 10);
  const selectedYear = parseInt(yearStr, 10);
  
  // Helper function to format allocation month
  const formatAllocationMonth = (m, y) => `${String(m).padStart(2, '0')}${y}`;

  const shareMap = shareholdings.reduce((acc, cur) => {
    acc[cur.shareholderCompanyId] = cur.shareholdingPercentage || 100;
    return acc;
  }, {});

  const producers = productionUnits.map(u => createUnitWithRemaining(u, true));
  const consumers = consumptionUnits.map(u => createUnitWithRemaining(u));
  const banked = bankingUnits.map(u => ({
    ...u,
    ...Object.fromEntries(ALL_PERIODS.map(p => [p, Number(u[p] || 0)])),
    productionSiteId: u.productionSiteId,
    siteName: u.siteName,
    month: u.month,
    companyId: u.companyId
  }));

  const allocations = [];
  const bankingAllocations = [];
  const lapseAllocations = [];
  const bankingUsage = [];

  // Groups
  const solar = producers.filter(p => p.type === 'SOLAR');
  const windNB = producers.filter(p => p.type === 'WIND' && !p.bankingEnabled);
  const windB = producers.filter(p => p.type === 'WIND' && p.bankingEnabled);

  const producerGroups = [solar, windNB, windB];

  // Core allocation
  function allocate(prodList, consList, period) {
    for (const prod of prodList) {
      if (prod.remaining[period] <= 0) continue;

      for (const cons of consList) {
        if (cons.remaining[period] <= 0) continue;

        // Compatibility check
        if (!isCompatible(period, period)) continue;

        const available = prod.remaining[period];
        const needed = cons.remaining[period];
        const alloc = Math.min(available, needed);
        const finalAlloc = applyShareholding(alloc, prod.companyId, shareMap);

        if (finalAlloc <= 0) continue;

        prod.remaining[period] -= finalAlloc;
        cons.remaining[period] -= finalAlloc;

        let record = allocations.find(a =>
          a.productionSiteId === prod.productionSiteId &&
          a.consumptionSiteId === cons.consumptionSiteId &&
          a.month === prod.month
        );

        if (!record) {
          record = createAllocationRecord(prod, cons, prod.month);
          allocations.push(record);
        }

        record.allocated[period] += finalAlloc;
      }
    }
  }

  // Banking allocations handler
  function allocateFromBanking(period) {
    const targets = consumers.filter(c => c.remaining[period] > 0);
    for (const cons of targets) {
      for (const bank of banked) {
        if (bank[period] <= 0) continue;
        const need = cons.remaining[period];
        if (need <= 0) break;

        const alloc = Math.min(bank[period], need);
        const final = applyShareholding(alloc, bank.companyId, shareMap);
        if (final <= 0) continue;

        cons.remaining[period] -= final;
        bank[period] -= final;

        bankingUsage.push({
          productionSiteId: bank.productionSiteId,
          productionSite: bank.siteName,
          consumptionSiteId: cons.consumptionSiteId,
          consumptionSite: cons.siteName,
          month: cons.month,
          type: 'BANKING',
          allocated: Object.fromEntries(ALL_PERIODS.map(p => [p, p === period ? -final : 0])),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  // Lapse or banking leftover
  function handleLeftovers(period, group) {
    console.group(`[handleLeftovers] Processing period ${period} with ${group.length} production units`);
    
    try {
      for (const [idx, prod] of group.entries()) {
        // Ensure we have a valid number for remaining units
        const left = Math.max(0, Number(prod.remaining[period]) || 0);
        
        console.log(`[${idx}] Checking ${prod.productionSiteId} (${prod.type}) - remaining[${period}]:`, left, 
                   'bankingEnabled:', prod.bankingEnabled, 
                   'Full remaining:', {...prod.remaining},
                   'Production Site ID:', prod.productionSiteId,
                   'Site Name:', prod.siteName,
                   'Site Type:', prod.siteType);
        
        if (left <= 0) {
          console.log(`[${idx}] No remaining units to allocate`);
          continue;
        }
        
        // Ensure we don't have negative remaining values
        if (left !== prod.remaining[period]) {
          console.log(`[${idx}] Adjusted remaining from ${prod.remaining[period]} to ${left}`);
          prod.remaining[period] = left;
        }
        
        // Create a base allocation object with all required fields
        const base = {
          productionSiteId: prod.productionSiteId,
          productionSite: prod.siteName || prod.productionSite || 'Unknown Site',
          month: formatAllocationMonth(selectedMonth, selectedYear),
          siteType: prod.siteType || 'WIND', // Default to WIND if not specified
          siteName: prod.siteName || prod.productionSite || 'Unknown Site',
          type: prod.bankingEnabled ? 'BANKING' : 'LAPSE',
          allocated: {
            c1: 0, c2: 0, c3: 0, c4: 0, c5: 0
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Add metadata for debugging
          _debug: {
            source: 'handleLeftovers',
            period,
            remaining: { ...prod.remaining },
            timestamp: new Date().toISOString()
          }
        };

        // Create a deep copy of the base object with the allocated value for this period
        const allocated = JSON.parse(JSON.stringify(base.allocated));
        allocated[period] = left;
        
        if (prod.bankingEnabled) {
          const bankingRecord = {
            ...base,
            allocated,
            consumptionSite: 'Banking',
            consumptionSiteId: 'BANK', // Special ID for banking records
            // Ensure all required fields are present
            id: `banking_${prod.productionSiteId}_${period}_${Date.now()}`,
            version: 1,
            status: 'ACTIVE'
          };
          console.log(`[${idx}] Creating BANKING record for ${left} units`, bankingRecord);
          bankingAllocations.push(bankingRecord);
        } else {
          const lapseRecord = {
            ...base,
            allocated,
            consumptionSite: 'Lapsed',
            consumptionSiteId: 'LAPSE',
            _debug: {
              source: 'handleLeftovers',
              period,
              remaining: { ...prod.remaining },
              timestamp: new Date().toISOString()
            }
          };
          console.log(`[${idx}] Adding lapse record:`, lapseRecord);
          lapseAllocations.push(lapseRecord);
        }
        
        // Reset remaining to avoid double-counting
        const beforeReset = { ...prod.remaining };
        prod.remaining[period] = 0;
        console.log(`[${idx}] Reset remaining[${period}] from ${beforeReset[period]} to ${prod.remaining[period]}`);
      }
    } catch (error) {
      console.error('[handleLeftovers] Error:', error);
    } finally {
      console.groupEnd();
    }
    
    console.log(`After handleLeftovers for ${period}:`, {
      bankingAllocations: bankingAllocations.length,
      lapseAllocations: lapseAllocations.length,
      remainingInGroup: group.map(p => ({
        id: p.productionSiteId,
        remaining: p.remaining,
        type: p.type,
        bankingEnabled: p.bankingEnabled
      }))
    });
  }

  // Process Peak & Non-Peak periods
  const processPeriods = (periods, groups) => {
    console.group(`[processPeriods] Starting allocation for periods: ${periods.join(', ')}`);
    console.log('Total producer groups:', groups.length);
    console.log('Total consumers:', consumers.length);
    
    try {
      for (const period of periods) {
        console.group(`[processPeriods] Processing period: ${period}`);
        
        try {
          // Log initial state for this period
          const initialProduction = groups.flatMap(g => g).reduce((sum, p) => sum + (p.remaining[period] || 0), 0);
          const initialConsumption = consumers.reduce((sum, c) => sum + (c.remaining[period] || 0), 0);
          console.log(`Initial state for ${period}:`, {
            totalProduction: initialProduction,
            totalConsumption: initialConsumption,
            producerGroups: groups.map((g, i) => ({
              group: i,
              producers: g.length,
              totalProduction: g.reduce((sum, p) => sum + (p.remaining[period] || 0), 0)
            }))
          });

          // Find consumers that need this period
          const consumersNeedingPeriod = consumers.filter(c => c.remaining[period] > 0);
          const hasConsumers = consumersNeedingPeriod.length > 0;
          
          if (!hasConsumers) {
            console.log(`No consumers need period ${period}, but will check for remaining production`);
          }
          
          console.log(`Processing ${consumersNeedingPeriod.length} consumers that need period ${period}`);

          // Process each producer group
          for (const [groupIdx, group] of groups.entries()) {
            console.group(`Processing producer group ${groupIdx} with ${group.length} producers`);
            
            try {
              // Log group state before allocation
              const groupProdBefore = group.reduce((sum, p) => sum + (p.remaining[period] || 0), 0);
              console.log(`Group ${groupIdx} initial production: ${groupProdBefore}`);

              if (hasConsumers) {
                // Only try to allocate to consumers if there are consumers needing this period
                console.log('Allocating to consumers...');
                allocate(group, consumersNeedingPeriod, period);
              } else {
                console.log('No consumers need this period, skipping allocation');
              }
              
              // Always handle leftovers for this group, even if no consumers
              console.log('Handling leftovers...');
              handleLeftovers(period, group);
              
              // Log group state after allocation and leftovers
              const groupProdAfter = group.reduce((sum, p) => sum + (p.remaining[period] || 0), 0);
              console.log(`Group ${groupIdx} remaining after allocation: ${groupProdAfter}`);
              
            } catch (error) {
              console.error(`Error processing group ${groupIdx}:`, error);
              throw error;
            } finally {
              console.groupEnd();
            }
          }

          if (hasConsumers) {
            // Only try to use banking if there were consumers to allocate to
            console.log('Attempting to allocate from banking...');
            allocateFromBanking(period);
          } else {
            console.log('No consumers, skipping banking allocation');
          }
          
          // Final check for any remaining production that wasn't allocated
          console.log('Performing final check for remaining production...');
          const remainingProducers = [];
          
          // First collect all producers with remaining production
          for (const [groupIdx, group] of groups.entries()) {
            for (const prod of group) {
              const remaining = Number(prod.remaining[period]) || 0;
              if (remaining > 0) {
                console.log(`Found remaining production in group ${groupIdx} for ${prod.productionSiteId} (${prod.type}): ${remaining} units`);
                remainingProducers.push(prod);
              }
            }
          }
          
          if (remainingProducers.length > 0) {
            console.log(`Processing ${remainingProducers.length} producers with remaining production`);
            console.log('Producers with remaining:', remainingProducers.map(p => ({
              id: p.productionSiteId,
              type: p.type,
              remaining: p.remaining[period],
              bankingEnabled: p.bankingEnabled
            })));
            
            // Process remaining production
            handleLeftovers(period, remainingProducers);
            
            // Verify all remaining was processed
            const remainingAfter = remainingProducers.reduce((sum, p) => sum + (Number(p.remaining[period]) || 0), 0);
            if (remainingAfter > 0) {
              console.warn(`WARNING: Still have ${remainingAfter} units remaining after handleLeftovers for period ${period}`);
              // Force set remaining to 0 to prevent infinite loops
              remainingProducers.forEach(p => {
                if (p.remaining[period] > 0) {
                  console.log(`Forcing remaining to 0 for ${p.productionSiteId} (was ${p.remaining[period]})`);
                  p.remaining[period] = 0;
                }
              });
            }
          } else {
            console.log('No remaining production found in any group');
          }
          
          // Log final state for this period
          const finalProduction = groups.flatMap(g => g).reduce((sum, p) => sum + (p.remaining[period] || 0), 0);
          const finalConsumption = consumers.reduce((sum, c) => sum + (c.remaining[period] || 0), 0);
          
          console.log(`Final state for ${period}:`, {
            remainingProduction: finalProduction,
            remainingConsumption: finalConsumption,
            allocations: allocations.filter(a => a.allocated[period] > 0).length,
            bankingAllocations: bankingAllocations.filter(b => b.allocated[period] > 0).length,
            lapseAllocations: lapseAllocations.filter(l => l.allocated[period] > 0).length
          });
          
        } catch (error) {
          console.error(`Error processing period ${period}:`, error);
          throw error;
        } finally {
          console.groupEnd();
        }
      }
      
      // Final summary
      console.group('Final allocation summary');
      console.log('Total allocations:', allocations.length);
      console.log('Total banking allocations:', bankingAllocations.length);
      console.log('Total lapse allocations:', lapseAllocations.length);
      console.log('Total banking usage:', bankingUsage.length);
      console.groupEnd();
      
    } catch (error) {
      console.error('Error in processPeriods:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  };

  processPeriods(PEAK_PERIODS, producerGroups); // c2, c3
  processPeriods(NON_PEAK_PERIODS, producerGroups); // c1, c4, c5

  return {
    allocations,
    lapseAllocations,
    bankingAllocations,
    bankingUsage,
    remainingProduction: producers.filter(hasRemaining),
    remainingConsumption: consumers.filter(hasRemaining)
  };
}
