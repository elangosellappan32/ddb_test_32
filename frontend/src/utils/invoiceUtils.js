import { getAccessibleSiteIds } from './siteAccessUtils';
import productionSiteApi from '../services/productionSiteApi';
import consumptionSiteApi from '../services/consumptionSiteApi';
import productionChargeApi from '../services/productionChargeApi';
import api from '../services/api';
import { format } from 'date-fns';

/**
 * Process allocation data to ensure consistent format
 * @param {Object} item - Raw allocation item from API
 * @returns {Object} Processed allocation with consistent structure
 */
const processAllocationItem = (item) => {
  
  // If item is already processed by allocationService, return as is
  if (item.cValues && typeof item.cValues === 'object' && 'c1' in item.cValues) {
    return item;
  }

  // Handle both direct and nested allocated values
  const source = item.original || item;
  const allocated = source.allocated || source.cValues || {};
  
  // Helper to safely get a value with case-insensitive keys
  const getValue = (obj, keys, defaultValue = 0, valueName = 'value') => {
    if (!obj) {
      return defaultValue;
    }
    
    const keyVariations = [
      ...keys.flatMap(k => [k, k.toLowerCase(), k.toUpperCase()]),
      ...keys.flatMap(k => [`c${k}`, `C${k}`])
    ];
    
    
    for (const key of keyVariations) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return defaultValue;
  };

  // Extract C values with proper fallbacks
  const cValues = {
    c1: Number(getValue(allocated, ['1', 'c1', 'C1'], 0, 'c1')),
    c2: Number(getValue(allocated, ['2', 'c2', 'C2'], 0, 'c2')),
    c3: Number(getValue(allocated, ['3', 'c3', 'C3'], 0, 'c3')),
    c4: Number(getValue(allocated, ['4', 'c4', 'C4'], 0, 'c4')),
    c5: Number(getValue(allocated, ['5', 'c5', 'C5'], 0, 'c5')),
    // Check both source and allocated for charge value, with proper type conversion
    charge: source.charge !== undefined ? (source.charge === true || source.charge === 1 ? 1 : 0) :
           (allocated.charge !== undefined ? (allocated.charge === true || allocated.charge === 1 ? 1 : 0) : 0)
  };
  

  // Calculate total allocation (excluding charge)
  const totalAllocation = Object.entries(cValues)
    .filter(([key]) => key !== 'charge')
    .reduce((sum, [_, value]) => sum + (Number(value) || 0), 0);

  const result = {
    ...item,
    cValues,
    charge: cValues.charge === 1,  // Convert to boolean for consistency
    total: Object.entries(cValues)
      .filter(([key]) => key !== 'charge') // Exclude charge from total calculation
      .reduce((sum, [_, val]) => sum + (typeof val === 'number' ? val : 0), 0),
    // Ensure allocated object has the charge value for backward compatibility
    allocated: {
      ...(item.allocated || {}),
      charge: cValues.charge
    }
  };
  
  return result;
};

// Helper: Normalize charge cValues keys to uppercase C001-C011
export function normalizeChargeCValues(cValues = {}) {
  const normalized = {};
  for (let i = 1; i <= 11; i++) {
    const keyBase = i.toString().padStart(3, '0');
    const keysToTry = [`C${keyBase}`, `c${keyBase}`];
    let value = 0;
    for (const key of keysToTry) {
      if (key in cValues && cValues[key] !== undefined && cValues[key] !== null) {
        value = Number(cValues[key]) || 0;
        break;
      }
    }
    normalized[`C${keyBase}`] = value;
  }
  return normalized;
}

/**
 * Fetches and processes allocation invoice data for a given month.
 * Normalizes allocation cValues keys to lowercase c1-c5 and includes charge flag.
 */
