const ALL_PERIODS = ['c1', 'c2', 'c3', 'c4', 'c5'];

function createUnitWithRemaining(unit, isProduction = false) {
  const remaining = ALL_PERIODS.reduce((acc, period) => {
    acc[period] = Number(unit[period] || 0);
    return acc;
  }, {});

  const bankingEnabled = isProduction && (
    unit.bankingEnabled || unit.banking === 1 || unit.banking === '1' || 
    unit.banking === true || unit.type === 'WIND'
  );

  return {
    id: unit.id || unit.productionSiteId || unit.consumptionSiteId || '',
    productionSiteId: isProduction ? (unit.productionSiteId || unit.id) : undefined, 
    consumptionSiteId: !isProduction ? (unit.consumptionSiteId || unit.id) : undefined,
    siteName: unit.siteName || unit.name || '',
    type: (unit.type || '').toUpperCase(),
    month: unit.month,
    companyId: unit.companyId,
    remaining,
    bankingEnabled: !!bankingEnabled,
    commissionDate: unit.commissionDate || unit.dateOfCommission || null,
    irType: unit.irType,
    injection: unit.injection ? { ...unit.injection } : undefined,
    reduction: unit.reduction ? { ...unit.reduction } : undefined,
    allocationPercentage: Number(unit.allocationPercentage) || null,
    generatorCompanyId: isProduction ? (unit.generatorCompanyId || unit._siteInfo?.generatorCompanyId) : undefined,
    shareholderCompanyId: !isProduction ? unit.shareholderCompanyId : undefined,
    _original: unit,
    _siteInfo: isProduction ? unit._siteInfo : undefined
  };
}

function getTotalRemaining(unit) {
  return unit ? ALL_PERIODS.reduce((total, period) => total + (Number(unit.remaining[period] || 0)), 0) : 0;
}

function hasRemaining(unit) {
  return getTotalRemaining(unit) > 0;
}



