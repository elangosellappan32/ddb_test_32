const express = require('express');
const router = express.Router();
const productionSiteController = require('./productionSiteController');
const validateSiteAccess = require('../middleware/validateSiteAccess');
const { authenticateToken } = require('../middleware/authorization');

// GET all production sites
router.get('/all', 
    authenticateToken,
    productionSiteController.getAllProductionSites
);

// GET production site by IDs - No auth required for details page
router.get('/:companyId/:productionSiteId', 
    productionSiteController.getProductionSite
);

// CREATE new production site
router.post('/', 
    authenticateToken,
    productionSiteController.createProductionSite
);

// UPDATE production site
router.put('/:companyId/:productionSiteId', 
    authenticateToken,
    validateSiteAccess('production'),
    productionSiteController.updateProductionSite
);

// DELETE production site
router.delete('/:companyId/:productionSiteId', 
    authenticateToken,
    validateSiteAccess('production'),
    productionSiteController.deleteProductionSite);

module.exports = router;
