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
      const response = await api.get(API_CONFIG.ENDPOINTS.USER.GET_ACCESSIBLE_SITES);
      
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || 'Failed to fetch accessible sites');
      }

      // Transform the response to match the expected format
      return {
        productionSites: response.data.data?.productionSites || [],
        consumptionSites: response.data.data?.consumptionSites || []
      };
    } catch (error) {
      console.error('Error fetching accessible sites:', error);
      return handleApiError(error);
    }
  }
}

const userService = new UserService();
export default userService;
