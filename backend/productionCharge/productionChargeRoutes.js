const express = require('express');
const router = express.Router();
const productionChargeController = require('./productionChargeController');
const validateJson = require('../middleware/validateJson');

// Get all charges for a company/site
router.get('/:companyId/:productionSiteId/all', productionChargeController.getAllCharges);

// Get single charge
router.get('/:companyId/:productionSiteId/:sk', productionChargeController.getCharge);

// Create new charge
router.post('/:companyId/:productionSiteId', validateJson, productionChargeController.createCharge);

// Update existing charge
router.put('/:companyId/:productionSiteId/:sk', validateJson, productionChargeController.updateCharge);

// Delete charge
router.delete('/:companyId/:productionSiteId/:sk', productionChargeController.deleteCharge);

module.exports = router;