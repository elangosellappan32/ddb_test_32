const express = require('express');
const router = express.Router();
const invoiceController = require('./invoiceController');

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

module.exports = router;
