import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  Autorenew as AutorenewIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import productionUnitApi from '../../services/productionUnitapi';
import consumptionUnitApi from '../../services/consumptionUnitapi';
import productionSiteapi from '../../services/productionSiteapi';
import consumptionSiteapi from '../../services/consumptionSiteapi';
import bankingApi from '../../services/bankingApi';
import allocationApi from '../../services/allocationapi';
import captiveApi from '../../services/captiveApi';
import ProductionUnitsTable from './ProductionUnitsTable';
import BankingUnitsTable from './BankingUnitsTable';
import ConsumptionUnitsTable from './ConsumptionUnitsTable';
import AllocationDetailsTable from './AllocationDetailsTable';
import AllocationSummary from './AllocationSummary';
import { formatAllocationMonth, ALL_PERIODS } from '../../utils/allocationUtils';
import { useAuth } from '../../context/AuthContext';
import { calculateAllocations } from '../../utils/allocationCalculator';

const Allocation = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { hasSiteAccess, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [productionData, setProductionData] = useState([]);
  const [consumptionData, setConsumptionData] = useState([]);
  const [bankingData, setBankingData] = useState([]);
  const [aggregatedBankingData, setAggregatedBankingData] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [bankingAllocations, setBankingAllocations] = useState([]);
  const [lapseAllocations, setLapseAllocations] = useState([]);
  const [originalBankingAllocations, setOriginalBankingAllocations] = useState([]);
  const [originalLapseAllocations, setOriginalLapseAllocations] = useState([]);
  const [shareholdings, setShareholdings] = useState([]);
  const [, setLoadingShareholdings] = useState(false);
  const [manualAllocations, setManualAllocations] = useState({});
  const [showAllocations, setShowAllocations] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState({ type: '', data: null });

  // Get company ID from the logged-in user
  const companyId = user?.companyId || (user?.metadata?.companyId?.S || null);
  
  // Year range for the year dropdown (1950 to current year)
  const yearRange = {
    start: 1950,
    end: new Date().getFullYear()
  };

  // Fetch shareholdings for a company
  const fetchShareholdings = useCallback(async (companyId) => {
    if (!hasSiteAccess) return [];
    if (!companyId) {
      console.error('No company ID provided to fetchShareholdings');
      return [];
    }
    
    try {
      console.log(`[fetchShareholdings] Fetching shareholdings for generator company ID: ${companyId}`);
      const response = await captiveApi.getByGeneratorCompanyId(companyId);
      
      // Handle different response formats
      let shareholdings = [];
      if (Array.isArray(response)) {
        shareholdings = response;
      } else if (response && response.data) {
        shareholdings = Array.isArray(response.data) ? response.data : [response.data];
      }
      
      console.log('[fetchShareholdings] Raw response:', response);
      console.log(`[fetchShareholdings] Processed ${shareholdings.length} shareholdings`);
      
      // Filter out invalid entries and check site access
      const validShareholdings = shareholdings.filter(item => {
        if (!item || !item.shareholderCompanyId) return false;
        
        // Check if user has access to this site
        const hasAccess = hasSiteAccess(
          item.generatorCompanyId || item.companyId, 
          'production'
        );
        
        return hasAccess && (item.shareholdingPercentage > 0 || item.percentage > 0);
      });
      
      console.log(`[fetchShareholdings] Found ${validShareholdings.length} valid shareholdings`);
      
      if (validShareholdings.length === 0) {
        console.warn('[fetchShareholdings] No valid shareholding data found for company:', companyId);
        enqueueSnackbar('No shareholding data available for this company', { 
          variant: 'warning',
          autoHideDuration: 5000,
          persist: false
        });
      }
      
      // Normalize the response format
      return validShareholdings.map(item => ({
        ...item,
        shareholdingPercentage: item.shareholdingPercentage || item.percentage || 0,
        shareholderCompanyId: item.shareholderCompanyId || item.shareholderCompanyId || 'unknown',
        generatorCompanyId: item.generatorCompanyId || companyId
      }));
      
    } catch (error) {
      console.error('[fetchShareholdings] Error:', {
        error,
        message: error.message,
        response: error.response?.data,
        config: error.config
      });
      
      enqueueSnackbar(
        error.response?.data?.message || 'Failed to load shareholdings. Please check the console for details.', 
        { 
          variant: 'error',
          autoHideDuration: 7000,
          persist: false
        }
      );
      
      return [];
    }
  }, [enqueueSnackbar, hasSiteAccess]);

  const handleManualAllocationChange = (prodId, consId, period, value) => {
    const key = `${prodId}_${consId}_${period}`;
    const newValue = Math.max(0, Number(value) || 0);

    // Only update the manualAllocations for the specific key
    setManualAllocations(prev => ({ ...prev, [key]: newValue }));

    // Recalculate allocations with updated manualAllocations
    const updatedManualAllocations = { ...manualAllocations, [key]: newValue };
    const result = calculateAllocations({
      productionUnits: productionData,
      consumptionUnits: consumptionData,
      bankingUnits: bankingData,
      manualAllocations: updatedManualAllocations,
      shareholdings,
      month: `${String(selectedMonth).padStart(2, '0')}${selectedYear}`
    });

    // Filter allocations by type
    const bankingAllocs = result.allocations.filter(a => a.type === 'BANKING');
    const lapseAllocs = result.allocations.filter(a => a.type === 'LAPSE');
    const regularAllocs = result.allocations.filter(a => !['BANKING', 'LAPSE'].includes(a.type));

    // Save original banking/lapse allocations if not already set
    if (originalBankingAllocations.length === 0 && bankingAllocs.length > 0) {
      setOriginalBankingAllocations(bankingAllocs.map(b => ({ ...b })));
    }
    if (originalLapseAllocations.length === 0 && lapseAllocs.length > 0) {
      setOriginalLapseAllocations(lapseAllocs.map(l => ({ ...l })));
    }

    // Validation: at least one period in allocated must be > 0, else set all to zero
    const fixZeroAllocations = (arr) => arr.map(a => {
      const allocated = a.allocated || {};
      const hasNonZero = Object.values(allocated).some(v => Number(v) > 0);
      if (!hasNonZero) {
        return {
          ...a,
          allocated: Object.fromEntries(Object.keys(allocated).map(p => [p, 0]))
        };
      }
      return a;
    });

    // Update state with fixed allocations
    setAllocations(fixZeroAllocations(regularAllocs));
    setBankingAllocations(fixZeroAllocations(bankingAllocs));
    setLapseAllocations(fixZeroAllocations(lapseAllocs));
    setShowAllocations(true);
  };

  const runAllocationCalculation = useCallback((currentShareholdings = shareholdings) => {
    if (!productionData.length || !consumptionData.length) return;

    const result = calculateAllocations({
      productionUnits: productionData,
      consumptionUnits: consumptionData,
      bankingUnits: bankingData,
      manualAllocations,
      shareholdings,
      month: `${String(selectedMonth).padStart(2, '0')}${selectedYear}`
    });
    
    console.log('Allocation result:', result);
    console.log('Shareholdings used in calculation:', shareholdings);

    // Filter allocations by type for logging and display
    const bankingAllocs = result.allocations.filter(a => a.type === 'BANKING');
    const lapseAllocs = result.allocations.filter(a => a.type === 'LAPSE');
    const regularAllocs = result.allocations.filter(a => !['BANKING', 'LAPSE'].includes(a.type));

    // Log banking allocations
    console.group('🏦 Banking Allocations');
    console.log('Total Banking Allocations:', bankingAllocs.length);
    bankingAllocs.forEach(bank => {
      console.group(`Banking for ${bank.siteName || bank.productionSite || 'Unknown'}`);
      console.log('Production Site ID:', bank.productionSiteId);
      console.log('Allocated Units:', bank.allocated);
      console.log('Total Units:', Object.values(bank.allocated || {}).reduce((sum, val) => sum + (Number(val) || 0), 0));
      console.groupEnd();
    });
    console.groupEnd();

    // Log lapse allocations
    console.group('⏳ Lapse Allocations');
    console.log('Total Lapse Allocations:', lapseAllocs.length);
    lapseAllocs.forEach(lapse => {
      console.group(`Lapse for ${lapse.siteName || lapse.productionSite || 'Unknown'}`);
      console.log('Production Site ID:', lapse.productionSiteId);
      console.log('Allocated Units:', lapse.allocated);
      console.log('Total Units:', Object.values(lapse.allocated || {}).reduce((sum, val) => sum + (Number(val) || 0), 0));
      console.groupEnd();
    });
    console.groupEnd();

    // Set all allocations in the main state
    setAllocations(regularAllocs);
    
    // For backward compatibility, also set banking and lapse allocations
    // but these will be derived from the main allocations array
    setBankingAllocations(bankingAllocs);
    setLapseAllocations(lapseAllocs);
    
    setShowAllocations(true);

    enqueueSnackbar('Allocation data updated', { 
      variant: 'success',
      autoHideDuration: 2000 
    });
  }, [productionData, consumptionData, bankingData, manualAllocations, enqueueSnackbar, selectedMonth, selectedYear, shareholdings, showAllocations]);

  const updateAllocationData = useCallback((currentShareholdings = shareholdings) => {
    if (!showAllocations) {
      console.log('Allocations not shown, skipping update');
      return;
    }
    
    if (productionData.length === 0 || consumptionData.length === 0) {
      console.log('Insufficient data for allocation calculation', {
        productionData: productionData.length,
        consumptionData: consumptionData.length,
        shareholdings: shareholdings.length
      });
      return;
    }
    
    console.log('Updating allocation data with:', {
      productionSites: productionData.length,
      consumptionSites: consumptionData.length,
      shareholdings: shareholdings.length,
      hasBankingData: bankingData.length > 0
    });
    
    try {
      // Recalculate allocations with current data
      const result = calculateAllocations({
        productionUnits: productionData,
        consumptionUnits: consumptionData,
        bankingUnits: bankingData,
        manualAllocations,
        shareholdings,
        month: `${String(selectedMonth).padStart(2, '0')}${selectedYear}`
      });
      
      console.log('Allocation calculation results:', result);
      
      // Filter allocations by type
      const bankingAllocs = result.allocations.filter(a => a.type === 'BANKING');
      const lapseAllocs = result.allocations.filter(a => a.type === 'LAPSE');
      const regularAllocs = result.allocations.filter(a => !['BANKING', 'LAPSE'].includes(a.type));
      
      // Update state with new allocations
      setAllocations(regularAllocs);
      setBankingAllocations(bankingAllocs);
      setLapseAllocations(lapseAllocs);
      
      // Save original banking/lapse allocations if not already set
      if (originalBankingAllocations.length === 0 && bankingAllocs.length > 0) {
        setOriginalBankingAllocations(bankingAllocs.map(b => ({ ...b })));
      }
      if (originalLapseAllocations.length === 0 && lapseAllocs.length > 0) {
        setOriginalLapseAllocations(lapseAllocs.map(l => ({ ...l })));
      }
      
    } catch (error) {
      console.error('Error in updateAllocationData:', error);
      enqueueSnackbar('Failed to update allocations. Please try again.', { variant: 'error' });
    }
  }, [
    productionData, 
    consumptionData, 
    bankingData, 
    manualAllocations, 
    shareholdings, 
    originalBankingAllocations.length, 
    originalLapseAllocations.length, 
    enqueueSnackbar,
    selectedMonth,
    selectedYear
  ]);

  const prepareAllocationPayload = useCallback((allocation, type, month, year) => {
    if (!companyId) {
      throw new Error('No company ID available for preparing allocation payload');
    }
    
    const monthYear = allocation.month && allocation.month.length === 6 ? allocation.month : formatAllocationMonth(month, year);
    
    // Create a copy of the allocation to avoid mutating the original
    const payload = { ...allocation };
    
    // Validate production site ID for allocation types that require it
    if (['ALLOCATION', 'BANKING', 'LAPSE'].includes(String(type || '').toUpperCase())) {
      const prodSiteId = payload.productionSiteId || allocation.productionSiteId;
      if (!prodSiteId) {
        throw new Error(`Production site ID is required for ${type} allocation`);
      }
      
      // Find the production site to get the correct ID format and company ID
      const productionSite = productionData.find(site => 
        site.productionSiteId === prodSiteId || site.id === prodSiteId || String(site.productionSiteId) === String(prodSiteId)
      );
      
      if (!productionSite) {
        console.warn(`Production site not found in local data: ${prodSiteId}`, {
          allocation,
          availableSites: productionData.map(s => ({ 
            id: s.id, 
            productionSiteId: s.productionSiteId, 
            companyId: s.companyId,
            name: s.siteName,
            type: typeof s.productionSiteId
          }))
        });
        throw new Error(`Production site not found: ${prodSiteId}. Please refresh the page and try again.`);
      }
      
      // Ensure productionSiteId is set to the correct format from the database
      const productionSiteId = productionSite.productionSiteId || productionSite.id;
      payload.productionSiteId = productionSiteId;
      
      // Set production site name and details for banking and lapse allocations
      if (type === 'BANKING' || type === 'LAPSE') {
        payload.productionSite = productionSite.siteName || productionSite.name;
        payload.siteName = productionSite.siteName || productionSite.name;
        payload.productionSiteId = productionSiteId;
        // Ensure c1-c5 values are copied to root level for LAPSE to match BANKING
        if (type === 'LAPSE' && payload.allocated) {
          payload.c1 = payload.allocated.c1 || 0;
          payload.c2 = payload.allocated.c2 || 0;
          payload.c3 = payload.allocated.c3 || 0;
          payload.c4 = payload.allocated.c4 || 0;
          payload.c5 = payload.allocated.c5 || 0;
        }
      }
      
      // Use the company ID from the production site
      let siteCompanyId = companyId; // Create a new variable to avoid reassigning the prop
      if (productionSite.companyId) {
        siteCompanyId = productionSite.companyId;
      }
    }
    
    payload.companyId = companyId;
    payload.type = (type || allocation.type || 'ALLOCATION').toUpperCase();
    payload.month = monthYear;
    if (!payload.allocated || typeof payload.allocated !== 'object') payload.allocated = {};
    Object.keys(payload.allocated).forEach(k => {
      payload.allocated[k] = Math.max(0, Math.round(Number(payload.allocated[k]) || 0));
    });

    // Set keys and required fields based on type
    if (payload.type === 'ALLOCATION') {
      payload.pk = `${companyId}_${payload.productionSiteId}_${payload.consumptionSiteId}`;
      payload.sk = monthYear;
    } else if (payload.type === 'BANKING') {
      payload.pk = `${companyId}_${payload.productionSiteId}`;
      payload.sk = monthYear;
      payload.bankingEnabled = true;
    } else if (payload.type === 'LAPSE') {
      payload.pk = `${companyId}_${payload.productionSiteId}`;
      payload.sk = monthYear;
    }
    // Add metadata stub for versioning and TTL
    const ts = new Date().toISOString();
    if (!payload.version) payload.version = 1;
    payload.ttl = 0;
    if (!payload.createdAt) payload.createdAt = ts;
    payload.updatedAt = ts;
    
    // Clean up undefined/null values and log the final payload for debugging
    Object.keys(payload).forEach(
      key => (payload[key] === undefined || payload[key] === null) && delete payload[key]
    );
    
    console.log(`[prepareAllocationPayload] Prepared ${type} payload:`, {
      productionSiteId: payload.productionSiteId,
      consumptionSiteId: payload.consumptionSiteId,
      month: payload.month,
      type: payload.type,
      companyId: payload.companyId
    });
    
    return payload;
  }, [companyId, productionData, consumptionData, bankingData, manualAllocations, formatAllocationMonth]);

  // Fix edit dialog selection: match by productionSiteId and consumptionSiteId (if present)
  const handleEditAllocation = useCallback((allocation, type) => {
    setDialogData({ type, data: allocation });
    setConfirmDialogOpen(true);
  }, []);

  // Local UI edit: update allocations/bankingAllocations/lapseAllocations only; persistence on 'Save Changes'
  const handleEditAllocationConfirmed = useCallback(() => {
    const { type, data: allocation } = dialogData;
    setConfirmDialogOpen(false);

    if (type === 'allocation') {
      // Update the allocation
      setAllocations(prevAllocs => prevAllocs.map(a =>
        a.productionSiteId === allocation.productionSiteId &&
        a.consumptionSiteId === allocation.consumptionSiteId
          ? { ...a, allocated: allocation.allocated, version: (a.version || 0) + 1, updatedAt: new Date().toISOString() }
          : a
      ));

      // Recalculate banking and lapse for this production site
      const pid = allocation.productionSiteId;
      const prod = productionData.find(p => p.productionSiteId === pid);
      if (prod) {
        // Calculate remaining units for banking/lapse
        const remaining = ALL_PERIODS.reduce((acc, period) => ({
          ...acc,
          [period]: Number(prod[period] || 0) - Number(allocation.allocated[period] || 0)
        }), {});

        // Create banking or lapse allocation
        const entry = {
          productionSiteId: pid,
          siteName: prod.siteName || prod.productionSite || '',
          month: prod.month,
          allocated: remaining,
          version: 1,
          ttl: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type: Number(prod.banking || 0) === 1 ? 'BANKING' : 'LAPSE'
        };

        // Update banking/lapse allocations
        if (entry.type === 'BANKING') {
          setBankingAllocations(prev => prev.filter(b => b.productionSiteId !== pid).concat(entry));
          setLapseAllocations(prev => prev.filter(l => l.productionSiteId === pid));
        } else {
          setLapseAllocations(prev => prev.filter(l => l.productionSiteId !== pid).concat(entry));
          setBankingAllocations(prev => prev.filter(b => b.productionSiteId === pid));
        }
      }
    } else if (type === 'banking') {
      setBankingAllocations(prev => prev.map(b =>
        b.productionSiteId === allocation.productionSiteId ? allocation : b
      ));
    }

    enqueueSnackbar('Allocation updated in UI. Click Save Changes to persist.', {
      variant: 'success',
      autoHideDuration: 3000
    });
  }, [dialogData, allocations, productionData, enqueueSnackbar]);

  // When fetch completes or month/year changes, update data
  useEffect(() => {
    if (showAllocations && productionData.length && consumptionData.length) {
      runAllocationCalculation();
    }
  }, [productionData, consumptionData, showAllocations, runAllocationCalculation]);

  const handleAutoAllocate = async () => {
    try {
      setLoading(true);
      setError(null);

      // Run allocation calculation
      runAllocationCalculation();
      
      enqueueSnackbar('Allocations computed successfully', { 
        variant: 'success',
        autoHideDuration: 3000 
      });
    } catch (err) {
      console.error('[Allocation] Auto allocation error:', err);
      setError(err.message || 'Failed to compute allocations');
      enqueueSnackbar(err.message || 'Failed to compute allocations', { 
        variant: 'error',
        autoHideDuration: 5000 
      });
    } finally {
      setLoading(false);
    }
  };

  const getFinancialYear = (month, year) => {
    return month >= 4 ? year : year - 1;
  };

  const fetchAllData = useCallback(async () => {
    if (!selectedMonth || !selectedYear || !companyId) {
      console.error('Missing required data for fetchAllData:', { 
        selectedMonth, 
        selectedYear, 
        companyId 
      });
      return;
    }

    setLoading(true);
    setError(null);
    
    console.log(`Fetching data for month: ${selectedMonth} year: ${selectedYear} for company: ${companyId}`);
    
    // Format month with leading zero if needed
    const formattedMonth = String(selectedMonth).padStart(2, '0');
    const financialYear = selectedMonth > 3 ? selectedYear : selectedYear - 1;
    
    const params = {
      companyId: companyId,
      month: selectedMonth,
      year: selectedYear,
      formattedMonth: `${formattedMonth}${selectedYear}`,
      financialYear,
      financialYearString: `${financialYear}-${financialYear + 1}`
    };
    
    console.log('Fetching data with params:', params);

    try {
      const [prodSitesResp, consSitesResp, bankingResp] = await Promise.all([
        productionSiteapi.fetchAll(companyId).catch(err => {
          console.error('Error fetching production sites:', err);
          enqueueSnackbar('Failed to load production sites', { variant: 'error' });
          return { data: [] };
        }),
        consumptionSiteapi.fetchAll(companyId).catch(err => {
          console.error('Error fetching consumption sites:', err);
          enqueueSnackbar('Failed to load consumption sites', { variant: 'error' });
          return { data: [] };
        }),
        bankingApi.fetchByPeriod(formattedMonth, companyId).catch(err => {
          console.error('Error fetching banking data:', err);
          enqueueSnackbar('Failed to load banking data', { variant: 'error' });
          return { data: [] };
        })
      ]);
      
      console.log('API responses:', {
        productionSites: prodSitesResp?.data?.length || 0,
        consumptionSites: consSitesResp?.data?.length || 0,
        bankingData: bankingResp?.data?.length || 0
      });

      const prodSites = Array.isArray(prodSitesResp?.data) ? prodSitesResp.data : [];
      const consSites = Array.isArray(consSitesResp?.data) ? consSitesResp.data : [];
      const bankingData = Array.isArray(bankingResp?.data) ? bankingResp.data : [];
      
      console.log('Processing data:', {
        productionSites: prodSites.length,
        consumptionSites: consSites.length,
        bankingRecords: bankingData.length
      });
      
      // Create a map of sites for easier lookup
      const siteNameMap = prodSites.reduce((map, site) => {
        try {
          if (!site || !site.productionSiteId) return map;
          
          const pk = `${Number(site.companyId) || 1}_${Number(site.productionSiteId)}`;
          map[pk] = {
            name: site.name || 'Unnamed Site',
            banking: Number(site.banking) || 0,
            status: site.status || 'Active',
            productionSiteId: site.productionSiteId,
            type: site.type || 'UNKNOWN',
            companyId: site.companyId
          };
        } catch (error) {
          console.error('Error processing production site:', { site, error });
        }
        return map;
      }, {});

      console.log('Created site name map with', Object.keys(siteNameMap).length, 'sites');

      // Calculate financial year months for filtering banking data
      const financialYear = selectedMonth > 3 ? selectedYear : selectedYear - 1;
      const financialYearMonths = [];
      
      // April to December of the current financial year
      for (let month = 4; month <= 12; month++) {
        financialYearMonths.push(`${month.toString().padStart(2, '0')}${financialYear}`);
      }
      // January to March of the next financial year
      for (let month = 1; month <= 3; month++) {
        financialYearMonths.push(`${month.toString().padStart(2, '0')}${financialYear + 1}`);
      }

      // Process banking data for the entire financial year
      const allBankingData = bankingData
        .filter(unit => {
          // Check if unit is valid and in the correct period
          if (!unit || !unit.pk || !unit.sk || !financialYearMonths.includes(unit.sk)) {
            if (unit) {
              console.log('Filtered out banking unit (invalid or wrong period):', {
                sk: unit.sk,
                financialYearMonths,
                unit
              });
            }
            return false;
          }
          return true;
        })
        .map(unit => {
          try {
            const siteInfo = siteNameMap[unit.pk] || { 
              name: 'Unknown Site', 
              banking: 0, 
              status: 'Unknown',
              productionSiteId: unit.pk?.split('_')?.[1] || 'unknown',
              type: 'UNKNOWN'
            };
            
            const processedUnit = {
              ...unit,
              siteName: siteInfo.name,
              banking: siteInfo.banking,
              status: siteInfo.status,
              productionSiteId: siteInfo.productionSiteId,
              type: siteInfo.type,
              c1: Number(unit.c1) || 0,
              c2: Number(unit.c2) || 0,
              c3: Number(unit.c3) || 0,
              c4: Number(unit.c4) || 0,
              c5: Number(unit.c5) || 0
            };
            
            return processedUnit;
          } catch (error) {
            console.error('Error processing banking unit:', { unit, error });
            return null;
          }
        })
        .filter(Boolean); // Remove any null entries from failed processing
        
      console.log('Processed banking data:', allBankingData.length, 'valid records');

      // Filter and process banking data for accessible sites
      const accessibleBankingData = allBankingData
        .map(unit => {
          try {
            // Skip if unit is invalid
            if (!unit || !unit.pk) {
              console.debug('Skipping invalid banking unit:', unit);
              return null;
            }
            
            // Get site info from the map
            const siteInfo = siteNameMap[unit.pk];
            
            // Skip if site info is not found (unknown site)
            if (!siteInfo) {
              console.debug('Skipping unknown site for unit:', unit.pk);
              return null;
            }
            
            // Extract production site ID safely
            const productionSiteId = String(siteInfo.productionSiteId || '').trim();
            const companyId = String(siteInfo.companyId || '').trim();
            
            // Skip if site ID is invalid
            if (!productionSiteId || !companyId) {
              console.debug('Skipping unit with invalid IDs:', { productionSiteId, companyId, unit });
              return null;
            }
            
            // Check if user has access to this site
            const hasAccess = hasSiteAccess(productionSiteId, 'production');
            if (!hasAccess) {
              console.debug('Filtered out banking unit (no access):', {
                productionSiteId,
                companyId,
                siteName: siteInfo.name || 'Unknown',
                unitPk: unit.pk
              });
              return null;
            }
            
            // Return the processed unit with proper typing
            return {
              ...unit,
              siteName: siteInfo.name || 'Unknown Site',
              banking: Number(siteInfo.banking) || 0,
              status: ['Active', 'Inactive'].includes(siteInfo.status) ? siteInfo.status : 'Inactive',
              productionSiteId,
              companyId,
              type: siteInfo.type || 'GENERATION',
              c1: Math.max(0, Number(unit.c1) || 0),
              c2: Math.max(0, Number(unit.c2) || 0),
              c3: Math.max(0, Number(unit.c3) || 0),
              c4: Math.max(0, Number(unit.c4) || 0),
              c5: Math.max(0, Number(unit.c5) || 0)
            };
          } catch (error) {
            console.error('Error processing banking unit:', { error, unit });
            return null;
          }
        })
        .filter(Boolean); // Remove any null entries from failed processing
      
      console.log('Accessible banking data:', accessibleBankingData.length, 'records');
      
      // Aggregate banking data by site for the entire financial year
      const aggregatedBanking = Object.values(
        accessibleBankingData.reduce((acc, curr) => {
          try {
            if (!curr || !curr.pk) return acc;
            
            const key = curr.pk;
            if (!acc[key]) {
              acc[key] = {
                ...curr,
                c1: 0,
                c2: 0,
                c3: 0,
                c4: 0,
                c5: 0,
                financialYear: `${financialYear}-${financialYear + 1}`
              };
            }
            
            acc[key].c1 += Number(curr.c1) || 0;
            acc[key].c2 += Number(curr.c2) || 0;
            acc[key].c3 += Number(curr.c3) || 0;
            acc[key].c4 += Number(curr.c4) || 0;
            acc[key].c5 += Number(curr.c5) || 0;
            
          } catch (error) {
            console.error('Error aggregating banking data:', { error, curr });
          }
          return acc;
        }, {})
      );

      console.log('Aggregated banking data:', aggregatedBanking.length, 'records');

      // Fetch production units for specific month, filtered by accessible sites
      const productionUnits = [];
      const productionUnitsErrors = [];
      
      // Filter production sites to only those the user has access to
      const accessibleProdSites = prodSites.filter(site => {
        if (!site?.productionSiteId) return false;
        const hasAccess = hasSiteAccess(String(site.productionSiteId), 'production');
        if (!hasAccess) {
          console.debug('Skipping production site (no access):', {
            productionSiteId: site.productionSiteId,
            companyId: site.companyId,
            siteName: site.name
          });
        }
        return hasAccess;
      });
      
      console.log(`Processing ${accessibleProdSites.length} accessible production sites`);
      
      await Promise.all(
        accessibleProdSites.map(async (site) => {
          try {
            const companyId = Number(site.companyId) || 1;
            const productionSiteId = Number(site.productionSiteId);
            
            if (!productionSiteId) {
              console.warn('Skipping site with invalid productionSiteId:', site);
              return;
            }
            
            console.debug(`Fetching production units for site ${productionSiteId} (company ${companyId})`);
            
            const unitsResp = await productionUnitApi.fetchAll(companyId, productionSiteId);
            const sk = `${selectedMonth.toString().padStart(2, '0')}${selectedYear}`;
            
            const siteUnits = (unitsResp?.data || [])
              .filter(unit => unit && unit.sk === sk)
              .map(unit => {
                try {
                  return {
                    ...unit,
                    siteName: site.name || 'Unnamed Site',
                    status: site.status || 'Active',
                    bankingStatus: allBankingData.some(
                      banking => banking.productionSiteId === site.productionSiteId && 
                                banking.banking === 1
                    ) ? 'Available' : 'Not Available',
                    banking: Number(site.banking) || 0,
                    productionSiteId: site.productionSiteId,
                    type: site.type || 'UNKNOWN',
                    c1: Number(unit.c1) || 0,
                    c2: Number(unit.c2) || 0,
                    c3: Number(unit.c3) || 0,
                    c4: Number(unit.c4) || 0,
                    c5: Number(unit.c5) || 0
                  };
                } catch (unitError) {
                  console.error('Error processing production unit:', { unit, error: unitError });
                  return null;
                }
              })
              .filter(Boolean);
              
            if (siteUnits.length > 0) {
              productionUnits.push(...siteUnits);
            } else {
              console.log(`No production units found for site ${productionSiteId} in ${sk}`);
            }
            
          } catch (error) {
            const errorMsg = `Error fetching production units for site ${site?.productionSiteId}: ${error.message || error}`;
            console.error(errorMsg, { site, error });
            productionUnitsErrors.push(errorMsg);
          }
        })
      );

      if (productionUnitsErrors.length > 0) {
        console.warn('Some production units could not be loaded:', productionUnitsErrors);
        if (productionUnitsErrors.length > 3) {
          enqueueSnackbar(
            `Failed to load production units for ${productionUnitsErrors.length} sites. Check console for details.`,
            { variant: 'warning' }
          );
        } else {
          productionUnitsErrors.forEach(error => {
            enqueueSnackbar(error, { variant: 'error' });
          });
        }
      }

      console.log('Fetched production units:', productionUnits.length);

      // Fetch consumption units for specific month, filtered by accessible sites
      const consumptionUnits = [];
      const consumptionUnitsErrors = [];
      
      // Filter consumption sites to only those the user has access to
      const accessibleConsSites = consSites.filter(site => {
        if (!site?.consumptionSiteId) return false;
        const hasAccess = hasSiteAccess(String(site.consumptionSiteId), 'consumption');
        if (!hasAccess) {
          console.debug('Skipping consumption site (no access):', {
            consumptionSiteId: site.consumptionSiteId,
            companyId: site.companyId,
            siteName: site.name
          });
        }
        return hasAccess;
      });
      
      console.log(`Processing ${accessibleConsSites.length} accessible consumption sites`);
      
      await Promise.all(
        accessibleConsSites.map(async (site) => {
          try {
            const companyId = Number(site.companyId) || 1;
            const consumptionSiteId = Number(site.consumptionSiteId);
            
            if (!consumptionSiteId) {
              console.warn('Skipping site with invalid consumptionSiteId:', site);
              return;
            }
            
            console.debug(`Fetching consumption units for site ${consumptionSiteId} (company ${companyId})`);
            
            const unitsResp = await consumptionUnitApi.fetchAll(companyId, consumptionSiteId);
            const sk = `${selectedMonth.toString().padStart(2, '0')}${selectedYear}`;
            
            const siteUnits = (unitsResp?.data || [])
              .filter(unit => unit && unit.sk === sk)
              .map(unit => {
                try {
                  return {
                    ...unit,
                    siteName: site.name || 'Unnamed Site',
                    status: site.status || 'Active',
                    consumptionSiteId: site.consumptionSiteId,
                    type: site.type || 'UNKNOWN',
                    c1: Number(unit.c1) || 0,
                    c2: Number(unit.c2) || 0,
                    c3: Number(unit.c3) || 0,
                    c4: Number(unit.c4) || 0,
                    c5: Number(unit.c5) || 0
                  };
                } catch (unitError) {
                  console.error('Error processing consumption unit:', { unit, error: unitError });
                  return null;
                }
              })
              .filter(Boolean);
              
            if (siteUnits.length > 0) {
              consumptionUnits.push(...siteUnits);
            } else {
              console.log(`No consumption units found for site ${consumptionSiteId} in ${sk}`);
            }
            
          } catch (error) {
            const errorMsg = `Error fetching consumption units for site ${site?.consumptionSiteId}: ${error.message || error}`;
            console.error(errorMsg, { site, error });
            consumptionUnitsErrors.push(errorMsg);
          }
        })
      );

      if (consumptionUnitsErrors.length > 0) {
        console.warn('Some consumption units could not be loaded:', consumptionUnitsErrors);
        if (consumptionUnitsErrors.length > 3) {
          enqueueSnackbar(
            `Failed to load consumption units for ${consumptionUnitsErrors.length} sites. Check console for details.`,
            { variant: 'warning' }
          );
        } else {
          consumptionUnitsErrors.forEach(error => {
            enqueueSnackbar(error, { variant: 'error' });
          });
        }
      }

      console.log('Fetched consumption units:', consumptionUnits.length);

      // Update production units with proper pk and sk for banking/lapse
      const updatedProductionUnits = productionUnits.map(unit => {
        try {
          if (!unit) return null;
          // Using the component's companyId from user context
          const formattedMonth = `${selectedMonth.toString().padStart(2, '0')}${selectedYear}`; // mmyyyy format
          
          return {
            ...unit,
            // Generate pk for banking/lapse (companyId_productionSiteId)
            pk: `${companyId}_${unit.productionSiteId}`,
            // Generate sk in mmyyyy format
            sk: formattedMonth,
            // Ensure all required fields have default values
            siteName: unit.siteName || 'Unnamed Site',
            status: unit.status || 'Active',
            type: unit.type || 'UNKNOWN',
            c1: Number(unit.c1) || 0,
            c2: Number(unit.c2) || 0,
            c3: Number(unit.c3) || 0,
            c4: Number(unit.c4) || 0,
            c5: Number(unit.c5) || 0
          };
        } catch (error) {
          console.error('Error processing production unit for banking/lapse:', { unit, error });
          return null;
        }
      }).filter(Boolean); // Remove any null entries
      
      console.log('Processed production units for banking/lapse:', updatedProductionUnits.length);

      // Final data processing and state updates
      console.log('Updating component state with new data', {
        productionUnits: updatedProductionUnits.length,
        consumptionUnits: consumptionUnits.length,
        bankingData: allBankingData.length,
        aggregatedBanking: Object.keys(aggregatedBanking).length
      });

      setProductionData(updatedProductionUnits);
      setConsumptionData(consumptionUnits);
      // Set the aggregated banking data with previous balance
      const bankingDataWithPreviousBalance = aggregatedBanking.map(unit => ({
        ...unit,
        previousBalance: {
          c1: 0,
          c2: 0,
          c3: 0,
          c4: 0,
          c5: 0
        }
      }));
      
      setBankingData(accessibleBankingData);
      setAggregatedBankingData(bankingDataWithPreviousBalance);
      
      // Clear any previous errors
      setError(null);
      
      enqueueSnackbar('Data loaded successfully', { variant: 'success' });
      
    } catch (error) {
      const errorMsg = `Error fetching data: ${error.message || error}`;
      console.error(errorMsg, error);
      setError({
        message: 'Failed to load data',
        details: error.message || 'An unknown error occurred',
        timestamp: new Date().toISOString()
      });
      
      enqueueSnackbar('Failed to load data. Please try again.', { variant: 'error' });
      
      // Reset data states to prevent showing stale data
      setProductionData([]);
      setConsumptionData([]);
      setBankingData([]);
      setAggregatedBankingData([]);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, selectedMonth, selectedYear, companyId, hasSiteAccess]);

  // Fetch shareholdings on component mount or when companyId changes
  useEffect(() => {
    const loadShareholdings = async () => {
      if (!companyId) {
        console.error('[loadShareholdings] No company ID available for the logged-in user');
        enqueueSnackbar('No company information found for the logged-in user', { 
          variant: 'error',
          autoHideDuration: 5000 
        });
        return;
      }

      try {
        setLoadingShareholdings(true);
        console.log(`[loadShareholdings] Loading shareholdings for company: ${companyId}`);
        
        const shareholdingsData = await fetchShareholdings(companyId);
        console.log(`[loadShareholdings] Received ${shareholdingsData?.length || 0} shareholdings`);
        
        if (shareholdingsData && shareholdingsData.length > 0) {
          setShareholdings(shareholdingsData);
          console.log('[loadShareholdings] Updated shareholdings state:', shareholdingsData);
        } else {
          console.warn('[loadShareholdings] No shareholding data available');
          setShareholdings([]);
          enqueueSnackbar('No shareholding data available for this company', { 
            variant: 'warning',
            autoHideDuration: 5000,
            persist: false
          });
        }
      } catch (error) {
        console.error('[loadShareholdings] Error:', {
          error,
          message: error.message,
          stack: error.stack
        });
        
        enqueueSnackbar(
          'Failed to load shareholding data. Please check the console for details.', 
          { 
            variant: 'error',
            autoHideDuration: 7000,
            persist: false
          }
        );
      } finally {
        setLoadingShareholdings(false);
      }
    };
    
    if (companyId) {
      loadShareholdings();
    } else {
      console.warn('Cannot load shareholdings: No company ID available');
      enqueueSnackbar('Cannot load shareholdings: No company information available', {
        variant: 'warning',
        autoHideDuration: 5000
      });
    }
  }, [companyId, enqueueSnackbar, fetchShareholdings]);

  // Update allocations when shareholdings or data changes
  useEffect(() => {
    const hasRequiredData = productionData.length > 0 && consumptionData.length > 0;
    
    if (!hasRequiredData) {
      console.log('Waiting for production and consumption data...');
      return;
    }

    if (shareholdings.length === 0) {
      console.warn('No shareholdings available for allocation');
      enqueueSnackbar('No shareholding data available for allocation', { 
        variant: 'warning',
        autoHideDuration: 5000 
      });
    } else {
      console.log('Updating allocation data with shareholdings:', shareholdings.length);
      updateAllocationData();
    }
  }, [productionData, consumptionData, shareholdings, updateAllocationData, enqueueSnackbar, selectedMonth, selectedYear]);

  // Fetch data when selectedYear, selectedMonth, or companyId changes
  useEffect(() => {
    if (companyId) {
      fetchAllData();
    } else {
      console.warn('Cannot fetch data: No company ID available');
      enqueueSnackbar('Cannot load data: No company information available', {
        variant: 'warning',
        autoHideDuration: 5000
      });
    }
  }, [selectedYear, selectedMonth, companyId, fetchAllData, enqueueSnackbar]);

  const handleMonthChange = (event) => {
    setSelectedMonth(Number(event.target.value));
  };

  const handleYearChange = (year) => {
    setSelectedYear(Number(year));
  };

  // Save handler: send each type to its respective API and log payloads
  const handleSaveAllocation = async () => {
    setIsSaving(true);
    try {
      // Log available production sites for debugging
      console.log('Available production sites:', productionData.map(site => ({
        id: site.id,
        productionSiteId: site.productionSiteId,
        name: site.siteName,
        companyId: site.companyId
      })));

      // 1. Save allocations
      if (allocations.length) {
        const allocPayloads = allocations.map(a => prepareAllocationPayload(a, 'ALLOCATION', selectedMonth, selectedYear));
        console.log('[AllocationApi] Payload to allocation table:', JSON.stringify(allocPayloads, null, 2));
        
        // Verify all production sites exist before making API calls
        for (const payload of allocPayloads) {
          try {
            // Log the payload being sent
            console.log(`Creating allocation for production site: ${payload.productionSiteId}`, {
              payload,
              productionSiteId: payload.productionSiteId,
              hasProductionSite: productionData.some(site => 
                site.productionSiteId === payload.productionSiteId || site.id === payload.productionSiteId
              )
            });
            
            await allocationApi.createAllocation(payload);
          } catch (error) {
            const msg = error.message || '';
            console.error('Error creating allocation:', {
              error,
              payload,
              productionSites: productionData.map(s => ({
                id: s.id,
                productionSiteId: s.productionSiteId,
                name: s.siteName
              }))
            });
            
            if (msg.includes('already exists')) {
              // Duplicate: ask to update existing record
              if (window.confirm(`${msg}. Do you want to update it instead?`)) {
                await allocationApi.update(payload.pk, payload.sk, payload, 'ALLOCATION');
              } else {
                throw error;
              }
            } else {
              // For production site not found errors, provide more context
              if (msg.includes('Production site not found')) {
                throw new Error(`${msg}. Available production sites: ${
                  productionData.map(s => `${s.siteName} (ID: ${s.productionSiteId || s.id})`).join(', ')
                }`);
              }
              throw error;
            }
          }
        }
      }
      // 2. Save banking allocations
      if (bankingAllocations.length) {
        // Group banking allocations by production site and month
        const bankingMap = new Map();
        
        bankingAllocations.forEach(b => {
          const payload = prepareAllocationPayload(b, 'BANKING', selectedMonth, selectedYear);
          // Use a composite key of productionSiteId and month to group
          const key = `${payload.productionSiteId}_${payload.month}`;
          
          if (!bankingMap.has(key)) {
            // Initialize with the first payload for this site/month
            bankingMap.set(key, { ...payload });
          } else {
            // Merge c1-c5 values for the same site/month
            const existing = bankingMap.get(key);
            ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(field => {
              existing[field] = (existing[field] || 0) + (payload[field] || 0);
            });
          }
        });
        
        // Convert map values back to array
        const consolidatedBanking = Array.from(bankingMap.values());
        console.log('[BankingApi] Consolidated banking payloads:', consolidatedBanking);
        
        // Process each unique banking allocation
        for (const payload of consolidatedBanking) {
          try {
            console.log(`[BankingApi] Processing banking for site ${payload.productionSiteId}, month ${payload.month}`);
            await allocationApi.createBanking(payload);
          } catch (error) {
            console.error(`[BankingApi] Error processing banking for site ${payload.productionSiteId}:`, error);
            throw error;
          }
        }
      }
      // 3. Save lapse allocations - handle potential duplicates with existence check
      if (lapseAllocations.length) {
        const lapsePayloads = lapseAllocations.map(l => prepareAllocationPayload(l, 'LAPSE', selectedMonth, selectedYear));
        console.log('[LapseApi] Payload to lapse table:', lapsePayloads);
        
        for (const payload of lapsePayloads) {
          try {
            // First, check if a LAPSE record already exists for this PK/SK
            console.log(`[LapseApi] Checking for existing LAPSE record: ${payload.pk}_${payload.sk}`);
            const existingRecord = await allocationApi.get(payload.pk, payload.sk, 'LAPSE').catch(() => null);
            
            if (existingRecord) {
              // Record exists, update it
              console.log(`[LapseApi] Updating existing LAPSE record: ${payload.pk}_${payload.sk}`);
              await allocationApi.update(payload.pk, payload.sk, payload, 'LAPSE');
              console.log('[LapseApi] Successfully updated LAPSE record');
            } else {
              // No record exists, create a new one
              console.log(`[LapseApi] Creating new LAPSE record: ${payload.pk}_${payload.sk}`);
              await allocationApi.createLapse(payload);
              console.log('[LapseApi] Successfully created LAPSE record');
            }
          } catch (error) {
            const errorMessage = error.message || '';
            const responseMessage = error.response?.data?.message || '';
            const statusCode = error.response?.status;
            
            console.error(`[LapseApi] Error processing LAPSE record ${payload.pk}_${payload.sk}:`, {
              error: errorMessage,
              response: responseMessage,
              statusCode
            });
            
            // If we get a 400 and the error message is about the record existing, try to update it
            if (statusCode === 400 && 
                (errorMessage.includes('already exists') || 
                 errorMessage.includes('conditional check failed') ||
                 responseMessage.includes('already exists') ||
                 responseMessage.includes('conditional check failed'))) {
              console.log('[LapseApi] Record may exist, attempting update...');
              try {
                await allocationApi.update(payload.pk, payload.sk, payload, 'LAPSE');
                console.log('[LapseApi] Successfully updated LAPSE record after initial failure');
                continue; // Success, move to next record
              } catch (updateError) {
                console.error('[LapseApi] Failed to update LAPSE record after initial failure:', updateError);
              }
            }
            
            // If we get here, all attempts have failed
            throw new Error(`Failed to save LAPSE record: ${errorMessage || responseMessage || 'Unknown error'}`);
          }
        }
      }
      enqueueSnackbar('Allocations saved successfully!', { variant: 'success' });
      updateAllocationData();
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to save allocations', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  const financialYear = getFinancialYear(selectedMonth, selectedYear);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        borderBottom: '2px solid #1976d2',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4">Allocation Management</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
            <Typography variant="subtitle1" sx={{ whiteSpace: 'nowrap' }}>
              FY: {financialYear}-{financialYear + 1}
            </Typography>
          </Box>
          <TextField
            select
            size="small"
            id="month-selector"
            label="Month"
            value={selectedMonth}
            onChange={handleMonthChange}
            sx={{ width: 120, mr: 2 }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <MenuItem key={month} value={month}>
                {format(new Date(2000, month - 1), 'MMMM')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            sx={{ width: 120 }}
          >
            {Array.from(
              { length: yearRange.end - yearRange.start + 1 },
              (_, i) => yearRange.start + i
            ).map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAllData}
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof error === 'string' ? error : (
            <Box>
              {error.allocation?.length > 0 && (
                <Typography>Allocation Errors: {error.allocation.join(', ')}</Typography>
              )}
              {error.banking?.length > 0 && (
                <Typography>Banking Errors: {error.banking.join(', ')}</Typography>
              )}
              {error.lapse?.length > 0 && (
                <Typography>Lapse Errors: {error.lapse.join(', ')}</Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      <ProductionUnitsTable 
        data={productionData}
        onManualAllocationChange={handleManualAllocationChange}
      />
      
      <BankingUnitsTable 
        bankingData={aggregatedBankingData}
        selectedYear={financialYear}
      />

      <ConsumptionUnitsTable 
        consumptionData={consumptionData}
        selectedYear={financialYear}
        shareholdings={shareholdings}
        companyId={companyId}
        isLoading={loading}
        onAllocationSaved={updateAllocationData}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4, mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AutorenewIcon />}
          onClick={handleAutoAllocate}
          disabled={loading || !productionData.length || !consumptionData.length}
        >
          Auto Allocate
        </Button>
      </Box>

      {showAllocations && (
        <>
          <AllocationDetailsTable 
            allocations={allocations}
            bankingAllocations={bankingAllocations}
            oldBankingAllocations={originalBankingAllocations}
            lapseAllocations={lapseAllocations}
            oldLapseAllocations={originalLapseAllocations}
            loading={loading || isSaving}
            onEdit={handleEditAllocation}
            onSave={handleSaveAllocation}
          />
          <Box sx={{ mt: 3 }}>
            <AllocationSummary
              productionData={productionData}
              consumptionData={consumptionData}
              allocations={allocations}
              bankingAllocations={bankingAllocations}
              oldBankingAllocations={aggregatedBankingData}
              lapseAllocations={lapseAllocations}
            />
          </Box>
        </>
      )}
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Update</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to update this {dialogData.type?.toLowerCase()}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditAllocationConfirmed} color="primary">OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Allocation;