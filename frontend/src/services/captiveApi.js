import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

class CaptiveApi {
    // Get all captive entries
    async getAll() {
        try {
            const response = await api.get(`${API_CONFIG.BASE_URL}/captive`);
            return response.data;
        } catch (error) {
            console.error('Error fetching captive entries:', error);
            throw error;
        }
    }

    // Get captive entries by generator company ID
    async getByGeneratorCompanyId(generatorCompanyId) {
        try {
            const response = await api.get(`${API_CONFIG.BASE_URL}/captive/generator/${generatorCompanyId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching captive entries for generator company ${generatorCompanyId}:`, error);
            throw error;
        }
    }

    // Get captive entries by shareholder company ID
    async getByShareholderCompanyId(shareholderCompanyId) {
        try {
            const response = await api.get(`${API_CONFIG.BASE_URL}/captive/shareholder/${shareholderCompanyId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching captive entries for shareholder company ${shareholderCompanyId}:`, error);
            throw error;
        }
    }

    // Get a specific captive entry
    async getCaptiveEntry(generatorCompanyId, shareholderCompanyId) {
        try {
            const response = await api.get(`${API_CONFIG.BASE_URL}/captive/${generatorCompanyId}/${shareholderCompanyId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching captive entry for generator ${generatorCompanyId} and shareholder ${shareholderCompanyId}:`, error);
            throw error;
        }
    }

    // Create a new captive entry
    async create(captiveData) {
        try {
            const response = await api.post(`${API_CONFIG.BASE_URL}/captive`, captiveData);
            return response.data;
        } catch (error) {
            console.error('Error creating captative:', error);
            throw error;
        }
    }

    // Update an existing captive entry
    async update(generatorCompanyId, shareholderCompanyId, updateData) {
        try {
            const response = await api.put(
                `${API_CONFIG.BASE_URL}/captive/${generatorCompanyId}/${shareholderCompanyId}`,
                updateData
            );
            return response.data;
        } catch (error) {
            console.error(`Error updating captive entry for generator ${generatorCompanyId} and shareholder ${shareholderCompanyId}:`, error);
            throw error;
        }
    }

    // Delete a captive entry
    async delete(generatorCompanyId, shareholderCompanyId) {
        try {
            const response = await api.delete(
                `${API_CONFIG.BASE_URL}/captive/${generatorCompanyId}/${shareholderCompanyId}`
            );
            return response.data;
        } catch (error) {
            console.error(`Error deleting captive entry for generator ${generatorCompanyId} and shareholder ${shareholderCompanyId}:`, error);
            throw error;
        }
    }

    // Get captives by period
    async getByPeriod(generatorCompanyId, period) {
        try {
            const response = await api.get(
                `${API_CONFIG.BASE_URL}/captive/period/${generatorCompanyId}/${period}`
            );
            return response.data;
        } catch (error) {
            console.error(`Error fetching captives for period ${period}:`, error);
            throw error;
        }
    }
}

const captiveApi = new CaptiveApi();
export default captiveApi;
