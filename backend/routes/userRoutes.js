const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authorization');
const { getUserById } = require('../controllers/userController');
const logger = require('../utils/logger');

/**
 * @route   GET /api/user/accessible-sites
 * @desc    Get accessible sites for the current user
 * @access  Private
 */
router.get('/accessible-sites', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Extract accessible sites from user metadata
        const accessibleSites = user.metadata?.accessibleSites?.M || {
            productionSites: { M: { L: [] } },
            consumptionSites: { M: { L: [] } }
        };

        // Format the response
        const response = {
            success: true,
            data: {
                productionSites: accessibleSites.productionSites?.M?.L?.flatMap(siteArray => 
                    siteArray.L.map(item => item.M?.S?.S).filter(Boolean)
                ) || [],
                consumptionSites: accessibleSites.consumptionSites?.M?.L?.flatMap(siteArray => 
                    siteArray.L.map(item => item.M?.S?.S).filter(Boolean)
                ) || []
            }
        };

        logger.info(`[UserRoutes] Fetched accessible sites for user ${req.user.userId}`);
        res.json(response);
    } catch (error) {
        logger.error(`[UserRoutes] Error fetching accessible sites: ${error.message}`, { error });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch accessible sites',
            error: error.message,
            code: 'FETCH_ACCESSIBLE_SITES_ERROR'
        });
    }
});

module.exports = router;
