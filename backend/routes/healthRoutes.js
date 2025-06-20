const express = require('express');
const router = express.Router();
const packageJson = require('../package.json');
const calculateFormVAMetrics = require('../services/formVACalculation');
const calculateFormVBMetrics = require('../services/formVBCalculation');
const logger = require('../utils/logger');

/**
 * Health check endpoint
 * Returns basic server status without database checks
 */
router.get('/', (req, res) => {
    const serverInfo = {
        status: 'up',
        version: packageJson.version,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        apiVersion: 'v1'
    };

    res.json(serverInfo);
});

// Define the /api/health/formva and formvb routes
router.get('/formva', async (req, res) => {
    try {
        const { financialYear } = req.query;
        if (!financialYear) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'financialYear query parameter is required'
            });
        }

        // Validate financial year format (YYYY-YYYY)
        if (!/^\d{4}-\d{4}$/.test(financialYear)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid financial year format. Expected: YYYY-YYYY'
            });
        }

        const metrics = await calculateFormVAMetrics(financialYear);
        res.json(metrics);
    } catch (error) {
        logger.error('[HealthRoutes] FormVA Error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

router.get('/formvb', async (req, res) => {
    try {
        const { financialYear } = req.query;
        if (!financialYear) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'financialYear query parameter is required'
            });
        }

        // Validate financial year format (YYYY-YYYY)
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
        logger.error('[HealthRoutes] FormVB Error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

module.exports = router;