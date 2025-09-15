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
     
      const pk = `${companyId}_${productionSiteId}`;
      
      const response = await api.get(
        API_CONFIG.ENDPOINTS.PRODUCTION.UNIT.GET_ALL(companyId, productionSiteId)
      );
      
      const allData = Array.isArray(response.data) ? response.data : 
                     Array.isArray(response.data?.data) ? response.data.data : [];
      
      const formattedData = allData
        .filter(item => item.pk === pk)
        .map(item => {
          // Handle both old and new data formats
          const baseData = {
            ...item,
            date: stripUnitPrefix(item.sk),
            // Import C values
            import_c1: Number(item.import_c1 || 0),
            import_c2: Number(item.import_c2 || 0),
            import_c3: Number(item.import_c3 || 0),
            import_c4: Number(item.import_c4 || 0),
            import_c5: Number(item.import_c5 || 0),
            import_total: Number(item.import_total || 0),
            // Export C values
            export_c1: Number(item.export_c1 || 0),
            export_c2: Number(item.export_c2 || 0),
            export_c3: Number(item.export_c3 || 0),
            export_c4: Number(item.export_c4 || 0),
            export_c5: Number(item.export_c5 || 0),
            export_total: Number(item.export_total || 0),
            // Net export C values
            net_export_c1: Number(item.net_export_c1 || 0),
            net_export_c2: Number(item.net_export_c2 || 0),
            net_export_c3: Number(item.net_export_c3 || 0),
            net_export_c4: Number(item.net_export_c4 || 0),
            net_export_c5: Number(item.net_export_c5 || 0),
            net_export_total: Number(item.net_export_total || 0)
          };

          // Backward compatibility for old data
          if (item.c1 !== undefined) {
            baseData.c1 = Number(item.c1 || 0);
            baseData.c2 = Number(item.c2 || 0);
            baseData.c3 = Number(item.c3 || 0);
            baseData.c4 = Number(item.c4 || 0);
            baseData.c5 = Number(item.c5 || 0);
            baseData.total = Number(item.total || 0);
          }

          return baseData;
        });

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

      // Ensure all C values are numbers with default 0
      const importC1 = Number(data.import_c1 || 0);
      const importC2 = Number(data.import_c2 || 0);
      const importC3 = Number(data.import_c3 || 0);
      const importC4 = Number(data.import_c4 || 0);
      const importC5 = Number(data.import_c5 || 0);
      const importTotal = importC1 + importC2 + importC3 + importC4 + importC5;

      const exportC1 = Number(data.export_c1 || 0);
      const exportC2 = Number(data.export_c2 || 0);
      const exportC3 = Number(data.export_c3 || 0);
      const exportC4 = Number(data.export_c4 || 0);
      const exportC5 = Number(data.export_c5 || 0);
      const exportTotal = exportC1 + exportC2 + exportC3 + exportC4 + exportC5;

      const unitData = {
        ...data,
        pk,
        sk,
        companyId: String(companyId),
        productionSiteId: String(productionSiteId),
        type: 'UNIT',
        // Import C values
        import_c1: importC1,
        import_c2: importC2,
        import_c3: importC3,
        import_c4: importC4,
        import_c5: importC5,
        import_total: importTotal,
        // Export C values
        export_c1: exportC1,
        export_c2: exportC2,
        export_c3: exportC3,
        export_c4: exportC4,
        export_c5: exportC5,
        export_total: exportTotal,
        // Net export C values
        net_export_c1: exportC1 - importC1,
        net_export_c2: exportC2 - importC2,
        net_export_c3: exportC3 - importC3,
        net_export_c4: exportC4 - importC4,
        net_export_c5: exportC5 - importC5,
        net_export_total: exportTotal - importTotal,
        // Timestamps
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