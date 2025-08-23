const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const invoiceController = require('./invoiceController');

// Input validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    return res.status(400).json({ 
        success: false,
        errors: errors.array(),
        message: 'Validation failed' 
    });
};

/**
 * @swagger
 * /api/invoice/{month}:
 *   get:
 *     summary: Get invoice data for a specific month
 *     description: Retrieve invoice data including allocations, banking, and lapse for a given month
 *     parameters:
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           format: YYYYMM
 *         description: The month in YYYYMM format
 *       - in: query
 *         name: sites
 *         schema:
 *           type: string
 *         description: Comma-separated list of site IDs to filter by
 *     responses:
 *       200:
 *         description: Successful response with invoice data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productionSiteId:
 *                         type: string
 *                       productionSiteName:
 *                         type: string
 *                       consumptionSiteId:
 *                         type: string
 *                       consumptionSiteName:
 *                         type: string
 *                       allocation:
 *                         type: number
 *                       banking:
 *                         type: number
 *                       lapse:
 *                         type: number
 *                       net:
 *                         type: number
 *                 meta:
 *                   type: object
 *                   properties:
 *                     month:
 *                       type: string
 *                     financialYear:
 *                       type: string
 *       500:
 *         description: Server error
 */
// Define the route with the correct path
router.get('/:month', invoiceController.getInvoiceData);

/**
 * @swagger
 * /api/invoice/generate:
 *   post:
 *     summary: Generate a new invoice
 *     description: Generate an invoice with the provided data
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - month
 *               - year
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: ID of the company
 *               month:
 *                 type: string
 *                 description: Month in MM format (01-12)
 *               year:
 *                 type: string
 *                 description: Year in YYYY format
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *               charges:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Invoice generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.post('/generate',
    [
        body('companyId').isString().notEmpty(),
        body('month').isString().matches(/^(0[1-9]|1[0-2])$/),
        body('year').isString().matches(/^\d{4}$/),
        body('allocations').optional().isArray(),
        body('charges').optional().isArray()
    ],
    validate,
    invoiceController.generateInvoice
);

module.exports = router;
