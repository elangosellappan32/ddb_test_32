import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';
import { format } from 'date-fns';
import { formatSK } from '../utils/dateUtils';

const productionChargeApi = {
  fetchAll: async (companyId, productionSiteId) => {
    try {
      console.log('[ProductionChargeAPI] Fetching all charges:', { companyId, productionSiteId });
      const response = await api.get(
        API_CONFIG.ENDPOINTS.PRODUCTION.CHARGE.GET_ALL(companyId, productionSiteId)
      );
      return {
        success: true,
        data: Array.isArray(response.data.data) ? response.data.data : [],
        message: response.data.message
      };
    } catch (error) {
      console.error('[ProductionChargeAPI] Fetch Error:', error);
      throw error;
    }
  },

  create: async (companyId, productionSiteId, data) => {
    try {
      if (!data.date) {
        throw new Error('Date is required');
      }

      const sk = formatSK(data.date);
      if (!sk) {
        throw new Error('Invalid date format');
      }

      const payload = {
        pk: `${companyId}_${productionSiteId}`,
        sk,
        date: format(new Date(data.date), 'yyyy-MM-dd'),
        version: 1,
        updatedat: new Date().toISOString(),
        ...Object.keys(data)
          .filter(key => key.startsWith('c'))
          .reduce((acc, key) => ({
            ...acc,
            [key]: Number(data[key]) || 0
          }), {})
      };

      console.log('[ProductionChargeAPI] Creating charge with payload:', payload);
      
      const response = await api.post(
        API_CONFIG.ENDPOINTS.PRODUCTION.CHARGE.CREATE(companyId, productionSiteId),
        payload
      );
      return response.data;
    } catch (error) {
      console.error('[ProductionChargeAPI] Create Error:', error);
      throw error;
    }
  },

  update: async (companyId, productionSiteId, sk, data) => {
    try {
      if (!sk) {
        throw new Error('Sort key (sk) is required for updates');
      }

      // Don't modify the sk during update
      const payload = {
        pk: `${companyId}_${productionSiteId}`,
        sk,
        updatedat: new Date().toISOString(),
        version: Number(data.version || 1) + 1,
        ...Object.keys(data)
          .filter(key => key.startsWith('c'))
          .reduce((acc, key) => ({
            ...acc,
            [key]: Number(data[key]) || 0
          }), {})
      };

      console.log('[ProductionChargeAPI] Updating charge with payload:', payload);

      const response = await api.put(
        API_CONFIG.ENDPOINTS.PRODUCTION.CHARGE.UPDATE(companyId, productionSiteId, sk),
        payload
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  delete: async (companyId, productionSiteId, sk) => {
    try {
      if (!sk) {
        throw new Error('Sort key (sk) is required for deletion');
      }

      const response = await api.delete(
        API_CONFIG.ENDPOINTS.PRODUCTION.CHARGE.DELETE(companyId, productionSiteId, sk)
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default productionChargeApi;