function createAllocationRecord(prod = {}, cons = {}, month = '') {
  const allocated = Object.fromEntries(ALL_PERIODS.map(p => [p, 0]));
  
  // Get IR data from consumer (with fallback to producer)
  const irType = cons.irType || prod.irType;
  const injection = cons.injection || prod.injection;
  const reduction = cons.reduction || prod.reduction;
  
  // Create the base record
  const record = {
    productionSiteId: prod.productionSiteId || prod.id || '',
    productionSite: prod.siteName || prod.productionSite || '',
    consumptionSiteId: cons.consumptionSiteId || cons.id || '',
    consumptionSite: cons.siteName || cons.consumptionSite || '',
    month: month || (prod.month || cons.month || ''),
    type: 'ALLOCATION',
    allocated,
    // Include IR fields
    ...(irType && { irType }),
    ...(injection && { injection: { ...injection } }),
    ...(reduction && { reduction: { ...reduction } }),
    allocationPercentage: 100,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Copy IR data to allocated object for consistency
  if (record.allocated) {
    if (irType) record.allocated.irType = irType;
    if (injection) record.allocated.injection = { ...injection };
    if (reduction) record.allocated.reduction = { ...reduction };
  }

  console.log('[Allocation] Created allocation record with IR data:', {
    productionSiteId: record.productionSiteId,
    consumptionSiteId: record.consumptionSiteId,
    irType: record.irType,
    injection: record.injection,
    reduction: record.reduction,
    source: {
      from: irType === cons.irType ? 'consumer' : 'producer',
      irType: !!cons.irType,
      injection: !!cons.injection,
      reduction: !!cons.reduction
    }
  });

  return record;
}

// Debug logging helper
const debugLog = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Allocation] ${message}`, data);
  }
};

/**
 * Distributes percentages as whole numbers that sum to exactly 100%
 * @param {Array<{percentage: number, [key: string]: any}>} items - Array of items with percentages
 * @returns {Array<{percentage: number, [key: string]: any}>} - Items with whole number percentages
 */
function normalizeToWholePercentages(items) {
  if (!items.length) return [];
  
  // First pass: calculate integer parts and track remainders
  const withRemainders = items.map(item => ({
    ...item,
    integerPart: Math.floor(item.percentage) || 0,
    remainder: (item.percentage % 1) || 0
  }));
  
  // Calculate total of integer parts and remaining to distribute
  const totalInteger = withRemainders.reduce((sum, item) => sum + item.integerPart, 0);
  let remaining = 100 - totalInteger;
  
  // Sort by remainder in descending order to distribute remaining points
  const sorted = [...withRemainders].sort((a, b) => b.remainder - a.remainder);
  
  // Distribute remaining points to items with largest remainders
  return sorted.map((item, index) => ({
    ...item,
    percentage: item.integerPart + (index < remaining ? 1 : 0)
  }));
}

export function calculateAllocations({
  productionUnits = [],
  consumptionUnits = [],
  bankingUnits = [],
  captiveData = [],
  month = '',
  productionSites = [],
  consumptionSitePriorityMap = {}
}) {
  debugLog('Starting allocation calculation', {
    productionUnits: productionUnits.length,
    consumptionUnits: consumptionUnits.length,
    bankingUnits: bankingUnits.length,
    captiveData: captiveData.length,
    month,
    hasConsumptionPriority: Object.keys(consumptionSitePriorityMap).length > 0
  });
  const allocationMonth = month || `${String(new Date().getMonth() + 1).padStart(2, '0')}${new Date().getFullYear()}`;
  const monthYear = allocationMonth;

  // Build captive allocation map using generator company ID and shareholder company ID
  const captiveMap = {};
  
  // Validate captive data
  if (!Array.isArray(captiveData)) {
    console.warn('Invalid captiveData: expected array, got', typeof captiveData);
    captiveData = [];
  }

  // Process captive data to build the allocation map
  captiveData.forEach((entry, index) => {
    try {
      if (!entry) {
        console.warn(`Skipping null/undefined captive data entry at index ${index}`);
        return;
      }
      
      // Ensure we have valid generator and shareholder IDs
      const genId = String(entry.generatorCompanyId || entry.generatorId || '');
      const shareId = String(entry.shareholderCompanyId || entry.shareholderId || '');
      
      if (!genId || !shareId) {
        console.warn('Skipping invalid captive data entry - missing IDs:', {
          genId,
          shareId,
          entry
        });
        return;
      }
      
      // Initialize generator entry if it doesn't exist
      if (!captiveMap[genId]) {
        captiveMap[genId] = {
          totalPercentage: 0,
          shareholders: {}
        };
      }
      
      // Parse and validate allocation percentage
      const percentage = Math.max(0, Math.min(100, Number(entry.allocationPercentage) || 0));
      const status = (entry.allocationStatus || 'active').toString().toLowerCase();
      
      // Skip inactive or zero-percentage entries
      if (status !== 'active' || percentage <= 0) {
        debugLog('Skipping inactive or zero-percentage captive entry', { 
          genId, 
          shareId, 
          percentage, 
          status 
        });
        return;
      }
      
      // Add or update shareholder with allocation percentage
      if (!captiveMap[genId].shareholders[shareId]) {
        captiveMap[genId].shareholders[shareId] = {
          percentage: 0,
          status,
          name: entry.shareholderCompanyName || `Shareholder ${shareId}`,
          updatedAt: entry.updatedAt || new Date().toISOString()
        };
      }
      
      // Update the percentage and status
      captiveMap[genId].shareholders[shareId].percentage += percentage;
      captiveMap[genId].shareholders[shareId].status = status;
      
      // Update total percentage for this generator
      captiveMap[genId].totalPercentage += percentage;
      
      debugLog('Added captive mapping', {
        genId,
        shareId,
        percentage,
        totalPercentage: captiveMap[genId].totalPercentage,
        status,
        totalGenerators: Object.keys(captiveMap).length,
        totalShareholders: Object.keys(captiveMap[genId].shareholders).length
      });
      
    } catch (error) {
      console.error('Error processing captive data entry:', { 
        error: error.message, 
        entry,
        stack: error.stack 
      });
    }
  });
  
  // Normalize percentages to ensure they sum to 100% for each generator
  Object.entries(captiveMap).forEach(([genId, genData]) => {
    const totalPct = genData.totalPercentage;
    if (totalPct > 0 && Math.abs(totalPct - 100) > 0.01) {
      // Normalize percentages to sum to 100%
      const scale = 100 / totalPct;
      Object.values(genData.shareholders).forEach(shareholder => {
        shareholder.percentage = shareholder.percentage * scale;
      });
      genData.totalPercentage = 100;
      
      debugLog('Normalized percentages for generator', {
        genId,
        originalTotal: totalPct,
        normalizedTotal: genData.totalPercentage
      });
    }
  });
  
  debugLog('Captive map created', {
    totalGenerators: Object.keys(captiveMap).length,
    totalMappings: Object.values(captiveMap).reduce((sum, shares) => sum + Object.keys(shares).length, 0)
  });

  // Process production units
  const producers = productionUnits
    .map((unit, index) => {
      try {
        if (!unit) {
          console.warn(`Skipping null/undefined production unit at index ${index}`);
          return null;
        }
        
        // Try to find matching site info
        const siteInfo = productionSites.find(ps => {
          const psId = String(ps?.productionSiteId || ps?.id || '');
          const unitId = String(unit?.productionSiteId || unit?.id || '');
          return psId && unitId && psId === unitId;
        });
        
        // Extract generator company ID with fallbacks
        let generatorCompanyId = unit.generatorCompanyId || 
                               siteInfo?.generatorCompanyId || 
                               unit.companyId ||
                               (unit._siteInfo?.generatorCompanyId) ||
                               '1'; // Default to '1' if none found, as per your captive data
        
        // Ensure generatorCompanyId is a string
        generatorCompanyId = String(generatorCompanyId);
        
        const producer = {
          ...createUnitWithRemaining(unit, true),
          commissionDate: unit.commissionDate || unit.dateOfCommission || 
            (siteInfo && (siteInfo.dateOfCommission || siteInfo.commissionDate)) ||
            new Date(0).toISOString(),
          _siteInfo: siteInfo,
          generatorCompanyId: generatorCompanyId,
          // Ensure we have all necessary IDs
          productionSiteId: unit.productionSiteId || unit.id,
          id: unit.id || unit.productionSiteId
        };
        
        // Debug log the producer info
        debugLog('Created producer', {
          id: producer.id,
          productionSiteId: producer.productionSiteId,
          generatorCompanyId: producer.generatorCompanyId,
          siteName: producer.siteName,
          hasSiteInfo: !!siteInfo,
          siteInfoGeneratorId: siteInfo?.generatorCompanyId,
          unitGeneratorId: unit.generatorCompanyId,
          unitCompanyId: unit.companyId
        });
        
        debugLog('Processed producer', {
          id: producer.id,
          siteName: producer.siteName,
          generatorCompanyId: producer.generatorCompanyId,
          remaining: Object.values(producer.remaining).reduce((a, b) => a + b, 0)
        });
        
        return producer;
      } catch (error) {
        console.error('Error processing production unit:', { error, unit });
        return null;
      }
    })
    .filter(Boolean) // Remove any null/undefined entries
    .sort((a, b) => new Date(b.commissionDate) - new Date(a.commissionDate));
    
  debugLog('Processed producers', { count: producers.length });

  // Group producers by generator company ID for better allocation management
  const producersByGenerator = {};
  producers.forEach(prod => {
    if (!prod) return;
    
    // Ensure we have a valid generator company ID
    const genId = String(prod.generatorCompanyId || '1'); // Default to '1' if missing
    
    if (!producersByGenerator[genId]) {
      producersByGenerator[genId] = [];
    }
    
    debugLog(`Adding producer to generator company group`, {
      producerId: prod.id,
      producerSiteId: prod.productionSiteId,
      generatorCompanyId: genId,
      siteName: prod.siteName,
      currentGroupSize: producersByGenerator[genId].length + 1
    });
    
    producersByGenerator[genId].push(prod);
  });
  
  // Log the grouping results
  debugLog('Producer grouping complete', {
    totalProducers: producers.length,
    generatorGroups: Object.keys(producersByGenerator).length,
    groupSizes: Object.fromEntries(
      Object.entries(producersByGenerator).map(([k, v]) => [k, v.length])
    )
  });

  // Process consumption units with enhanced shareholder company ID handling
  const consumers = consumptionUnits
    .map((unit, index) => {
      try {
        if (!unit) {
          console.warn(`Skipping null/undefined consumption unit at index ${index}`);
          return null;
        }
        
        // Create the base consumer
        const consumer = createUnitWithRemaining(unit, false);
        
        // Enhanced shareholder company ID resolution
        let shareholderCompanyId = String(
          unit.shareholderCompanyId || 
          unit.companyId || 
          (unit._siteInfo?.shareholderCompanyId) || 
          '1' // Default fallback
        );
        
        // Ensure we have the ID in the consumer object
        consumer.shareholderCompanyId = shareholderCompanyId;
        
        // Debug log the consumer info
        debugLog('Processed consumer', {
          id: consumer.id,
          consumptionSiteId: consumer.consumptionSiteId,
          siteName: consumer.siteName,
          shareholderCompanyId: consumer.shareholderCompanyId,
          remaining: Object.values(consumer.remaining).reduce((a, b) => a + b, 0),
          source: {
            unitShareholderId: unit.shareholderCompanyId,
            unitCompanyId: unit.companyId,
            siteInfoShareholderId: unit._siteInfo?.shareholderCompanyId
          }
        });
        
        return consumer;
      } catch (error) {
        console.error('Error processing consumption unit:', { error, unit });
        return null;
      }
    })
    .filter(Boolean) // Remove any null/undefined entries
    .sort((a, b) => {
      // If priority map is provided, sort by priority first
      const aId = String(a.consumptionSiteId || a.id);
      const bId = String(b.consumptionSiteId || b.id);
      
      const aPriority = consumptionSitePriorityMap[aId] || Number.MAX_VALUE;
      const bPriority = consumptionSitePriorityMap[bId] || Number.MAX_VALUE;
      
      // Debug log the sorting decision
      debugLog('Consumer sort comparison', {
        aId,
        aSiteName: a.siteName,
        aPriority,
        bId,
        bSiteName: b.siteName,
        bPriority,
        hasCustomPriority: Object.keys(consumptionSitePriorityMap).length > 0
      });
      
      // If both have priorities, sort by priority (ascending)
      if (aPriority !== Number.MAX_VALUE && bPriority !== Number.MAX_VALUE) {
        return aPriority - bPriority;
      }
      
      // Otherwise, sort by remaining consumption (descending) for backward compatibility
      const aRemaining = Object.values(a.remaining).reduce((sum, val) => sum + val, 0);
      const bRemaining = Object.values(b.remaining).reduce((sum, val) => sum + val, 0);
      return bRemaining - aRemaining;
    });
    
  debugLog('Processed consumers', { 
    count: consumers.length,
    consumersWithPriority: consumptionSitePriorityMap ? Object.entries(consumptionSitePriorityMap).map(([id, priority]) => ({ id, priority })) : [],
    priorityMapAvailable: Object.keys(consumptionSitePriorityMap).length > 0
  });

  // Initialize banking units - only use current month's banking units
  const banked = bankingUnits
    .filter(unit => unit.month === monthYear) // Only use current month banking units
    .map(unit => ({
      ...unit,
      productionSiteId: unit.productionSiteId,
      siteName: unit.siteName,
      month: unit.month,
      companyId: unit.companyId,
      remaining: ALL_PERIODS.reduce((acc, p) => { 
        acc[p] = Number(unit[p] || 0); 
        return acc; 
      }, {})
    }));

  const allocations = [];
  const bankingAllocations = [];
  const lapseAllocations = [];

  // Process allocations based on captive relationships
  debugLog('Starting captive allocation processing', {
    totalGenerators: Object.keys(captiveMap).length,
    captiveMapKeys: Object.keys(captiveMap),
    producerGroups: Object.keys(producersByGenerator).map(gid => ({
      generatorId: gid,
      siteCount: producersByGenerator[gid]?.length || 0,
      siteNames: producersByGenerator[gid]?.map(p => p.siteName) || []
    })),
    totalConsumers: consumers.length
  });
  
  // Debug log the structure of captive map and available shareholders
  const allShareholderIds = new Set();
  Object.entries(captiveMap).forEach(([genId, shareholders]) => {
    const shareIds = Object.keys(shareholders);
    shareIds.forEach(id => allShareholderIds.add(id));
    
    debugLog(`Captive map entry for generator ${genId}`, {
      shareholders: shareIds.map(shareId => ({
        shareId,
        ...shareholders[shareId],
        hasMatchingConsumers: consumers.some(c => String(c.shareholderCompanyId) === String(shareId))
      })),
      hasProducers: producersByGenerator[genId]?.length > 0,
      producerSites: producersByGenerator[genId]?.map(p => ({
        id: p.id,
        name: p.siteName,
        remaining: Object.values(p.remaining).reduce((a, b) => a + b, 0)
      }))
    });
  });
  
  // Log all unique shareholder IDs found in consumers
  const consumerShareholderIds = [...new Set(consumers.map(c => c.shareholderCompanyId).filter(Boolean))];
  debugLog('Shareholder ID summary', {
    totalUniqueShareholderIds: allShareholderIds.size,
    shareholderIdsInCaptiveMap: Array.from(allShareholderIds),
    shareholderIdsInConsumers: consumerShareholderIds,
    missingShareholderIds: consumerShareholderIds.filter(id => !allShareholderIds.has(id))
  });

  // Process each generator company in the captive map
  Object.entries(captiveMap).forEach(([genId, genData]) => {
    const generatorSites = producersByGenerator[genId] || [];
    const { shareholders, totalPercentage } = genData;
    
    // Skip if no generator sites found for this company
    if (generatorSites.length === 0) {
      debugLog('Skipping generator company - no production sites found', { 
        genId,
        totalShareholders: Object.keys(shareholders).length,
        availableGeneratorCompanies: Object.keys(producersByGenerator)
      });
      return;
    }

    // Get active shareholders with positive percentages
    let activeShareholders = Object.entries(shareholders)
      .filter(([_, sh]) => sh.status === 'active' && sh.percentage > 0);
    
    // Calculate total percentage for normalization
    const totalActivePercentage = activeShareholders.reduce(
      (sum, [_, sh]) => sum + (sh.percentage || 0), 0
    );
    
    // First pass: Calculate base normalized percentages
    let normalizedShareholders = activeShareholders.map(([id, sh]) => {
      const normalizedPercentage = totalActivePercentage > 0 
        ? (sh.percentage / totalActivePercentage) * 100 
        : 0;
      return {
        id,
        data: { ...sh, originalPercentage: sh.percentage },
        percentage: normalizedPercentage
      };
    });
    
    // Convert to whole numbers that sum to 100%
    const wholeNumberShares = normalizeToWholePercentages(
      normalizedShareholders.map(({ id, data, percentage }) => ({
        id,
        ...data,
        percentage
      }))
    );
    
    // Map back to the expected format
    activeShareholders = wholeNumberShares.map(({ id, ...data }) => [
      id,
      {
        ...data,
        originalPercentage: data.originalPercentage,
        percentage: Math.round(data.percentage) // Ensure it's a whole number
      }
    ]);
    
    // Verify the total is exactly 100%
    const finalTotalPercentage = activeShareholders.reduce((sum, [_, sh]) => sum + sh.percentage, 0);
    if (finalTotalPercentage !== 100) {
      console.warn(`Warning: Total percentage after normalization is ${finalTotalPercentage}%`);
    }

    debugLog(`\n=== Processing generator company ${genId} ===`, {
      totalAllocationPct: totalPercentage,
      normalizedTotalPct: activeShareholders.reduce((sum, [_, sh]) => sum + sh.percentage, 0),
      activeShareholders: activeShareholders.length,
      siteCount: generatorSites.length,
      siteNames: generatorSites.map(s => s.siteName),
      shareholders: activeShareholders.map(([id, data]) => ({
        shareId: id,
        name: data.name || `Shareholder ${id}`,
        originalPercentage: data.originalPercentage,
        normalizedPercentage: data.percentage,
        hasMatchingConsumers: consumers.some(c => String(c.shareholderCompanyId) === String(id))
      }))
    });

    // If no active shareholders, skip this generator
    if (activeShareholders.length === 0) {
      debugLog('Skipping generator - no active shareholders', { genId });
      return;
    }

    // Calculate total production across all generator sites for this company
    const totalProduction = generatorSites.reduce((sum, site) => {
      const siteTotal = getTotalRemaining(site);
      debugLog(`Production site ${site.siteName} (${site.id}) has ${siteTotal} units remaining`, {
        siteId: site.id,
        siteName: site.siteName,
        remaining: site.remaining,
        generatorCompanyId: site.generatorCompanyId
      });
      return sum + siteTotal;
    }, 0);
    
    debugLog(`Total production for generator company ${genId}`, {
      totalProduction,
      siteCount: generatorSites.length,
      siteNames: generatorSites.map(s => s.siteName)
    });

    // Sort shareholders by percentage (descending) to allocate to largest shareholders first
    const sortedShareholders = [...activeShareholders].sort((a, b) => b[1].percentage - a[1].percentage);
    
    // Process each active shareholder in order of their allocation percentage
    sortedShareholders.forEach(([shareId, captiveInfo]) => {
      const allocationPct = Number(captiveInfo.percentage) || 0;
      
      if (allocationPct <= 0) {
        debugLog('Skipping zero-percentage shareholder', {
          shareId,
          status: captiveInfo.status,
          percentage: allocationPct
        });
        return;
      }

      // Find all consumers for this shareholder
      const allShareholderConsumers = consumers.filter(cons => {
        const match = String(cons.shareholderCompanyId) === String(shareId);
        if (!match) return false;
        
        // Log detailed consumer info
        debugLog(`Matching consumer for shareholder ${shareId}`, {
          consumerId: cons.id,
          siteName: cons.siteName,
          remaining: Object.values(cons.remaining).reduce((a, b) => a + b, 0),
          periods: Object.entries(cons.remaining)
            .filter(([_, val]) => val > 0)
            .map(([p, v]) => ({ period: p, value: v }))
        });
        return true;
      });
      
      // Filter to only those with remaining consumption
      const shareholderConsumers = allShareholderConsumers.filter(cons => {
        const hasRemaining = getTotalRemaining(cons) > 0;
        if (!hasRemaining) {
          debugLog('Skipping consumer with no remaining demand', {
            consumerId: cons.id,
            siteName: cons.siteName,
            remaining: Object.values(cons.remaining).reduce((a, b) => a + b, 0)
          });
        }
        return hasRemaining;
      });

      debugLog(`\nProcessing shareholder ${shareId} (${captiveInfo.percentage}%)`, {
        totalConsumers: allShareholderConsumers.length,
        activeConsumers: shareholderConsumers.length,
        consumerDetails: shareholderConsumers.map(cons => ({
          id: cons.id,
          siteName: cons.siteName,
          remaining: Object.values(cons.remaining).reduce((a, b) => a + b, 0),
          periods: Object.entries(cons.remaining)
            .filter(([_, val]) => val > 0)
            .map(([period, val]) => ({ period, value: val }))
        }))
      });

      if (shareholderConsumers.length === 0) {
        debugLog('No active consumers with remaining demand for shareholder', { 
          shareId,
          totalConsumers: allShareholderConsumers.length,
          inactiveReasons: allShareholderConsumers.length > 0 ? {
            noRemaining: allShareholderConsumers.filter(c => !hasRemaining(c)).length,
            zeroRemaining: allShareholderConsumers.filter(c => 
              Object.values(c.remaining).every(v => v <= 0)
            ).length
          } : 'No consumers found'
        });
        return;
      }
      
      debugLog(`Processing ${shareholderConsumers.length} consumers for shareholder`, {
        shareId,
        allocationPercentage: captiveInfo.percentage
      });

      // Get the normalized percentage (should already be normalized to 100% total)
      const normalizedPct = captiveInfo.percentage;
      const allocationRatio = normalizedPct / 100;
      
      debugLog(`Processing allocation for shareholder ${shareId}`, {
        originalPercentage: captiveInfo.originalPercentage,
        normalizedPercentage: normalizedPct,
        allocationRatio: allocationRatio.toFixed(4),
        totalProduction,
        allocationAmount: totalProduction * allocationRatio,
        generatorSites: generatorSites.length,
        siteNames: generatorSites.map(s => s.siteName),
        consumerCount: shareholderConsumers.length,
        hasMatchingConsumers: consumers.some(c => String(c.shareholderCompanyId) === String(shareId))
      });
      
      // Track total allocated to ensure we don't exceed the captive percentage
      const totalAllocated = { ...Object.fromEntries(ALL_PERIODS.map(p => [p, 0])) };
      const maxAllocation = { ...Object.fromEntries(ALL_PERIODS.map(p => [p, 0])) };
      const totalProductionByPeriod = {};

      // First pass: Calculate maximum possible allocation for each period
      ALL_PERIODS.forEach(period => {
        // Calculate total available production across all generator sites for this period
        const totalProduction = generatorSites.reduce(
          (sum, prod) => sum + (Number(prod.remaining[period] || 0)), 0
        );
        totalProductionByPeriod[period] = totalProduction;
        
        // Calculate maximum allocation based on captive percentage
        maxAllocation[period] = Math.floor(totalProduction * allocationRatio);
        
        // Calculate total demand from all consumers for this period
        const totalDemand = shareholderConsumers.reduce(
          (sum, cons) => sum + (Number(cons.remaining[period] || 0)), 0
        );
        
        debugLog(`Period ${period} allocation capacity`, {
          totalProduction,
          allocationRatio: `${(allocationRatio * 100).toFixed(2)}%`,
          maxAllocation: maxAllocation[period],
          totalDemand,
          generatorSites: generatorSites.map(site => ({
            id: site.id,
            name: site.siteName,
            available: site.remaining[period] || 0
          }))
        });
      });

      // Allocate to each consumption site
      shareholderConsumers.forEach((cons, consIndex) => {
        const consumerTotalRemaining = Object.values(cons.remaining).reduce((a, b) => a + b, 0);
        debugLog(`\nProcessing consumer ${consIndex + 1}/${shareholderConsumers.length}`, {
          consumerId: cons.id,
          consumerName: cons.siteName,
          totalRemaining: consumerTotalRemaining,
          remainingByPeriod: Object.entries(cons.remaining)
            .filter(([_, val]) => val > 0)
            .map(([period, val]) => ({ period, value: val })),
          allocationPercentage: captiveInfo.percentage,
          allocationRatio: allocationRatio.toFixed(4)
        });
        
        if (consumerTotalRemaining <= 0) {
          debugLog('Skipping consumer - no remaining demand', {
            consumerId: cons.id,
            consumerName: cons.siteName
          });
          return;
        }
        
        // Process each period where consumer has need
        ALL_PERIODS.forEach(period => {
          const consumerNeed = Number(cons.remaining[period] || 0);
          
          if (consumerNeed <= 0) {
            debugLog(`Skipping period ${period} - no consumer need`, { 
              consumerId: cons.id,
              period,
              consumerNeed 
            });
            return;
          }
          
          // Skip if no allocation capacity for this period
          if (maxAllocation[period] <= 0) {
            debugLog(`Skipping period ${period} - no allocation capacity`, {
              consumerId: cons.id,
              period,
              maxAllocation: maxAllocation[period],
              totalProduction: totalProductionByPeriod[period] || 0,
              allocationRatio: allocationRatio.toFixed(4)
            });
            return;
          }
          
          if (maxAllocation[period] <= 0) {
            debugLog(`Skipping period ${period} - no allocation capacity`, { 
              consumerId: cons.id,
              period,
              maxAllocation: maxAllocation[period] 
            });
            return;
          }

          // Calculate allocation amount based on consumer need and remaining allocation
          let take = Math.min(consumerNeed, maxAllocation[period]);
          
          if (take <= 0) {
            debugLog(`No allocation possible for period ${period}`, {
              consumerId: cons.id,
              period,
              consumerNeed,
              maxAllocation: maxAllocation[period],
              take,
              remainingAllocation: maxAllocation[period] - totalAllocated[period],
              generatorSites: generatorSites.map(site => ({
                id: site.id,
                name: site.siteName,
                remaining: site.remaining[period] || 0
              }))
            });
            return;
          }
          
          debugLog(`Attempting to allocate ${take} units for period ${period}`, {
            consumerId: cons.id,
            period,
            consumerNeed,
            maxAllocation: maxAllocation[period],
            remainingAllocation: maxAllocation[period] - totalAllocated[period],
            generatorSites: generatorSites.map(site => ({
              id: site.id,
              name: site.siteName,
              remaining: site.remaining[period] || 0
            }))
          });

          // Apply IR adjustments if present
          if (cons.injection && cons.injection[period] > 0) {
            const injectionAmount = Number(cons.injection[period] || 0);
            debugLog(`Applying injection of ${injectionAmount} to period ${period}`, {
              consumerId: cons.id,
              period,
              beforeTake: take,
              afterTake: Math.min(take + injectionAmount, maxAllocation[period]),
              maxAllocation: maxAllocation[period],
              remainingAllocation: maxAllocation[period] - totalAllocated[period]
            });
            take = Math.min(take + injectionAmount, maxAllocation[period]);
          } else if (cons.reduction && cons.reduction[period] > 0) {
            const reductionAmount = Number(cons.reduction[period] || 0);
            debugLog(`Applying reduction of ${reductionAmount} to period ${period}`, {
              consumerId: cons.id,
              period,
              beforeTake: take,
              afterTake: Math.max(0, take - reductionAmount),
              maxAllocation: maxAllocation[period],
              remainingAllocation: maxAllocation[period] - totalAllocated[period]
            });
            take = Math.max(0, take - reductionAmount);
          }
          
          // Final check after IR adjustments
          if (take <= 0) {
            debugLog(`Skipping allocation - zero or negative take after IR adjustments`, {
              consumerId: cons.id,
              period,
              take,
              consumerNeed,
              maxAllocation: maxAllocation[period]
            });
            return;
          }
          
          // Ensure we don't exceed remaining allocation
          const remainingAllocation = maxAllocation[period] - totalAllocated[period];
          if (remainingAllocation <= 0) {
            debugLog(`Skipping allocation - no remaining allocation capacity`, {
              consumerId: cons.id,
              period,
              take,
              remainingAllocation,
              totalAllocated: totalAllocated[period],
              maxAllocation: maxAllocation[period]
            });
            return;
          }
          
          // Adjust take if it exceeds remaining allocation
          take = Math.min(take, remainingAllocation);
          debugLog(`Final allocation amount: ${take} units`, {
            consumerId: cons.id,
            period,
            consumerNeed,
            maxAllocation: maxAllocation[period],
            remainingAllocation: remainingAllocation,
            generatorSites: generatorSites.map(site => ({
              id: site.id,
              name: site.siteName,
              remaining: site.remaining[period] || 0
            }))
          });

          if (take <= 0) {
            debugLog(`Skipping allocation - zero or negative take after IR adjustments`, {
              consumerId: cons.id,
              period,
              take
            });
            return;
          }

          // Distribute allocation across generator sites
          let remainingTake = take;
          
          debugLog(`Allocating ${remainingTake} units for period ${period}`, {
            consumerId: cons.id,
            period,
            generatorSites: generatorSites.length
          });
          
          for (const prod of generatorSites) {
            if (remainingTake <= 0) {
              debugLog('Allocation complete - no remaining take', { consumerId: cons.id, period });
              break;
            }
            
            if (cons.month && prod.month && String(cons.month) !== String(prod.month)) {
              debugLog('Skipping producer - month mismatch', {
                consumerMonth: cons.month,
                producerMonth: prod.month
              });
              continue;
            }

            const producerAvailable = Number(prod.remaining[period] || 0);
            if (producerAvailable <= 0) {
              debugLog('Skipping producer - no available capacity', {
                producerId: prod.id,
                period,
                available: producerAvailable
              });
              continue;
            }

            const siteTake = Math.min(remainingTake, producerAvailable);
            if (siteTake <= 0) {
              debugLog('Skipping producer - zero allocation', {
                producerId: prod.id,
                period,
                siteTake,
                remainingTake,
                producerAvailable
              });
              continue;
            }

            debugLog(`Allocating ${siteTake} units from producer ${prod.id}`, {
              producerId: prod.id,
              consumerId: cons.id,
              period,
              siteTake,
              remainingTake: remainingTake - siteTake,
              producerAvailable: producerAvailable - siteTake
            });
            
            try {
              // Apply allocation
              prod.remaining[period] = Math.max(0, producerAvailable - siteTake);
              remainingTake -= siteTake;
              totalAllocated[period] += siteTake;
              maxAllocation[period] -= siteTake;

              // Update consumer remaining
              cons.remaining[period] = Math.max(0, cons.remaining[period] - siteTake);

              // Find or create allocation record
              let record = allocations.find(a => 
                a.productionSiteId === prod.productionSiteId && 
                a.consumptionSiteId === cons.consumptionSiteId &&
                a.month === monthYear
              );

              if (!record) {
                record = createAllocationRecord(prod, cons, monthYear, allocationRatio * 100);
                allocations.push(record);
                debugLog('Created new allocation record', {
                  productionSiteId: prod.productionSiteId,
                  consumptionSiteId: cons.consumptionSiteId,
                  monthYear
                });
              }

              const prevAllocated = record.allocated[period] || 0;
              record.allocated[period] = prevAllocated + siteTake;

              // Include IR data in record if present
              if (cons.irType) {
                record.irType = cons.irType;
                if (cons.injection) record.injection = { ...cons.injection };
                if (cons.reduction) record.reduction = { ...cons.reduction };
              }

              debugLog(`Allocated ${siteTake} units (total: ${prevAllocated + siteTake})`, {
                producerId: prod.id,
                consumerId: cons.id,
                period,
                allocationPercentage: (allocationRatio * 100).toFixed(2) + '%',
                remainingCapacity: prod.remaining[period],
                remainingNeed: cons.remaining[period]
              });
              
            } catch (error) {
              console.error('Error during allocation:', {
                error,
                producerId: prod.id,
                consumerId: cons.id,
                period,
                siteTake
              });
            }
          }
        });
      });
    });
  });

    // Handle banking units if available
  for (const bank of banked) {
    const bankingSites = producersByGenerator[String(bank.generatorCompanyId)] || [];
    const bankingAllocationPct = bankingSites.length > 0 ? 100 / bankingSites.length : 100;
    
    debugLog(`Processing banking for generator ${bank.generatorCompanyId}`, {
      totalBanked: getTotalRemaining(bank),
      bankingSites: bankingSites.length,
      allocationPct: bankingAllocationPct
    });

    // Try to satisfy remaining consumer needs with banked units
    for (const cons of consumers) {
      if (!cons.consumptionSiteId) continue;
      if (cons.month && bank.month && String(cons.month) !== String(bank.month)) continue;

      // Process each period
      ALL_PERIODS.forEach(period => {
        const need = Number(cons.remaining[period] || 0);
        const available = Number(bank.remaining[period] || 0);

        if (need <= 0 || available <= 0) return;

        // Calculate allocation amount based on banking percentage
        const target = Math.round((need * bankingAllocationPct) / 100);
        const take = Math.min(target, available);

        if (take <= 0) return;

        // Apply banking allocation
        bank.remaining[period] = Math.max(0, bank.remaining[period] - take);
        cons.remaining[period] = Math.max(0, cons.remaining[period] - take);

        // Record allocation
        let rec = allocations.find(a => 
          a.productionSiteId === bank.productionSiteId && 
          a.consumptionSiteId === cons.consumptionSiteId && 
          a.month === monthYear
        );

        if (!rec) {
          rec = createAllocationRecord(
            { ...bank, generatorCompanyId: bank.generatorCompanyId }, 
            cons, 
            monthYear,
            bankingAllocationPct
          );
          allocations.push(rec);
          debugLog('Created new banking allocation record', {
            productionSiteId: bank.productionSiteId,
            consumptionSiteId: cons.consumptionSiteId,
            monthYear,
            allocationPct: bankingAllocationPct
          });
        }

        const prevAllocated = rec.allocated[period] || 0;
        rec.allocated[period] = prevAllocated + take;
        
        debugLog(`Allocated ${take} banked units to consumer ${cons.consumptionSiteId}`, {
          period,
          bankedAvailable: available,
          consumerNeed: need,
          allocated: rec.allocated[period]
        });
      });
    }

    // Handle leftover banking units
    if (bank.month === monthYear) {
      const leftoverBanking = Object.entries(bank.remaining)
        .filter(([_, amount]) => Number(amount) > 0)
        .reduce((acc, [period, amount]) => {
          acc[period] = amount;
          return acc;
        }, {});

      if (Object.keys(leftoverBanking).length > 0) {
        let rec = bankingAllocations.find(r => 
          r.productionSiteId === bank.productionSiteId && 
          r.month === monthYear
        );

        if (!rec) {
          rec = {
            productionSiteId: bank.productionSiteId,
            productionSite: bank.siteName || '',
            month: monthYear,
            type: 'BANKING',
            allocated: Object.fromEntries(ALL_PERIODS.map(p => [p, 0])),
            bankingEnabled: true,
            consumptionSite: 'Banking',
            consumptionSiteId: 'BANK',
            id: `banking_${bank.productionSiteId}_${monthYear}`,
            generatorCompanyId: bank.generatorCompanyId,
            allocationPercentage: bankingAllocationPct,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          bankingAllocations.push(rec);
        }

        Object.entries(leftoverBanking).forEach(([period, amount]) => {
          rec.allocated[period] = (rec.allocated[period] || 0) + amount;
        });
      }
    }
  }

  // Handle remaining producer units (banking or lapse)
  producers.forEach(prod => {
    const remainingByPeriod = Object.entries(prod.remaining || {})
      .filter(([_, amount]) => Number(amount) > 0);
      
    if (remainingByPeriod.length === 0) return;
    
    const recordType = prod.bankingEnabled ? 'BANKING' : 'LAPSE';
    const targetArray = recordType === 'BANKING' ? bankingAllocations : lapseAllocations;
    const genId = String(prod.generatorCompanyId || '1');
    const genSites = producersByGenerator[genId] || [];
    const siteAllocationPct = genSites.length > 0 ? 100 / genSites.length : 100;
    const totalRemaining = remainingByPeriod.reduce((sum, [_, amount]) => sum + Number(amount), 0);

    debugLog(`Processing ${totalRemaining} remaining units for ${recordType}`, {
      productionSiteId: prod.productionSiteId,
      siteName: prod.siteName,
      generatorCompanyId: genId,
      bankingEnabled: prod.bankingEnabled,
      siteAllocationPct,
      remainingByPeriod: Object.fromEntries(remainingByPeriod)
    });

    // Group by period for better tracking
    const remaining = remainingByPeriod.reduce((acc, [period, amount]) => {
      acc[period] = amount;
      return acc;
    }, {});

    // Find or create allocation record
    let allocation = targetArray.find(a => 
      a.productionSiteId === prod.productionSiteId && 
      a.month === monthYear
    );

    if (!allocation) {
      allocation = {
        productionSiteId: prod.productionSiteId,
        productionSite: prod.siteName || '',
        month: monthYear,
        type: recordType,
        allocated: {},
        bankingEnabled: recordType === 'BANKING',
        consumptionSite: recordType === 'BANKING' ? 'Banking' : 'Lapsed',
        consumptionSiteId: recordType === 'BANKING' ? 'BANK' : 'LAPSE',
        id: `${recordType.toLowerCase()}_${prod.productionSiteId}_${monthYear}`,
        generatorCompanyId: genId,
        allocationPercentage: siteAllocationPct,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      targetArray.push(allocation);
    }

    // Allocate remaining units by period
    Object.entries(remaining).forEach(([period, amount]) => {
      if (amount <= 0) return;
      
      const allocated = Number(amount);
      allocation.allocated[period] = (allocation.allocated[period] || 0) + allocated;
      
      debugLog(`Allocated ${allocated} units to ${recordType}`, {
        period,
        productionSiteId: prod.productionSiteId,
        siteName: prod.siteName,
        remainingAfterAllocation: 0,
        totalAllocated: allocation.allocated[period]
      });
    });
    
    // Clear remaining units after allocation
    Object.keys(remaining).forEach(period => {
      prod.remaining[period] = 0;
    });
  });

  const result = {
    allocations,
    lapseAllocations,
    bankingAllocations,
    remainingProduction: producers.filter(hasRemaining),
    remainingConsumption: consumers.filter(hasRemaining),
    _debug: {
      totalAllocations: allocations.length,
      totalLapseAllocations: lapseAllocations.length,
      totalBankingAllocations: bankingAllocations.length,
      remainingProduction: producers.filter(hasRemaining).length,
      remainingConsumption: consumers.filter(hasRemaining).length,
      totalAllocated: allocations.reduce((sum, alloc) => {
        return sum + ALL_PERIODS.reduce((s, p) => s + (alloc.allocated[p] || 0), 0);
      }, 0)
    }
  };
  
  debugLog('Allocation calculation complete', result._debug);
  
  return result;
}
