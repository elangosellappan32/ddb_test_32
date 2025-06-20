import axios from 'axios';
import api, { handleApiError } from './apiUtils';
import { API_CONFIG } from '../config/api.config';

const generatePK = (companyId, productionSiteId) => `${companyId}_${productionSiteId}`;

const formatDateToMMYYYY = (dateString) => {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${year}`;
};

const stripUnitPrefix = (sk) => {
  return sk.startsWith('UNIT#') ? sk.substring(5) : sk;
};

const productionUnitApi = {
  fetchAll: async (companyId, productionSiteId) => {
    try {
      console.log('[ProductionUnitAPI] Fetching units for site:', { companyId, productionSiteId });
      const pk = `${companyId}_${productionSiteId}`;
      
      const response = await api.get(
        API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.GET_ALL(companyId, productionSiteId)
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
          c5: Number(item.c5 || 0)
        }));

      return { data: formattedData };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  fetchOne: async (companyId, productionSiteId, sk) => {
    try {
      console.log('[ProductionUnitAPI] Fetching unit:', { companyId, productionSiteId, sk });
      const response = await api.get(
        API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.GET_ONE(companyId, productionSiteId, sk)
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  create: async (companyId, productionSiteId, data) => {
    try {
      const pk = `${companyId}_${productionSiteId}`;
      const sk = formatDateToMMYYYY(data.date);  // Direct MMYYYY format without UNIT# prefix

      const unitData = {
        ...data,
        pk,
        sk,
        companyId: String(companyId),
        productionSiteId: String(productionSiteId),
        type: 'UNIT',
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };

      console.log('[ProductionUnitAPI] Creating unit:', unitData);
      const response = await api.post(
        API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.CREATE(companyId, productionSiteId),
        unitData
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  update: async (companyId, productionSiteId, sk, data) => {
    try {
      if (!sk) {
        throw new Error('Sort key (sk) is required for updates');
      }

      console.log('[ProductionUnitAPI] Updating unit:', {
        companyId,
        productionSiteId,
        sk,
        data
      });

      const response = await api.put(
        API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.UPDATE(companyId, productionSiteId, sk),
        data
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  delete: async (companyId, productionSiteId, sk) => {
    try {
      const pk = `${companyId}_${productionSiteId}`;
      const cleanSk = stripUnitPrefix(sk);
      
      const response = await api.delete(
        API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.DELETE(companyId, productionSiteId, cleanSk)
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default productionUnitApi;