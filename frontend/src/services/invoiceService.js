import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';
import { enqueueSnackbar } from 'notistack';

class InvoiceService {
  /**
   * Generate an invoice for the given month and year
   * @param {Object} params - Invoice generation parameters
   * @param {string} params.companyId - Company ID
   * @param {string} params.month - Month in MM format
   * @param {string} params.year - Year in YYYY format
   * @param {Array} params.allocations - Array of allocation records
   * @param {Array} params.charges - Array of charge records
   * @returns {Promise<Object>} Generated invoice data
   */
  async generateInvoice({ companyId, productionSiteId, month, year, allocations = [], charges = [] }) {
    try {
      console.log('Generating invoice with data:', { companyId, month, year });
      
      // Validate and format the request data
      if (!companyId || !productionSiteId || month === undefined || year === undefined) {
        throw new Error('Missing required parameters: companyId, productionSiteId, month, and year are required');
      }

      // Ensure month is a string and properly formatted as MM
      const formattedMonth = String(month).padStart(2, '0');
      const formattedYear = String(year);
      
      // Ensure allocations and charges are arrays
      const formattedAllocations = Array.isArray(allocations) ? allocations : [];
      const formattedCharges = Array.isArray(charges) ? charges : [];

      // Prepare the request payload
      const payload = {
        companyId: String(companyId),
        productionSiteId: String(productionSiteId),
        month: formattedMonth,
        year: formattedYear,
        allocations: formattedAllocations,
        charges: formattedCharges
      };

      console.log('Sending invoice generation request with payload:', payload);
      console.log('API Endpoint:', API_CONFIG.ENDPOINTS.INVOICE.GENERATE);
      const response = await api.post(API_CONFIG.ENDPOINTS.INVOICE.GENERATE, payload);
      
      if (!response.data) {
        throw new Error('No data received from server');
      }

      console.log('Invoice generated successfully:', response.data);
      return { 
        success: true, 
        data: response.data,
        message: 'Invoice generated successfully'
      };
    } catch (error) {
      console.error('Error in generateInvoice:', {
        message: error.message,
        response: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        },
        stack: error.stack
      });
      
      // Show error to user
      enqueueSnackbar(error.response?.data?.message || 'Failed to generate invoice', { 
        variant: 'error' 
      });
      
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to generate invoice',
        details: error.response?.data
      };
    }
  }

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice data
   */
  async getInvoice(invoiceId) {
    try {
      const response = await api.get(`${API_CONFIG.ENDPOINTS.INVOICE.BASE}/${invoiceId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to fetch invoice' 
      };
    }
  }

  /**
   * Get all invoices for a company
   * @param {string} companyId - Company ID
   * @returns {Promise<Object>} List of invoices
   */
  async getInvoices(companyId) {
    try {
      const response = await api.get(API_CONFIG.ENDPOINTS.INVOICE.BASE, { 
        params: { companyId } 
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to fetch invoices' 
      };
    }
  }
}

export default new InvoiceService();
