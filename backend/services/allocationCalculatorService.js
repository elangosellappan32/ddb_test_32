// Allocation Calculator
// Allocates solar first, then wind, then banking units (for windmills with banking enabled)
// Follows all period, banking, and lapse rules

const PEAK_PERIODS = ['c2', 'c3'];
const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];
const ALL_PERIODS = [...NON_PEAK_PERIODS, ...PEAK_PERIODS];

/**
 * Advanced Allocation Calculator
 * Allocates units from ProductionUnitsTable and BankingUnitsTable to ConsumptionUnitsTable based on percentage and period rules.
 * - Peak units (c2, c3) can be used for non-peak (c1, c4, c5), but not vice versa.
 * - Non-peak units cannot be shared to other non-peak or peak periods (e.g., c1→c3/c4 not allowed, c1→c1 allowed).
 * - Solar cannot bank; only windmills with banking enabled can bank unused units; others lapse.
 * - Allocation is driven by consumption unit percentage.
 * - Allocation is done: Solar (non-banking) → Wind (non-banking) → Banking wind → Banking units.
 * - No units are double-counted. All data is suitable for Allocation Details Table.
 *
 * @param {Object[]} productionUnits
 * @param {Object[]} consumptionUnits
 * @param {Object[]} bankingUnits
 * @returns {Object} { allocations, bankingAllocations, lapseAllocations }
 */
