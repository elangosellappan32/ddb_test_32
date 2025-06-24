import api from './api';
import { API_CONFIG } from '../config/api.config';
import { handleApiError } from '../utils/errorHandlers';

class UserService {
  constructor() {
    this.getUserAccessibleSites = this.getUserAccessibleSites.bind(this);
  }

  /**
   * Fetches accessible sites for the current user
   * @returns {Promise<Object>} Object containing accessible production and consumption sites
   */
  async getUserAccessibleSites() {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.USER.GET_ACCESSIBLE_SITES;
      console.log('[UserService] Fetching accessible sites from:', endpoint);
      
      // Get auth token for debugging
      const token = localStorage.getItem('auth_token');
      console.log('[UserService] Auth token present:', !!token);
      
      const response = await api.get(endpoint);
      
      console.log('[UserService] Received accessible sites response:', {
        status: response.status,
        data: response.data,
        headers: response.headers
      });
      
      if (!response?.data?.success) {
        const errorMsg = response?.data?.message || 'Failed to fetch accessible sites';
        const errorCode = response?.data?.code || 'UNKNOWN_ERROR';
        
        console.error('[UserService] Error in response:', {
          message: errorMsg,
          code: errorCode,
          status: response.status,
          requestId: response.data?.requestId
        });
        
        // Handle specific error codes
        if (errorCode === 'INVALID_USER_ID' || errorCode === 'AUTH_REQUIRED') {
          // Clear invalid auth data and reload
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          window.location.href = '/login';
          return { productionSites: [], consumptionSites: [] };
        }
        
        throw new Error(`${errorMsg} (${errorCode})`);
      }

      // Ensure we have valid arrays for both site types
      const productionSites = Array.isArray(response.data.data?.productionSites) 
        ? response.data.data.productionSites 
        : [];
        
      const consumptionSites = Array.isArray(response.data.data?.consumptionSites)
        ? response.data.data.consumptionSites
        : [];

      console.log(`[UserService] Found ${productionSites.length} production sites and ${consumptionSites.length} consumption sites`);
      
      return {
        productionSites,
        consumptionSites,
        requestId: response.data.requestId // Include request ID for debugging
      };
    } catch (error) {
      console.error('[UserService] Error in getUserAccessibleSites:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
      
      // Handle 400 Bad Request specifically
      if (error.response?.status === 400) {
        const errorData = error.response?.data || {};
        console.error('[UserService] Bad Request:', errorData);
        
        // If it's an invalid user ID error, clear auth and redirect to login
        if (errorData.code === 'INVALID_USER_ID' || errorData.message?.includes('user ID')) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          window.location.href = '/login';
        }
      }
      
      // Return empty arrays for 404 or other errors
      if (error.response?.status === 404) {
        console.warn('[UserService] Accessible sites endpoint not found, returning empty arrays');
        return {
          productionSites: [],
          consumptionSites: []
        };
      }
      
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }
}

const userService = new UserService();
export default userService;
