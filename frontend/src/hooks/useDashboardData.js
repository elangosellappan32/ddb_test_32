import { useState, useEffect, useCallback } from 'react';
import allocationService from '../services/allocationService';
import lapseApi from '../services/lapseApi';
import bankingApi from '../services/bankingApi';
import productionSiteApi from '../services/productionSiteApi';
import consumptionSiteApi from '../services/consumptionSiteApi';
import { getAccessibleSiteIds } from '../utils/siteAccessUtils';

// Helper function to get financial year months (April to March) - same as GraphicalAllocationReport
function getFinancialYearMonths(fy) {
  const [startYear, endYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${m < 10 ? '0' : ''}${m}${startYear}`);
  for (let m = 1; m <= 3; m++) months.push(`${m < 10 ? '0' : ''}${m}${endYear}`);
  return months;
}

// Process lapse data to calculate totals by month
function processLapseData(lapseData, months) {
  const byMonth = {};
  months.forEach(month => {
    byMonth[month] = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0 };
  });

  (lapseData || []).forEach(record => {
    let month = '';
    if (record.sk) month = record.sk;
    else if (record.date) {
      const d = new Date(record.date);
      month = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    } else if (record.period) month = record.period;

    if (!month || !byMonth[month]) return;

    const allocated = record.allocated || record;
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(c => {
      byMonth[month][c] += Math.max(0, Number(allocated[c] || 0));
    });

    byMonth[month].total = Object.values(byMonth[month])
      .slice(0, 5)
      .reduce((sum, val) => sum + val, 0);
  });

  return byMonth;
}

// Process banking data similar to GraphicalBankingReport
function processBankingData(bankingData, months) {
  const byMonth = {};
  months.forEach(month => {
    byMonth[month] = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0 };
  });

  (bankingData || []).forEach(record => {
    let month = '';
    if (record.sk) month = record.sk;
    else if (record.date) {
      const d = new Date(record.date);
      month = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
    } else if (record.period) month = record.period;

    if (!month || !byMonth[month]) return;

    const allocated = record.allocated || record;
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(c => {
      byMonth[month][c] += Math.max(0, Number(allocated[c] || 0));
    });

    byMonth[month].total = Object.values(byMonth[month])
      .slice(0, 5)
      .reduce((sum, val) => sum + val, 0);
  });

  return byMonth;
}

// Helper function to calculate total units from processed monthly data
const calculateTotalUnits = (processedData, type = 'allocation') => {
  if (!processedData || typeof processedData !== 'object') {
    console.log(`[${type.toUpperCase()}] No data to calculate`);
    return 0;
  }

  console.log(`[${type.toUpperCase()}] Calculating total from processed monthly data`);
  
  const result = Object.values(processedData).reduce((sum, monthData) => {
    return sum + (monthData.total || 0);
  }, 0);

  console.log(`[${type.toUpperCase()}] Final total:`, result);
  return result;
};

const useDashboardData = (user) => {
  const [allocationStats, setAllocationStats] = useState({
    totalBankingUnits: 0,
    totalAllocationUnits: 0,
    totalLapseUnits: 0,
    unitsAllocated: 0,
    pendingAllocations: 0,
    allocationRate: 0,
    loading: true,
    error: null
  });

  const [invoiceStats, setInvoiceStats] = useState({
    dailyInvoices: 0,
    monthlyInvoices: 0,
    pendingInvoices: 0,
    completionRate: 0,
    loading: true,
    error: null
  });

  // Get current financial year (April to March)
  const getCurrentFinancialYear = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12

    // Financial year starts in April
    const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    return `${startYear}-${startYear + 1}`;
  };

  const fetchAllocationStats = useCallback(async () => {
    if (!user) {
      console.error('[Dashboard] No user provided to useDashboardData');
      return;
    }

    console.group('[Dashboard] Fetching allocation stats');
    try {
      setAllocationStats(prev => ({ ...prev, loading: true, error: null }));

      // Get current financial year and months
      const financialYear = getCurrentFinancialYear();
      const months = getFinancialYearMonths(financialYear);
      console.log('[Dashboard] Financial year:', financialYear);
      console.log('[Dashboard] Financial year months:', months);

      // Get accessible site IDs - following GraphicalAllocationReport pattern
      const prodIds = getAccessibleSiteIds(user, 'production');
      const consIds = getAccessibleSiteIds(user, 'consumption');

      const extractSiteId = id => (id && id.includes('_') ? id.split('_')[1] : id);
      const accessibleProdIds = prodIds.map(extractSiteId);
      const accessibleConsIds = consIds.map(extractSiteId);

      // Fetch site info for filtering - following GraphicalAllocationReport pattern
      const [prods, conss] = await Promise.all([
        productionSiteApi.fetchAll().then(r => r.data || []),
        consumptionSiteApi.fetchAll().then(r => r.data || [])
      ]);

      console.log('[Dashboard] Accessible prod IDs:', accessibleProdIds);
      console.log('[Dashboard] Accessible cons IDs:', accessibleConsIds);

      // 1. FETCH ALLOCATION DATA - Using the correct API like GraphicalAllocationReport
      console.group('[Dashboard] Fetching allocation data');
      const allocArrays = await Promise.all(
        months.map(m => allocationService.fetchAllocationsByMonth(m).catch(err => {
          console.error(`[Dashboard] Error fetching allocations for ${m}:`, err);
          return [];
        }))
      );

      let allocs = allocArrays.flat();
      console.log('[Dashboard] Raw allocations fetched:', allocs.length);

      // Handle allocated object mapping - same as GraphicalAllocationReport
      allocs = allocs.map(item =>
        item && item.allocated && typeof item.allocated === 'object'
          ? { ...item, ...item.allocated }
          : item
      );

      // Filter by accessible sites - same logic as GraphicalAllocationReport
      allocs = allocs.filter(item => {
        if (!item.pk) return false;

        let prodId, consId;
        const pkParts = item.pk.split('_');
        
        if (pkParts.length === 3) {
          [, prodId, consId] = pkParts;
        } else {
          [prodId, consId] = pkParts;
        }

        return (
          (!accessibleProdIds.length || accessibleProdIds.includes(prodId)) &&
          (!accessibleConsIds.length || accessibleConsIds.includes(consId))
        );
      });

      console.log('[Dashboard] Filtered allocations:', allocs.length);
      console.groupEnd();

      // Process allocation data by month
      const allocationByMonth = {};
      months.forEach(month => {
        allocationByMonth[month] = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, total: 0 };
      });

      allocs.forEach(item => {
        const month = item.sk;
        if (!month || !allocationByMonth[month]) return;

        const c1 = Math.max(0, Number(item.c1) || 0);
        const c2 = Math.max(0, Number(item.c2) || 0);
        const c3 = Math.max(0, Number(item.c3) || 0);
        const c4 = Math.max(0, Number(item.c4) || 0);
        const c5 = Math.max(0, Number(item.c5) || 0);

        allocationByMonth[month].c1 += c1;
        allocationByMonth[month].c2 += c2;
        allocationByMonth[month].c3 += c3;
        allocationByMonth[month].c4 += c4;
        allocationByMonth[month].c5 += c5;
        allocationByMonth[month].total += (c1 + c2 + c3 + c4 + c5);
      });

      // 2. FETCH BANKING DATA - Similar to GraphicalBankingReport
      console.group('[Dashboard] Fetching banking data');
      const allSites = await productionSiteApi.fetchAll().then(res => res.data || []);
      let allBankingData = [];

      for (const combinedId of prodIds) {
        const [companyId, siteId] = combinedId.split('_');
        const siteObj = allSites.find(s =>
          String(s.productionSiteId) === String(siteId) &&
          String(s.companyId) === String(companyId)
        );

        if (!siteObj) continue;

        const siteKey = `${siteObj.companyId}_${siteObj.productionSiteId}`;

        try {
          const response = await bankingApi.fetchAllByPk(siteKey);
          const bankingData = Array.isArray(response) ? response : [];
          
          // Filter for current financial year
          const currentYearBanking = bankingData.filter(item => {
            if (!item) return false;
            let monthKey = item.sk || item.period;
            if (item.date && !monthKey) {
              const d = new Date(item.date);
              monthKey = `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
            }
            return monthKey && months.includes(monthKey);
          });

          allBankingData = [...allBankingData, ...currentYearBanking];
        } catch (error) {
          console.error(`[Dashboard] Error fetching banking data for site ${siteKey}:`, error);
        }
      }

      const bankingByMonth = processBankingData(allBankingData, months);
      console.log('[Dashboard] Banking data processed:', Object.keys(bankingByMonth).length, 'months');
      console.groupEnd();

      // 3. FETCH LAPSE DATA - Same as current implementation
      console.group('[Dashboard] Fetching lapse data');
      let lapseData = [];

      for (const combinedId of prodIds) {
        const [companyId, siteId] = combinedId.split('_');
        const siteObj = allSites.find(s =>
          String(s.productionSiteId) === String(siteId) &&
          String(s.companyId) === String(companyId)
        );

        if (!siteObj) continue;

        const siteKey = `${siteObj.companyId}_${siteObj.productionSiteId}`;

        try {
          const response = await lapseApi.fetchAllByPk(siteKey);
          const siteLapseData = Array.isArray(response) ? response : [];

          // Filter for current financial year
          const currentYearLapseData = siteLapseData.filter(item => {
            if (!item || (!item.sk && !item.period)) return false;
            const monthKey = item.sk || item.period;
            return months.includes(monthKey);
          });

          lapseData = [...lapseData, ...currentYearLapseData];
        } catch (error) {
          console.error(`[Dashboard] Error fetching lapse data for site ${siteKey}:`, error);
        }
      }

      const lapseByMonth = processLapseData(lapseData, months);
      console.log('[Dashboard] Lapse data processed:', Object.keys(lapseByMonth).length, 'months');
      console.groupEnd();

      // Calculate totals using processed monthly data
      const totalAllocationUnits = calculateTotalUnits(allocationByMonth, 'allocation');
      const totalBankingUnits = calculateTotalUnits(bankingByMonth, 'banking');
      const totalLapseUnits = calculateTotalUnits(lapseByMonth, 'lapse');

      // Calculate other metrics
      const unitsAllocated = allocs.length;
      const pendingAllocations = lapseData.length;
      const allocationRate = totalBankingUnits > 0 ? (totalAllocationUnits / totalBankingUnits) * 100 : 0;

      console.log('[Dashboard] Final calculations:', {
        totalAllocationUnits,
        totalBankingUnits,
        totalLapseUnits,
        unitsAllocated,
        pendingAllocations,
        allocationRate: allocationRate.toFixed(2) + '%'
      });

      setAllocationStats({
        totalBankingUnits,
        totalAllocationUnits,
        totalLapseUnits,
        unitsAllocated,
        pendingAllocations,
        allocationRate,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('[Dashboard] Error fetching allocation stats:', error);
      setAllocationStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load allocation statistics'
      }));
    } finally {
      console.groupEnd();
    }
}, [user]);

const fetchInvoiceStats = useCallback(async () => {
  try {
    setInvoiceStats(prev => ({ ...prev, loading: true, error: null }));
    
    // Simulate API call to fetch invoice stats
    // In a real app, you would make an actual API call here
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock data - replace with actual API call
    setInvoiceStats({
      dailyInvoices: 15,
      monthlyInvoices: 120,
      pendingInvoices: 5,
      completionRate: 92,
      loading: false,
      error: null
    });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    setInvoiceStats(prev => ({
      ...prev,
      loading: false,
      error: 'Failed to load invoice statistics'
    }));
  }
}, []);

useEffect(() => {
  fetchAllocationStats();
  fetchInvoiceStats();
}, [fetchAllocationStats, fetchInvoiceStats]);

return { allocationStats, invoiceStats, refreshAllocationStats: fetchAllocationStats };
};

export default useDashboardData;
