import api, { handleApiError } from './apiUtils';
import { API_CONFIG } from '../config/api.config';

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
    console.error('[BankingAPI] Date format error:', error);
    throw new Error('Invalid date format. Expected YYYY-MM or MMYYYY');
  }
};

const formatBankingData = (data) => ({
  ...data,
  c1: Number(data.c1 || 0),
  c2: Number(data.c2 || 0),
  c3: Number(data.c3 || 0),
  c4: Number(data.c4 || 0),
  c5: Number(data.c5 || 0),
  banking: Number(data.banking || 0),
  version: Number(data.version || 1),
  total: Number(data.c1 || 0) + 
         Number(data.c2 || 0) + 
         Number(data.c3 || 0) + 
         Number(data.c4 || 0) + 
         Number(data.c5 || 0)
});

const bankingApi = {
  fetchAll: async () => {
    try {
      console.log('[BankingAPI] Fetching all banking records');
      const response = await api.get(API_CONFIG.ENDPOINTS.BANKING.GET_ALL);
      return {
        data: Array.isArray(response.data?.data) 
          ? response.data.data.map(formatBankingData) 
          : []
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  fetchOne: async (pk, sk) => {
    try {
      console.log('[BankingAPI] Fetching banking record:', { pk, sk });
      const response = await api.get(API_CONFIG.ENDPOINTS.BANKING.GET_ONE(pk, sk));
      return {
        data: formatBankingData(response.data)
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  fetchByPeriod: async (period, companyId) => {
    try {
      const formattedPeriod = formatDateToMMYYYY(period);
      let url = `${API_CONFIG.BASE_URL}/banking?period=${formattedPeriod}`;
      
      if (companyId) {
        url += `&companyId=${companyId}`;
      }
      
      const response = await api.get(url);
      
      // Transform the response to match the expected format
      const data = response.data?.data || [];
      return {
        data: data.map(item => formatBankingData(item)),
        error: null
      };
    } catch (error) {
      console.error('[BankingAPI] Error fetching by period:', error);
      throw handleApiError(error);
    }
  },

  create: async (data) => {
    try {
      // Flatten allocated fields if present (for compatibility with backend)
      let bankingData = {
        ...data,
        sk: formatDateToMMYYYY(data.date),
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      };
      if (data.allocated) {
        bankingData = { ...bankingData, ...data.allocated };
        delete bankingData.allocated;
      }
      const response = await api.post(API_CONFIG.ENDPOINTS.BANKING.CREATE, bankingData);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  update: async (pk, sk, data) => {
    try {
      const response = await api.put(
        API_CONFIG.ENDPOINTS.BANKING.UPDATE(pk, sk),
        {
          ...data,
          updatedat: new Date().toISOString()
        }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  delete: async (pk, sk) => {
    try {
      console.log('[BankingAPI] Deleting banking record:', { pk, sk });
      const response = await api.delete(API_CONFIG.ENDPOINTS.BANKING.DELETE(pk, sk));
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default bankingApi;