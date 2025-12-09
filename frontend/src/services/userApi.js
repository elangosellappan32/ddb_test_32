import api from './api';

class UserApi {
  /**
   * Get all users
   * @returns {Promise} Response containing all users
   */
  async getAll() {
    try {
      const response = await api.get('/user/all');
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error fetching all users:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   * @param {string} username - Username to retrieve
   * @returns {Promise} Response containing user data
   */
  async getByUsername(username) {
    try {
      const response = await api.get(`/user/${username}`);
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error fetching user:', error);
      throw error;
    }
  }

  /**
   * Get current user (me)
   * @returns {Promise} Response containing current user data
   */
  async getCurrentUser() {
    try {
      const response = await api.get('/user/me');
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error fetching current user:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data (username, email, password, roleId, etc.)
   * @returns {Promise} Response containing created user data
   */
  async create(userData) {
    try {
      const response = await api.post('/user', userData);
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update an existing user
   * @param {string} username - Username to update
   * @param {Object} updateData - Data to update
   * @returns {Promise} Response containing updated user data
   */
  async update(username, updateData) {
    try {
      const response = await api.put(`/user/${username}`, updateData);
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   * @param {string} username - Username to delete
   * @returns {Promise} Response confirming deletion
   */
  async delete(username) {
    try {
      const response = await api.delete(`/user/${username}`);
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get all companies
   * @returns {Promise} Response containing all companies
   */
  async getCompanies() {
    try {
      console.log('Fetching companies from /api/company');
      const response = await api.get('/company');
      console.log('Companies API response status:', response.status);
      console.log('Companies API response data:', response.data);
      console.log('Companies API response success:', response.data?.success);
      console.log('Companies API response data array:', response.data?.data);
      
      // Log each company if we have them
      if (response.data?.data && Array.isArray(response.data.data)) {
        console.log('Number of companies received:', response.data.data.length);
        response.data.data.forEach((company, index) => {
          console.log(`Company ${index + 1}: ID=${company.companyId}, Name=${company.companyName}`);
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error fetching companies:', error.response?.status, error.response?.data);
      // If authentication fails, try to get companies from user data
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('Authentication failed, using fallback method');
        // Return empty array, will be handled by frontend
        return { data: [] };
      }
      throw error;
    }
  }

  /**
   * Get all roles
   * @returns {Promise} Response containing all roles
   */
  async getRoles() {
    try {
      const response = await api.get('/roles/all');
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error fetching roles:', error);
      throw error;
    }
  }

  /**
   * Get accessible sites for current user
   * @returns {Promise} Response containing accessible sites
   */
  async getAccessibleSites() {
    try {
      const response = await api.get('/user/accessible-sites');
      return response.data;
    } catch (error) {
      console.error('[UserApi] Error fetching accessible sites:', error);
      throw error;
    }
  }
}

const userApi = new UserApi();
export default userApi;
