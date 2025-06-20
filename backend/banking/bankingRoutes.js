const express = require('express');
const router = express.Router();
const bankingController = require('./bankingController');
const validateJson = require('../middleware/validateJson');
const validateBanking = require('./bankingValidator');
const logger = require('../utils/logger');

// Get all banking records
router.get('/', bankingController.getAllBanking);

// Get banking data
router.get('/data', bankingController.getBankingData);

// Get specific banking record
router.get('/:pk/:sk', bankingController.getBanking);

// Get banking by period
router.get('/:pk/period/:period', bankingController.queryBankingByPeriod);

// Create banking record
router.post('/', [validateJson, validateBanking], bankingController.createBanking);

// Update banking record
router.put('/:pk/:sk', [validateJson, validateBanking], bankingController.updateBanking);

// Delete banking record
router.delete('/:pk/:sk', bankingController.deleteBanking);

module.exports = router;