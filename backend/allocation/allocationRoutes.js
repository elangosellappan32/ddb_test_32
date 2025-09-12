const express = require('express');
const router = express.Router();
const allocationController = require('./allocationController');
const validateAllocation = require('./allocationValidator');
const validateJson = require('../middleware/validatejson');

// Create single allocation
router.post('/', validateJson, validateAllocation, allocationController.createAllocation);

// Create batch allocations
router.post('/batch', validateJson, validateAllocation, allocationController.createAllocation);

// Get all allocations (for report page, no month filter)
router.get('/', allocationController.getAllAllocations);

// Get all allocations for a month
router.get('/month/:month', allocationController.getAllocations);

// Get charging allocation for a month
router.get('/month/:month/charging', allocationController.getChargingAllocation);

// Get all allocations for a month with charge filter
router.get('/month/:month/filtered', allocationController.getFilteredAllocations);

// Update allocation
router.put('/:pk/:sk', validateJson, validateAllocation, allocationController.updateAllocation);

// Delete allocation
router.delete('/:pk/:sk', allocationController.deleteAllocation);

module.exports = router;