export const fetchAndProcessInvoiceData = async (user, date, { onlyCharging = false } = {}) => {
  try {
    // Get accessible site IDs for production and consumption
    const prodIds = getAccessibleSiteIds(user, 'production');
    const consIds = getAccessibleSiteIds(user, 'consumption');
    const extractSiteId = (id) => (id && id.includes('_') ? id.split('_')[1] : id);
    const accessibleProdIds = prodIds.map(extractSiteId);
    const accessibleConsIds = consIds.map(extractSiteId);

    // Fetch production and consumption sites for names
    const [productionSites, consumptionSites] = await Promise.all([
      productionSiteApi.fetchAll().then(r => r.data || []),
      consumptionSiteApi.fetchAll().then(r => r.data || []),
    ]);

    // Create maps from site IDs to names
    const prodMap = {};
    productionSites.forEach(site => {
      prodMap[String(site.productionSiteId)] = site.name || site.siteName || site.productionSiteId;
    });
    const consMap = {};
    consumptionSites.forEach(site => {
      consMap[String(site.consumptionSiteId)] = site.name || site.siteName || site.consumptionSiteId;
    });

    // Format date as YYYYMM for API request
    const formattedDate = format(date, 'yyyyMM');
    const allSiteIds = [...new Set([...accessibleProdIds, ...accessibleConsIds])];

    // Fetch invoice data from API
    const response = await api.get(`/invoice/${formattedDate}`, {
      params: { sites: allSiteIds.join(',') },
    });
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to fetch invoice data');
    }

    // Process main "data" allocations
    let processedData = [];
    const seenKeys = new Set();

    if (Array.isArray(response.data?.data)) {
      processedData = response.data.data
        .filter(item => {
          const prodId = String(item.productionSiteId || item.productionSiteId || '');
          const consId = String(item.consumptionSiteId || item.consumptionSiteId || '');
          return accessibleProdIds.includes(prodId) && accessibleConsIds.includes(consId);
        })
        .map(item => {
          // Process the allocation item
          const processedItem = processAllocationItem(item);
          
          // Create a stable key to prevent duplicates
          const key = `${processedItem.productionSiteId}-${processedItem.consumptionSiteId}`;
          if (seenKeys.has(key)) return null;
          seenKeys.add(key);
          
          return {
            ...processedItem,
            productionSiteName: prodMap[String(processedItem.productionSiteId)] || `Site ${processedItem.productionSiteId}`,
            consumptionSiteName: consMap[String(processedItem.consumptionSiteId)] || `Site ${processedItem.consumptionSiteId}`,
            // Ensure we have all required fields with proper defaults
            productionSiteId: processedItem.productionSiteId || item.productionSiteId,
            consumptionSiteId: processedItem.consumptionSiteId || item.consumptionSiteId,
            // Ensure cValues is properly structured
            cValues: {
              c1: Number(processedItem.cValues?.c1 || 0),
              c2: Number(processedItem.cValues?.c2 || 0),
              c3: Number(processedItem.cValues?.c3 || 0),
              c4: Number(processedItem.cValues?.c4 || 0),
              c5: Number(processedItem.cValues?.c5 || 0),
              charge: Number(processedItem.cValues?.charge || 0)
            },
            // Ensure charge is properly set
            charge: Boolean(processedItem.charge || processedItem.cValues?.charge),
            // Ensure totals are calculated
            total: processedItem.total || processedItem.totalAllocation || 0,
            totalAllocation: processedItem.totalAllocation || processedItem.total || 0,
            // Preserve original data for reference
            original: processedItem.original || item
          };
        })
        .filter(Boolean); // Remove any null entries from duplicates
    }

    // Optionally filter only charging data from the main allocations
    if (onlyCharging) {
      processedData = processedData.filter(rec => rec.charge === true || rec.charge === 1);
    }

    return {
      data: processedData,
      meta: {
        financialYear: response.data.meta?.financialYear || '',
        month: response.data.meta?.month || '',
        totalCount: processedData.length,
      },
      siteMaps: {
        production: prodMap,
        consumption: consMap,
      },
    };
  } catch (error) {
    console.error('Error in fetchAndProcessInvoiceData:', error);
    throw error;
  }
};


/**
 * Fetches production charge data for a specific month.
 * Normalizes charge cValues keys to uppercase C001-C011 format.
 */
