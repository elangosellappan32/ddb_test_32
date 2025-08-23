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
            c5: Math.max(0, Math.round(Number(c5) || 0)),
            // Charge defaults to false and will be handled by the backend
            // The frontend will need to ensure only one allocation per month has charge=true
            charge: Boolean(data.charge)
        };
        const t = (type || data.type || 'ALLOCATION').toUpperCase();
        if (t === 'ALLOCATION') {
            payload.consumptionSiteId = data.consumptionSiteId;
        } else if (t === 'BANKING') {
            payload.siteName = data.productionSiteName || data.siteName;
        } else if (t === 'LAPSE') {
            payload.productionSiteId = data.productionSiteId;
            payload.month = data.month;
            payload.siteName = data.productionSiteName || data.siteName;
        }
        ['version','ttl','createdAt','updatedAt'].forEach(key => {
            if (data[key] !== undefined) payload[key] = data[key];
        });
        return payload;
    }

    async fetchAll(month, companyId) {
        try {
            // Construct the URL with company ID as a query parameter
            const endpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}/month/${month}${companyId ? `?companyId=${companyId}` : ''}`;
            const response = await api.get(endpoint);
            
            // Filter allocations by company ID if provided
            const filterByCompany = (items) => {
                if (!companyId) return items || [];
                return (items || []).filter(item => item.companyId === companyId);
            };
            
            return {
                allocations: filterByCompany(response.data?.data),
                banking: filterByCompany(response.data?.banking),
                lapse: filterByCompany(response.data?.lapse)
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async fetchAllAllocations(companyId) {
        try {
            const endpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}${companyId ? `?companyId=${companyId}` : ''}`;
            const response = await api.get(endpoint);
            // Filter allocations by company ID if provided
            const allocations = response.data?.data || [];
            return companyId 
                ? allocations.filter(item => item.companyId === companyId)
                : allocations;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async fetchByType(type, month, companyId) {
        try {
            const typeMap = {
                'allocations': API_CONFIG.ENDPOINTS.ALLOCATION.BASE,
                'banking': API_CONFIG.ENDPOINTS.BANKING.BASE,
                'lapse': API_CONFIG.ENDPOINTS.LAPSE.BASE
            };
            
            const endpoint = typeMap[type];
            if (!endpoint) {
                throw new Error(`Invalid allocation type: ${type}`);
            }
            
            // Add company ID as query parameter if provided
            const queryParams = [];
            if (month) queryParams.push(`month=${month}`);
            if (companyId) queryParams.push(`companyId=${companyId}`);
            
            const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
            const url = `${endpoint}${queryString}`;
            
            
            const response = await api.get(url).catch(error => {
                if (error.response) {
                }
                throw error;
            });
            
            
            const data = response.data?.data || [];
            
            // Apply company filter if needed
            const filteredData = companyId 
                ? data.filter(item => item.companyId === companyId)
                : data;
                
            return filteredData;
        } catch (error) {
            throw error;
        } finally {
        }
    }

    async createAllocation(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'ALLOCATION');
            const response = await api.post(API_CONFIG.ENDPOINTS.ALLOCATION.CREATE, formattedData);
            return response.data;
        } catch (error) {
            // Only log unexpected errors (not simple duplicates)
            const msg = error.response?.data?.message || '';
            if (!(error.response?.status === 400 && msg.includes('already exists'))) {
            }
            throw this.handleError(error);
        }
    }

    async createBanking(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'BANKING');
            
            // First try to update if record exists
            try {
                // Check if we have the required fields for an update
                if (formattedData.pk && formattedData.sk) {
                    const existingRecord = await this.get(formattedData.pk, formattedData.sk, 'BANKING').catch(() => null);
                    if (existingRecord) {
                        return await this.update(formattedData.pk, formattedData.sk, formattedData, 'BANKING');
                    }
                }
                // If no existing record or missing fields, proceed with create
                const response = await api.post(API_CONFIG.ENDPOINTS.BANKING.CREATE, formattedData);
                return response.data;
            } catch (createError) {
                // If create fails with a duplicate error, try to update instead
                const errorMessage = createError?.response?.data?.message || '';
                if (errorMessage.includes('already exists') || errorMessage.includes('conditional check failed')) {
                    if (formattedData.pk && formattedData.sk) {
                        return await this.update(formattedData.pk, formattedData.sk, formattedData, 'BANKING');
                    }
                }
                throw createError;
            }
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async createLapse(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'LAPSE');
            const response = await api.post(API_CONFIG.ENDPOINTS.LAPSE.CREATE, formattedData);
            return response.data;
        } catch (error) {
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

    async get(pk, sk, type = 'ALLOCATION') {
        try {
            let getEndpoint;
            
            switch (type.toUpperCase()) {
                case 'BANKING':
                    getEndpoint = API_CONFIG.ENDPOINTS.BANKING.BASE + `/${pk}/${sk}`;
                    break;
                case 'LAPSE':
                    getEndpoint = API_CONFIG.ENDPOINTS.LAPSE.BASE + `/${pk}/${sk}`;
                    break;
                default:
                    getEndpoint = API_CONFIG.ENDPOINTS.ALLOCATION.BASE + `/${pk}/${sk}`;
            }

            const response = await api.get(getEndpoint);
            return response.data;
        } catch (error) {
            // Return null if record not found
            if (error.response?.status === 404) {
                return null;
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