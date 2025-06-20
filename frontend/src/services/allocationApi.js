import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

class AllocationApi {
    formatAllocationData(data, type = 'ALLOCATION') {
        // Accept c1-c5 at root level if present, otherwise from allocated
        const allocated = data.allocated || {};
        // Use c1-c5 from root if present, else from allocated
        const c1 = data.c1 !== undefined ? data.c1 : allocated.c1 || 0;
        const c2 = data.c2 !== undefined ? data.c2 : allocated.c2 || 0;
        const c3 = data.c3 !== undefined ? data.c3 : allocated.c3 || 0;
        const c4 = data.c4 !== undefined ? data.c4 : allocated.c4 || 0;
        const c5 = data.c5 !== undefined ? data.c5 : allocated.c5 || 0;
        // Build payload with c1-c5 at root
        const payload = {
            companyId: data.companyId,
            pk: data.pk,
            sk: data.sk,
            c1: Math.max(0, Math.round(Number(c1) || 0)),
            c2: Math.max(0, Math.round(Number(c2) || 0)),
            c3: Math.max(0, Math.round(Number(c3) || 0)),
            c4: Math.max(0, Math.round(Number(c4) || 0)),
            c5: Math.max(0, Math.round(Number(c5) || 0))
        };
        const t = (type || data.type || 'ALLOCATION').toUpperCase();
        if (t === 'ALLOCATION') {
            payload.consumptionSiteId = data.consumptionSiteId;
        } else if (t === 'BANKING') {
            payload.siteName = data.productionSiteName || data.siteName;
        } else if (t === 'LAPSE') {
            payload.productionSiteId = data.productionSiteId;
            payload.month = data.month;
        }
        ['version','ttl','createdAt','updatedAt'].forEach(key => {
            if (data[key] !== undefined) payload[key] = data[key];
        });
        return payload;
    }

    async fetchAll(month) {
        try {
            // Construct the URL with proper path joining
            const endpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}/month/${month}`;
            const response = await api.get(endpoint);
            return {
                allocations: response.data?.data || [],
                banking: response.data?.banking || [],
                lapse: response.data?.lapse || []
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async fetchAllAllocations() {
        try {
            const endpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}`;
            const response = await api.get(endpoint);
            // Expect response.data to be an array of records with allocated: {c1, c2, ...}
            return response.data?.data || [];
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async createAllocation(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'ALLOCATION');
            console.log('[AllocationApi] Outgoing ALLOCATION payload:', formattedData);
            const response = await api.post(API_CONFIG.ENDPOINTS.ALLOCATION.CREATE, formattedData);
            return response.data;
        } catch (error) {
            // Only log unexpected errors (not simple duplicates)
            const msg = error.response?.data?.message || '';
            if (!(error.response?.status === 400 && msg.includes('already exists'))) {
                console.error('[AllocationApi] Backend ALLOCATION error:', error?.response?.data || error);
            }
            throw this.handleError(error);
        }
    }

    async createBanking(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'BANKING');
            console.log('[AllocationApi] Outgoing BANKING payload:', formattedData);
            const response = await api.post(API_CONFIG.ENDPOINTS.BANKING.CREATE, formattedData);
            return response.data;
        } catch (error) {
            console.error('[AllocationApi] Backend BANKING error:', error?.response?.data || error);
            throw this.handleError(error);
        }
    }

    async createLapse(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'LAPSE');
            console.log('[AllocationApi] Outgoing LAPSE payload:', formattedData);
            const response = await api.post(API_CONFIG.ENDPOINTS.LAPSE.CREATE, formattedData);
            return response.data;
        } catch (error) {
            console.error('[AllocationApi] Backend LAPSE error:', error?.response?.data || error);
            throw this.handleError(error);
        }
    }

    async create(data, type = 'ALLOCATION') {
        try {
            const formattedData = this.formatAllocationData(data, type);
            let endpoint;
            
            switch (type.toUpperCase()) {
                case 'BANKING':
                    endpoint = API_CONFIG.ENDPOINTS.BANKING.CREATE;
                    break;
                case 'LAPSE':
                    endpoint = API_CONFIG.ENDPOINTS.LAPSE.CREATE;
                    break;
                default:
                    endpoint = API_CONFIG.ENDPOINTS.ALLOCATION.CREATE;
            }

            const response = await api.post(endpoint, formattedData);
            return response.data;
        } catch (error) {
            console.error('[AllocationApi] Backend error:', error?.response?.data || error);
            throw this.handleError(error);
        }
    }

    async update(pk, sk, data, type = 'ALLOCATION') {
        try {
            const formattedData = this.formatAllocationData(data, type);
            let updateEndpoint;
            
            switch (type.toUpperCase()) {
                case 'BANKING':
                    updateEndpoint = API_CONFIG.ENDPOINTS.BANKING.UPDATE(pk, sk);
                    break;
                case 'LAPSE':
                    updateEndpoint = API_CONFIG.ENDPOINTS.LAPSE.UPDATE(pk, sk);
                    break;
                default:
                    updateEndpoint = API_CONFIG.ENDPOINTS.ALLOCATION.UPDATE(pk, sk);
            }

            const response = await api.put(updateEndpoint, formattedData);
            return response.data;
        } catch (error) {
            // If not found, fallback to create for new records
            if (error.response?.status === 404) {
                // Create new record if update target doesn't exist
                return this.create(data, type);
            }
            throw this.handleError(error);
        }
    }

    async delete(pk, sk, type = 'ALLOCATION') {
        try {
            let deleteEndpoint;
            
            switch (type.toUpperCase()) {
                case 'BANKING':
                    deleteEndpoint = API_CONFIG.ENDPOINTS.BANKING.DELETE(pk, sk);
                    break;
                case 'LAPSE':
                    deleteEndpoint = API_CONFIG.ENDPOINTS.LAPSE.DELETE(pk, sk);
                    break;
                default:
                    deleteEndpoint = API_CONFIG.ENDPOINTS.ALLOCATION.DELETE(pk, sk);
            }

            const response = await api.delete(deleteEndpoint);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    handleError(error) {
        // Only log unexpected errors
        const msg = error.response?.data?.message || '';
        if (error.response) {
            if (!(error.response.status === 400 && msg.includes('already exists'))) {
                console.error('[Allocation API Error]:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }
        } else {
            console.error('[Allocation API Error]:', error);
        }
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
    }

    formatMonth(month, year) {
        return `${month.toString().padStart(2, '0')}${year}`;
    }
}

const allocationApi = new AllocationApi();
export default allocationApi;