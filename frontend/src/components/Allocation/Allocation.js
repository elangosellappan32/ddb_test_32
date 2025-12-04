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
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormControl,
  Select,
  Grid,
  Paper,
  Chip,
  Switch
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  Autorenew as AutorenewIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTheme } from '@mui/material/styles';
import productionUnitApi from '../../services/productionUnitApi';
import consumptionUnitApi from '../../services/consumptionUnitApi';
import productionSiteapi from '../../services/productionSiteApi';
import consumptionSiteapi from '../../services/consumptionSiteApi';
import bankingApi from '../../services/bankingApi';
import allocationApi from '../../services/allocationApi';
import captiveApi from '../../services/captiveApi';
import ProductionUnitsTable from './ProductionUnitsTable';
import BankingUnitsTable from './BankingUnitsTable';
import ConsumptionUnitsTable from './ConsumptionUnitsTable';
import AllocationDetailsTable from './AllocationDetailsTable';
import AllocationSummary from './AllocationSummary';
import { formatAllocationMonth, ALL_PERIODS } from '../../utils/allocationUtils';
import { useAuth } from '../../context/AuthContext';
import { calculateAllocations, filterConsumptionUnits, createIncludeExcludeSettings } from '../../utils/allocationCalculator';
import { 
  loadAllocationPercentages, 
  convertToCaptiveDataFormat 
} from '../../utils/allocationLocalStorage';

