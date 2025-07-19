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
  return {
    id: unit.id,
    productionSiteId: isProduction ? (unit.productionSiteId || unit.id) : undefined,
    consumptionSiteId: !isProduction ? (unit.consumptionSiteId || unit.id) : undefined,
    siteName: unit.siteName || '',
    type: unit.type?.toUpperCase() || '',
    bankingEnabled: isProduction ? unit.banking === 1 : undefined,
    month: unit.month,
    companyId: unit.companyId,
    remaining
  };
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

export function calculateAllocations({ productionUnits = [], consumptionUnits = [], bankingUnits = [], shareholdings = [] }) {
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
    for (const prod of group) {
      const left = prod.remaining[period];
      if (left <= 0) continue;

      const base = {
        productionSiteId: prod.productionSiteId,
        productionSite: prod.siteName,
        month: prod.month,
        siteType: prod.type,
        siteName: prod.siteName,
        allocated: Object.fromEntries(ALL_PERIODS.map(p => [p, 0])),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (prod.bankingEnabled) {
        base.type = 'BANKING';
        base.consumptionSiteId = 'BANK';
        base.consumptionSite = 'Banking';
        base.allocated[period] = left;
        bankingAllocations.push(base);
      } else {
        base.type = 'LAPSE';
        base.consumptionSiteId = 'LAPSE';
        base.consumptionSite = 'Lapsed';
        base.allocated[period] = left;
        lapseAllocations.push(base);
      }
    }
  }

  // Process Peak & Non-Peak
  const processPeriods = (periods, groups) => {
    for (const period of periods) {
      if (consumers.every(c => c.remaining[period] <= 0)) continue;

      for (const grp of groups) {
        allocate(grp, consumers, period);
        handleLeftovers(period, grp);
      }

      allocateFromBanking(period);
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
