const express = require('express');
const router = express.Router();
const { 
  getAvailableSites, 
  addExistingSiteAccess, 
  updateUserSiteAccess,
  validateSiteType 
} = require('../services/siteAccessService');
const { authenticateToken } = require('../middleware/authorization');
const logger = require('../utils/logger');

// Get available sites of a specific type
router.get('/available-sites/:siteType', authenticateToken, async (req, res) => {
    try {
        const { siteType } = req.params;

        // Validate site type
        try {
            validateSiteType(siteType);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'INVALID_SITE_TYPE'
            });
        }
        
        // Get available sites
        const sites = await getAvailableSites(siteType);

        res.json({
            success: true,
            data: sites
        });
    } catch (error) {
        logger.error('[SiteAccessRoutes] Error getting available sites:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available sites',
            error: error.message
        });
    }
});

// Grant access to existing sites
router.post('/grant-access', authenticateToken, async (req, res) => {
    try {
        const { userId, siteIds, siteType } = req.body;

        // Validate required fields
        if (!userId || !Array.isArray(siteIds) || !siteType) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                code: 'MISSING_FIELDS'
            });
        }

        // Validate site type
        try {
            validateSiteType(siteType);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'INVALID_SITE_TYPE'
            });
        }

        await addExistingSiteAccess(userId, siteIds, siteType);
        res.json({
            success: true,
            message: `Successfully granted ${siteType} site access`
        });
    } catch (error) {
        logger.error('[SiteAccessRoutes] Error granting site access:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to grant site access',
            error: error.message
        });
    }
});

// Update user's accessible sites when a new site is created
router.post('/update-site-access', authenticateToken, async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  const logContext = { requestId, userId: req.body.userId };
  
  try {
    let { userId, siteId, siteType } = req.body;
    logger.info(`[SiteAccess] [${requestId}] Received update-site-access request`, { 
      userId, 
      siteId: typeof siteId === 'string' ? siteId.substring(0, 10) + '...' : siteId,
      siteType 
    });

    // Validate required fields
    if (!userId || !siteId || !siteType) {
      const errorMsg = 'Missing required fields: userId, siteId, and siteType are required';
      logger.warn(`[SiteAccess] [${requestId}] ${errorMsg}`, { userId, hasSiteId: !!siteId, hasSiteType: !!siteType });
      return res.status(400).json({
        success: false,
        message: errorMsg,
        code: 'MISSING_FIELDS'
      });
    }

    // Validate site type
    try {
      validateSiteType(siteType);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_SITE_TYPE'
      });
    }

    // Parse site ID and company ID
    let companyId, siteIdToUse;
    
    // If siteId is in format "companyId_siteId"
    if (typeof siteId === 'string' && siteId.includes('_')) {
      [companyId, siteIdToUse] = siteId.split('_');
      logger.debug(`[SiteAccess] [${requestId}] Parsed combined siteId`, { companyId, siteId: siteIdToUse });
    } 
    // If companyId is provided separately in the request body
    else if (req.body.companyId) {
      companyId = req.body.companyId;
      siteIdToUse = siteId;
      logger.debug(`[SiteAccess] [${requestId}] Using separate companyId and siteId`, { companyId, siteId: siteIdToUse });
    } 
    // If we have a proper site object
    else if (typeof siteId === 'object' && siteId.companyId) {
      companyId = siteId.companyId;
      const siteIdKey = siteType === 'production' ? 'productionSiteId' : 'consumptionSiteId';
      siteIdToUse = siteId[siteIdKey] || siteId.siteId;
      logger.debug(`[SiteAccess] [${requestId}] Using site object`, { companyId, siteId: siteIdToUse });
    }
    else {
      const errorMsg = 'Invalid siteId format. Expected {companyId, productionSiteId/consumptionSiteId}, "companyId_siteId" or separate companyId and siteId';
      logger.error(`[SiteAccess] [${requestId}] ${errorMsg}`, { siteId });
      return res.status(400).json({
        success: false,
        message: errorMsg,
        code: 'INVALID_SITE_ID_FORMAT'
      });
    }
    
    // Ensure we have valid values
    if (!companyId || !siteIdToUse) {
      const errorMsg = 'Missing companyId or siteId';
      logger.error(`[SiteAccess] [${requestId}] ${errorMsg}`, { companyId, siteId: siteIdToUse });
      return res.status(400).json({
        success: false,
        message: errorMsg,
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Format the final site ID as companyId_siteId
    const formattedSiteId = `${companyId}_${siteIdToUse}`;

    // Update the user's accessible sites
    logger.info(`[SiteAccess] [${requestId}] Updating site access`, { 
      userId, 
      companyId, 
      siteId: siteIdToUse,
      formattedSiteId,
      siteType 
    });

    // Call the service with the formatted site ID
    const updatedUser = await updateUserSiteAccess(userId, companyId, siteIdToUse, siteType);
    
    logger.info(`[SiteAccess] [${requestId}] Successfully updated site access`, { 
      userId,
      accessibleSites: updatedUser.accessibleSites,
      updatedSiteId: formattedSiteId
    });

    res.json({
      success: true,
      message: 'Successfully updated user site access',
      user: updatedUser
    });
  } catch (error) {
    logger.error('[SiteAccessRoutes] Error updating user site access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user site access',
      error: error.message
    });
  }
});

module.exports = router;
