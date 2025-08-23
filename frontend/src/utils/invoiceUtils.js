import { getAccessibleSiteIds } from './siteAccessUtils';
import productionSiteApi from '../services/productionSiteApi';
import productionChargeApi from '../services/productionChargeApi';
import consumptionSiteApi from '../services/consumptionSiteApi';
import api from '../services/api';
import { format } from 'date-fns';

// Helper: Normalize allocation cValues keys to lowercase c1-c5
export function normalizeAllocationCValues(cValues = {}) {
  const normalized = {};
  ['1', '2', '3', '4', '5'].forEach(num => {
    const keysToTry = [`C${num}`, `c${num}`, `C0${num}`, `c0${num}`];
    let value = 0;
    for (const key of keysToTry) {
      if (key in cValues && cValues[key] !== undefined && cValues[key] !== null) {
        value = Number(cValues[key]) || 0;
        break;
      }
    }
    normalized[`c${num}`] = value;
  });
  return normalized;
}

// Helper: Normalize charge cValues keys to uppercase C001-C010
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
 * Fetches and processes allocation invoice data for a given month
 * Normalizes allocation cValues keys to lowercase c1-c5
 */
export const fetchAndProcessInvoiceData = async (user, date) => {
  try {
    // Get accessible site IDs for production and consumption
    const prodIds = getAccessibleSiteIds(user, 'production');
    const consIds = getAccessibleSiteIds(user, 'consumption');

    // Extract raw IDs if prefixed
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

    // Prepare combined unique site IDs
    const allSiteIds = [...new Set([...accessibleProdIds, ...accessibleConsIds])];

    // Fetch invoice data from API
    const response = await api.get(`/invoice/${formattedDate}`, {
      params: { sites: allSiteIds.join(',') },
    });
    
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Failed to fetch invoice data');
    }

    // Process and normalize the data
    const processedData = [];
    const seenKeys = new Set();

    (response.data.data || [])
      .filter(item => accessibleProdIds.includes(String(item.productionSiteId)))
      .forEach(item => {
        const key = `${item.productionSiteId}-${item.consumptionSiteId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const normalizedCValues = normalizeAllocationCValues(item.cValues);
          processedData.push({
            productionSiteId: item.productionSiteId,
            productionSiteName: prodMap[item.productionSiteId] || `Site ${item.productionSiteId}`,
            consumptionSiteId: item.consumptionSiteId,
            consumptionSiteName: consMap[item.consumptionSiteId] || `Site ${item.consumptionSiteId}`,
            cValues: normalizedCValues,
            total: item.totalAllocation || 0,
          });
        }
      });

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
 * Fetches production charge data for a specific month
 * Normalizes charge cValues keys to uppercase C001-C011 format
 */
export const fetchProductionChargesForMonth = async (user, companyId, productionSiteId, date) => {
  console.group('fetchProductionChargesForMonth');
  try {
    if (!user || !companyId || !date) {
      throw new Error('Missing required parameters: user, companyId, and date are required');
    }

    // Get accessible production site IDs
    const accessibleSiteIds = getAccessibleSiteIds(user, 'production');

    // Validate access if specific site ID is given
    if (productionSiteId) {
      const hasAccess = accessibleSiteIds.includes(productionSiteId) ||
        accessibleSiteIds.some(id => id.endsWith(`_${productionSiteId}`));
      if (!hasAccess) {
        throw new Error('You do not have access to this production site');
      }
    }

    const yearMonth = format(date, 'MMyyyy');
    const sitesToFetch = productionSiteId ? [productionSiteId] : accessibleSiteIds;
    const allCharges = [];

    // Fetch charges from each site
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
        console.error(`Error fetching charges for site ${siteId}:`, error);
      }
    }

    // Filter charges by month (MMYYYY)
    const chargesForMonth = allCharges.filter(charge => {
      const chargeDate = charge.sk ? charge.sk.substring(0, 6) : '';
      return chargeDate === yearMonth;
    });

    // Helper function to safely parse dates (ISO string)
    const safeParseDate = (dateStr) => {
      try {
        if (!dateStr) return new Date().toISOString();
        if (dateStr instanceof Date && !isNaN(dateStr)) return dateStr.toISOString();
        if (/^\d{6}$/.test(dateStr)) {
          const month = dateStr.substring(0, 2);
          const year = dateStr.substring(2);
          return new Date(`${year}-${month}-01`).toISOString();
        }
        if (/^\d{4}\d{2}$/.test(dateStr)) {
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4);
          return new Date(`${year}-${month}-01`).toISOString();
        }
        const parsed = new Date(dateStr);
        if (!isNaN(parsed)) return parsed.toISOString();
      } catch (_) {}
      return new Date().toISOString();
    };

    // Fetch site information in parallel
    const uniqueSiteIds = [...new Set(chargesForMonth.map(c => c.productionSiteId))];
    const sitesInfo = await Promise.all(uniqueSiteIds.map(async (siteId) => {
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
        // Normalize keys for cValues to C001-C011 format
        Object.entries(charge.cValues).forEach(([key, value]) => {
          const normalizedKey = key.toUpperCase().startsWith('C')
            ? `C${key.substring(1).padStart(3, '0')}`
            : key;
          const numValue = parseFloat(value) || 0;
          cValues[normalizedKey] = numValue;
          totalCharge += numValue;
        });
      } else {
        // fallback if cValues missing, try individual C001-C011 keys
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
      const formattedDate = safeParseDate(rawDate);

      return {
        id: charge.id || `charge-${siteId}-${formattedDate}`,
        productionSiteId: siteId,
        productionSiteName: siteName,
        cValues,
        total: parseFloat(totalCharge.toFixed(2)),
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

    console.log('Production charges loaded:', result);

    console.groupEnd();
    return result;
  } catch (error) {
    console.error('Error in fetchProductionChargesForMonth:', error);
    console.groupEnd();
    return {
      success: false,
      data: [],
      message: error.message || 'Failed to fetch production charges',
      error,
    };
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
    C5: 0,
  };
  let totalAllocation = 0;

  const processedData = invoiceData.map(item => {
    const rowTotal = Object.entries(item.cValues || {}).reduce(
      (sum, [key, value]) => sum + (Number(value) || 0),
      0
    );
    totalAllocation += rowTotal;

    Object.entries(item.cValues || {}).forEach(([cValue, value]) => {
      const numValue = Number(value) || 0;
      if (numValue > 0) {
        cValueCounts[cValue] = (cValueCounts[cValue] || 0) + 1;
      }
    });

    return { ...item, total: rowTotal };
  });

  return {
    data: processedData,
    allocation: totalAllocation,
    cValueCounts,
  };
};
