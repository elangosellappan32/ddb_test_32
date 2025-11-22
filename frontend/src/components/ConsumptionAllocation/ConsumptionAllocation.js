import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  MenuItem,
  TextField,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../context/AuthContext';
import allocationApi from '../../services/allocationApi';
import consumptionSiteApi from '../../services/consumptionSiteApi';
import productionSiteApi from '../../services/productionSiteApi';
import consumptionUnitApi from '../../services/consumptionUnitApi';
import bankingApi from '../../services/bankingApi';
import lapseApi from '../../services/lapseApi';
import productionChargeApi from '../../services/productionChargeApi';

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }) }));
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);

const formatMonthKey = (m, y) => `${String(m).padStart(2, '0')}${y}`;

const groupByConsumptionSite = (allocations, siteMap, prodSiteMap) => {
  const grouped = {};
  allocations.forEach(item => {
    const consId = String(item.consumptionSiteId || '');
    if (!consId) return;
    if (!grouped[consId]) {
      grouped[consId] = {
        consumptionSiteId: consId,
        consumptionSiteName: siteMap[consId]?.name || siteMap[consId]?.Name || 'Consumption Site',
        rows: [],
        totals: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c24: 0 }
      };
    }
    const allocated = item.allocated || {};
    const prodId = String(item.productionSiteId || (item.pk?.split('_')[1] || ''));
    const prodName = prodSiteMap[prodId]?.name || prodSiteMap[prodId]?.siteName || item.productionSite || item.siteName || `Production Site ${prodId}`;
    const row = {
      pk: item.pk,
      sk: item.sk,
      productionSiteId: prodId,
      productionSiteName: prodName,
      c1: Number(item.c1 ?? allocated.c1 ?? 0) || 0,
      c2: Number(item.c2 ?? allocated.c2 ?? 0) || 0,
      c3: Number(item.c3 ?? allocated.c3 ?? 0) || 0,
      c4: Number(item.c4 ?? allocated.c4 ?? 0) || 0,
      c5: Number(item.c5 ?? allocated.c5 ?? 0) || 0,
      c24: 0,
      charge: allocated.charge === 1 || allocated.charge === true || item.charge === true || item.charge === 1
    };
    row.c24 = row.c1 + row.c2 + row.c3 + row.c4 + row.c5;
    grouped[consId].rows.push(row);
    grouped[consId].totals.c1 += row.c1;
    grouped[consId].totals.c2 += row.c2;
    grouped[consId].totals.c3 += row.c3;
    grouped[consId].totals.c4 += row.c4;
    grouped[consId].totals.c5 += row.c5;
    grouped[consId].totals.c24 += row.c24;
  });
  return grouped;
};

