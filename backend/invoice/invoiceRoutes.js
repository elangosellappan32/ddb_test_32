const express = require('express');
const router = express.Router();
const invoiceController = require('./invoiceController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Generate a new invoice
router.post('/generate', authenticateToken, invoiceController.generateInvoice);

// Get invoice by ID
router.get('/:invoiceId', authenticateToken, invoiceController.getInvoice);

// Get all invoices for a company
router.get('/', authenticateToken, (req, res) => {
  // This would be implemented to return all invoices for the authenticated company
  res.status(200).json({
    success: true,
    data: [],
    message: 'List of invoices will be returned here'
  });
});

module.exports = router;
