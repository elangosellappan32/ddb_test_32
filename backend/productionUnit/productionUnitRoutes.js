const express = require('express');
const router = express.Router();
const productionUnitController = require('./productionUnitController');

// Get all production units for a site - No auth for details
router.get('/:companyId/:productionSiteId/all', productionUnitController.getAllProductionUnits);

// Get production unit by ID
router.get('/:companyId/:productionSiteId/:sk', productionUnitController.getProductionUnit);

// Create production unit
router.post('/:companyId/:productionSiteId', productionUnitController.createProductionUnit);

// Update production unit
router.put('/:companyId/:productionSiteId/:sk', productionUnitController.updateProductionUnit);

// Delete production unit
router.delete('/:companyId/:productionSiteId/:sk', productionUnitController.deleteProductionUnit);

module.exports = router;