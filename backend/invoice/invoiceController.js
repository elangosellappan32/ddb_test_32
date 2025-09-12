const { v4: uuidv4 } = require('uuid');
const { processAllocations } = require('./invoiceCalculator');

class InvoiceController {
  /**
   * Generate an invoice for the given company, month, and year
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  /**
   * Get invoice configuration for a company
   * @param {string} companyId - Company ID
   * @returns {Object} Configuration object with unitPrice and taxRate
   */
  static getInvoiceConfig(companyId) {
    // TODO: Fetch these values from database/configuration service
    // This is a temporary implementation
    return {
      unitPrice: 6.0, // Default unit price, should be fetched from company settings
      taxRate: 0.18   // Default tax rate (18%), should be configurable
    };
  }

  async generateInvoice(req, res) {
    try {
      const { companyId, month, year, allocations = [], charges = [] } = req.body;

      // Validate input
      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: companyId, month, and year are required'
        });
      }

      // Get invoice configuration
      const { unitPrice, taxRate } = InvoiceController.getInvoiceConfig(companyId);

      // Process allocations and calculate invoice
      const invoiceData = await processAllocations({
        companyId,
        month,
        year,
        allocations,
        charges,
        unitPrice,
        taxRate
      });

      // Generate invoice number (you can customize this format)
      const invoiceNumber = `INV-${year}${month.toString().padStart(2, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;

      // Create invoice object
      const invoice = {
        invoiceId: uuidv4(),
        invoiceNumber,
        companyId,
        period: `${year}-${month.toString().padStart(2, '0')}`,
        issueDate: new Date().toISOString(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
        status: 'generated',
        ...invoiceData
      };

      // Here you would typically save the invoice to your database
      // await InvoiceModel.create(invoice);

      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Invoice generated successfully'
      });

    } catch (error) {
      console.error('Error generating invoice:', error);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate invoice',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Get invoice by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getInvoice(req, res) {
    try {
      const { invoiceId } = req.params;
      
      // Here you would typically fetch the invoice from your database
      // const invoice = await InvoiceModel.findById(invoiceId);
      
      // For now, we'll return a 404
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
      
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}

module.exports = new InvoiceController();
