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

export function calculateAllocations({
  productionUnits = [],
  consumptionUnits = [],
  bankingUnits = [],
  captiveData = [], // Changed from shareholdings to captiveData
  month = '',
  productionSites = []
}) {
  const allocationMonth = month || `${String(new Date().getMonth() + 1).padStart(2, '0')}${new Date().getFullYear()}`;
  const monthYear = allocationMonth;

  // Build captive allocation map using generator company ID and shareholder company ID
  const captiveMap = {};
  captiveData.forEach(entry => {
    const genId = String(entry.generatorCompanyId);
    const shareId = String(entry.shareholderCompanyId);
    
    if (!captiveMap[genId]) {
      captiveMap[genId] = {};
    }
    
    if (!captiveMap[genId][shareId] || entry.updatedAt > captiveMap[genId][shareId].updatedAt) {
      captiveMap[genId][shareId] = {
        percentage: Number(entry.allocationPercentage) || 0,
        status: entry.allocationStatus || 'active',
        updatedAt: entry.updatedAt
      };
    }
  });

  // Sort producers by commission date, newest first
  const producers = productionUnits
    .map(unit => {
      const siteInfo = productionSites.find(ps => 
        String(ps.productionSiteId || ps.id) === String(unit.productionSiteId || unit.id)
      );
      
      return {
        ...createUnitWithRemaining(unit, true),
        commissionDate: unit.commissionDate || unit.dateOfCommission || 
          (siteInfo && (siteInfo.dateOfCommission || siteInfo.commissionDate)) ||
          new Date(0).toISOString(),
        _siteInfo: siteInfo,
        generatorCompanyId: siteInfo?.generatorCompanyId
      };
    })
    .sort((a, b) => new Date(b.commissionDate) - new Date(a.commissionDate));

  // Group producers by generator company ID for better allocation management
  const producersByGenerator = {};
  producers.forEach(prod => {
    const genId = String(prod.generatorCompanyId);
    if (!producersByGenerator[genId]) {
      producersByGenerator[genId] = [];
    }
    producersByGenerator[genId].push(prod);
  });

  // Initialize consumers and map them to shareholder companies
  const consumers = consumptionUnits.map(unit => createUnitWithRemaining(unit, false));

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
  Object.entries(captiveMap).forEach(([genId, shareholders]) => {
    const generatorSites = producersByGenerator[genId] || [];
    if (generatorSites.length === 0) return;

    Object.entries(shareholders).forEach(([shareId, captiveInfo]) => {
      if (captiveInfo.status !== 'active' || captiveInfo.percentage <= 0) return;

      // Find consumption sites for this shareholder
      const shareholderConsumers = consumers.filter(cons => 
        String(cons.shareholderCompanyId) === shareId
      );

      if (shareholderConsumers.length === 0) return;

      // Calculate per-site allocation percentage based on captive entry
      const siteAllocationPct = captiveInfo.percentage / generatorSites.length;

      // Allocate to each consumption site
      shareholderConsumers.forEach(cons => {
        generatorSites.forEach(prod => {
          // Skip if months don't match
          if (cons.month && prod.month && String(cons.month) !== String(prod.month)) return;

          // Process each period
          ALL_PERIODS.forEach(period => {
            const consumerNeed = Number(cons.remaining[period] || 0);
            const producerAvailable = Number(prod.remaining[period] || 0);

            if (consumerNeed <= 0 || producerAvailable <= 0) return;

            // Calculate allocation amount based on percentage
            const target = Math.round((consumerNeed * siteAllocationPct) / 100);
            let take = Math.min(target, producerAvailable);

            // Apply IR adjustments if present
            if (cons.injection && cons.injection[period] > 0) {
              console.log(`[IR] Applying injection of ${cons.injection[period]} to period ${period} for consumer ${cons.consumptionSiteId}`);
              const additionalNeed = Math.round((Number(cons.injection[period]) * siteAllocationPct) / 100);
              take = Math.min(take + additionalNeed, producerAvailable);
            } else if (cons.reduction && cons.reduction[period] > 0) {
              console.log(`[IR] Applying reduction of ${cons.reduction[period]} to period ${period} for consumer ${cons.consumptionSiteId}`);
              const reduction = Math.round((Number(cons.reduction[period]) * siteAllocationPct) / 100);
              take = Math.max(0, take - reduction);
            }

            if (take <= 0) return;

            // Apply allocation
            prod.remaining[period] = Math.max(0, prod.remaining[period] - take);
            cons.remaining[period] = Math.max(0, cons.remaining[period] - take);

            // Record allocation
            let record = allocations.find(a => 
              a.productionSiteId === prod.productionSiteId && 
              a.consumptionSiteId === cons.consumptionSiteId &&
              a.month === monthYear
            );

            if (!record) {
              record = createAllocationRecord(prod, cons, monthYear, siteAllocationPct);
              allocations.push(record);
            }

            record.allocated[period] = (record.allocated[period] || 0) + take;

            // Include IR data in record if present
            if (cons.irType) {
              record.irType = cons.irType;
              if (cons.injection) record.injection = { ...cons.injection };
              if (cons.reduction) record.reduction = { ...cons.reduction };
            }

            console.log(`[Allocation] Allocated ${take} from ${prod.productionSiteId} to ${cons.consumptionSiteId} for period ${period} (${siteAllocationPct}%)`);
          });
        });
      });
    });
  });

    // Handle banking units if available
  for (const bank of banked) {
    const bankingSites = producersByGenerator[String(bank.generatorCompanyId)] || [];
    const bankingAllocationPct = bankingSites.length > 0 ? 100 / bankingSites.length : 0;

    // Try to satisfy remaining consumer needs with banked units
    for (const cons of consumers) {
      if (!cons.consumptionSiteId) continue;
      if (cons.month && bank.month && String(cons.month) !== String(bank.month)) continue;

      // Process each period
      ALL_PERIODS.forEach(period => {
        const need = Number(cons.remaining[period] || 0);
        const available = Number(bank.remaining[period] || 0);

        if (need <= 0 || available <= 0) return;

        // Calculate allocation amount
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
        }

        rec.allocated[period] = (rec.allocated[period] || 0) + take;
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
    const leftover = Object.entries(prod.remaining)
      .filter(([_, amount]) => Number(amount) > 0)
      .reduce((acc, [period, amount]) => {
        acc[period] = amount;
        return acc;
      }, {});

    if (Object.keys(leftover).length > 0) {
      const recordType = prod.bankingEnabled ? 'BANKING' : 'LAPSE';
      const targetArray = recordType === 'BANKING' ? bankingAllocations : lapseAllocations;

      // Calculate percentage based on number of sites for this generator
      const genId = String(prod.generatorCompanyId);
      const genSites = producersByGenerator[genId] || [];
      const siteAllocationPct = genSites.length > 0 ? 100 / genSites.length : 0;

      let rec = targetArray.find(r => 
        r.productionSiteId === prod.productionSiteId && 
        r.month === monthYear
      );

      if (!rec) {
        rec = {
          productionSiteId: prod.productionSiteId,
          productionSite: prod.siteName || '',
          month: monthYear,
          type: recordType,
          allocated: Object.fromEntries(ALL_PERIODS.map(p => [p, 0])),
          bankingEnabled: !!prod.bankingEnabled,
          consumptionSite: recordType === 'BANKING' ? 'Banking' : 'Lapsed',
          consumptionSiteId: recordType === 'BANKING' ? 'BANK' : 'LAPSE',
          id: `${recordType.toLowerCase()}_${prod.productionSiteId}_${monthYear}`,
          generatorCompanyId: prod.generatorCompanyId,
          allocationPercentage: siteAllocationPct,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        targetArray.push(rec);
      }

      Object.entries(leftover).forEach(([period, amount]) => {
        rec.allocated[period] = (rec.allocated[period] || 0) + amount;
      });
    }
  });

  return {
    allocations,
    lapseAllocations,
    bankingAllocations,
    remainingProduction: producers.filter(hasRemaining),
    remainingConsumption: consumers.filter(hasRemaining)
  };
}
