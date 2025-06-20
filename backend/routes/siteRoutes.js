const express = require('express');
const router = express.Router();
const siteService = require('../services/siteService');
const { authenticateToken } = require('../middleware/auth');

// Create a new site
router.post('/:siteType', authenticateToken, async (req, res) => {
  try {
    const { siteType } = req.params;
    const siteData = req.body;
    
    // Validate site type
    if (!['production', 'consumption'].includes(siteType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid site type. Must be either production or consumption.'
      });
    }

    // Add user's company ID if not provided
    if (!siteData.companyId && req.user.companyId) {
      siteData.companyId = req.user.companyId;
    }

    const result = await siteService.createSite(siteData, siteType);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create site',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all sites for a company
router.get('/:siteType', authenticateToken, async (req, res) => {
  try {
    const { siteType } = req.params;
    const companyId = req.query.companyId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    const sites = await siteService.getSites(companyId, siteType);
    res.json({
      success: true,
      data: sites,
      count: sites.length
    });
  } catch (error) {
    console.error('Error getting sites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sites',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
