import api, { handleApiError } from './apiUtils';
import { API_CONFIG } from '../config/api.config';

const formatLapseData = (data) => ({
  ...data,
  c1: Number(data.c1 || 0),
  c2: Number(data.c2 || 0),
  c3: Number(data.c3 || 0),
  c4: Number(data.c4 || 0),
  c5: Number(data.c5 || 0),
  version: Number(data.version || 1),
  total: Number(data.c1 || 0) + 
         Number(data.c2 || 0) + 
         Number(data.c3 || 0) + 
         Number(data.c4 || 0) + 
         Number(data.c5 || 0)
});

const lapseApi = {
  async fetchAllByPk(pk) {
    try {
      if (!pk) {
        throw new Error('Primary key (pk) is required');
      }
      
      const response = await api.get(API_CONFIG.ENDPOINTS.LAPSE.GET_ALL_BY_PK(encodeURIComponent(pk)));
      return response.data?.data || [];
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`[LapseAPI] No lapse records found for site ${pk}, returning empty array`);
        return [];
      }
      
      const errorMessage = error.response?.data?.message || 'Error fetching lapse records by PK';
      handleApiError(error);
      throw new Error(errorMessage);
    }
  },

  async fetchByPeriod(period, companyId) {
    try {
      const response = await api.get(API_CONFIG.ENDPOINTS.LAPSE.GET_BY_PERIOD(period, companyId));
      return {
        data: Array.isArray(response.data?.data) 
          ? response.data.data.map(formatLapseData) 
          : []
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },
  getLapsesByProductionSite: async (companyId, productionSiteId, fromMonth, toMonth) => {
    try {
      const pk = `${companyId}_${productionSiteId}`;
      const response = await api.get(API_CONFIG.ENDPOINTS.LAPSE.GET_ALL_BY_PK(pk));
      let lapses = Array.isArray(response.data?.data) ? response.data.data : [];
      
      // Filter by date range if provided
      if (fromMonth && toMonth) {
        lapses = lapses.filter(lapse => {
          return lapse.sk >= fromMonth && lapse.sk <= toMonth;
        });
      }
      
      return lapses.map(lapse => ({
        ...lapse,
        ...(lapse.allocated || {})
      }));
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`[LapseAPI] No lapses found for site ${productionSiteId}, returning empty array`);
        return [];
      }
      console.error('[LapseAPI] Error fetching lapses by production site:', error);
      throw error;
    }
  },
};

export default lapseApi;
