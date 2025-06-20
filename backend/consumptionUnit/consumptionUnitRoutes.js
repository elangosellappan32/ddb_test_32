const express = require('express');
const router = express.Router();
const consumptionUnitController = require('./consumptionUnitController');
const validateConsumptionUnit = require('./ConsumptionUnitvalidator');

// All get operations do not require auth for details views
router.post('/:companyId/:consumptionSiteId', validateConsumptionUnit, consumptionUnitController.createConsumptionUnit);

// Get all consumption units for a site
router.get('/:companyId/:consumptionSiteId/all', consumptionUnitController.getAllConsumptionUnits);

// Get consumption unit by ID
router.get('/:companyId/:consumptionSiteId/:sk', consumptionUnitController.getConsumptionUnit);

// Update consumption unit
router.put('/:companyId/:consumptionSiteId/:sk', validateConsumptionUnit, consumptionUnitController.updateConsumptionUnit);

// Delete consumption unit
router.delete('/:companyId/:consumptionSiteId/:sk', consumptionUnitController.deleteConsumptionUnit);

module.exports = router;