const express = require('express');
const router = express.Router();
const consumptionSiteController = require('./consumptionSiteController');
const validateConsumptionSite = require('./ConsumptionSitevalidator');
const validateConsumptionSiteUpdate = require('./ConsumptionSiteUpdatevalidator');
const validateSiteAccess = require('../middleware/validateSiteAccess');
const { authenticateToken } = require('../middleware/authorization');

// Get all consumption sites
router.get('/all', 
    authenticateToken,
    consumptionSiteController.getAllConsumptionSites);

// Get specific consumption site - No auth required for details page
router.get('/:companyId/:consumptionSiteId', 
    consumptionSiteController.getConsumptionSite
);

// Create consumption site
router.post('/', 
    authenticateToken,
    validateConsumptionSite, 
    consumptionSiteController.createConsumptionSite);

// Update consumption site
router.put('/:companyId/:consumptionSiteId', 
    authenticateToken,
    validateSiteAccess('consumption'),
    validateConsumptionSiteUpdate, 
    consumptionSiteController.updateConsumptionSite
);

// Delete consumption site
router.delete('/:companyId/:consumptionSiteId', 
    authenticateToken,
    validateSiteAccess('consumption'),
    consumptionSiteController.deleteConsumptionSite
);

module.exports = router;
