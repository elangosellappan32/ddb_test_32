const AllocationDAL = require('../allocation/allocationDAL');
const productionSiteDAL = require('../productionSite/productionSiteDAL');
const consumptionSiteDAL = require('../consumptionSite/consumptionSiteDAL');
const logger = require('../utils/logger');

// Initialize DAL instance for allocation (since it's a class)
const allocationDAL = new AllocationDAL();

// C Values
const C_VALUES = ['C1', 'C2', 'C3', 'C4', 'C5'];

/**
 * Get C value (simple passthrough, no range checking)
 * @param {string} cValue - C value from the allocation
 * @returns {string} The same C value
 */
const getCValue = (cValue) => {
    return cValue && C_VALUES.includes(cValue) ? cValue : 'C1';
};

/**
 * Process raw allocation data into a structured format
 * @param {Object} alloc - Raw allocation data
 * @returns {Object} Processed allocation data
 */
const processAllocation = (alloc) => {
    const parts = alloc.pk.split('_');
    const isLegacyFormat = parts.length === 2;
    
    let prodSiteId, consSiteId;
    if (isLegacyFormat) {
        [prodSiteId, consSiteId] = parts;
    } else {
        // New format: ALLOC#<prodId>_<consId>
        prodSiteId = parts[1];
        consSiteId = parts[2];
    }
    
    // Initialize C values with 0
    const cValues = {
        C1: 0,
        C2: 0,
        C3: 0,
        C4: 0,
        C5: 0
    };

    // Process each C value from the allocation
    C_VALUES.forEach(cKey => {
        // Try both uppercase and lowercase variations
        const lowerKey = cKey.toLowerCase();
        const value = Number(alloc[cKey] || alloc[lowerKey] || 0);
        cValues[cKey] = Math.round(Math.max(0, value)); // Ensure non-negative numbers
    });
    
    // Calculate total allocation
    const totalAllocation = Object.values(cValues).reduce((sum, val) => sum + val, 0);
    
    // Only include non-zero allocations
    if (totalAllocation > 0) {
        logger.debug(`Processed allocation for ${prodSiteId}-${consSiteId}:`, {
            cValues,
            totalAllocation,
            rawAllocation: alloc
        });
        
        return {
            productionSiteId: prodSiteId,
            productionSiteName: '', // Will be filled in later
            consumptionSiteId: consSiteId,
            consumptionSiteName: '', // Will be filled in later
            cValues: { ...cValues }, // Ensure we return a new object
            total: totalAllocation
        };
    }
    
    return null;
};

/**
 * Generate invoice data for a specific month and optional sites
 * @param {string} month - Month in YYYYMM format
 * @param {Array<string>} siteIds - Optional array of site IDs to filter by
 * @returns {Promise<Array>} Processed invoice data
 */
const generateInvoiceData = async (month, siteIds = []) => {
    try {
        // 1. Format the month to MMYYYY format expected by the database
        const monthStr = String(month);
        const year = monthStr.substring(0, 4);
        const monthNum = monthStr.substring(4);
        const formattedMonth = `${monthNum}${year}`;
        
        // 2. Get allocations and site data in parallel
        const [allocations, productionSites, consumptionSites] = await Promise.all([
            allocationDAL.getAllocationsByMonth(formattedMonth),
            productionSiteDAL.getAllProductionSites(),
            consumptionSiteDAL.getAllConsumptionSites()
        ]);
        
        if (!Array.isArray(productionSites) || !Array.isArray(consumptionSites)) {
            throw new Error('Failed to fetch site data');
        }
        
        // Create maps for quick lookup
        const prodSiteMap = new Map(productionSites.map(site => [
            site.productionSiteId, 
            { name: site.name || `Site ${site.productionSiteId}`, ...site }
        ]));
        
        const consSiteMap = new Map(consumptionSites.map(site => [
            site.consumptionSiteId, 
            { name: site.name || `Site ${site.consumptionSiteId}`, ...site }
        ]));
        
        // 3. Process allocations into invoice items
        const invoiceItems = [];
        const processedKeys = new Set();
        
        for (const alloc of allocations) {
            try {
                const processed = processAllocation(alloc);
                if (!processed) continue; // Skip if no valid allocation data
                
                const { productionSiteId, consumptionSiteId, cValues, total } = processed;
                const allocationKey = `${productionSiteId}-${consumptionSiteId}`;
                
                // Skip if we've already processed this site pair
                if (processedKeys.has(allocationKey)) continue;
                processedKeys.add(allocationKey);
                
                // Apply site filtering if specified
                if (siteIds.length > 0 && 
                    !siteIds.includes(productionSiteId) && 
                    !siteIds.includes(consumptionSiteId)) {
                    continue;
                }
                
                // Get site names
                const prodSite = prodSiteMap.get(productionSiteId) || { 
                    name: `Site ${productionSiteId}`
                };
                
                const consSite = consSiteMap.get(consumptionSiteId) || { 
                    name: `Site ${consumptionSiteId}`
                };
                
                // Add to invoice items
                invoiceItems.push({
                    productionSiteId,
                    productionSiteName: prodSite.name,
                    consumptionSiteId,
                    consumptionSiteName: consSite.name,
                    cValues: { ...cValues }, // Ensure we return a new object
                    total
                });
                
            } catch (error) {
                logger.error(`Error processing allocation: ${JSON.stringify(alloc)}`, error);
                continue;
            }
        }
        
        logger.info(`Generated ${invoiceItems.length} invoice items for ${formattedMonth}`);
        return invoiceItems;
        
    } catch (error) {
        logger.error('Error in generateInvoiceData:', error);
        throw new Error(`Failed to generate invoice data: ${error.message}`);
    }
};

module.exports = {
    generateInvoiceData,
    getCValue  // Export for testing
};
