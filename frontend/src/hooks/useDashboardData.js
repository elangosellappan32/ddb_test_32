import { useState, useEffect, useCallback } from 'react';
import allocationApi from '../services/allocationApi';
import lapseApi from '../services/lapseApi';
import productionSiteApi from '../services/productionSiteApi';
import { getAccessibleSiteIds } from '../utils/siteAccessUtils';

// Helper function to get financial year months (April to March)
function getFinancialYearMonths(fy) {
  const [startYear] = fy.split('-').map(Number);
  const months = [];
  for (let m = 4; m <= 12; m++) months.push((m < 10 ? '0' : '') + m + startYear);
  for (let m = 1; m <= 3; m++) months.push((m < 10 ? '0' : '') + m + (startYear + 1));
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

// Helper function to calculate total units from an array of items
const calculateTotalUnits = (items, type = 'allocation') => {
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`[${type.toUpperCase()}] No items to calculate`);
    return 0;
  }
  
  console.log(`[${type.toUpperCase()}] Calculating total for ${items.length} items`);
  
  const result = items.reduce((sum, item, index) => {
    try {
      if (!item) {
        console.warn(`[${type.toUpperCase()}] Item at index ${index} is null or undefined`);
        return sum;
      }
      
      // For all types, check if units are in the 'allocated' object or at root
      const source = item.allocated || item;
      
      // Log the item being processed for debugging
      console.log(`[${type.toUpperCase()}] Processing item ${index + 1}/${items.length}:`, 
        JSON.parse(JSON.stringify(item)));
      
      // Extract values safely, defaulting to 0 if not found
      const c1 = Number(source.c1) || 0;
      const c2 = Number(source.c2) || 0;
      const c3 = Number(source.c3) || 0;
      const c4 = Number(source.c4) || 0;
      const c5 = Number(source.c5) || 0;
      
      const itemTotal = c1 + c2 + c3 + c4 + c5;
      
      // Log the calculation details
      console.log(`[${type.toUpperCase()}] Item ${index + 1} values - c1: ${c1}, c2: ${c2}, c3: ${c3}, c4: ${c4}, c5: ${c5}`);
      console.log(`[${type.toUpperCase()}] Item ${index + 1} total: ${itemTotal}, Running total: ${sum + itemTotal}`);
      
      return sum + itemTotal;
    } catch (error) {
      console.error('Error calculating units:', error);
      console.groupEnd();
      return sum;
    } finally {
      console.groupEnd();
    }
  }, 0);
  
  console.log('Final total for', type, ':', result);
  console.groupEnd();
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

  const [reportStats, setReportStats] = useState({
    dailyReports: 0,
    monthlyReports: 0,
    pendingReview: 0,
    complianceRate: 0,
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
      const financialYearMonths = getFinancialYearMonths(financialYear);
      console.log('[Dashboard] Financial year:', financialYear);
      console.log('[Dashboard] Financial year months:', financialYearMonths);
      
      // Track unique items to avoid duplicates
      const seenBanking = new Set();
      const seenAllocations = new Set();
      
      let banking = [];
      let allocations = [];
      let lapseData = [];
      
      // 1. Fetch banking and allocation data (monthly as before)
      for (const month of financialYearMonths) {
        try {
          console.group(`[Dashboard] Processing month: ${month}`);
          
          // Fetch banking and allocation data in parallel
          const [bankingData, allocationData] = await Promise.all([
            allocationApi.fetchByType('banking', month).catch(e => {
              console.error(`[Dashboard] Error fetching banking data for ${month}:`, e);
              return [];
            }),
            allocationApi.fetchByType('allocations', month).catch(e => {
              console.error(`[Dashboard] Error fetching allocation data for ${month}:`, e);
              return [];
            })
          ]);
          
          // Process banking data
          if (Array.isArray(bankingData)) {
            const uniqueBanking = bankingData.filter(item => {
              if (!item) return false;
              const id = item.id || JSON.stringify(item);
              if (!seenBanking.has(id)) {
                seenBanking.add(id);
                return true;
              }
              return false;
            });
            banking = [...banking, ...uniqueBanking];
          }
          
          // Process allocation data
          if (Array.isArray(allocationData)) {
            const uniqueAllocations = allocationData.filter(item => {
              if (!item) return false;
              const id = item.id || JSON.stringify(item);
              if (!seenAllocations.has(id)) {
                seenAllocations.add(id);
                return true;
              }
              return false;
            });
            allocations = [...allocations, ...uniqueAllocations];
          }
          
          console.log(`[Dashboard] Processed ${month}:`, {
            banking: bankingData?.length || 0,
            allocations: allocationData?.length || 0
          });
          
        } catch (error) {
          console.error(`[Dashboard] Error processing month ${month}:`, error);
        } finally {
          console.groupEnd();
        }
      }
      
      // 2. Fetch lapse data by production site (similar to GraphicalLapseReport)
      try {
        console.group('[Dashboard] Fetching lapse data by production site');
        const siteIds = getAccessibleSiteIds(user, 'production');
        const allSites = await productionSiteApi.fetchAll().then(res => res.data || []);
        
        for (const combinedId of siteIds) {
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
              return financialYearMonths.includes(monthKey);
            });
            
            lapseData = [...lapseData, ...currentYearLapseData];
            
            if (currentYearLapseData.length > 0) {
              console.log(`[Dashboard] Fetched ${currentYearLapseData.length} lapse records for site ${siteKey}`);
            }
          } catch (error) {
            console.error(`[Dashboard] Error fetching lapse data for site ${siteKey}:`, error);
          }
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching lapse data:', error);
      } finally {
        console.groupEnd();
      }
      
      // Process lapse data using the same logic as GraphicalLapseReport
      const lapseByMonth = processLapseData(lapseData, financialYearMonths);
      
      // Log summary of unique items
      console.log('[Dashboard] Unique items summary:', {
        banking: banking.length,
        allocations: allocations.length,
        lapse: lapseData.length
      });
      
      // Log sample items for debugging
      if (lapseData.length > 0) {
        console.log('[Dashboard] Sample lapse item structure:', JSON.parse(JSON.stringify(lapseData[0])));
      } else {
        console.warn('[Dashboard] No lapse data found for any site');
      }
      
      // Calculate totals with error handling
      console.group('[Dashboard] Calculating totals');
      let totalBankingUnits, totalAllocationUnits, totalLapseUnits = 0;
      
      try {
        console.log('[Dashboard] Calculating banking units...');
        totalBankingUnits = calculateTotalUnits(banking, 'banking');
        
        console.log('[Dashboard] Calculating allocation units...');
        totalAllocationUnits = calculateTotalUnits(allocations, 'allocation');
        
        // Calculate total lapse units from processed data
        console.log('[Dashboard] Calculating lapse units...');
        totalLapseUnits = Object.values(lapseByMonth).reduce(
          (sum, monthData) => sum + monthData.total, 0
        );
        
        console.log('[Dashboard] Calculated totals:', {
          banking: totalBankingUnits,
          allocations: totalAllocationUnits,
          lapse: totalLapseUnits
        });
      } catch (error) {
        console.error('[Dashboard] Error calculating totals:', error);
        // Set defaults if calculation fails
        totalBankingUnits = totalBankingUnits || 0;
        totalAllocationUnits = totalAllocationUnits || 0;
        totalLapseUnits = totalLapseUnits || 0;
      } finally {
        console.groupEnd();
      }
      
      const unitsAllocated = allocations.length;
      const pendingAllocations = lapseData.length;

      setAllocationStats({
        totalBankingUnits,
        totalAllocationUnits,
        totalLapseUnits,
        unitsAllocated,
        pendingAllocations,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching allocation stats:', error);
      setAllocationStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load allocation statistics'
      }));
    }
  }, []);

  const fetchReportStats = useCallback(async () => {
    try {
      setReportStats(prev => ({ ...prev, loading: true, error: null }));
      
      // In a production environment, these would come from actual API calls
      // For now, we'll use reasonable defaults
      const dailyReports = 0;
      const monthlyReports = 0;
      const pendingReview = 0;
      const complianceRate = 0;

      setReportStats({
        dailyReports,
        monthlyReports,
        pendingReview,
        complianceRate,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching report stats:', error);
      setReportStats(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load report statistics'
      }));
    }
  }, []);

  useEffect(() => {
    fetchAllocationStats();
    fetchReportStats();
  }, [fetchAllocationStats, fetchReportStats]);

  return {
    allocationStats,
    reportStats,
    refreshAllocationStats: fetchAllocationStats,
    refreshReportStats: fetchReportStats
  };
};

export default useDashboardData;
