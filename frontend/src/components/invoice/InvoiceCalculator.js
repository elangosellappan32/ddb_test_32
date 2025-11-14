import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import companyApi from '../../services/companyApi';
import productionSiteApi from '../../services/productionSiteApi';
import consumptionSiteApi from '../../services/consumptionSiteApi';
import bankingApi from '../../services/bankingApi';
import allocationApi from '../../services/allocationApi';
import productionUnitApi from '../../services/productionUnitApi';
import { enqueueSnackbar } from 'notistack';

// Utility function to format numbers with Indian locale
const formatNumber = (num) =>
  num === null || num === undefined || num === '' ? '' : Number(num).toLocaleString('en-IN');

// Utility function to format currency with Indian Rupee symbol
const formatCurrency = (num) =>
  num === null || num === undefined || num === '' ? '' : `₹${Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// Default invoice data structure
const getDefaultInvoiceData = (billMonth) => ({
  windData: [],
  chargesData: [],
  windHeaders: [],
  invoiceNumber: [
    `STR/001/${billMonth?.split('-')[1] || '08'}/${billMonth?.split('-')[0] || '2025'}`,
    `STR/002/${billMonth?.split('-')[1] || '08'}/${billMonth?.split('-')[0] || '2025'}`,
  ],
});

const useInvoiceCalculator = (billMonth, selectedSite, siteType, consumptionSite) => {
  const { user } = useAuth();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [error, setError] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [productionSites, setProductionSites] = useState([]);
  const [consumptionSites, setConsumptionSites] = useState([]);
  const [invoiceData, setInvoiceData] = useState(() => getDefaultInvoiceData(billMonth));
  
  // Memoized values
  const siteTypes = useMemo(() => ['wind', 'solar', 'hybrid'], []);
  // Format production site data consistently
  const formatProductionSite = useCallback((site) => ({
    id: site.productionSiteId || site.id,
    name: site.name || 'Unnamed Production Site',
    type: (site.type?.toLowerCase() || 'wind'),
    location: site.location || 'Location not specified',
    capacity: site.capacity_MW || site.capacity || 0,
    isActive: site.isActive !== false, // Default to true if not specified
  }), []);

  // Format consumption site data consistently
  const formatConsumptionSite = useCallback((site) => ({
    id: site.consumptionSiteId || site.id,
    name: site.name || 'Unnamed Consumption Site',
    type: (site.type?.toLowerCase() || 'commercial'),
    location: site.location || 'Location not specified',
    isActive: site.isActive !== false, // Default to true if not specified
  }), []);

  // Fetch production sites with better error handling
  const fetchProductionSites = useCallback(async () => {
    try {
      setIsLoadingSites(true);
      setError(null);
      
      const response = await productionSiteApi.fetchAll({ forceRefresh: true });
      
      let sites = [];
      if (Array.isArray(response?.data)) {
        sites = response.data;
      } else if (Array.isArray(response)) {
        sites = response;
      } else if (response?.data) {
        sites = [response.data];
      }
      
      const formattedSites = sites.map(formatProductionSite);
      setProductionSites(formattedSites);
      
      // Auto-select first site if none selected
      if (formattedSites.length > 0 && !selectedSite) {
        return formattedSites[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching production sites:', error);
      setError('Failed to load production sites. Please try again.');
      enqueueSnackbar('Failed to load production sites', { variant: 'error' });
      return null;
    } finally {
      setIsLoadingSites(false);
    }
  }, [formatProductionSite, selectedSite]);

  // Fetch consumption sites with better error handling
  const fetchConsumptionSites = useCallback(async () => {
    try {
      setIsLoadingSites(true);
      setError(null);
      
      const response = await consumptionSiteApi.fetchAll({ forceRefresh: true });
      
      let sites = [];
      if (Array.isArray(response?.data)) {
        sites = response.data;
      } else if (Array.isArray(response)) {
        sites = response;
      } else if (response?.data) {
        sites = [response.data];
      }
      
      const formattedSites = sites.map(formatConsumptionSite);
      setConsumptionSites(formattedSites);
      
      // Auto-select first site if none selected
      if (formattedSites.length > 0 && !consumptionSite) {
        return formattedSites[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching consumption sites:', error);
      setError('Failed to load consumption sites. Please try again.');
      enqueueSnackbar('Failed to load consumption sites', { variant: 'error' });
      return null;
    } finally {
      setIsLoadingSites(false);
    }
  }, [formatConsumptionSite, consumptionSite]);
  // Fetch company details with improved error handling
  const fetchCompanyDetails = useCallback(async () => {
    try {
      if (!user) return;
      
      // Check for company name in various locations
      if (user.companyName) {
        setCompanyName(user.companyName);
        return;
      }
      if (user.company?.name) {
        setCompanyName(user.company.name);
        return;
      }
      if (user.metadata?.companyName) {
        setCompanyName(user.metadata.companyName);
        return;
      }
      
      // If we have a company ID, try to fetch the company details
      if (user.companyId) {
        // Check cache first
        const cacheKey = `company_${user.companyId}`;
        const cachedCompany = sessionStorage.getItem(cacheKey);
        
        if (cachedCompany) {
          try {
            const company = JSON.parse(cachedCompany);
            if (company?.companyName) {
              setCompanyName(company.companyName);
              return;
            }
          } catch (e) {
            console.warn('Failed to parse cached company data', e);
            sessionStorage.removeItem(cacheKey); // Remove invalid cache
          }
        }
        
        // Fetch from API if not in cache or cache is invalid
        try {
          const company = await companyApi.getById(user.companyId);
          if (company?.companyName) {
            // Update cache
            sessionStorage.setItem(cacheKey, JSON.stringify(company));
            setCompanyName(company.companyName);
          }
        } catch (apiError) {
          console.error('Error fetching company details:', apiError);
          enqueueSnackbar('Failed to load company details', { variant: 'warning' });
        }
      }
    } catch (error) {
      console.error('Unexpected error in fetchCompanyDetails:', error);
      enqueueSnackbar('Error loading company information', { variant: 'error' });
    }
  }, [user]);
  // Calculate invoice data
  const calculateInvoiceData = useCallback(async () => {
    if (!selectedSite || !billMonth || productionSites.length === 0 || consumptionSites.length === 0) {
      return {
        windData: [],
        chargesData: [],
        windHeaders: [],
        sites: productionSites,
        siteTypes,
        invoiceNumber: invoiceData.invoiceNumber,
      };
    }
    try {
      const companyId = user?.companyId;
      if (!companyId) throw new Error('Company ID is required');
      if (!selectedSite) throw new Error('Site selection is required');
      if (!billMonth) throw new Error('Month selection is required');
      if (!billMonth.includes('-')) throw new Error('Invalid date format');
      const [year, month] = billMonth.split('-');
      const paddedMonth = month.padStart(2, '0');
      const formattedMonth = `${paddedMonth}${year}`;
      const selectedProdSite = productionSites.find(site => site.id === selectedSite);
      if (!selectedProdSite) throw new Error('Selected production site not found');
      // Fetch invoice-related data
      const [productionResponse, bankingData, allocationData] = await Promise.all([
        productionUnitApi.fetchAll(companyId, selectedSite),
        bankingApi.fetchByPeriod(formattedMonth, companyId),
        allocationApi.fetchAll(formattedMonth, companyId),
      ]);
      if (!productionResponse?.data) throw new Error('Failed to fetch production data');
      // Find the correct production data entry
      const unitData = productionResponse.data?.find(unit => {
        const unitMonth = (unit.sk || unit.date || unit.period || '').replace(/[^0-9]/g, '');
        const targetMonth = formattedMonth.replace(/[^0-9]/g, '');
        const matchesMonth = unitMonth === targetMonth;
        const matchesSite = String(unit.productionSiteId) === String(selectedSite);
        return matchesMonth && matchesSite;
      });
      if (!unitData) throw new Error(`No production data found for ${month}/${year}`);
      // Find banking info for the site/month
      const bankingArray = Array.isArray(bankingData) ? bankingData :
        Array.isArray(bankingData?.data) ? bankingData.data : [];
      const siteBankingData = bankingArray.find(b => {
        const siteMatch = String(b.pk).startsWith(`${companyId}_${selectedSite}`);
        const monthMatch = b.sk === formattedMonth;
        return siteMatch && monthMatch;
      });
      // Extract values from production data
      const slots = ['c1', 'c2', 'c3', 'c4', 'c5'];
      const productionValues = slots.reduce((acc, slot) => {
        acc[slot] = Number(unitData[slot] || 0);
        return acc;
      }, {});
      const exportValue = Object.values(productionValues).reduce((sum, value) => sum + value, 0);
      const importValue = Number(unitData.import || 0);
      const bankingUnits = Number(siteBankingData?.totalBanking || 0);
      const totalExport = Math.max(0, exportValue - importValue);
      // Filter allocation records for the selected production site and month
      const allocationArray = Array.isArray(allocationData) ? allocationData :
        Array.isArray(allocationData?.data) ? allocationData.data : [];
      
      // Filter allocations for the current production site and month
      const siteAllocations = allocationArray.filter(a => 
        String(a.productionSiteId) === String(selectedSite) && 
        a.sk === formattedMonth
      );
      
      // Calculate total allocated units for this production site
      const allocatedUnits = siteAllocations.reduce((sum, allocation) => {
        const allocatedToSite = Object.values(allocation.allocated || {}).reduce(
          (total, value) => total + (Number(value) || 0), 0
        );
        return sum + allocatedToSite;
      }, 0);
      // Calculations
      const tdLossPercent = 0.0658;
      const revenuePerKWH = 3.0;
      const tnebChargesPerKWH = 0.5;
      // Helper: allocation value for given consumption site
      const getSiteAllocation = (site) => {
        // Find all allocations for this consumption site and month
        const siteAllocations = allocationArray.filter(a => 
          String(a.consumptionSiteId) === String(site.id) && 
          String(a.productionSiteId) === String(selectedSite) &&
          a.sk === formattedMonth
        );
        
        // Sum up all allocations for this consumption site from the selected production site
        return siteAllocations.reduce((total, allocation) => {
          if (allocation.allocated) {
            // Try to get the allocation for this specific site
            const value = allocation.allocated[site.id] || 
                         allocation.allocated[site.consumptionSiteId] || 
                         allocation.allocation || 0;
            return total + (Number(value) || 0);
          }
          return total + (Number(allocation.allocation) || 0);
        }, 0);
      };
      const tdLoss = Math.round(allocatedUnits * tdLossPercent);
      const netExportAfterLoss = Math.round(allocatedUnits * (1 - tdLossPercent));
      const revenueTotal = Math.round(netExportAfterLoss * revenuePerKWH);
      const tnebCharges = Math.round(netExportAfterLoss * tnebChargesPerKWH);
      const netAmount = revenueTotal - tnebCharges;
      // Create table headers and wind data
      const headers = [
        `${selectedProdSite.name.toUpperCase()} (${selectedProdSite.type.toUpperCase()})`,
        ...consumptionSites.map(site => `${site.name.toUpperCase()} (${site.type.toUpperCase()})`),
      ];
      return {
        windData: [
          { slNo: 1, description: "Total Production (Export)", values: [exportValue, ...consumptionSites.map(() => '')] },
          { slNo: 2, description: "Less: Import", values: [importValue, ...consumptionSites.map(() => '')] },
          { slNo: 3, description: "Net Export (Production - Import)", values: [totalExport, ...consumptionSites.map(() => '')] },
          { slNo: 4, description: "Total Alloted", values: [totalExport, ...consumptionSites.map(site => getSiteAllocation(site))] },
          { slNo: 5, description: "Less: T&D loss 6.58%", values: [tdLoss, ...consumptionSites.map(site => Math.round(getSiteAllocation(site) * tdLossPercent))] },
          { slNo: 6, description: "Net Export (after loss)", values: [netExportAfterLoss, ...consumptionSites.map(site => Math.round(getSiteAllocation(site) * (1 - tdLossPercent)))] },
          { slNo: 7, description: "Adjusted", values: [0, ...consumptionSites.map(() => 0)] },
          { slNo: 8, description: "Banking", values: [bankingUnits, ...consumptionSites.map(() => '')] },
          { slNo: 9, description: "Revenue @ 3.0 per KWH", values: [revenueTotal, ...consumptionSites.map(site => Math.round(getSiteAllocation(site) * (1 - tdLossPercent) * revenuePerKWH))] },
          { slNo: 10, description: "Less: TNEB Open Access Charges", values: [tnebCharges, ...consumptionSites.map(site => Math.round(getSiteAllocation(site) * (1 - tdLossPercent) * tnebChargesPerKWH))] },
          { slNo: 11, description: "Net Amount", values: [netAmount, ...consumptionSites.map(site => Math.round(getSiteAllocation(site) * (1 - tdLossPercent) * (revenuePerKWH - tnebChargesPerKWH)))] },
        ],
        chargesData: [], // To implement if needed
        windHeaders: headers,
        sites: productionSites,
        siteTypes,
        invoiceNumber: invoiceData.invoiceNumber,
      };
    } catch (error) {
      console.error('Error calculating invoice data:', error);
      return {
        windData: [],
        chargesData: [],
        windHeaders: [],
        sites: productionSites,
        siteTypes,
        invoiceNumber: invoiceData.invoiceNumber,
      };
    }
  }, [selectedSite, productionSites, consumptionSites, invoiceData.invoiceNumber, siteTypes, billMonth, user?.companyId]);
  // Initialize data on component mount and when dependencies change
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch all required data in parallel
        const [newSelectedSite, newSelectedConsumptionSite] = await Promise.all([
          fetchProductionSites(),
          fetchConsumptionSites(),
          fetchCompanyDetails()
        ]);
        
        // Update selected sites if needed
        if (newSelectedSite && !selectedSite) {
          // Update parent component's selected site if needed
          if (typeof selectedSite === 'function') {
            selectedSite(newSelectedSite);
          }
        }
        
        if (newSelectedConsumptionSite && !consumptionSite) {
          // Update parent component's selected consumption site if needed
          if (typeof consumptionSite === 'function') {
            consumptionSite(newSelectedConsumptionSite);
          }
        }
        
      } catch (error) {
        console.error('Error initializing data:', error);
        setError('Failed to initialize data. Please refresh the page.');
        enqueueSnackbar('Failed to initialize data', { variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [fetchProductionSites, fetchConsumptionSites, fetchCompanyDetails, selectedSite, consumptionSite]);

  // Recalculate invoice data when dependencies change
  useEffect(() => {
    const fetchAndUpdateData = async () => {
      if (!selectedSite || !billMonth) return;
      
      try {
        setIsLoading(true);
        const calculatedData = await calculateInvoiceData();
        
        setInvoiceData(prev => ({
          ...prev,
          ...calculatedData,
          // Preserve invoice number if already set
          invoiceNumber: prev.invoiceNumber || calculatedData.invoiceNumber
        }));
      } catch (error) {
        console.error('Error updating invoice data:', error);
        setError('Failed to calculate invoice data. ' + (error.message || ''));
        enqueueSnackbar('Error calculating invoice data', { variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchAndUpdateData, 300);
    return () => clearTimeout(debounceTimer);
  }, [selectedSite, billMonth, calculateInvoiceData]);
  // Update invoice function with better error handling
  const updateInvoice = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newData = await calculateInvoiceData();
      
      setInvoiceData(prev => ({
        ...prev,
        ...newData,
        // Preserve existing invoice number if not in new data
        invoiceNumber: newData.invoiceNumber || prev.invoiceNumber
      }));
      
      enqueueSnackbar('Invoice updated successfully', { variant: 'success' });
      return newData;
    } catch (error) {
      console.error('Error updating invoice:', error);
      setError('Failed to update invoice: ' + (error.message || 'Unknown error'));
      enqueueSnackbar('Failed to update invoice', { variant: 'error' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [calculateInvoiceData]);
  
  // Memoize the returned object to prevent unnecessary re-renders
  return useMemo(() => ({
    ...invoiceData,
    companyName,
    isLoading: isLoading || isLoadingSites,
    error,
    productionSites,
    consumptionSites,
    siteTypes,
    formatNumber,
    formatCurrency,
    updateInvoice,
    // For backward compatibility
    sites: productionSites,
    siteError: error,
  }), [
    invoiceData, 
    companyName, 
    isLoading, 
    isLoadingSites, 
    error, 
    productionSites, 
    consumptionSites, 
    siteTypes, 
    updateInvoice
  ]);
};
export default useInvoiceCalculator;