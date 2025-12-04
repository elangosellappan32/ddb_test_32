const AllocationDAL = require('../allocation/allocationDAL');
const productionSiteDAL = require('../productionSite/productionSiteDAL');
const consumptionSiteDAL = require('../consumptionSite/consumptionSiteDAL');
const logger = require('../utils/logger');

// Initialize DAL instance for allocation (since it's a class)
const allocationDAL = new AllocationDAL();

// C Values
const C_VALUES = ['C1', 'C2', 'C3', 'C4', 'C5','charge'];

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
    
    // Initialize with default values from the allocation or 0
    const cValues = {
        C1: alloc.allocated?.C1 || alloc.allocated?.c1 || 0,
        C2: alloc.allocated?.C2 || alloc.allocated?.c2 || 0,
        C3: alloc.allocated?.C3 || alloc.allocated?.c3 || 0,
        C4: alloc.allocated?.C4 || alloc.allocated?.c4 || 0,
        C5: alloc.allocated?.C5 || alloc.allocated?.c5 || 0,
        charge: alloc.charge || 0
    };

    // Process each C value from the allocation
    C_VALUES.forEach(cKey => {
        if (cKey !== 'charge') {  // Skip charge as it's handled separately
            const value = alloc.allocated?.[cKey] || alloc.allocated?.[cKey.toLowerCase()];
            if (value !== undefined) {
                cValues[cKey] = Number(value) || 0;
            }
        }
        // Try both uppercase and lowercase variations
        const lowerKey = cKey.toLowerCase();
        const value = Number(alloc[cKey] || alloc[lowerKey] || 0);
        cValues[cKey] = Math.round(Math.max(0, value)); // Ensure non-negative numbers
    });
    
    // Calculate total allocation
    const totalAllocation = Object.values(cValues).reduce((sum, val) => sum + val, 0);
    
    // Only include non-zero allocations
    if (totalAllocation > 0) {
        
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

/**
 * Generate an invoice with the provided data
 * @param {Object} params - Invoice generation parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.month - Month in MM format (01-12)
 * @param {string} params.year - Year in YYYY format
 * @param {Array} params.allocations - Array of allocation records
 * @param {Array} params.charges - Array of charge records
 * @returns {Promise<Object>} Generated invoice data
 */
const generateInvoice = async ({ companyId, month, year, allocations = [], charges = [] }) => {
    try {
        // Validate input
        if (!companyId || !month || !year) {
            throw new Error('Missing required parameters: companyId, month, and year are required');
        }

        // Format month to ensure it's 2 digits
        const formattedMonth = String(month).padStart(2, '0');
        const period = `${year}${formattedMonth}`;

        // Calculate invoice number (format: INV-YYYYMM-XXXXX where XXXXX is a random number)
        const invoiceNumber = `INV-${period}-${Math.floor(10000 + Math.random() * 90000)}`;
        
        // Calculate invoice date (current date)
        const invoiceDate = new Date().toISOString().split('T')[0];
        
        // Calculate due date (30 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const formattedDueDate = dueDate.toISOString().split('T')[0];

        // Process allocations and charges to calculate totals
        const totalAllocation = allocations.reduce((sum, alloc) => sum + (Number(alloc.allocation) || 0), 0);
        const totalCharges = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);

        // Calculate tax (assuming 18% GST for example)
        const taxRate = 0.18;
        const taxAmount = totalCharges * taxRate;
        const totalAmount = totalCharges + taxAmount;

        // Prepare line items (combining allocations and charges)
        const lineItems = [
            ...allocations.map(alloc => ({
                type: 'allocation',
                description: `Allocation for ${alloc.productionSiteName || 'Site'}`,
                quantity: 1,
                unitPrice: alloc.allocation,
                amount: alloc.allocation
            })),
            ...charges.map(charge => ({
                type: 'charge',
                description: charge.description || 'Service Charge',
                quantity: charge.quantity || 1,
                unitPrice: charge.unitPrice || charge.amount,
                amount: charge.amount
            }))
        ];

        // Prepare the invoice object
        const invoice = {
            invoiceNumber,
            invoiceDate,
            dueDate: formattedDueDate,
            period: {
                month: formattedMonth,
                year,
                display: `${getMonthName(parseInt(formattedMonth, 10))} ${year}`
            },
            companyId,
            status: 'generated',
            lineItems,
            subtotal: totalCharges,
            tax: {
                rate: taxRate * 100, // Convert to percentage
                amount: taxAmount
            },
            total: totalAmount,
            currency: 'INR',
            metadata: {
                allocationsCount: allocations.length,
                chargesCount: charges.length,
                generatedAt: new Date().toISOString()
            }
        };

        logger.info(`Generated invoice ${invoiceNumber} for company ${companyId}`, {
            invoiceNumber,
            companyId,
            period,
            totalAmount
        });

        return invoice;

    } catch (error) {
        logger.error('Error in generateInvoice service:', {
            error: error.message,
            stack: error.stack,
            params: { companyId, month, year }
        });
        throw error;
    }
};

/**
 * Helper function to get month name from month number
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name
 */
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
}

module.exports = {
    generateInvoiceData,
    generateInvoice,
    getCValue  // Export for testing
};
