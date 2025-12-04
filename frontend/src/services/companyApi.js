import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

class CompanyApi {
    // Get all companies
    async getAll() {
        try {
            console.log('Fetching all companies from:', `${API_CONFIG.BASE_URL}/company/`);
            const response = await api.get(`${API_CONFIG.BASE_URL}/company/`);
            console.log('Companies response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error fetching companies:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }
    }

    // Get a single company by ID
    async getById(companyId) {
        try {
            console.log(`Fetching company ${companyId} from:`, `${API_CONFIG.BASE_URL}/company/id/${companyId}`);
            const response = await api.get(`${API_CONFIG.BASE_URL}/company/id/${companyId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching company ${companyId}:`, {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }
    }

    // Create a new company
    async create(companyData) {
        try {
            const response = await api.post(`${API_CONFIG.BASE_URL}/company`, companyData);
            return response.data;
        } catch (error) {
            console.error('Error creating company:', error);
            throw error;
        }
    }

    // Update an existing company
    async update(companyId, companyData) {
        try {
            const response = await api.put(`${API_CONFIG.BASE_URL}/company/${companyId}`, companyData);
            return response.data;
        } catch (error) {
            console.error(`Error updating company ${companyId}:`, error);
            throw error;
        }
    }

    // Delete a company
    async delete(companyId) {
        try {
            const response = await api.delete(`${API_CONFIG.BASE_URL}/company/${companyId}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting company ${companyId}:`, error);
            throw error;
        }
    }

    // Check if company has production or consumption sites
    async checkSites(companyId) {
        try {
            console.log(`[CompanyAPI] Checking sites for company ID: ${companyId}`);
            const response = await api.get(`${API_CONFIG.BASE_URL}/company/check-sites/${companyId}`);
            console.log(`[CompanyAPI] Sites check response:`, response.data);
            return response.data;
        } catch (error) {
            console.error(`[CompanyAPI] Error checking sites for company ${companyId}:`, {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Get generator companies only
    async getGeneratorCompanies() {
        try {
            console.log('Fetching generator companies from:', `${API_CONFIG.BASE_URL}/company/generators`);
            const response = await api.get(`${API_CONFIG.BASE_URL}/company/generators`);
            return response.data;
        } catch (error) {
            console.error('Error fetching generator companies:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }
    }

    // Get shareholder companies only
    async getShareholderCompanies() {
        try {
            console.log('Fetching shareholder companies from:', `${API_CONFIG.BASE_URL}/company/shareholders`);
            const response = await api.get(`${API_CONFIG.BASE_URL}/company/shareholders`);
            return response.data;
        } catch (error) {
            console.error('Error fetching shareholder companies:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers
                }
            });
            throw error;
        }
    }
}

const companyApi = new CompanyApi();
export default companyApi;