const ConsumptionAllocation = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 1);
    return date.getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 1);
    return date.getFullYear();
  });
  const [siteMap, setSiteMap] = useState({});
  const [allocData, setAllocData] = useState([]);
  const [prodSiteMap, setProdSiteMap] = useState({});
  const [selectedConsumptionSiteId, setSelectedConsumptionSiteId] = useState('all');
  const [consUnitsBySite, setConsUnitsBySite] = useState({}); // { [consId]: { c1,c2,c3,c4,c5,total } }
  const [bankingData, setBankingData] = useState({}); // { [prodSiteId]: { c1,c2,c3,c4,c5,total } }
  const [lapseData, setLapseData] = useState({}); // { [prodSiteId]: { c1,c2,c3,c4,c5,total } }
  const [oaChargesData, setOaChargesData] = useState({}); // { [prodSiteId]: { c001, c002, ..., c011 } }

  // OA Adjustment Charges charge codes configuration - memoized to prevent dependency issues
  const oaChargeCodesConfig = useMemo(() => [
    { code: 'C001', description: 'AMR Meter Reading Charges' },
    { code: 'C002', description: 'O&M Charges' },
    { code: 'C003', description: 'Transmission Charges' },
    { code: 'C004', description: 'System Operation Charges' },
    { code: 'C005', description: 'RKvah Penalty' },
    { code: 'C006', description: 'Import Energy Charges' },
    { code: 'C007', description: 'Scheduling Charges' },
    { code: 'C008', description: 'Other Charges' },
    { code: 'C010', description: 'DSM Charges' },
    { code: 'C011', description: 'WHLC' }
  ], []);

  const monthKey = useMemo(() => formatMonthKey(selectedMonth, selectedYear), [selectedMonth, selectedYear]);

  // Format number with thousands separators and no decimal places
  const formatNumber = (num) => {
    return Number(num || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const fetchSites = useCallback(async () => {
    try {
      const [consResp, prodResp] = await Promise.all([
        consumptionSiteApi.fetchAll(),
        productionSiteApi.fetchAll()
      ]);

      const consMap = {};
      (consResp?.data || []).forEach(s => { consMap[String(s.consumptionSiteId)] = s; });
      setSiteMap(consMap);

      const pMap = {};
      (prodResp?.data || []).forEach(p => { pMap[String(p.productionSiteId)] = p; });
      setProdSiteMap(pMap);
    } catch (e) {
      enqueueSnackbar('Failed to load sites', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const fetchConsumptionUnitsForMonth = useCallback(async (monthKeyToUse, consMapArg) => {
    try {
      const consMapLocal = consMapArg || siteMap;
      const consIds = Object.keys(consMapLocal);
      if (consIds.length === 0) {
        setConsUnitsBySite({});
        return;
      }
      const normalizeDigits = (v) => String(v || '')?.replace(/[^0-9]/g, '');
      const toPairs = (val) => {
        const s = normalizeDigits(val);
        const out = new Set();
        if (s.length === 6) {
          const mm = s.slice(0,2);
          const yyyy = s.slice(2);
          out.add(`${mm}${yyyy}`); // MMYYYY
          out.add(`${yyyy}${mm}`); // YYYYMM
        } else if (s.length === 8) {
          // Assume YYYYMMDD
          const yyyy = s.slice(0,4);
          const mm = s.slice(4,6);
          out.add(`${mm}${yyyy}`);
          out.add(`${yyyy}${mm}`);
        } else if (s.length >= 4) {
          // Try last 6 digits as MMYYYY (in case prefix/suffix)
          const last6 = s.slice(-6);
          if (last6.length === 6) {
            const mm = last6.slice(0,2);
            const yyyy = last6.slice(2);
            out.add(`${mm}${yyyy}`);
            out.add(`${yyyy}${mm}`);
          }
        }
        return Array.from(out);
      };
      const targets = toPairs(monthKeyToUse);
      const results = await Promise.all(consIds.map(async (cid) => {
        try {
          const site = consMapLocal[cid] || {};
          const companyIdForSite = String(site.companyId || user?.companyId || user?.metadata?.companyId || '');
          const res = await consumptionUnitApi.fetchAll(companyIdForSite, cid);
          const arr = res?.data || [];
          // Find by multiple possible formats
          let entry = arr.find(u => {
            const d = normalizeDigits(u?.date || u?.sk || '');
            const candidates = toPairs(d);
            return candidates.some(c => targets.includes(c));
          });
          // Fallback: direct fetch one by MMYYYY
          if (!entry) {
            try {
              const mmYYYY = targets.find(t => t.length === 6 && /^[0-9]{6}$/.test(t) && t.slice(0,2) >= '01' && t.slice(0,2) <= '12');
              if (mmYYYY) {
                const single = await consumptionUnitApi.fetchOne(companyIdForSite, cid, mmYYYY);
                const data = single?.data || single; // service may return data in different shape
                if (data) {
                  entry = {
                    c1: Number(data.c1 || 0),
                    c2: Number(data.c2 || 0),
                    c3: Number(data.c3 || 0),
                    c4: Number(data.c4 || 0),
                    c5: Number(data.c5 || 0)
                  };
                }
              }
            } catch {}
          }
          const val = {
            c1: Number(entry?.c1 || 0),
            c2: Number(entry?.c2 || 0),
            c3: Number(entry?.c3 || 0),
            c4: Number(entry?.c4 || 0),
            c5: Number(entry?.c5 || 0),
            c24: 0
          };
          val.c24 = val.c1 + val.c2 + val.c3 + val.c4 + val.c5;
          return [cid, val];
        } catch {
          return [cid, { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c24: 0 }];
        }
      }));
      const map = {};
      results.forEach(([cid, val]) => { map[cid] = val; });
      setConsUnitsBySite(map);
    } catch (e) {
      // Non-fatal; show a warning
      enqueueSnackbar('Failed to load consumption units for month', { variant: 'warning' });
      setConsUnitsBySite({});
    }
  }, [enqueueSnackbar, siteMap, user?.companyId, user?.metadata?.companyId]);

  const fetchAllocations = useCallback(async () => {
    if (!user?.companyId && !user?.metadata?.companyId) return;
    try {
      setLoading(true);
      const companyId = String(user?.companyId || user?.metadata?.companyId || '');
      const res = await allocationApi.fetchAll(monthKey, companyId);
      setAllocData(res.allocations || []);
    } catch (e) {
      enqueueSnackbar(e.message || 'Failed to load allocations', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user?.companyId, user?.metadata?.companyId, monthKey, enqueueSnackbar]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const fetchBankingData = useCallback(async () => {
    if (!user?.companyId && !user?.metadata?.companyId) {
      console.error('No company ID found for fetching banking data');
      return;
    }
    
    const companyId = String(user?.companyId || user?.metadata?.companyId || '');
    console.log('Fetching banking data for company:', companyId, 'monthKey:', monthKey);
    
    try {
      let response;
      try {
        // First try to fetch using fetchByPeriod
        console.log('Trying to fetch banking data using fetchByPeriod...');
        response = await bankingApi.fetchByPeriod(monthKey, companyId);
        console.log('Banking API response (fetchByPeriod):', response);
        
        // If no data, try the allocation API as fallback
        if (!response.data || response.data.length === 0) {
          console.log('No data from fetchByPeriod, trying allocation API...');
          const allocationResponse = await allocationApi.fetchAll(monthKey, companyId);
          console.log('Allocation API response:', allocationResponse);
          
          // If we have banking data in the allocation response, use it
          if (allocationResponse.banking && allocationResponse.banking.length > 0) {
            response = { data: allocationResponse.banking };
          } else {
            response = { data: [] };
          }
        }
      } catch (apiError) {
        console.error('Error fetching banking data, falling back to basic fetch:', apiError);
        // Fallback to basic fetch if specific endpoints fail
        response = { data: [] };
      }
      
      const bankingBySite = {};
      
      // Process banking data from API response
      (response.data || []).forEach(item => {
        try {
          // Extract site ID from different possible fields
          const siteId = item.productionSiteId || 
                        item.pk?.split('_')[1] || 
                        item.pk?.replace('_BANK', '') ||
                        item.id;
          
          if (!siteId) {
            console.warn('Skipping banking data item with no valid site ID:', item);
            return;
          }
          
          // Handle both direct properties and nested 'allocated' object
          const allocated = item.allocated || {};
          const c1 = Number(allocated.c1 || item.c1 || 0);
          const c2 = Number(allocated.c2 || item.c2 || 0);
          const c3 = Number(allocated.c3 || item.c3 || 0);
          const c4 = Number(allocated.c4 || item.c4 || 0);
          const c5 = Number(allocated.c5 || item.c5 || 0);
          
          // Calculate total, using totalAmount if available
          const total = Number(item.totalAmount) || (c1 + c2 + c3 + c4 + c5);
          
          console.log(`Processing banking data for site ${siteId}:`, { 
            item, 
            extracted: { c1, c2, c3, c4, c5, total } 
          });
          
          // Create or update the banking data for this site
          bankingBySite[siteId] = {
            ...item,
            c1,
            c2,
            c3,
            c4,
            c5,
            total,
            c24: total, // For backward compatibility
            productionSiteId: siteId,
            // Get site name from various possible sources
            siteName: item.siteName || item.name || 
                     prodSiteMap[siteId]?.name || 
                     `Production Site ${siteId}`,
            name: item.siteName || item.name || 
                 prodSiteMap[siteId]?.name || 
                 `Production Site ${siteId}`,
            htscNo: item.htscNo || prodSiteMap[siteId]?.htscNo || 'N/A',
            siteType: item.siteType || 
                     prodSiteMap[siteId]?.siteType || 
                     prodSiteMap[siteId]?.type || 
                     prodSiteMap[siteId]?.siteCategory || 'N/A'
          };
        } catch (error) {
          console.error('Error processing banking data item:', { error, item });
        }
      });
      
      console.log('Processing complete. Banking data by site:', bankingBySite);
      
      // If no banking data found, log a warning
      if (Object.keys(bankingBySite).length === 0) {
        console.warn('No banking data found for the selected period');
      }
      
      setBankingData(bankingBySite);
    } catch (error) {
      console.error('Error in fetchBankingData:', error);
      // Set empty banking data on error
      setBankingData({});
      enqueueSnackbar('Failed to load banking data', { variant: 'error' });
    }
  }, [monthKey, user?.companyId, user?.metadata?.companyId, enqueueSnackbar, prodSiteMap]);

  useEffect(() => {
    fetchAllocations();
    fetchBankingData();
  }, [fetchAllocations, fetchBankingData]);

  const fetchLapseData = useCallback(async () => {
    if (!user?.companyId && !user?.metadata?.companyId) {
      console.error('No company ID found for fetching lapse data');
      return;
    }
    
    const companyId = String(user?.companyId || user?.metadata?.companyId || '');
    console.log('Fetching lapse data for company:', companyId, 'monthKey:', monthKey);
    
    try {
      const lapseBySite = {};
      
      // Get all production sites that we know about
      const prodSiteIds = Object.keys(prodSiteMap);
      
      if (prodSiteIds.length === 0) {
        console.warn('No production sites found to fetch lapse data for');
        setLapseData({});
        return;
      }
      
      // Fetch lapse data for each production site
      for (const prodSiteId of prodSiteIds) {
        try {
          const pk = `${companyId}_${prodSiteId}`;
          console.log('Fetching lapse for pk:', pk, 'monthKey:', monthKey);
          
          // Fetch all lapse records for this production site
          const lapseRecords = await lapseApi.fetchAllByPk(pk);
          console.log(`Lapse records for ${pk}:`, lapseRecords);
          
          // Find the record matching the current month
          const monthLapseRecord = lapseRecords.find(record => {
            const recordMonthKey = record.sk || record.month;
            return recordMonthKey === monthKey;
          });
          
          if (monthLapseRecord) {
            // Extract c1-c5 from either root level or nested 'allocated' object
            const allocated = monthLapseRecord.allocated || {};
            const c1 = Number(monthLapseRecord.c1 ?? allocated.c1 ?? 0) || 0;
            const c2 = Number(monthLapseRecord.c2 ?? allocated.c2 ?? 0) || 0;
            const c3 = Number(monthLapseRecord.c3 ?? allocated.c3 ?? 0) || 0;
            const c4 = Number(monthLapseRecord.c4 ?? allocated.c4 ?? 0) || 0;
            const c5 = Number(monthLapseRecord.c5 ?? allocated.c5 ?? 0) || 0;
            const total = c1 + c2 + c3 + c4 + c5;
            
            console.log(`Processing lapse data for site ${prodSiteId}:`, { 
              c1, c2, c3, c4, c5, total 
            });
            
            lapseBySite[prodSiteId] = {
              ...monthLapseRecord,
              c1,
              c2,
              c3,
              c4,
              c5,
              total,
              c24: total, // For backward compatibility
              productionSiteId: prodSiteId,
              // Get site name from prodSiteMap (primary source) or fallback to record data
              siteName: prodSiteMap[prodSiteId]?.name || 
                       prodSiteMap[prodSiteId]?.siteName ||
                       monthLapseRecord.siteName || 
                       `Production Site ${prodSiteId}`,
              name: prodSiteMap[prodSiteId]?.name || 
                   prodSiteMap[prodSiteId]?.siteName ||
                   monthLapseRecord.siteName || 
                   `Production Site ${prodSiteId}`,
              htscNo: monthLapseRecord.htscNo || prodSiteMap[prodSiteId]?.htscNo || 'N/A',
              siteType: monthLapseRecord.siteType || 
                       prodSiteMap[prodSiteId]?.siteType || 
                       prodSiteMap[prodSiteId]?.type || 
                       prodSiteMap[prodSiteId]?.siteCategory || 'N/A'
            };
          }
        } catch (error) {
          console.warn(`Could not fetch lapse data for site ${prodSiteId}:`, error);
          // Continue with other sites
        }
      }
      
      console.log('Processing complete. Lapse data by site:', lapseBySite);
      setLapseData(lapseBySite);
    } catch (error) {
      console.error('Error in fetchLapseData:', error);
      setLapseData({});
      enqueueSnackbar('Failed to load lapse data', { variant: 'error' });
    }
  }, [monthKey, user?.companyId, user?.metadata?.companyId, enqueueSnackbar, prodSiteMap]);

  useEffect(() => {
    fetchAllocations();
    fetchBankingData();
    fetchLapseData();
  }, [fetchAllocations, fetchBankingData, fetchLapseData]);

  // Fetch OA Adjustment Charges data
  const fetchOAChargesData = useCallback(async () => {
    if (!user?.companyId && !user?.metadata?.companyId) {
      console.warn('No company ID found for fetching OA charges data');
      return;
    }
    
    const companyId = String(user?.companyId || user?.metadata?.companyId || '');
    console.log('Fetching OA charges data for company:', companyId, 'monthKey:', monthKey);
    
    try {
      const chargesBySite = {};
      const prodSiteIds = Object.keys(prodSiteMap);
      
      if (prodSiteIds.length === 0) {
        console.warn('No production sites found to fetch OA charges for');
        setOaChargesData({});
        return;
      }
      
      // Fetch charges for each production site
      for (const siteId of prodSiteIds) {
        try {
          console.log(`Fetching charges for site ${siteId}`);
          const chargesResponse = await productionChargeApi.fetchAll(companyId, siteId);
          
          // Find the charge record matching the current month
          const allCharges = chargesResponse.data || [];
          const monthCharge = allCharges.find(charge => charge.sk === monthKey);
          
          if (monthCharge) {
            console.log(`Found charge for site ${siteId}:`, monthCharge);
            chargesBySite[siteId] = {
              c001: Number(monthCharge.c001 || 0),
              c002: Number(monthCharge.c002 || 0),
              c003: Number(monthCharge.c003 || 0),
              c004: Number(monthCharge.c004 || 0),
              c005: Number(monthCharge.c005 || 0),
              c006: Number(monthCharge.c006 || 0),
              c007: Number(monthCharge.c007 || 0),
              c008: Number(monthCharge.c008 || 0),
              c010: Number(monthCharge.c010 || 0),
              c011: Number(monthCharge.c011 || 0)
            };
          } else {
            // Initialize with zeros if no charge record found
            console.warn(`No charge record found for site ${siteId} for month ${monthKey}`);
            chargesBySite[siteId] = {
              c001: 0, c002: 0, c003: 0, c004: 0, c005: 0,
              c006: 0, c007: 0, c008: 0, c010: 0, c011: 0
            };
          }
        } catch (error) {
          console.warn(`Could not fetch charges for site ${siteId}:`, error);
          // Initialize with zeros on error
          chargesBySite[siteId] = {
            c001: 0, c002: 0, c003: 0, c004: 0, c005: 0,
            c006: 0, c007: 0, c008: 0, c010: 0, c011: 0
          };
        }
      }
      
      console.log('OA charges data loaded:', chargesBySite);
      setOaChargesData(chargesBySite);
    } catch (error) {
      console.error('Error in fetchOAChargesData:', error);
      setOaChargesData({});
    }
  }, [monthKey, user?.companyId, user?.metadata?.companyId, prodSiteMap]);

  useEffect(() => {
    if (Object.keys(prodSiteMap).length > 0) {
      fetchOAChargesData();
    }
  }, [prodSiteMap, fetchOAChargesData]);

  // When sites are loaded or month changes, load consumption units for that month
  useEffect(() => {
    if (Object.keys(siteMap).length > 0) {
      fetchConsumptionUnitsForMonth(monthKey, siteMap);
    }
  }, [monthKey, siteMap, fetchConsumptionUnitsForMonth]);

  const grouped = useMemo(() => groupByConsumptionSite(allocData, siteMap, prodSiteMap), [allocData, siteMap, prodSiteMap]);
  const consSiteIds = useMemo(() => {
    const ids = Object.keys(grouped).sort((a, b) => (siteMap[a]?.name || '').localeCompare(siteMap[b]?.name || ''));
    if (selectedConsumptionSiteId && selectedConsumptionSiteId !== 'all') {
      return ids.filter(id => id === String(selectedConsumptionSiteId));
    }
    return ids;
  }, [grouped, siteMap, selectedConsumptionSiteId]);
  
  // Function to get charges for a specific production site
  const getChargesForSite = useCallback((siteId) => {
    const siteCharges = oaChargesData[siteId] || {};
    return oaChargeCodesConfig.map(config => ({
      ...config,
      amount: Number(siteCharges[config.code.toLowerCase()] || 0)
    }));
  }, [oaChargesData, oaChargeCodesConfig]);

  // Function to calculate total charges for a site
  const getTotalChargesForSite = useCallback((siteId) => {
    const charges = getChargesForSite(siteId);
    return charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
  }, [getChargesForSite]);
  const prodSitesWithBanking = useMemo(() => {
    return Object.entries(bankingData).map(([siteId, bankData]) => ({
      id: siteId,
      ...bankData,
      name: bankData.siteName || `Production Site ${siteId}`,
      htscNo: bankData.htscNo || 'N/A',
      siteType: bankData.siteType || prodSiteMap[siteId]?.siteType || 
               prodSiteMap[siteId]?.type || prodSiteMap[siteId]?.siteCategory || 'N/A'
    }));
  }, [bankingData, prodSiteMap]);

  // Collect all production sites with lapse data
  const prodSitesWithLapse = useMemo(() => {
    return Object.entries(lapseData).map(([siteId, lapseItem]) => ({
      id: siteId,
      ...lapseItem,
      name: lapseItem.siteName || `Production Site ${siteId}`,
      htscNo: lapseItem.htscNo || 'N/A',
      siteType: lapseItem.siteType || prodSiteMap[siteId]?.siteType || 
               prodSiteMap[siteId]?.type || prodSiteMap[siteId]?.siteCategory || 'N/A'
    }));
  }, [lapseData, prodSiteMap]);

  const consumptionSiteOptions = useMemo(() => {
    // Build options from the loaded siteMap so user can filter even if there are no allocations yet
    return Object.values(siteMap)
      .map(s => ({ id: String(s.consumptionSiteId), name: s.name || s.Name || `Consumption Site ${s.consumptionSiteId}` }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [siteMap]);

  // Header title for Annexure page
  const headerTitle = useMemo(() => {
    return `Annexure for Adjustment HT Billing Working Sheet for the Month of ${selectedMonth}/${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>{headerTitle}</Typography>
          {selectedConsumptionSiteId !== 'all' && siteMap[String(selectedConsumptionSiteId)]?.htscNo && (
            <Typography 
              variant="subtitle1" 
              sx={{ 
                mt: 0.5, 
                display: 'inline-block',
                backgroundColor: '#4caf50', 
                color: 'white',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                fontWeight: 'bold'
              }}
            >
              Service No: {siteMap[String(selectedConsumptionSiteId)].htscNo}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField size="small" select label="Consumption Site" value={selectedConsumptionSiteId} onChange={e => setSelectedConsumptionSiteId(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="all">All Consumption Sites</MenuItem>
            {consumptionSiteOptions.map(opt => (
              <MenuItem key={opt.id} value={opt.id}>{opt.name} ({opt.id})</MenuItem>
            ))}
          </TextField>
          <TextField size="small" select label="Month" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {monthOptions.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Year" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </TextField>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : consSiteIds.length === 0 ? (
        <Typography variant="body1">No allocations found for the selected period.</Typography>
      ) : (
        consSiteIds.map(consId => {
          const section = grouped[consId];
          return (
            <Paper key={consId} sx={{ 
              p: 3, 
              mb: 3, 
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              '&:last-child': { mb: 0 }
            }}>
              {/* Calculate section totals before rendering the table */}
              {(() => {
                const targetUnits = consUnitsBySite[consId] || { c24: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
                const sectionTotals = { ...targetUnits };
                
                return (
                  <Table size="small" sx={{ 
                border: '1px solid #e0e0e0',
                '& .MuiTableCell-root': {
                  border: '1px solid #e0e0e0',
                  padding: '8px 12px',
                  backgroundColor: '#ffffff',
                  '&.header-cell': {
                    backgroundColor: '#c8e6c9',
                    fontWeight: 600,
                    color: '#000000',
                    borderBottom: '2px solid #e0e0e0'
                  },
                  '&.highlight': {
                    backgroundColor: '#f8f9fa',
                    fontWeight: 500
                  },
                  '&.subtext': {
                    color: '#6b7280',
                    fontSize: '0.85rem'
                  },
                  '&.section-header': {
                    backgroundColor: '#e8f4fd',
                    fontWeight: 600,
                    color: '#1a365d'
                  },
                  '&.section-value': {
                    backgroundColor: '#ffffff',
                    fontWeight: 500
                  }
                },
                '& .MuiTableRow-hover:hover': {
                  backgroundColor: '#f5f5f5'
                }
              }}>
                <TableHead>
                  <TableRow>
                    <TableCell className="header-cell"> </TableCell>
                    <TableCell className="header-cell" align="center">C24</TableCell>
                    <TableCell className="header-cell" align="center">C1</TableCell>
                    <TableCell className="header-cell" align="center">C2</TableCell>
                    <TableCell className="header-cell" align="center">C3</TableCell>
                    <TableCell className="header-cell" align="center">C4</TableCell>
                    <TableCell className="header-cell" align="center">C5</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="header-cell">Consumption</TableCell>
                    <TableCell className="header-cell" colSpan={6}>
                      
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-value">HT</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c24)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c1)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c2)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c3)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c4)}</TableCell>
                    <TableCell align="right" className="section-value">{formatNumber(sectionTotals.c5)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-value"></TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="section-value">Transmission Loss</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                    <TableCell align="right" className="section-value">0</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const cumulative = { c24: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
                    return section.rows
                      .slice()
                      .sort((a, b) => {
                        const da = prodSiteMap[a.productionSiteId]?.dateOfCommission ? new Date(prodSiteMap[a.productionSiteId]?.dateOfCommission) : null;
                        const db = prodSiteMap[b.productionSiteId]?.dateOfCommission ? new Date(prodSiteMap[b.productionSiteId]?.dateOfCommission) : null;
                        const ta = da && !isNaN(da) ? da.getTime() : 0;
                        const tb = db && !isNaN(db) ? db.getTime() : 0;
                        // Newest first
                        return tb - ta;
                      })
                      .map((r, idx, array) => {
                        const isLastProductionSite = idx === array.length - 1;
                        // Available before applying this allocation
                        const available = {
                          c24: Math.max(0, sectionTotals.c24 - cumulative.c24),
                          c1: Math.max(0, sectionTotals.c1 - cumulative.c1),
                          c2: Math.max(0, sectionTotals.c2 - cumulative.c2),
                          c3: Math.max(0, sectionTotals.c3 - cumulative.c3),
                          c4: Math.max(0, sectionTotals.c4 - cumulative.c4),
                          c5: Math.max(0, sectionTotals.c5 - cumulative.c5)
                        };
                        // Remaining after applying this allocation (clamped)
                        const rem = {
                          c24: Math.max(0, available.c24 - (Number(r.c24) || 0)),
                          c1: Math.max(0, available.c1 - (Number(r.c1) || 0)),
                          c2: Math.max(0, available.c2 - (Number(r.c2) || 0)),
                          c3: Math.max(0, available.c3 - (Number(r.c3) || 0)),
                          c4: Math.max(0, available.c4 - (Number(r.c4) || 0)),
                          c5: Math.max(0, available.c5 - (Number(r.c5) || 0))
                        };
                        // Now update cumulative after computing remaining
                        cumulative.c24 += Number(r.c24) || 0;
                        cumulative.c1 += Number(r.c1) || 0;
                        cumulative.c2 += Number(r.c2) || 0;
                        cumulative.c3 += Number(r.c3) || 0;
                        cumulative.c4 += Number(r.c4) || 0;
                        cumulative.c5 += Number(r.c5) || 0;
                        const prodSite = prodSiteMap[r.productionSiteId] || {};
                        return (
                          <React.Fragment key={`${r.pk}-${idx}`}>
                            {/* Supply Details Row */}
                            <TableRow sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                              <TableCell className="header-cell" sx={{ 
                                backgroundColor: '#4caf50',
                                color: 'white',
                                borderBottom: '1px solid #e0e0e0',
                                textAlign: 'left',
                                paddingLeft: '16px',
                                width: '28.57%',
                                borderRight: '1px solid #e0e0e0',
                                fontWeight: 'bold'
                              }} colSpan={2}>
                                {prodSite.htscNo || 'N/A'}
                              </TableCell>
                              <TableCell className="header-cell" sx={{ 
                                backgroundColor: '#4caf50',
                                color: 'white',
                                borderBottom: '1px solid #e0e0e0',
                                textAlign: 'center',
                                width: '28.57%',
                                borderRight: '1px solid #e0e0e0',
                                fontWeight: 'bold'
                              }} colSpan={2}>
                                {prodSite.siteType || prodSite.type || prodSite.siteCategory || 'N/A'}
                              </TableCell>
                              <TableCell className="header-cell" sx={{ 
                                backgroundColor: '#4caf50',
                                color: 'white',
                                borderBottom: '1px solid #e0e0e0',
                                fontWeight: 'bold',
                                textAlign: 'left',
                                paddingLeft: '16px',
                                width: '42.86%'
                              }} colSpan={3}>
                                {r.productionSiteName || 'N/A'}
                              </TableCell>
                            </TableRow>
                            {/* Main Data Row */}
                            <TableRow hover>
                              <TableCell className="highlight">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  {r.charge && (
                                    <Box 
                                      component="span" 
                                      sx={{
                                        fontSize: '0.7rem',
                                        backgroundColor: '#e6f7ff',
                                        color: '#1890ff',
                                        px: 0.75,
                                        py: 0.25,
                                        borderRadius: '4px',
                                        fontWeight: 500,
                                        mr: 1
                                      }}
                                    >
                                      CHARGED
                                    </Box>
                                  )}
                                  Supply
                                </Box>
                              </TableCell>
                              <TableCell align="right">{formatNumber(r.c24)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c1)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c2)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c3)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c4)}</TableCell>
                              <TableCell align="right">{formatNumber(r.c5)}</TableCell>
                            </TableRow>
                            
                            {/* Available and Remaining Rows */}
                            <TableRow>
                              <TableCell className="subtext" sx={{ pl: 4 }}>Adjust</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c24)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c1)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c2)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c3)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c4)}</TableCell>
                              <TableCell className="subtext" align="right">{formatNumber(available.c5)}</TableCell>
                            </TableRow>
                            
                            <TableRow>
                              <TableCell 
                                className="subtext" 
                                sx={{ 
                                  pl: 4, 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                Consumption balance
                              </TableCell>
                              <TableCell 
                                className="subtext" 
                                align="right" 
                                sx={{ 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                {formatNumber(rem.c24)}
                              </TableCell>
                              <TableCell 
                                className="subtext" 
                                align="right" 
                                sx={{ 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                {formatNumber(rem.c1)}
                              </TableCell>
                              <TableCell 
                                className="subtext" 
                                align="right" 
                                sx={{ 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                {formatNumber(rem.c2)}
                              </TableCell>
                              <TableCell 
                                className="subtext" 
                                align="right" 
                                sx={{ 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                {formatNumber(rem.c3)}
                              </TableCell>
                              <TableCell 
                                className="subtext" 
                                align="right" 
                                sx={{ 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                {formatNumber(rem.c4)}
                              </TableCell>
                              <TableCell 
                                className="subtext" 
                                align="right" 
                                sx={{ 
                                  borderBottom: isLastProductionSite ? '2px solid #e0e0e0' : '1px solid #e0e0e0',
                                  fontWeight: isLastProductionSite ? 500 : 'normal'
                                }}
                              >
                                {formatNumber(rem.c5)}
                              </TableCell>
                            </TableRow>
                            
                            {/* Banking Units Section - Shown after all production sites */}
                            {isLastProductionSite && prodSitesWithBanking.length > 0 && (
                              <>
                                {prodSitesWithBanking.map((bankData) => (
                                  <React.Fragment key={`banking-${bankData.id}`}>
                                    {/* Supply Details Row - Matches production site header */}
                                    <TableRow sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                                      <TableCell className="header-cell" sx={{ 
                                        backgroundColor: '#1b5e20',
                                        color: 'white',
                                        borderBottom: '1px solid #e0e0e0',
                                        textAlign: 'left',
                                        paddingLeft: '16px',
                                        width: '28.57%',
                                        borderRight: '1px solid #e0e0e0',
                                        fontWeight: 'bold'
                                      }} colSpan={2}>
                                        {bankData.htscNo || 'N/A'}
                                      </TableCell>
                                      <TableCell className="header-cell" sx={{ 
                                        backgroundColor: '#1b5e20',
                                        color: 'white',
                                        borderBottom: '1px solid #e0e0e0',
                                        textAlign: 'center',
                                        width: '28.57%',
                                        borderRight: '1px solid #e0e0e0',
                                        fontWeight: 'bold'
                                      }} colSpan={2}>
                                        {bankData.siteType || 'N/A'}
                                      </TableCell>
                                      <TableCell className="header-cell" sx={{ 
                                        backgroundColor: '#1b5e20',
                                        color: 'white',
                                        borderBottom: '1px solid #e0e0e0',
                                        fontWeight: 'bold',
                                        textAlign: 'left',
                                        paddingLeft: '16px',
                                        width: '42.86%'
                                      }} colSpan={3}>
                                        {bankData.name || 'N/A'}
                                      </TableCell>
                                    </TableRow>
                                    
                                    {/* Main Banking Data Row */}
                                    <TableRow hover>
                                      <TableCell className="highlight" sx={{ backgroundColor: '#c8e6c9' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          Banking Units
                                        </Box>
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 500, color: '#1b5e20', backgroundColor: '#c8e6c9' }}>
                                        {formatNumber((bankData.c1 || 0) + (bankData.c2 || 0) + (bankData.c3 || 0) + (bankData.c4 || 0) + (bankData.c5 || 0))}
                                      </TableCell>
                                      {[1, 2, 3, 4, 5].map(cat => (
                                        <TableCell 
                                          key={`bank-${bankData.id}-c${cat}`} 
                                          align="right"
                                          sx={{ color: '#1b5e20', backgroundColor: '#c8e6c9' }}
                                        >
                                          {formatNumber(bankData[`c${cat}`] || 0)}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                    
                                    {/* Spacing between entries */}
                                    <TableRow>
                                      <TableCell colSpan={7} sx={{ height: '16px', border: 'none' }}></TableCell>
                                    </TableRow>
                                  </React.Fragment>
                                ))}
                                
                                {/* Total Banking Units row removed as per user request */}
                              </>
                            )}

                            {/* Lapse Units Section - Shown after banking units */}
                            {isLastProductionSite && prodSitesWithLapse.length > 0 && (
                              <>
                                {prodSitesWithLapse.map((lapseItem) => (
                                  <React.Fragment key={`lapse-${lapseItem.id}`}>
                                    {/* Supply Details Row - Matches production site header */}
                                    <TableRow sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                                      <TableCell className="header-cell" sx={{ 
                                        backgroundColor: '#ef5350',
                                        color: 'white',
                                        borderBottom: '1px solid #e0e0e0',
                                        textAlign: 'left',
                                        paddingLeft: '16px',
                                        width: '28.57%',
                                        borderRight: '1px solid #e0e0e0',
                                        fontWeight: 'bold'
                                      }} colSpan={2}>
                                        {lapseItem.htscNo || 'N/A'}
                                      </TableCell>
                                      <TableCell className="header-cell" sx={{ 
                                        backgroundColor: '#ef5350',
                                        color: 'white',
                                        borderBottom: '1px solid #e0e0e0',
                                        textAlign: 'center',
                                        width: '28.57%',
                                        borderRight: '1px solid #e0e0e0',
                                        fontWeight: 'bold'
                                      }} colSpan={2}>
                                        {lapseItem.siteType || 'N/A'}
                                      </TableCell>
                                      <TableCell className="header-cell" sx={{ 
                                        backgroundColor: '#ef5350',
                                        color: 'white',
                                        borderBottom: '1px solid #e0e0e0',
                                        fontWeight: 'bold',
                                        textAlign: 'left',
                                        paddingLeft: '16px',
                                        width: '42.86%'
                                      }} colSpan={3}>
                                        {lapseItem.name || 'N/A'}
                                      </TableCell>
                                    </TableRow>
                                    
                                    {/* Main Lapse Data Row */}
                                    <TableRow hover>
                                      <TableCell className="highlight" sx={{ backgroundColor: '#ffebee' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          Lapse Units
                                        </Box>
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 500, color: '#c62828', backgroundColor: '#ffebee' }}>
                                        {formatNumber((lapseItem.c1 || 0) + (lapseItem.c2 || 0) + (lapseItem.c3 || 0) + (lapseItem.c4 || 0) + (lapseItem.c5 || 0))}
                                      </TableCell>
                                      {[1, 2, 3, 4, 5].map(cat => (
                                        <TableCell 
                                          key={`lapse-${lapseItem.id}-c${cat}`} 
                                          align="right"
                                          sx={{ color: '#c62828', backgroundColor: '#ffebee' }}
                                        >
                                          {formatNumber(lapseItem[`c${cat}`] || 0)}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                    
                                    {/* Spacing between entries */}
                                    <TableRow>
                                      <TableCell colSpan={7} sx={{ height: '16px', border: 'none' }}></TableCell>
                                    </TableRow>
                                  </React.Fragment>
                                ))}
                              </>
                            )}
                          </React.Fragment>
                        );
                      });
                  })()}
                </TableBody>
              </Table>
              );
            })()}

            {/* OA Adjustment Charges Table - Shown after all sections */}
            {Object.keys(prodSiteMap).length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 3 }}>
                <Box sx={{ width: '100%', maxWidth: '900px' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: '#1976d2', textAlign: 'center', fontSize: '0.9rem' }}>
                    OA Adjustment Charges
                  </Typography>

                {/* Render each production site with its charges */}
                {Object.entries(prodSiteMap).map(([siteId, siteData]) => (
                  <Box key={`oa-charges-${siteId}`} sx={{ mb: 1.5 }}>
                    {/* Production Site Header - Single Line */}
                    <Box sx={{ 
                      backgroundColor: '#c8e6c9', 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #e0e0e0'
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: '600', color: '#000000', fontSize: '0.8rem', display: 'block', lineHeight: 1.6 }}>
                        GEN.SC.NO: <span style={{ fontWeight: 'bold', color: '#000000' }}>{siteData.htscNo || 'N/A'}</span>
                        <span style={{ marginLeft: '40px' }}>
                          Inj.Volt: <span style={{ fontWeight: 'bold', color: '#000000' }}>{siteData.injectionVoltage_KV ? `${siteData.injectionVoltage_KV}KV` : (siteData.injectionVoltage || siteData.voltage || 'N/A')}</span>
                        </span>
                        <span style={{ marginLeft: '40px' }}>
                          Capacity: <span style={{ fontWeight: 'bold', color: '#000000' }}>{siteData.name || siteData.siteName || `Production Site ${siteId}`}</span>
                        </span>
                      </Typography>
                    </Box>

                    {/* Charges Table for this site */}
                    <Table size="small" sx={{ 
                      border: '1px solid #e0e0e0',
                      borderTop: 'none',
                      '& .MuiTableCell-root': {
                        border: '1px solid #e0e0e0',
                        padding: '5px 8px',
                        fontSize: '0.75rem'
                      },
                      '& .MuiTableHead-root .MuiTableCell-root': {
                        fontSize: '0.75rem',
                        padding: '6px 8px',
                        fontWeight: '600',
                        backgroundColor: '#c8e6c9',
                        color: '#000000',
                        borderBottom: '2px solid #e0e0e0'
                      },
                      '& .MuiTableBody-root .MuiTableRow-root': {
                        height: 'auto'
                      }
                    }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: '30%', textAlign: 'left' }}>CHARGE CODE</TableCell>
                          <TableCell sx={{ width: '50%', textAlign: 'left' }}>CHARGE DESCRIPTION</TableCell>
                          <TableCell sx={{ width: '20%', textAlign: 'right' }}>CHARGE AMOUNT</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* Charge Data Rows */}
                        {getChargesForSite(siteId).map((charge, idx) => (
                          <TableRow key={`charge-${siteId}-${idx}`} sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                            <TableCell sx={{ fontWeight: '600', fontSize: '0.75rem', textAlign: 'left', color: '#000' }}>
                              {charge.code}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', textAlign: 'left', color: '#333' }}>
                              {charge.description}
                            </TableCell>
                            <TableCell sx={{ fontWeight: '500', color: '#000', fontSize: '0.75rem', textAlign: 'right' }}>
                              {formatNumber(charge.amount)}
                            </TableCell>
                          </TableRow>
                        ))}

                        {/* Site Total Row */}
                        <TableRow sx={{ backgroundColor: '#f0f0f0', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'right', paddingRight: '16px' }}>
                            Total:
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', color: '#000', fontSize: '0.75rem', textAlign: 'right', borderTop: '2px solid #333' }}>
                            {formatNumber(getTotalChargesForSite(siteId))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Box>
                ))}
                </Box>
              </Box>
            )}
            </Paper>
          );
        })
      )}
    </Box>
  );
};

export default ConsumptionAllocation;
