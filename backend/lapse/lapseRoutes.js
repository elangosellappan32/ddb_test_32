const express = require('express');
const router = express.Router();
const lapseController = require('./lapseController');
const validateLapse = require('./Lapsevalidator');
const validateJson = require('../middleware/validateJson');

// Get all lapse records
router.get('/', lapseController.getAllLapse);

// Get all lapses for a specific PK (companyId_productionSiteId)
router.get('/:pk', lapseController.getLapsesByPk);

// Get specific lapse record
router.get('/:pk/:sk', lapseController.getLapse);

// Create lapse record
router.post('/', validateJson, validateLapse, lapseController.createLapse);

// Update lapse record
router.put('/:pk/:sk', validateJson, validateLapse, lapseController.updateLapse);

// Delete lapse record
router.delete('/:pk/:sk', lapseController.deleteLapse);

module.exports = router;