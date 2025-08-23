const invoiceService = require('./invoiceService');
const logger = require('../utils/logger');

/**
 * Get invoice data for a specific month
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInvoiceData = async (req, res) => {
    try {
        const { month } = req.params;
        const { sites } = req.query;
        
        const siteList = sites ? sites.split(',').map(s => s.trim()) : [];
        
        const invoiceData = await invoiceService.generateInvoiceData(month, siteList);
        
        res.json({
            success: true,
            data: invoiceData,
            meta: {
                month,
                financialYear: getFinancialYear(month)
            }
        });
    } catch (error) {
        logger.error('Error in getInvoiceData:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate invoice data'
        });
    }
};

/**
 * Helper function to get financial year from month (YYYYMM format)
 * @param {string} month - Month in YYYYMM format
 * @returns {string} Financial year in YYYY-YYYY format
 */
function getFinancialYear(month) {
    if (!month || month.length !== 6) return '';
    
    const year = parseInt(month.substring(0, 4));
    const monthNum = parseInt(month.substring(4, 6));
    
    // If month is April (4) or later, financial year is currentYear-nextYear
    // Otherwise, it's previousYear-currentYear
    if (monthNum >= 4) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

module.exports = {
    getInvoiceData
};