export function calculateAllocations({ productionUnits, consumptionUnits, bankingUnits }) {
  const PEAK_PERIODS = ['c2', 'c3'];
  const NON_PEAK_PERIODS = ['c1', 'c4', 'c5'];
  const ALL_PERIODS = [...NON_PEAK_PERIODS, ...PEAK_PERIODS];

  // Deep copy units with remaining
  const prodUnits = (productionUnits || []).map(u => ({
    productionSiteId: u.productionSiteId || u.id,
    productionSite: u.productionSite || u.siteName,
    siteName: u.siteName,
    month: u.month,
    type: (u.type || '').toUpperCase(),
    // Determine banking support from 'banking' flag
    bankingEnabled: Number(u.banking) === 1,
    remaining: { c1: +u.c1 || 0, c2: +u.c2 || 0, c3: +u.c3 || 0, c4: +u.c4 || 0, c5: +u.c5 || 0 }
  }));
  const consUnits = (consumptionUnits || []).map(u => ({
    consumptionSiteId: u.consumptionSiteId || u.id,
    consumptionSite: u.consumptionSite || u.siteName,
    siteName: u.siteName,
    month: u.month,
    remaining: { c1: +u.c1 || 0, c2: +u.c2 || 0, c3: +u.c3 || 0, c4: +u.c4 || 0, c5: +u.c5 || 0 }
  }));
  const bankUnits = (bankingUnits || []).map(u => ({
    productionSiteId: u.productionSiteId || u.id,
    productionSite: u.productionSite || u.siteName,
    siteName: u.siteName,
    month: u.month,
    remaining: { c1: +u.c1 || 0, c2: +u.c2 || 0, c3: +u.c3 || 0, c4: +u.c4 || 0, c5: +u.c5 || 0 }
  }));

  // Classify production sources
  const solarUnits = prodUnits.filter(u => u.type === 'SOLAR');
  const windUnits = prodUnits.filter(u => u.type === 'WIND' && !u.bankingEnabled);
  const bankingWindUnits = prodUnits.filter(u => u.type === 'WIND' && u.bankingEnabled);

  const allocations = [];
  const bankingAllocations = [];
  const lapseAllocations = [];

  // Sort consumption sites by allocation priority (first selected site first)
  const sortedConsUnits = [...consUnits].sort((a, b) => {
    // If both have month, compare months first
    if (a.month && b.month) {
      const monthA = parseInt(a.month.substring(0, 2));
      const monthB = parseInt(b.month.substring(0, 2));
      const yearA = parseInt(a.month.substring(2));
      const yearB = parseInt(b.month.substring(2));
      if (yearA !== yearB) return yearA - yearB;
      if (monthA !== monthB) return monthA - monthB;
    }
    // Otherwise, sort by site name (first selected site first)
    return a.siteName.localeCompare(b.siteName);
  });

  // Allocate to consumption demands with priority
  [solarUnits, windUnits, bankingWindUnits, bankUnits].forEach(group => {
    group.forEach(prod => {
      // First allocate to the first selected site
      const firstSite = sortedConsUnits[0];
      if (firstSite && (!prod.month || prod.month === firstSite.month)) {
        const allocation = {
          productionSiteId: prod.productionSiteId,
          productionSite: prod.productionSite,
          siteType: prod.type,
          siteName: prod.siteName,
          consumptionSiteId: firstSite.consumptionSiteId,
          consumptionSite: firstSite.consumptionSite,
          month: firstSite.month,
          allocated: {}
        };
        let anyAlloc = false;
        ALL_PERIODS.forEach(period => {
          let alloc = 0;
          const demand = firstSite.remaining[period];
          if (demand > 0) {
            if (NON_PEAK_PERIODS.includes(period)) {
              const same = Math.min(prod.remaining[period], demand);
              alloc += same;
              prod.remaining[period] -= same;
              firstSite.remaining[period] -= same;
              if (firstSite.remaining[period] > 0) {
                PEAK_PERIODS.forEach(peak => {
                  if (firstSite.remaining[period] <= 0) return;
                  const palloc = Math.min(prod.remaining[peak], firstSite.remaining[period]);
                  alloc += palloc;
                  prod.remaining[peak] -= palloc;
                  firstSite.remaining[period] -= palloc;
                });
              }
            } else {
              const same = Math.min(prod.remaining[period], demand);
              alloc += same;
              prod.remaining[period] -= same;
              firstSite.remaining[period] -= same;
            }
          }
          allocation.allocated[period] = alloc;
          if (alloc > 0) anyAlloc = true;
        });
        if (anyAlloc) allocations.push(allocation);
      }

      // Then allocate remaining units to other sites
      sortedConsUnits.slice(1).forEach(cons => {
        if (prod.month && cons.month && prod.month !== cons.month) return;
        const allocation = {
          productionSiteId: prod.productionSiteId,
          productionSite: prod.productionSite,
          siteType: prod.type,
          siteName: prod.siteName,
          consumptionSiteId: cons.consumptionSiteId,
          consumptionSite: cons.consumptionSite,
          month: cons.month,
          allocated: {}
        };
        let anyAlloc = false;
        ALL_PERIODS.forEach(period => {
          let alloc = 0;
          const demand = cons.remaining[period];
          if (demand > 0) {
            if (NON_PEAK_PERIODS.includes(period)) {
              const same = Math.min(prod.remaining[period], demand);
              alloc += same;
              prod.remaining[period] -= same;
              cons.remaining[period] -= same;
              if (cons.remaining[period] > 0) {
                PEAK_PERIODS.forEach(peak => {
                  if (cons.remaining[period] <= 0) return;
                  const palloc = Math.min(prod.remaining[peak], cons.remaining[period]);
                  alloc += palloc;
                  prod.remaining[peak] -= palloc;
                  cons.remaining[period] -= palloc;
                });
              }
            } else {
              const same = Math.min(prod.remaining[period], demand);
              alloc += same;
              prod.remaining[period] -= same;
              cons.remaining[period] -= same;
            }
          }
          allocation.allocated[period] = alloc;
          if (alloc > 0) anyAlloc = true;
        });
        if (anyAlloc) allocations.push(allocation);
      });
    });
  });

  // Handle leftover: banking then lapse
  [...bankingWindUnits, ...bankUnits].forEach(prod => {
    const total = ALL_PERIODS.reduce((s, p) => s + prod.remaining[p], 0);
    if (total > 0) bankingAllocations.push({
      productionSiteId: prod.productionSiteId,
      productionSite: prod.productionSite,
      siteType: prod.type,
      siteName: prod.siteName,
      month: prod.month,
      allocated: { ...prod.remaining }
    });
  });
  [...solarUnits, ...windUnits].forEach(prod => {
    const total = ALL_PERIODS.reduce((s, p) => s + prod.remaining[p], 0);
    if (total > 0) lapseAllocations.push({
      productionSiteId: prod.productionSiteId,
      productionSite: prod.productionSite,
      siteType: prod.type,
      siteName: prod.siteName,
      month: prod.month,
      allocated: { ...prod.remaining }
    });
  });

  return { allocations, bankingAllocations, lapseAllocations };
}