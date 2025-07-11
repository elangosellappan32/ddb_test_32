const express = require('express');
const router = express.Router();
const calculateFormVAMetrics = require('../services/formVACalculation');
const calculateFormVBMetrics = require('../services/formVBCalculation');
const logger = require('../utils/logger');

// Form V-A route
router.get('/formva', async (req, res) => {
    try {
        const { financialYear } = req.query;
        if (!financialYear) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'financialYear query parameter is required'
            });
        }
        if (!/^\d{4}-\d{4}$/.test(financialYear)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid financial year format. Expected: YYYY-YYYY'
            });
        }
        const metrics = await calculateFormVAMetrics(financialYear);
        res.json(metrics);
    } catch (error) {
        logger.error('[FormRoutes] FormVA Error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// Form V-B route
router.get('/formvb', async (req, res) => {
    try {
        const { financialYear } = req.query;
        if (!financialYear) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'financialYear query parameter is required'
            });
        }
        if (!/^\d{4}-\d{4}$/.test(financialYear)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid financial year format. Expected: YYYY-YYYY'
            });
        }
        const metrics = await calculateFormVBMetrics(financialYear);
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('[FormRoutes] FormVB Error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;