export const fetchProductionChargesForMonth = async (user, companyId, productionSiteId, date) => {
  try {
    if (!user || !companyId || !date) {
      throw new Error('Missing required parameters: user, companyId, and date are required');
    }

    // Get accessible production site IDs
    const accessibleSiteIds = getAccessibleSiteIds(user, 'production');
    if (productionSiteId) {
      const hasAccess =
        accessibleSiteIds.includes(productionSiteId) ||
        accessibleSiteIds.some(id => id.endsWith(`_${productionSiteId}`));
      if (!hasAccess) {
        throw new Error('You do not have access to this production site');
      }
    }
    const yearMonth = format(date, 'MMyyyy');
    const sitesToFetch = productionSiteId ? [productionSiteId] : accessibleSiteIds;
    const allCharges = [];

    for (const siteId of sitesToFetch) {
      try {
        const siteIdOnly = siteId.includes('_') ? siteId.split('_')[1] : siteId;
        const response = await productionChargeApi.fetchAll(companyId, siteIdOnly);
        if (response.success && Array.isArray(response.data)) {
          const chargesWithSiteId = response.data.map(charge => ({
            ...charge,
            productionSiteId: siteIdOnly,
          }));
          allCharges.push(...chargesWithSiteId);
        }
      } catch (error) {
      }
    }

    // Filter charges by month (MMYYYY)
    const chargesForMonth = allCharges.filter(charge => {
      const chargeDate = charge.sk ? charge.sk.substring(0, 6) : '';
      return chargeDate === yearMonth;
    });

    // Fetch site info in parallel
    const uniqueSiteIds = [...new Set(chargesForMonth.map(c => c.productionSiteId))];
    const sitesInfo = await Promise.all(uniqueSiteIds.map(async siteId => {
      try {
        const site = await productionSiteApi.fetchOne(companyId, siteId);
        return {
          id: siteId,
          name: site.data?.name || `Site ${siteId}`,
        };
      } catch (_) {
        return {
          id: siteId,
          name: `Site ${siteId}`,
        };
      }
    }));
    const siteMap = sitesInfo.reduce((acc, site) => ({ ...acc, [site.id]: site.name }), {});

    // Process and normalize charges
    const processedCharges = chargesForMonth.map(charge => {
      let cValues = {};
      let totalCharge = 0;
      if (charge.cValues && typeof charge.cValues === 'object') {
        cValues = normalizeChargeCValues(charge.cValues);
        totalCharge = Object.values(cValues).reduce((acc, val) => acc + val, 0);
      } else {
        // Fallback normalization if cValues is missing
        for (let i = 1; i <= 11; i++) {
          const chargeKey = `C${i.toString().padStart(3, '0')}`;
          const possibleKeys = [chargeKey, `c${i.toString().padStart(3, '0')}`];
          const matchingKey = possibleKeys.find(k =>
            Object.keys(charge).some(x => x.toLowerCase() === k.toLowerCase())
          );
          const value = matchingKey
            ? charge[Object.keys(charge).find(x => x.toLowerCase() === matchingKey.toLowerCase())]
            : 0;
          const numVal = parseFloat(value) || 0;
          cValues[chargeKey] = numVal;
          totalCharge += numVal;
        }
      }

      const siteId = String(charge.productionSiteId || '');
      const siteName = siteMap[siteId] || `Site ${siteId}`;
      const rawDate = charge.date || charge.sk || '';

      return {
        id: charge.id || `charge-${siteId}-${rawDate}`,
        productionSiteId: siteId,
        productionSiteName: siteName,
        cValues,
        total: parseFloat(totalCharge.toFixed(2)),
        charge: typeof charge.charge !== "undefined" ? Number(charge.charge) : 0,
        _raw: { ...charge, sensitiveData: undefined },
      };
    });

    // Final formatting: ensure all keys present in cValues
    const formattedData = processedCharges.map(charge => {
      const completeCValues = {};
      for (let i = 1; i <= 11; i++) {
        const key = `C${i.toString().padStart(3, '0')}`;
        completeCValues[key] = charge.cValues ? (charge.cValues[key] || 0) : 0;
      }
      return {
        ...charge,
        cValues: completeCValues,
        _calculated: { grandTotal: charge.total || 0 },
      };
    });

    const result = {
      success: true,
      data: formattedData,
      meta: {
        type: 'production_charges',
        totalRecords: formattedData.length,
        generatedAt: new Date().toISOString(),
      },
      message: `Successfully retrieved ${formattedData.length} charge records`,
      records: formattedData, // backward compatibility
    };
    return result;
  } catch (error) {
    return {
      success: false,
      data: [],
      message: error.message || 'Failed to fetch production charges',
      error,
    };
  }
};
