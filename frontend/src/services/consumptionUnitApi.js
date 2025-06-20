import api, { handleApiError } from './apiUtils';
import { API_CONFIG } from '../config/api.config';

const generatePK = (companyId, consumptionSiteId) => `${companyId}_${consumptionSiteId}`;

const formatDateToMMYYYY = (dateString) => {
  try {
    if (!dateString) {
      const date = new Date();
      return `${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`;
    }
    
    // If already in MMYYYY format
    if (dateString.length === 6 && !dateString.includes('-')) {
      const month = parseInt(dateString.substring(0, 2));
      if (month >= 1 && month <= 12) {
        return dateString;
      }
      throw new Error('Invalid month value in MMYYYY format');
    }
    
    // Handle YYYY-MM format
    if (dateString.includes('-')) {
      const [yearStr, monthStr] = dateString.split('-');
      if (!yearStr || !monthStr || yearStr.length !== 4) {
        throw new Error('Invalid YYYY-MM format');
      }
      return `${monthStr}${yearStr}`;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    return `${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`;
  } catch (error) {
    console.error('[ConsumptionUnitAPI] Date format error:', error);
    throw new Error('Invalid date format. Expected YYYY-MM or MMYYYY');
  }
};

const stripUnitPrefix = (sk) => {
  return sk.startsWith('UNIT#') ? sk.substring(5) : sk;
};

const consumptionUnitApi = {
  fetchAll: async (companyId, consumptionSiteId) => {
    try {
      const pk = generatePK(companyId, consumptionSiteId);
      
      const response = await api.get(
        API_CONFIG.ENDPOINTS.CONSUMPTION.UNIT.GET_ALL(companyId, consumptionSiteId)
      );
      
      const allData = Array.isArray(response.data) ? response.data : 
                     Array.isArray(response.data?.data) ? response.data.data : [];
      
      const formattedData = allData
        .filter(item => item.pk === pk)
        .map(item => ({
          ...item,
          date: stripUnitPrefix(item.sk),
          c1: Number(item.c1 || 0),
          c2: Number(item.c2 || 0),
          c3: Number(item.c3 || 0),
          c4: Number(item.c4 || 0),
          c5: Number(item.c5 || 0),
          total: Number(item.total || 0)
        }));

      return { data: formattedData };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  fetchOne: async (companyId, consumptionSiteId, sk) => {
    try {
      console.log('[ConsumptionUnitAPI] Fetching unit:', { companyId, consumptionSiteId, sk });
      const response = await api.get(
        API_CONFIG.ENDPOINTS.CONSUMPTION.UNIT.GET_ONE(companyId, consumptionSiteId, sk)
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  create: async (companyId, consumptionSiteId, data) => {
    try {
      const sk = formatDateToMMYYYY(data.date);
      const pk = generatePK(companyId, consumptionSiteId);
      const unitData = {
        ...data,
        pk,
        sk,
        companyId: String(companyId),
        consumptionSiteId: String(consumptionSiteId),
        type: 'UNIT',
        version: 1,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };

      console.log('[ConsumptionUnitAPI] Creating unit:', unitData);
      const response = await api.post(
        API_CONFIG.ENDPOINTS.CONSUMPTION.UNIT.CREATE(companyId, consumptionSiteId),
        unitData
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  update: async (companyId, consumptionSiteId, sk, data) => {
    try {
      if (!sk) {
        throw new Error('Sort key (sk) is required for updates');
      }

      const pk = generatePK(companyId, consumptionSiteId);
      const updateData = {
        pk,
        sk,
        companyId: String(companyId),
        consumptionSiteId: String(consumptionSiteId),
        type: 'UNIT',
        version: (data.version || 0) + 1,
        updatedat: new Date().toISOString(),
        c1: Number(data.c1 || 0),
        c2: Number(data.c2 || 0),
        c3: Number(data.c3 || 0),
        c4: Number(data.c4 || 0),
        c5: Number(data.c5 || 0)
      };

      console.log('[ConsumptionUnitAPI] Updating unit:', updateData);
      const response = await api.put(
        API_CONFIG.ENDPOINTS.CONSUMPTION.UNIT.UPDATE(companyId, consumptionSiteId, sk),
        updateData
      );
      return response.data;
    } catch (error) {
      console.error('[ConsumptionUnitAPI] Update Error:', error);
      throw handleApiError(error);
    }
  },

  delete: async (companyId, consumptionSiteId, sk) => {
    try {
      const cleanSk = stripUnitPrefix(sk);
      console.log('[ConsumptionUnitAPI] Deleting unit:', { 
        companyId, 
        consumptionSiteId, 
        sk: cleanSk 
      });
      
      const response = await api.delete(
        API_CONFIG.ENDPOINTS.CONSUMPTION.UNIT.DELETE(companyId, consumptionSiteId, cleanSk)
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default consumptionUnitApi;