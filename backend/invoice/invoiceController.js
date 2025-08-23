const invoiceService = require('./invoiceService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

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

/**
 * Generate a new invoice
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateInvoice = async (req, res) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
                message: 'Validation failed'
            });
        }

        const { companyId, month, year, allocations = [], charges = [] } = req.body;
        
        logger.info(`Generating invoice for company ${companyId}, ${month}/${year}`, {
            allocationsCount: allocations.length,
            chargesCount: charges.length
        });

        // Generate the invoice
        const invoice = await invoiceService.generateInvoice({
            companyId,
            month,
            year,
            allocations,
            charges
        });

        res.status(201).json({
            success: true,
            message: 'Invoice generated successfully',
            data: invoice
        });

    } catch (error) {
        logger.error('Error in generateInvoice:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate invoice',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getInvoiceData,
    generateInvoice
};
