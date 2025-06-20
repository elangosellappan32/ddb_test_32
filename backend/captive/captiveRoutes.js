const express = require('express');
const captiveController = require('./captiveController');

const router = express.Router();

// Get all Captive entries
router.get('/', captiveController.getAllCaptives);

// Get Captive entries by Generator Company ID
router.get('/generator/:generatorCompanyId', captiveController.getCaptiveEntriesByGenerator);

// Get Captive entries by Shareholder Company ID
router.get('/shareholder/:shareholderCompanyId', captiveController.getCaptiveEntriesByShareholder);

// Get specific Captive entry
router.get('/:generatorCompanyId/:shareholderCompanyId', captiveController.getCaptiveEntry);

// Update existing Captive entry
router.put('/:generatorCompanyId/:shareholderCompanyId', captiveController.updateCaptiveEntry);

// Create new Captive entry
router.post('/', captiveController.createCaptiveEntry);

module.exports = router;
