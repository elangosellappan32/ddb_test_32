import { getAccessibleSiteIds } from './siteAccessUtils';
import productionSiteApi from '../services/productionSiteApi';
import consumptionSiteApi from '../services/consumptionSiteApi';
import api from '../services/api';
import { format } from 'date-fns';

/**
 * Fetches and processes invoice data for a given month
 * @param {Object} user - Current authenticated user object
 * @param {Date} date - Date object for the invoice month
 * @returns {Promise<Object>} Processed invoice data
 */
export const fetchAndProcessInvoiceData = async (user, date) => {
  try {
    // Get accessible site IDs
    const prodIds = getAccessibleSiteIds(user, 'production');
    const consIds = getAccessibleSiteIds(user, 'consumption');
    
    // Extract site IDs (handling potential prefixed formats)
    const extractSiteId = id => (id && id.includes('_') ? id.split('_')[1] : id);
    const accessibleProdIds = prodIds.map(extractSiteId);
    const accessibleConsIds = consIds.map(extractSiteId);

    // Fetch site information for display names
    const [productionSites, consumptionSites] = await Promise.all([
      productionSiteApi.fetchAll().then(r => r.data || []),
      consumptionSiteApi.fetchAll().then(r => r.data || [])
    ]);

    // Create site ID to name mappings
    const prodMap = {};
    productionSites.forEach(site => {
      prodMap[String(site.productionSiteId)] = site.name || site.siteName || site.productionSiteId;
    });

    const consMap = {};
    consumptionSites.forEach(site => {
      consMap[String(site.consumptionSiteId)] = site.name || site.siteName || site.consumptionSiteId;
    });

    // Format date for API request (YYYYMM format)
    const formattedDate = format(date, 'yyyyMM');
    
    // Get all accessible sites for the API request
    const allSiteIds = [...new Set([...accessibleProdIds, ...accessibleConsIds])];

    // Make API request to fetch invoice data
    const response = await api.get(`/invoice/${formattedDate}`, {
      params: {
        sites: allSiteIds.join(',')
      }
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to fetch invoice data');
    }

    // Process and enhance the invoice data with site names and C values
    const processedData = [];
    const processedItems = new Set();
    
    (response.data.data || [])
      .filter(item => {
        // Only include records where the production site is in the accessible list
        return accessibleProdIds.includes(String(item.productionSiteId));
      })
      .forEach(item => {
        const key = `${item.productionSiteId}-${item.consumptionSiteId}`;
        
        // Initialize the data structure for this site pair if it doesn't exist
        if (!processedItems.has(key)) {
          processedItems.add(key);
          
          // Create a new entry with C values from the backend
          const newEntry = {
            productionSiteId: item.productionSiteId,
            productionSiteName: prodMap[item.productionSiteId] || `Site ${item.productionSiteId}`,
            consumptionSiteId: item.consumptionSiteId,
            consumptionSiteName: consMap[item.consumptionSiteId] || `Site ${item.consumptionSiteId}`,
            cValues: {
              C1: 0,
              C2: 0,
              C3: 0,
              C4: 0,
              C5: 0
            },
            total: 0
          };
          
          // If the item already has cValues, use them directly
          if (item.cValues) {
            newEntry.cValues = { ...item.cValues };
            newEntry.total = item.totalAllocation || 0;
          }
          
          processedData.push(newEntry);
        } else {
          // If the entry already exists, update it with the latest data
          const existingEntry = processedData.find(
            d => d.productionSiteId === item.productionSiteId && 
                 d.consumptionSiteId === item.consumptionSiteId
          );
          
          if (existingEntry && item.cValues) {
            // Update C values if they exist in the item
            existingEntry.cValues = { ...item.cValues };
            existingEntry.total = item.totalAllocation || 0;
          }
        }
      });
      
    console.log('Processed invoice data:', processedData);

    return {
      data: processedData,
      meta: {
        financialYear: response.data.meta?.financialYear || '',
        month: response.data.meta?.month || '',
        totalCount: processedData.length
      },
      siteMaps: {
        production: prodMap,
        consumption: consMap
      }
    };
  } catch (error) {
    console.error('Error in fetchAndProcessInvoiceData:', error);
    throw error;
  }
};

/**
 * Calculates totals from invoice data
 * @param {Array} invoiceData - Array of invoice items
 * @returns {Object} Object containing calculated totals
 */
export const calculateInvoiceTotals = (invoiceData = []) => {
  const cValueCounts = {
    C1: 0,
    C2: 0,
    C3: 0,
    C4: 0,
    C5: 0
  };
  
  let totalAllocation = 0;
  
  // Process each invoice item to ensure totals are calculated correctly
  const processedData = invoiceData.map(item => {
    // Calculate row total from C values
    const rowTotal = Object.entries(item.cValues || {}).reduce((sum, [key, value]) => {
      const numValue = Number(value) || 0;
      return sum + numValue;
    }, 0);
    
    // Update total allocation
    totalAllocation += rowTotal;
    
    // Count non-zero C values
    Object.entries(item.cValues || {}).forEach(([cValue, value]) => {
      const numValue = Number(value) || 0;
      if (numValue > 0) {
        cValueCounts[cValue] = (cValueCounts[cValue] || 0) + 1;
      }
    });
    
    // Return item with updated total
    return {
      ...item,
      total: rowTotal
    };
  });
  
  console.log('Calculated totals:', { 
    totalAllocation, 
    cValueCounts,
    processedData: processedData.map(d => ({
      productionSiteId: d.productionSiteId,
      consumptionSiteId: d.consumptionSiteId,
      total: d.total,
      cValues: d.cValues
    }))
  });
  
  return {
    data: processedData,
    allocation: totalAllocation,
    cValueCounts
  };
};
