const express = require('express');
const captiveController = require('./captiveController');

const router = express.Router();

// Add cache control middleware to all routes
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Get all Captive entries
router.get('/', captiveController.getAllCaptives);

// Get Captive entries by Generator Company ID
router.get('/generator/:id', captiveController.getCaptivesByGenerator);

// Get allocation percentages for a company
router.get('/allocations/:companyId', captiveController.getAllocationPercentages);

// Get specific Captive entry by generator and shareholder company IDs
router.get('/:generatorCompanyId/:shareholderCompanyId', captiveController.getCaptiveByCompanies);

// Create new captive entry
router.post('/', captiveController.createCaptive);

// Update existing captive entry
router.put('/:generatorCompanyId/:shareholderCompanyId', captiveController.updateCaptive);

// Bulk update multiple captive entries
router.post('/update-bulk', captiveController.bulkUpdateCaptives);

// Delete a captive entry
router.delete('/:generatorCompanyId/:shareholderCompanyId', captiveController.deleteCaptive);

module.exports = router;
