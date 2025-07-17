const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authorization');
const { getGraphicalAllocationReport } = require('./graphicalReportController');

// Get graphical allocation report data
router.get('/allocation', authenticateToken, getGraphicalAllocationReport);

module.exports = router;
