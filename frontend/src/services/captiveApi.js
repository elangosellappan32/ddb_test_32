import api from './apiUtils';

class CaptiveApi {
    constructor() {
        this.BASE_URL = '/captive';
    }

    async getAll() {
        try {
            console.log('Fetching all captive entries');
            // Use the base URL with trailing slash to match backend route
            const response = await api.get(`${this.BASE_URL}/`);
            console.log('Captive response:', response);
            return response.data?.data || response.data || [];
        } catch (error) {
            console.error('Error in captiveApi.getAll:', error);
            throw error; // Let the caller handle the error
        }
    }

    async getByGenerator(generatorId) {
        try {
            console.log(`Fetching captive entries for generator: ${generatorId}`);
            // Use a relative path since baseURL already includes /api
            const response = await api.get(`/captive/generator/${generatorId}`);
            console.log('API Response:', response);
            return response.data?.data || response.data || [];
        } catch (error) {
            console.error(`Error fetching captive entries for generator ${generatorId}:`, error);
            if (error.response) {
                console.error('Error response data:', error.response.data);
                console.error('Error status:', error.response.status);
                console.error('Error headers:', error.response.headers);
            } else if (error.request) {
                console.error('Error request:', error.request);
            }
            return [];
        }
    }

    async getCaptiveEntry(generatorId, shareholderId) {
        try {
            console.log(`Fetching captive entry for generator ${generatorId} and shareholder ${shareholderId}`);
            // Use a relative URL without the leading slash to prevent double /api
            const endpoint = `captive/${generatorId}/${shareholderId}`;
            console.log('API Endpoint:', endpoint);
            const response = await api.get(endpoint);
            return response.data?.data || response.data || null;
        } catch (error) {
            console.error(`Error fetching captive entry for generator ${generatorId} and shareholder ${shareholderId}:`, error);
            if (error.response) {
                console.error('Error response data:', error.response.data);
                console.error('Error status:', error.response.status);
            }
            return null;
        }
    }

    async getShareholdings(companyId) {
        try {
            console.log(`Fetching shareholdings for company: ${companyId}`);
            // Use a relative URL without the leading slash to prevent double /api
            const endpoint = `captive/shareholdings/${companyId}`;
            console.log('API Endpoint:', endpoint);
            const response = await api.get(endpoint);
            return response.data?.data || response.data || [];
        } catch (error) {
            console.error(`Error fetching shareholdings for company ${companyId}:`, error);
            if (error.response) {
                console.error('Error response data:', error.response.data);
                console.error('Error status:', error.response.status);
            }
            throw error;
        }
    }

    async getByShareholder(shareholderId) {
        try {
            console.log(`Fetching captive entries for shareholder: ${shareholderId}`);
            // Get all entries and filter for the shareholder on the client side
            // since the backend no longer supports direct shareholder queries
            const response = await this.getAll();
            return response.filter(entry => entry.shareholderCompanyId === Number(shareholderId));
        } catch (error) {
            console.error(`Error fetching captive entries for shareholder ${shareholderId}:`, error);
            return [];
        }
    }

    async upsertCaptive(captiveData) {
        try {
            // Ensure required fields are present
            const requiredFields = [
                'generatorCompanyId',
                'shareholderCompanyId',
                'generatorCompanyName',
                'shareholderCompanyName',
                'allocationPercentage'
            ];

            // Check for missing fields
            const missingFields = requiredFields.filter(field => !captiveData[field]);
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            // Validate numeric fields
            if (!Number.isInteger(Number(captiveData.generatorCompanyId))) {
                throw new Error('Generator Company ID must be a valid integer');
            }

            if (!Number.isInteger(Number(captiveData.shareholderCompanyId))) {
                throw new Error('Shareholder Company ID must be a valid integer');
            }

            // Validate allocation percentage
            const allocationPercentage = Number(captiveData.allocationPercentage);
            if (isNaN(allocationPercentage) || allocationPercentage < 0 || allocationPercentage > 100) {
                throw new Error('Allocation percentage must be between 0 and 100');
            }

            // Convert company IDs and allocation percentage to numbers, ensure all fields are valid
            const data = {
                generatorCompanyId: Number(captiveData.generatorCompanyId),
                shareholderCompanyId: Number(captiveData.shareholderCompanyId),
                generatorCompanyName: String(captiveData.generatorCompanyName),
                shareholderCompanyName: String(captiveData.shareholderCompanyName),
                allocationPercentage: Number(captiveData.allocationPercentage),
                allocationStatus: captiveData.allocationStatus || 'active'
            };

            console.log('Creating captive entry with data:', data);
            const response = await api.post(`${this.BASE_URL}`, data);
            return response.data?.data || response.data;
        } catch (error) {
            console.error('Error creating captive entry:', error);
            throw error;
        }
    }

    async updateAllocationPercentage(generatorId, shareholderId, allocationPercentage) {
    try {
        // Validate IDs
        if (!generatorId || !shareholderId) {
            throw new Error('Generator ID and Shareholder ID are required');
        }

        // Convert to numbers and validate
        const genId = Number(generatorId);
        const shareId = Number(shareholderId);
        const percentage = Number(allocationPercentage);

        if (isNaN(genId) || isNaN(shareId) || isNaN(percentage)) {
            throw new Error('Invalid ID or percentage format');
        }

        if (percentage < 0 || percentage > 100) {
            throw new Error('Allocation percentage must be between 0 and 100');
        }

        console.log(`Updating allocation percentage for generator ${genId} and shareholder ${shareId} to ${percentage}%`);
        
        const response = await api.put(`${this.BASE_URL}/${genId}/${shareId}`, {
            allocationPercentage: percentage
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.data) {
            throw new Error('No data received from server');
        }

        return response.data.data || response.data;
    } catch (error) {
        console.error('Error in updateAllocationPercentage:', {
            generatorId,
            shareholderId,
            allocationPercentage,
            error: error.response?.data || error.message
        });
        throw error;
    }
}

    async deleteCaptiveEntry(generatorId, shareholderId) {
        try {
            // Validate IDs
            if (!Number.isInteger(Number(generatorId))) {
                throw new Error('Generator ID must be a valid integer');
            }
            if (!Number.isInteger(Number(shareholderId))) {
                throw new Error('Shareholder ID must be a valid integer');
            }

            console.log(`Deleting captive entry for generator ${generatorId} and shareholder ${shareholderId}`);
            const response = await api.delete(`${this.BASE_URL}/${generatorId}/${shareholderId}`);
            return response.data?.data || response.data;
        } catch (error) {
            console.error('Error deleting captive entry:', error);
            throw error;
        }
    }
}

const captiveApi = new CaptiveApi();
export default captiveApi;