const Allocation = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { hasSiteAccess, user, hasCompanyAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [captiveData, setCaptiveData] = useState([]);
  // Set default to previous month
  const currentDate = new Date();
  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const [selectedYear, setSelectedYear] = useState(prevMonthDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(prevMonthDate.getMonth() + 1);
  const [autoAllocationDialogOpen, setAutoAllocationDialogOpen] = useState(false);
  const [selectedConsumptionSites, setSelectedConsumptionSites] = useState({});
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
  const [consumptionSitePriority, setConsumptionSitePriority] = useState({});
  const [consumptionSiteIncludeExclude, setConsumptionSiteIncludeExclude] = useState({
    included: new Set(),
    excluded: new Set(),
    excludeByDefault: false
  });

  // Get company ID from the logged-in user with multiple fallback options
  const companyId = React.useMemo(() => {
    // Try different possible locations for company ID
    const id = user?.companyId || 
               user?.company?.id ||
               (user?.metadata?.companyId?.S || user?.metadata?.companyId) ||
               (user?.metadata?.department?.toLowerCase().includes('strio') ? '1' : null) ||
               (user?.metadata?.department?.toLowerCase().includes('smr') ? '5' : null);
    
    if (!id) {
      console.warn('Could not determine company ID from user object:', {
        user: {
          ...user,
          // Don't log sensitive data
          password: user?.password ? '***' : undefined,
          token: user?.token ? '***' : undefined
        }
      });
      enqueueSnackbar('Warning: Could not determine company information', { 
        variant: 'warning',
        autoHideDuration: 10000
      });
    } else {
      console.log('Using company ID:', id, 'from user object');
    }
    
    return id || null;
  }, [user, enqueueSnackbar]);

  const fetchCaptiveData = useCallback(async () => {
    try {
      console.log('Fetching captive data for all generator companies');
      
      // First, get all production sites to identify all generator companies
      const response = await productionSiteapi.fetchAll();
      const productionSites = response.data || [];
      
      if (!Array.isArray(productionSites)) {
        console.error('Unexpected production sites format:', productionSites);
        throw new Error('Failed to load production sites: Invalid response format');
      }
      
      const generatorCompanyIds = [...new Set(
        productionSites
          .map(site => site.generatorCompanyId || site.companyId)
          .filter(Boolean)
      )];
      
      console.log('Found generator companies:', generatorCompanyIds);
      
      if (generatorCompanyIds.length === 0) {
        console.warn('No generator companies found in production sites');
        setCaptiveData([]);
        return [];
      }
      
      console.log('Found generator companies:', generatorCompanyIds);
      
      // Fetch captive data for all generator companies
      const allCaptiveData = [];
      
      for (const genId of generatorCompanyIds) {
        try {
          console.log(`Fetching captive data for generator company: ${genId}`);
          const data = await captiveApi.getByGenerator(genId);
          
          if (data && data.length > 0) {
            // Add generator company ID to each entry if missing
            const validEntries = data
              .filter(entry => entry && entry.shareholderCompanyId && entry.allocationPercentage > 0)
              .map(entry => ({
                ...entry,
                generatorCompanyId: entry.generatorCompanyId || genId
              }));
              
            allCaptiveData.push(...validEntries);
          }
        } catch (error) {
          console.error(`Error fetching captive data for generator ${genId}:`, error);
        }
      }
      
      // If no data found, try to get all captive entries
      if (allCaptiveData.length === 0) {
        console.log('No captive data found by generator, fetching all entries');
        const allData = await captiveApi.getAll();
        
        if (Array.isArray(allData) && allData.length > 0) {
          // Filter for entries matching our generator companies
          const validData = allData.filter(entry => 
            entry && 
            entry.generatorCompanyId && 
            generatorCompanyIds.includes(String(entry.generatorCompanyId)) &&
            entry.shareholderCompanyId && 
            entry.allocationPercentage > 0
          );
          
          allCaptiveData.push(...validData);
        }
      }
      
      console.log('Fetched captive data:', allCaptiveData);
      
      // Ensure we have valid data with required fields
      const validData = allCaptiveData.filter(entry => 
        entry && 
        entry.generatorCompanyId && 
        entry.shareholderCompanyId && 
        entry.allocationPercentage > 0
      );
      
      // Ensure we have at least one entry for each generator company
      const generatorIdsInCaptiveData = new Set(validData.map(entry => String(entry.generatorCompanyId)));
      const missingGeneratorIds = generatorCompanyIds.filter(id => !generatorIdsInCaptiveData.has(String(id)));
      
      if (missingGeneratorIds.length > 0) {
        console.warn('No captive data found for generator companies:', missingGeneratorIds);
        // You might want to add default entries here if needed
      }
      
      setCaptiveData(validData);
      return validData;
    } catch (error) {
      console.error('Error fetching captive data:', error);
      enqueueSnackbar('Failed to load captive data', { variant: 'error' });
      setCaptiveData([]);
      return [];
    }
  }, [enqueueSnackbar]);
  const updateAllocationData = useCallback(async (currentShareholdings = shareholdings) => {
    if (!showAllocations) {
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
      hasBankingData: bankingData.length > 0,
      companyId
    });
    
    try {
      // Ensure we have the latest captive data
      const latestCaptiveData = await fetchCaptiveData();
      
      if (!latestCaptiveData || latestCaptiveData.length === 0) {
        console.warn('No captive data available for allocation');
        enqueueSnackbar('Warning: No captive data found for allocation. Please check your captive settings.', { 
          variant: 'warning',
          autoHideDuration: 10000
        });
      }
      
      // Recalculate allocations with current data
      const result = calculateAllocations({
        productionUnits: productionData,
        consumptionUnits: consumptionData,
        bankingUnits: bankingData,
        manualAllocations,
        shareholdings: currentShareholdings,
        month: `${String(selectedMonth).padStart(2, '0')}${selectedYear}`,
        productionSites: productionData,
        captiveData: latestCaptiveData,
        consumptionSitePriorityMap: consumptionSitePriority,
        consumptionSiteIncludeExclude: consumptionSiteIncludeExclude
      });
      
      console.log('Allocation calculation results:', result);
      
      // Use allocations directly from calculator result
      const regularAllocs = result.allocations;
      const bankingAllocs = result.bankingAllocations || [];
      const lapseAllocs = result.lapseAllocations || [];
      
      // Log any consumers that weren't matched with producers
      const consumerIds = new Set(consumptionData.map(c => c.id || c.consumptionSiteId));
      const allocatedConsumerIds = new Set(regularAllocs.map(a => a.consumptionSiteId));
      const unallocatedConsumers = Array.from(consumerIds).filter(id => !allocatedConsumerIds.has(id));
      
      if (unallocatedConsumers.length > 0) {
        console.warn(`Warning: ${unallocatedConsumers.length} consumers were not allocated any production`, {
          unallocatedConsumerIds: unallocatedConsumers,
          totalConsumers: consumerIds.size,
          allocatedConsumers: allocatedConsumerIds.size
        });
      }
      
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
      enqueueSnackbar(`Failed to update allocations: ${error.message}`, { 
        variant: 'error',
        autoHideDuration: 10000
      });
    }
  }, [
    productionData, 
    consumptionData, 
    bankingData, 
    manualAllocations, 
    shareholdings, 
    selectedMonth,
    selectedYear,
    originalBankingAllocations.length, 
    originalLapseAllocations.length,
    showAllocations,
    companyId,
    enqueueSnackbar,
    fetchCaptiveData,
    consumptionSitePriority
  ]);

  // Save handler: send each type to its respective API and log payloads
  const handleSaveAllocation = async () => {
    setIsSaving(true);
    try {
      // Pre-flight validation
      if (!companyId) {
        throw new Error('Company ID is not set. Please check your user profile and try again.');
      }

      if (typeof companyId !== 'number' && typeof companyId !== 'string') {
        throw new Error(`Invalid company ID format. Expected number or string, got ${typeof companyId}`);
      }

      // Log summary of data to be saved
      console.log('[HandleSaveAllocation] Starting save process with data:', {
        allocationsCount: allocations.length,
        bankingAllocationsCount: bankingAllocations.length,
        lapseAllocationsCount: lapseAllocations.length,
        month: selectedMonth,
        year: selectedYear,
        companyId: companyId,
        companyIdType: typeof companyId,
        userInfo: {
          userId: user?.id,
          userCompanyId: user?.companyId,
          userMetadataCompanyId: user?.metadata?.companyId
        }
      });

      // Log available production sites for debugging
      console.log('[HandleSaveAllocation] Available production sites:', productionData.map(site => ({
        id: site.id,
        productionSiteId: site.productionSiteId,
        name: site.siteName,
        companyId: site.companyId,
        generatorCompanyId: site.generatorCompanyId
      })));

      // 1. Save allocations
      if (allocations.length) {
        const allocPayloads = allocations.map(a => {
          const payload = prepareAllocationPayload(a, 'ALLOCATION', selectedMonth, selectedYear);
          // Ensure IR fields are included
          if (a.irType) payload.irType = a.irType;
          if (a.injection) payload.injection = { ...a.injection };
          if (a.reduction) payload.reduction = { ...a.reduction };
          return payload;
        });
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
              userCompanyId: companyId,
              productionSites: productionData.map(s => ({
                id: s.id,
                productionSiteId: s.productionSiteId,
                name: s.siteName,
                companyId: s.companyId
              }))
            });
            
            if (msg.includes('User company information not found')) {
              throw new Error(`User company information not found. Your company ID: ${companyId}. Please contact your administrator if this issue persists.`);
            } else if (msg.includes('already exists')) {
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
        console.log('[HandleSaveAllocation] Saving banking allocations:', bankingAllocations);
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
        console.log('[HandleSaveAllocation] Consolidated banking allocations:', consolidatedBanking);
        
        // Process each unique banking allocation
        for (const payload of consolidatedBanking) {
          try {
            console.log(`[HandleSaveAllocation] Creating banking allocation for site ${payload.productionSiteId}`);
            await allocationApi.createBanking({
              ...payload,
              generatorCompanyId: companyId,
              month: payload.month
            });
            console.log(`[HandleSaveAllocation] Successfully saved banking for site ${payload.productionSiteId}`);
          } catch (error) {
            console.error(`[BankingApi] Error processing banking for site ${payload.productionSiteId}:`, error);
            throw error;
          }
        }
      }
      // 3. Save lapse allocations - handle potential duplicates with existence check
      if (lapseAllocations.length) {
        console.log('[HandleSaveAllocation] Saving lapse allocations:', lapseAllocations);
        const lapsePayloads = lapseAllocations.map(l => prepareAllocationPayload(l, 'LAPSE', selectedMonth, selectedYear));
        console.log('[LapseApi] Payload to lapse table:', lapsePayloads);
        
        for (const payload of lapsePayloads) {
          try {
            console.log(`[HandleSaveAllocation] Creating lapse allocation for site ${payload.productionSiteId}`, payload);
            // Prepare the payload with generatorCompanyId
            const lapsePayload = {
              ...payload,
              generatorCompanyId: companyId,
              month: payload.month,
              productionSiteId: payload.productionSiteId
            };

            // First, check if a LAPSE record already exists for this site/month
            try {
              await allocationApi.createLapse(lapsePayload);
              console.log(`[HandleSaveAllocation] Successfully saved lapse for site ${payload.productionSiteId}`);
            } catch (createError) {
              if (createError.response?.status === 400 && 
                  (createError.message?.includes('already exists') || 
                   createError.response?.data?.message?.includes('already exists'))) {
                // If record exists, update it
                console.log(`[HandleSaveAllocation] Lapse record exists, updating for site ${payload.productionSiteId}`);
                await allocationApi.update(lapsePayload.productionSiteId, lapsePayload.month, lapsePayload, 'LAPSE');
                console.log(`[HandleSaveAllocation] Successfully updated lapse for site ${payload.productionSiteId}`);
              } else {
                throw createError;
              }
            }
          } catch (error) {
            const errorMessage = error.message || '';
            const responseMessage = error.response?.data?.message || '';
            const statusCode = error.response?.status;
            
            console.error(`[LapseApi] Error processing LAPSE record for site ${payload.productionSiteId}:`, {
              error: errorMessage,
              response: responseMessage,
              statusCode,
              payload
            });
            
            throw new Error(`Failed to save LAPSE record: ${errorMessage || responseMessage || 'Unknown error'}`);
          }
        }
      }
      
      console.log('[HandleSaveAllocation] All allocations saved successfully');
      enqueueSnackbar(`Allocations saved successfully! (Regular: ${allocations.length}, Banking: ${bankingAllocations.length}, Lapse: ${lapseAllocations.length})`, { 
        variant: 'success',
        autoHideDuration: 5000
      });
      updateAllocationData();
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to save allocations', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogConfirm = () => {
    // Handle confirmation logic here
    handleSaveAllocation();
    setConfirmDialogOpen(false);
  };

  const handleAllocationPercentageChange = (siteId, newPercentage) => {
    // This function handles allocation percentage changes from ConsumptionUnitsTable
    console.log('Allocation percentage changed:', { siteId, newPercentage });
    // You can implement additional logic here if needed
  };

  // Simple ConfirmationDialog component
  const ConfirmationDialog = ({ open, onClose, onConfirm, title, content }) => {
    const theme = useTheme();
    
    return (
      <Dialog 
        open={open} 
        onClose={onClose}
        aria-labelledby="confirmation-dialog-title"
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            minWidth: 400,
            [theme.breakpoints.down('sm')]: {
              margin: 2,
              minWidth: 'auto',
              width: '100%'
            }
          }
        }}
      >
        <DialogTitle 
          id="confirmation-dialog-title"
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            padding: theme.spacing(2, 3),
            '& .MuiTypography-root': {
              fontWeight: 600,
              fontSize: '1.25rem',
              lineHeight: 1.5,
            }
          }}
        >
          {title || 'Confirm Action'}
        </DialogTitle>
        
        <DialogContent sx={{ padding: theme.spacing(3) }}>
          <DialogContentText 
            sx={{
              color: theme.palette.text.primary,
              fontSize: '1rem',
              lineHeight: 1.6,
              '&:not(:last-child)': {
                marginBottom: theme.spacing(2)
              }
            }}
          >
            {content || 'Are you sure you want to proceed with this action?'}
          </DialogContentText>
        </DialogContent>
        
        <DialogActions 
          sx={{
            padding: theme.spacing(2, 3, 3, 3),
            justifyContent: 'flex-end',
            '& > :not(:first-of-type)': {
              marginLeft: theme.spacing(2)
            }
          }}
        >
          <Button 
            onClick={onClose}
            variant="outlined"
            color="inherit"
            sx={{
              padding: theme.spacing(0.75, 2),
              textTransform: 'none',
              borderRadius: 1,
              borderWidth: 1,
              '&:hover': {
                borderWidth: 1
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            variant="contained" 
            color="primary" 
            autoFocus
            sx={{
              padding: theme.spacing(0.75, 3),
              textTransform: 'none',
              borderRadius: 1,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: theme.shadows[2]
              }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Year range for the year dropdown (1970 to next year)
  const currentYear = new Date().getFullYear();
  const yearRange = {
    start: 1970,           // Starting from 1970
    end: currentYear + 1   // Up to next year (2026)
  };

  // Fetch captive data for the current company

  // Get combined captive data from server and local storage
  const getCombinedCaptiveData = useCallback(async () => {
    try {
      // Load local allocation percentages
      const localAllocations = loadAllocationPercentages();
      const localCaptiveData = convertToCaptiveDataFormat(localAllocations);
      
      console.log('Local allocation data loaded:', {
        localEntriesCount: localCaptiveData.length,
        localEntries: localCaptiveData.map(entry => ({
          generatorCompanyId: entry.generatorCompanyId,
          shareholderCompanyId: entry.shareholderCompanyId,
          allocationPercentage: entry.allocationPercentage
        }))
      });
      
      // Fetch server captive data as fallback
      const serverCaptiveData = await fetchCaptiveData();
      
      // Merge local data with server data (local takes precedence)
      const mergedMap = new Map();
      
      // Add server data first
      serverCaptiveData.forEach(entry => {
        const key = `${entry.generatorCompanyId}-${entry.shareholderCompanyId}`;
        mergedMap.set(key, { ...entry });
      });
      
      // Override with local data
      localCaptiveData.forEach(entry => {
        const key = `${entry.generatorCompanyId}-${entry.shareholderCompanyId}`;
        const existing = mergedMap.get(key);
        
        if (existing) {
          // Update existing entry with local percentage
          mergedMap.set(key, {
            ...existing,
            allocationPercentage: entry.allocationPercentage,
            allocationStatus: 'active'
          });
        } else {
          // Add new local entry
          mergedMap.set(key, { ...entry });
        }
      });
      
      const combinedData = Array.from(mergedMap.values());
      
      console.log('Combined captive data created:', {
        serverCount: serverCaptiveData.length,
        localCount: localCaptiveData.length,
        combinedCount: combinedData.length
      });
      
      return combinedData;
    } catch (error) {
      console.error('Error creating combined captive data:', error);
      // Fallback to server data only
      return await fetchCaptiveData();
    }
  }, [fetchCaptiveData]);

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
      month: `${String(selectedMonth).padStart(2, '0')}${selectedYear}`,
      productionSites: productionData,
      captiveData,
      consumptionSitePriorityMap: consumptionSitePriority,
      consumptionSiteIncludeExclude: consumptionSiteIncludeExclude
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

    // Log banking allocations
    if (bankingAllocs.length > 0) {
      console.group('Banking Allocations');
      bankingAllocs.forEach(bank => {
        console.log(`Banking for ${bank.siteName || bank.productionSite || 'Unknown'}:`, bank);
      });
      console.groupEnd();
    }
  };

  const prepareAllocationPayload = useCallback((allocation, type, month, year) => {
    if (!companyId) {
      throw new Error('No company ID available for preparing allocation payload');
    }
    
    const monthYear = allocation.month && allocation.month.length === 6 ? allocation.month : formatAllocationMonth(month, year);
    
    // Create a copy of the allocation to avoid mutating the original
    const payload = { ...allocation };
    
    // Initialize allocated object if it doesn't exist
    if (!payload.allocated || typeof payload.allocated !== 'object') {
      payload.allocated = {};
    }
    
    // Move charge from root to allocated if it exists
    if (payload.charge !== undefined) {
      payload.allocated.charge = Math.max(0, Number(payload.charge) || 0);
      delete payload.charge; // Remove from root level to avoid duplication
    }
    
    // Process charge in allocated object if it exists
    if (payload.allocated.charge !== undefined) {
      payload.allocated.charge = Math.max(0, Number(payload.allocated.charge) || 0);
    }
    
    // Include IR (Injection/Reduction) fields in the payload
      // Copy the irType, injection and reduction fields if they exist
      if (payload.irType) {
        // Keep irType as is
      }
      if (payload.injection) {
        payload.injection = { ...payload.injection };
      }
      if (payload.reduction) {
        payload.reduction = { ...payload.reduction };
      }    // Set default type if not provided
    const allocationType = (type || payload.type || 'ALLOCATION').toUpperCase();
    payload.type = allocationType;
    
    // Set month
    payload.month = monthYear;
    
    // Set company ID
    payload.companyId = companyId;
    
    // Validate production site ID for allocation types that require it
    if (['ALLOCATION', 'BANKING', 'LAPSE'].includes(allocationType)) {
      // Get production site ID from different possible locations
      const prodSiteId = payload.productionSiteId || allocation.productionSiteId || allocation.productionSite?.id;
      
      if (!prodSiteId) {
        console.error('No production site ID found in payload or allocation:', {
          payload,
          allocation,
          productionData: productionData?.map(s => ({
            id: s.id,
            productionSiteId: s.productionSiteId,
            siteName: s.siteName,
            type: s.type
          }))
        });
        throw new Error(`Production site ID is required for ${allocationType} allocation`);
      }
      
      // Log available production sites for debugging
      console.log('Available production sites:', productionData.map(site => ({
        id: site.id,
        productionSiteId: site.productionSiteId,
        siteName: site.siteName,
        type: site.type
      })));
      
      // Try different ways to find the production site
      const productionSite = productionData.find(site => {
        // Try exact match first
        if (site.productionSiteId === prodSiteId || site.id === prodSiteId) {
          return true;
        }
        // Try string comparison
        if (String(site.productionSiteId) === String(prodSiteId) || 
            String(site.id) === String(prodSiteId)) {
          return true;
        }
        return false;
      });
      
      if (!productionSite) {
        console.error('Production site not found in local data:', {
          requestedId: prodSiteId,
          requestedIdType: typeof prodSiteId,
          availableSites: productionData.map(site => ({
            id: site.id,
            idType: typeof site.id,
            productionSiteId: site.productionSiteId,
            productionSiteIdType: typeof site.productionSiteId,
            siteName: site.siteName,
            type: site.type
          }))
        });
        throw new Error(`Production site not found: ${prodSiteId}. Please check the site ID and try again.`);
      }
      
      // Set the production site ID and name in the payload
      const productionSiteId = productionSite.productionSiteId || productionSite.id;
      const consumptionSiteId = payload.consumptionSiteId || '';
      
      // Format the PK and SK according to backend expectations
      payload.pk = `${companyId}_${productionSiteId}_${consumptionSiteId}`.replace(/_+$/, ''); // Remove trailing underscore if no consumption site
      payload.sk = monthYear;
      
      // Keep the original fields for reference
      payload.productionSiteId = productionSiteId;
      payload.productionSite = productionSite.siteName || productionSite.name;
      
      // Log the final payload before sending
      console.log('Final allocation payload:', JSON.stringify({
        ...payload,
        // Don't log the entire allocated object if it's large
        allocated: payload.allocated ? Object.keys(payload.allocated) : 'none',
        _debug: {
          originalProductionSiteId: productionSiteId,
          originalConsumptionSiteId: consumptionSiteId,
          formattedPk: payload.pk,
          formattedSk: payload.sk
        }
      }, null, 2));
      
      // Set production site name and details for banking and lapse allocations
      if (type === 'BANKING' || type === 'LAPSE') {
        payload.productionSite = productionSite.siteName || productionSite.name;
        payload.siteName = productionSite.siteName || productionSite.name;
        
        // Ensure c1-c5 values are copied to root level for LAPSE to match BANKING
        if (type === 'LAPSE' && payload.allocated) {
          payload.c1 = payload.allocated.c1 || 0;
          payload.c2 = payload.allocated.c2 || 0;
          payload.c3 = payload.allocated.c3 || 0;
          payload.c4 = payload.allocated.c4 || 0;
          payload.c5 = payload.allocated.c5 || 0;
        }
      }
      
      // Use the company ID from the production site if available
      if (productionSite.companyId) {
        payload.companyId = productionSite.companyId;
      }
    }
    
    // Set default values
    payload.companyId = payload.companyId || companyId;
    payload.type = (type || allocation.type || 'ALLOCATION').toUpperCase();
    payload.month = monthYear;
    
    // Process all allocation values (round numbers, handle charge as boolean 1/0)
    Object.entries(payload.allocated).forEach(([key, value]) => {
      if (key === 'charge') {
        // Convert charge to 1/0 value at both root and allocated level
        const chargeValue = value === true || value === 1 ? 1 : 0;
        payload.charge = chargeValue;
        payload.allocated[key] = chargeValue;
      } else if (value !== undefined) {
        payload.allocated[key] = Math.max(0, Math.round(Number(value) || 0));
      }
    });
    
    return payload;
  }, [companyId, productionData]);

  const handleEditAllocationConfirmed = useCallback((allocation, type) => {
    if (!allocation || !type) {
      console.warn('[Allocation] handleEditAllocationConfirmed called without allocation or type');
      return;
    }

    if (type === 'allocation') {
      console.log('[Allocation] Updating allocation with data:', {
        productionSiteId: allocation.productionSiteId,
        consumptionSiteId: allocation.consumptionSiteId,
        c1: allocation.c1,
        c2: allocation.c2,
        c3: allocation.c3,
        c4: allocation.c4,
        c5: allocation.c5,
        allocatedObject: allocation.allocated,
        irType: allocation.irType,
        injection: allocation.injection,
        reduction: allocation.reduction
      });

      // Update the allocation
      setAllocations(prevAllocs => {
        return prevAllocs.map(a => {
          if (a.productionSiteId === allocation.productionSiteId &&
              a.consumptionSiteId === allocation.consumptionSiteId) {
            
            // Create a clean IR data object
            const irData = {
              irType: allocation.irType || a.irType || 'normal',
              injection: allocation.injection ? { ...allocation.injection } : (a.injection ? { ...a.injection } : {}),
              reduction: allocation.reduction ? { ...allocation.reduction } : (a.reduction ? { ...a.reduction } : {})
            };

            // Create updated allocation with all period values
            const updatedAllocation = {
              ...a,
              // Update root level period values
              c1: allocation.c1 ?? a.c1 ?? 0,
              c2: allocation.c2 ?? a.c2 ?? 0,
              c3: allocation.c3 ?? a.c3 ?? 0,
              c4: allocation.c4 ?? a.c4 ?? 0,
              c5: allocation.c5 ?? a.c5 ?? 0,
              // Update IR fields
              ...irData,
              // Update charge value
              charge: allocation.charge ?? a.charge ?? false,
              // Update allocated object with period values
              allocated: {
                ...a.allocated,
                // Ensure we have all period values in the allocated object
                c1: allocation.c1 ?? a.allocated?.c1 ?? 0,
                c2: allocation.c2 ?? a.allocated?.c2 ?? 0,
                c3: allocation.c3 ?? a.allocated?.c3 ?? 0,
                c4: allocation.c4 ?? a.allocated?.c4 ?? 0,
                c5: allocation.c5 ?? a.allocated?.c5 ?? 0,
                // Update charge in allocated object
                charge: allocation.charge ?? a.allocated?.charge ?? false,
                // Include IR data in allocated object
                ...irData,
                // Preserve other allocated fields
                ...(allocation.allocated || {})
              },
              version: (a.version || 0) + 1,
              updatedAt: new Date().toISOString()
            };
            
            console.log('[Allocation] Updated allocation - Period Values:', {
              before: {
                c1: a.c1 ?? a.allocated?.c1,
                c2: a.c2 ?? a.allocated?.c2,
                c3: a.c3 ?? a.allocated?.c3,
                c4: a.c4 ?? a.allocated?.c4,
                c5: a.c5 ?? a.allocated?.c5,
                allocatedObject: a.allocated
              },
              after: {
                c1: updatedAllocation.c1,
                c2: updatedAllocation.c2,
                c3: updatedAllocation.c3,
                c4: updatedAllocation.c4,
                c5: updatedAllocation.c5,
                allocatedObject: updatedAllocation.allocated
              }
            });
            
            return updatedAllocation;
          }
          return a;
        });
      });

      // Recalculate banking and lapse for this production site
      const pid = allocation.productionSiteId;
      const prod = productionData.find(p => p.productionSiteId === pid);
      if (prod) {
        // Calculate remaining units for banking/lapse
        const remaining = ALL_PERIODS.reduce((acc, period) => ({
          ...acc,
          [period]: Number(prod[period] || 0) - Number(allocation.allocated[period] || 0)
        }), {});

        console.log('[Allocation] Banking/Lapse recalculation for production site:', {
          productionSiteId: pid,
          production: { c1: prod.c1, c2: prod.c2, c3: prod.c3, c4: prod.c4, c5: prod.c5 },
          allocated: { c1: allocation.allocated?.c1, c2: allocation.allocated?.c2, c3: allocation.allocated?.c3, c4: allocation.allocated?.c4, c5: allocation.allocated?.c5 },
          remaining: remaining,
          type: Number(prod.banking || 0) === 1 ? 'BANKING' : 'LAPSE'
        });

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

        // Update banking or lapse allocations without affecting the other
        if (entry.type === 'BANKING') {
          // Only update banking allocations for this site, leave lapse allocations unchanged
          setBankingAllocations(prev => 
            prev.filter(b => b.productionSiteId !== pid).concat(entry)
          );
        } else {
          // Only update lapse allocations for this site, leave banking allocations unchanged
          setLapseAllocations(prev => 
            prev.filter(l => l.productionSiteId !== pid).concat(entry)
          );
        }
      }
    } else if (type === 'banking') {
      setBankingAllocations(prev => prev.map(b =>
        b.productionSiteId === allocation.productionSiteId ? allocation : b
      ));
    } else if (type === 'lapse') {
      setLapseAllocations(prev => prev.map(l =>
        l.productionSiteId === allocation.productionSiteId ? allocation : l
      ));
    }

    enqueueSnackbar('Allocation updated in UI. Click Save Changes to persist.', {
      variant: 'success',
      autoHideDuration: 3000
    });
  }, [productionData, enqueueSnackbar]);

  const handleAutoAllocateClick = () => {
    // Initialize selected consumption sites with sequential priorities
    const initialSelection = {};
    const priorityMap = {};
    
    consumptionData.forEach((site, index) => {
      const siteId = site.consumptionSiteId || site.id;
      initialSelection[siteId] = {
        selected: true,
        priority: index + 1 // Start with 1, 2, 3...
      };
      priorityMap[siteId] = index + 1;
    });
    
    // Ensure only the first site has priority 1
    if (consumptionData.length > 0) {
      const firstSiteId = consumptionData[0].consumptionSiteId || consumptionData[0].id;
      initialSelection[firstSiteId].priority = 1;
      priorityMap[firstSiteId] = 1;
      
      // Set other priorities to be sequential starting from 2
      consumptionData.slice(1).forEach((site, index) => {
        const siteId = site.consumptionSiteId || site.id;
        initialSelection[siteId].priority = index + 2;
        priorityMap[siteId] = index + 2;
      });
    }
    
    setSelectedConsumptionSites(initialSelection);
    setConsumptionSitePriority(priorityMap);
    setAutoAllocationDialogOpen(true);
  };

  const handleSiteSelectionChange = (siteId, checked) => {
    setSelectedConsumptionSites(prev => ({
      ...prev,
      [siteId]: {
        ...prev[siteId],
        selected: checked
      }
    }));
  };

  const handlePriorityChange = (siteId, newPriority) => {
    setSelectedConsumptionSites(prev => {
      const updatedSites = { ...prev };
      newPriority = parseInt(newPriority, 10) || 1;
      
      // If setting priority to 1, find and reset any other site that has priority 1
      if (newPriority === 1) {
        Object.keys(updatedSites).forEach(id => {
          if (id !== siteId && updatedSites[id]?.priority === 1) {
            updatedSites[id] = {
              ...updatedSites[id],
              priority: 2
            };
          }
        });
      }
      
      updatedSites[siteId] = {
        ...updatedSites[siteId],
        priority: newPriority
      };
      
      return updatedSites;
    });
  };

  const handleIncludeSite = (siteId) => {
    setConsumptionSiteIncludeExclude(prev => {
      const newIncluded = new Set(prev.included);
      const newExcluded = new Set(prev.excluded);
      
      newIncluded.add(String(siteId));
      newExcluded.delete(String(siteId)); // Remove from excluded if it was there
      
      return {
        ...prev,
        included: newIncluded,
        excluded: newExcluded
      };
    });
  };

  const handleExcludeSite = (siteId) => {
    setConsumptionSiteIncludeExclude(prev => {
      const newIncluded = new Set(prev.included);
      const newExcluded = new Set(prev.excluded);
      
      newExcluded.add(String(siteId));
      newIncluded.delete(String(siteId)); // Remove from included if it was there
      
      return {
        ...prev,
        included: newIncluded,
        excluded: newExcluded
      };
    });
  };

  const handleToggleExcludeByDefault = () => {
    setConsumptionSiteIncludeExclude(prev => ({
      ...prev,
      excludeByDefault: !prev.excludeByDefault
    }));
  };

  const clearIncludeExcludeSettings = () => {
    setConsumptionSiteIncludeExclude({
      included: new Set(),
      excluded: new Set(),
      excludeByDefault: false
    });
  };

  const handleAutoAllocate = async () => {
    try {
      setLoading(true);
      
      // Apply include/exclude filtering to consumption data
      const filteredConsumptionData = consumptionData.filter(site => {
        const siteId = String(site.consumptionSiteId || site.id);
        const isIncluded = consumptionSiteIncludeExclude.included.has(siteId);
        const isExcluded = consumptionSiteIncludeExclude.excluded.has(siteId);
        
        // If excluded, don't include
        if (isExcluded) return false;
        
        // If exclude by default is true, only include if explicitly included
        if (consumptionSiteIncludeExclude.excludeByDefault) {
          return isIncluded;
        }
        
        // Otherwise, include all non-excluded sites
        return true;
      }).sort((a, b) => {
        // Sort by priority if available, otherwise by site name
        const aPriority = selectedConsumptionSites[a.consumptionSiteId || a.id]?.priority || 999;
        const bPriority = selectedConsumptionSites[b.consumptionSiteId || b.id]?.priority || 999;
        return aPriority - bPriority;
      });
      
      // Create priority map for the filtered sites
      const priorityMap = {};
      filteredConsumptionData.forEach((site) => {
        const siteId = site.consumptionSiteId || site.id;
        priorityMap[siteId] = selectedConsumptionSites[siteId]?.priority || 1;
      });
      
      // Update the consumption site priority state
      setConsumptionSitePriority(priorityMap);
      
      // Run the allocation calculation with filtered consumption data and priority map
      const result = calculateAllocations({
        productionUnits: productionData,
        consumptionUnits: filteredConsumptionData,
        bankingUnits: bankingData,
        manualAllocations,
        shareholdings,
        month: `${String(selectedMonth).padStart(2, '0')}${selectedYear}`,
        productionSites: productionData,
        captiveData,
        consumptionSitePriorityMap: priorityMap,
        consumptionSiteIncludeExclude
      });

      // Update allocations with the result
      const regularAllocs = result.allocations.filter(a => !['BANKING', 'LAPSE'].includes(a.type));
      const bankingAllocs = result.allocations.filter(a => a.type === 'BANKING');
      const lapseAllocs = result.allocations.filter(a => a.type === 'LAPSE');

      setAllocations(regularAllocs);
      setBankingAllocations(bankingAllocs);
      setLapseAllocations(lapseAllocs);
      // Show the allocations table
      setShowAllocations(true);
      enqueueSnackbar('Auto-allocation completed successfully', { variant: 'success' });
    } catch (error) {
      console.error('Auto-allocation failed:', error);
      enqueueSnackbar('Failed to perform auto-allocation', { variant: 'error' });
    } finally {
      setLoading(false);
      setAutoAllocationDialogOpen(false);
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
    
    // Reset consumption site priority on data refresh
    setConsumptionSitePriority({});
    
    // Format month with leading zero if needed
    const formattedMonth = String(selectedMonth).padStart(2, '0');
    

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

      const prodSites = Array.isArray(prodSitesResp?.data) ? prodSitesResp.data : [];
      const consSites = Array.isArray(consSitesResp?.data) ? consSitesResp.data : [];
      const bankingData = Array.isArray(bankingResp?.data) ? bankingResp.data : [];
      
      
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


      // Calculate prior months within the financial year for filtering banking data
      const financialYear = selectedMonth > 3 ? selectedYear : selectedYear - 1;
      const priorMonthsInFY = [];

      if (selectedMonth >= 4 && selectedMonth <= 12) {
        // For April–December: include April up to month before selected month of the same year
        for (let month = 4; month < selectedMonth; month++) {
          priorMonthsInFY.push(`${month.toString().padStart(2, '0')}${financialYear}`);
        }
      } else {
        // For January–March: include April–December of FY and Jan..(selectedMonth-1) of next year
        for (let month = 4; month <= 12; month++) {
          priorMonthsInFY.push(`${month.toString().padStart(2, '0')}${financialYear}`);
        }
        for (let month = 1; month < selectedMonth; month++) {
          priorMonthsInFY.push(`${month.toString().padStart(2, '0')}${financialYear + 1}`);
        }
      }


      // Process banking data for the prior-month range within the financial year
      const allBankingData = bankingData
        .filter(unit => {
          // Check if unit is valid and in the correct period
          if (!unit || !unit.pk || !unit.sk || !priorMonthsInFY.includes(unit.sk)) {
            if (unit) {
              console.log('Filtered out banking unit (invalid or wrong period):', {
                sk: unit.sk,
                priorMonthsInFY,
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
        .filter(Boolean); // Remove any null entries from faile

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
             
              return null;
            }
            
            // Extract production site ID safely
            const productionSiteId = String(siteInfo.productionSiteId || '').trim();
            const companyId = String(siteInfo.companyId || '').trim();
            
            // Skip if site ID is invalid
            if (!productionSiteId || !companyId) {
              return null;
            }
            
            // Check if user has access to this site
            const compositeSiteId = `${companyId}_${productionSiteId}`;
            const hasAccess = hasSiteAccess(compositeSiteId, 'production');
            if (!hasAccess) {
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
            return null;
          }
        })
        .filter(Boolean); // Remove any null entries from failed processing
      
      
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


      // Fetch production units for specific month, filtered by accessible sites
      const productionUnits = [];
      const productionUnitsErrors = [];
      
      // Filter production sites to only those the user has access to
      const accessibleProdSites = prodSites.filter(site => {
        if (!site?.productionSiteId) return false;
        // Construct composite site ID in format: companyId_siteId to match accessible sites format
        const compositeSiteId = `${site.companyId}_${site.productionSiteId}`;
        const hasAccess = hasSiteAccess(compositeSiteId, 'production');
        if (!hasAccess) {
          console.debug('Skipping production site (no access):', {
            productionSiteId: site.productionSiteId,
            companyId: site.companyId,
            siteName: site.name,
            compositeSiteId: compositeSiteId
          });
        }
        return hasAccess;
      });
      
      
      await Promise.all(
        accessibleProdSites.map(async (site) => {
          try {
            const companyId = Number(site.companyId) || 1;
            const productionSiteId = Number(site.productionSiteId);
            
            if (!productionSiteId) {
              console.warn('Skipping site with invalid productionSiteId:', site);
              return;
            }
            
            
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
                    dateOfCommission: site.dateOfCommission || null,
                    commissionDate: site.dateOfCommission || null,
                    c1: Number(unit.c1) || 0,
                    c2: Number(unit.c2) || 0,
                    c3: Number(unit.c3) || 0,
                    c4: Number(unit.c4) || 0,
                    c5: Number(unit.c5) || 0
                  };
                } catch (unitError) {
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


      // Fetch consumption units for specific month, filtered by accessible sites
      const consumptionUnits = [];
      const consumptionUnitsErrors = [];
      
      // Filter consumption sites to only those the user has access to
      const accessibleConsSites = consSites.filter(site => {
        if (!site?.consumptionSiteId) return false;
        // Construct composite site ID in format: companyId_siteId to match accessible sites format
        const compositeSiteId = `${site.companyId}_${site.consumptionSiteId}`;
        const hasAccess = hasSiteAccess(compositeSiteId, 'consumption');
        if (!hasAccess) {
          console.debug('Skipping consumption site (no access):', {
            consumptionSiteId: site.consumptionSiteId,
            companyId: site.companyId,
            siteName: site.name,
            compositeSiteId: compositeSiteId
          });
        }
        return hasAccess;
      });
      
      
      await Promise.all(
        accessibleConsSites.map(async (site) => {
          try {
            const companyId = Number(site.companyId) || 1;
            const consumptionSiteId = Number(site.consumptionSiteId);
            
            if (!consumptionSiteId) {
              console.warn('Skipping site with invalid consumptionSiteId:', site);
              return;
            }
            
            
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
      

      // Final data processing and state updates

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
  }, [enqueueSnackbar, selectedMonth, selectedYear, companyId, hasSiteAccess, hasCompanyAccess]);

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
        
        // Update to use getByGenerator instead of getAll
        const shareholdingsData = await captiveApi.getByGenerator(companyId);
        
        if (shareholdingsData && shareholdingsData.length > 0) {
          // Filter out invalid entries and check company access
          const validShareholdings = shareholdingsData.filter(item => {
            if (!item || !item.shareholderCompanyId || !item.allocationPercentage) return false;
            
            // Check if user has access to this company's generator
            const generatorCompanyId = item.generatorCompanyId || item.companyId;
            const hasAccess = hasCompanyAccess(generatorCompanyId);
            
            return hasAccess && Number(item.allocationPercentage) > 0;
          });
          
          if (validShareholdings.length === 0) {
            console.warn('[loadShareholdings] No valid shareholding data available');
            setShareholdings([]);
            enqueueSnackbar('No valid shareholding data available for this company', { 
              variant: 'warning',
              autoHideDuration: 5000,
              persist: false
            });
            return;
          }
          
          // Map the data to match the expected format
          const formattedShareholdings = validShareholdings.map(item => ({
            ...item,
            shareholdingPercentage: Number(item.allocationPercentage) || 0,
            shareholderCompanyId: item.shareholderCompanyId,
            generatorCompanyId: item.generatorCompanyId,
            generatorCompanyName: item.generatorCompanyName,
            shareholderCompanyName: item.shareholderCompanyName,
            allocationStatus: item.allocationStatus || 'active'
          }));
          
          setShareholdings(formattedShareholdings);
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
  }, [companyId, hasSiteAccess, hasCompanyAccess, enqueueSnackbar]);

  // Update allocations when shareholdings or data changes
  useEffect(() => {
    const hasRequiredData = productionData.length > 0 && consumptionData.length > 0;
    
    if (!hasRequiredData) {
      return;
    }

    if (shareholdings.length === 0) {
      console.warn('No shareholdings available for allocation');
      enqueueSnackbar('No shareholding data available for allocation', { 
        variant: 'warning',
        autoHideDuration: 5000 
      });
    } else {
      updateAllocationData();
    }
  }, [productionData, consumptionData, shareholdings, updateAllocationData, enqueueSnackbar, selectedMonth, selectedYear]);

  // Fetch data when selectedYear, selectedMonth, or companyId changes
  useEffect(() => {
    if (companyId) {
      fetchAllData();
      fetchCaptiveData();
    } else {
      console.warn('Cannot fetch data: No company ID available');
      enqueueSnackbar('Cannot load data: No company information available', {
        variant: 'warning',
        autoHideDuration: 5000
      });
    }
  }, [selectedYear, selectedMonth, companyId, fetchAllData, enqueueSnackbar, fetchCaptiveData]);

  const handleMonthChange = (event) => {
    setSelectedMonth(Number(event.target.value));
  };

  const handleYearChange = (year) => {
    setSelectedYear(Number(year));
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
        borderBottom: '2px solid #000000',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: '#1976d2' }}>Allocation Management</Typography>
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
            disabled={isSaving}
            size="small"
          >
            {isSaving ? 'Saving...' : 'Refresh'}
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
      
      <Box sx={{ mt: 4 }}>
        <BankingUnitsTable 
          bankingData={aggregatedBankingData}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />
      </Box>

      <ConsumptionUnitsTable 
        consumptionData={consumptionData}
        selectedYear={financialYear}
        shareholdings={shareholdings}
        companyId={companyId}
        isLoading={loading}
        onAllocationSaved={updateAllocationData}
        onAllocationPercentageChanged={handleAllocationPercentageChange}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4, mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AutorenewIcon />}
          onClick={handleAutoAllocateClick}
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
            lapseAllocations={lapseAllocations}
            onEdit={handleEditAllocationConfirmed}
            onSave={handleSaveAllocation}
            loading={isSaving}
            productionSites={productionData}
            consumptionSites={consumptionData}
            consumptionSitePriorityMap={consumptionSitePriority}
          />
          <Box sx={{ mt: 3 }}>
            <AllocationSummary
              productionData={productionData}
              consumptionData={consumptionData}
              allocations={allocations}
              bankingAllocations={bankingAllocations}
              lapseAllocations={lapseAllocations}
            />
          </Box>
        </>
      )}
      {confirmDialogOpen && (
        <ConfirmationDialog
          open={confirmDialogOpen}
          onClose={() => setConfirmDialogOpen(false)}
          onConfirm={handleDialogConfirm}
          title="Save Allocation Changes"
          content="Are you sure you want to save these allocation changes?"
        />
      )}

      {/* Auto Allocation Dialog */}
      <Dialog 
        open={autoAllocationDialogOpen} 
        onClose={() => setAutoAllocationDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme => theme.shadows[5]
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: theme => theme.palette.primary.main,
          color: theme => theme.palette.primary.contrastText,
          '& .MuiTypography-root': {
            fontWeight: 600,
            fontSize: '1.25rem',
          }
        }}>
          Auto-Allocation Setup
        </DialogTitle>
        <DialogContent sx={{ padding: 3 }}>
          {/* Include/Exclude Controls */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>
              Consumption Site Filter
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={consumptionSiteIncludeExclude.excludeByDefault}
                      onChange={handleToggleExcludeByDefault}
                      color="primary"
                    />
                  }
                  label="Exclude sites by default"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={clearIncludeExcludeSettings}
                  sx={{ mr: 1 }}
                >
                  Clear Filters
                </Button>
                <Typography variant="caption" sx={{ ml: 1 }}>
                  Included: {consumptionSiteIncludeExclude.included.size} | 
                  Excluded: {consumptionSiteIncludeExclude.excluded.size}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Site Selection */}
          <Paper sx={{ p: 3, mb: 2, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
              Consumption Site Selection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select sites to include in allocation. Excluded sites will be moved to the bottom.
            </Typography>
            
            {/* Header */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              py: 2, 
              px: 2, 
              bgcolor: 'grey.50', 
              borderRadius: 1, 
              mb: 2,
              borderBottom: '2px solid',
              borderColor: 'primary.main'
            }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Site Name
                </Typography>
              </Box>
              <Box sx={{ width: 120, textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Status
                </Typography>
              </Box>
              <Box sx={{ width: 150 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, textAlign: 'center' }}>
                  Priority
                </Typography>
              </Box>
            </Box>
            
            {/* Site List */}
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {consumptionData
                .sort((a, b) => {
                  const aId = String(a.consumptionSiteId || a.id);
                  const bId = String(b.consumptionSiteId || b.id);
                  const aExcluded = consumptionSiteIncludeExclude.excluded.has(aId);
                  const bExcluded = consumptionSiteIncludeExclude.excluded.has(bId);
                  
                  // Excluded sites go to the bottom
                  if (aExcluded && !bExcluded) return 1;
                  if (!aExcluded && bExcluded) return -1;
                  
                  // Keep original order for sites with same exclusion status
                  return 0;
                })
                .map((site, index) => {
                  const siteId = site.consumptionSiteId || site.id;
                  const isIncluded = consumptionSiteIncludeExclude.included.has(String(siteId));
                  const isExcluded = consumptionSiteIncludeExclude.excluded.has(String(siteId));
                  const isFiltered = isExcluded || (consumptionSiteIncludeExclude.excludeByDefault && !isIncluded);
                  const isActive = !isFiltered;
                  
                  return (
                    <Box
                      key={siteId}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 2,
                        px: 2,
                        mb: 1,
                        borderRadius: 2,
                        bgcolor: isActive ? 'background.paper' : 'grey.100',
                        border: isActive ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(244, 67, 54, 0.3)',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: isActive ? 'action.hover' : 'grey.200',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {/* Site Name */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%',
                          bgcolor: isActive ? 'success.main' : 'error.main'
                        }} />
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: isActive ? 500 : 400,
                            color: isActive ? 'text.primary' : 'text.secondary',
                            textDecoration: isFiltered ? 'line-through' : 'none'
                          }}
                        >
                          {site.siteName || 'Unnamed Site'}
                        </Typography>
                        {isFiltered && (
                          <Chip 
                            label="Filtered" 
                            size="small" 
                            color="error" 
                            variant="outlined" 
                            sx={{ ml: 1, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      
                      {/* Status Checkbox */}
                      <Box sx={{ width: 120, display: 'flex', justifyContent: 'center' }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={isActive}
                              onChange={() => {
                                if (isActive) {
                                  handleExcludeSite(siteId);
                                } else {
                                  handleIncludeSite(siteId);
                                }
                              }}
                              color="success"
                              size="small"
                            />
                          }
                          label={isActive ? 'Active' : 'Filtered'}
                          labelPlacement="top"
                          sx={{ 
                            m: 0,
                            '& .MuiFormControlLabel-label': {
                              fontSize: '0.75rem',
                              fontWeight: isActive ? 600 : 400,
                              color: isActive ? 'success.main' : 'error.main'
                            }
                          }}
                        />
                      </Box>
                      
                      {/* Priority */}
                      <Box sx={{ width: 150, display: 'flex', justifyContent: 'center' }}>
                        <FormControl 
                          fullWidth 
                          size="small" 
                          disabled={!isActive}
                          sx={{ 
                            minWidth: 100,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              bgcolor: isActive ? 'background.paper' : 'grey.100'
                            }
                          }}
                        >
                          <Select
                            value={selectedConsumptionSites[siteId]?.priority || 1}
                            onChange={(e) => handlePriorityChange(siteId, e.target.value)}
                            disabled={!isActive}
                            size="small"
                            displayEmpty
                          >
                            {[1, 2, 3, 4, 5].map((num) => {
                              const isPriorityOne = num === 1 && 
                                selectedConsumptionSites[siteId]?.priority === 1;
                              
                              return (
                                <MenuItem 
                                  key={num} 
                                  value={num}
                                  disabled={num === 1 && !isPriorityOne && 
                                    Object.values(selectedConsumptionSites).some(s => s.priority === 1)}
                                >
                                  Priority {num} {isPriorityOne ? ' (Highest)' : ''}
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>
                  );
                })}
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAllocationDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleAutoAllocate} 
            color="primary"
            variant="contained"
          >
            Run Auto-Allocation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Allocation;
