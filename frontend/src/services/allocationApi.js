import api from './apiUtils';
import { API_CONFIG } from '../config/api.config';

class AllocationApi {
    formatAllocationData(data, type = 'ALLOCATION') {
        const allocated = data.allocated || {};
        const c1 = data.c1 !== undefined ? data.c1 : allocated.c1 || 0;
        const c2 = data.c2 !== undefined ? data.c2 : allocated.c2 || 0;
        const c3 = data.c3 !== undefined ? data.c3 : allocated.c3 || 0;
        const c4 = data.c4 !== undefined ? data.c4 : allocated.c4 || 0;
        const c5 = data.c5 !== undefined ? data.c5 : allocated.c5 || 0;
        
        const charge = data.charge !== undefined ? 
            (data.charge === true || data.charge === 1) : 
            (allocated.charge === true || allocated.charge === 1);
        const chargeValue = charge ? 1 : 0;

        const payload = {
            companyId: data.companyId,
            pk: data.pk,
            sk: data.sk,
            c1: Math.max(0, Math.round(Number(c1) || 0)),
            c2: Math.max(0, Math.round(Number(c2) || 0)),
            c3: Math.max(0, Math.round(Number(c3) || 0)),
            c4: Math.max(0, Math.round(Number(c4) || 0)),
            c5: Math.max(0, Math.round(Number(c5) || 0)),
            charge: chargeValue,
            allocated: {
                c1: Math.max(0, Math.round(Number(c1) || 0)),
                c2: Math.max(0, Math.round(Number(c2) || 0)),
                c3: Math.max(0, Math.round(Number(c3) || 0)),
                c4: Math.max(0, Math.round(Number(c4) || 0)),
                c5: Math.max(0, Math.round(Number(c5) || 0)),
                charge: chargeValue
            }
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
        
        ['version', 'ttl', 'createdAt', 'updatedAt'].forEach(key => {
            if (data[key] !== undefined) payload[key] = data[key];
        });
        
        return payload;
    }

    async fetchAll(month, companyId, options = {}) {
        try {
            const queryParams = [];
            if (companyId) queryParams.push(`companyId=${companyId}`);
            if (options.charge !== undefined) queryParams.push(`charge=${options.charge ? 1 : 0}`);
            
            const endpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}/month/${month}${
                queryParams.length ? '?' + queryParams.join('&') : ''
            }`;
            
            const response = await api.get(endpoint);
            
            const filterByCompany = (items) => {
                if (!companyId) return items || [];
                return (items || []).filter(item => String(item.companyId) === String(companyId));
            };
            
            const transformCharge = (items) => {
                return (items || []).map(item => ({
                    ...item,
                    charge: item.charge === 1 || item.charge === true,
                    allocated: item.allocated ? {
                        ...item.allocated,
                        charge: item.allocated.charge === 1 || item.allocated.charge === true
                    } : undefined
                }));
            };
            
            return {
                allocations: transformCharge(filterByCompany(response.data?.data)),
                banking: transformCharge(filterByCompany(response.data?.banking)),
                lapse: transformCharge(filterByCompany(response.data?.lapse))
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async fetchAllAllocations(companyId) {
        try {
            const endpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}${companyId ? `?companyId=${companyId}` : ''}`;
            const response = await api.get(endpoint);
            const allocations = response.data?.data || [];
            return companyId 
                ? allocations.filter(item => item.companyId === companyId)
                : allocations;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Fetch allocations for a specific production site
     * @param {string} productionSiteId - The ID of the production site
     * @param {string} month - The month in MMYYYY format
     * @param {string} companyId - Optional company ID to filter by
     * @returns {Promise<Array>} Array of allocation records
     */
    async fetchByProductionSite(productionSiteId, month, companyId) {
        try {
            // First get all allocations for the month and company
            const allAllocations = await this.fetchByType('allocations', month, companyId);
            
            // Filter allocations for the specific production site
            // The PK typically contains the production site ID in the format: COMPANYID_PRODUCTIONSITEID_CONSUMPTIONSITEID
            return allAllocations.filter(allocation => {
                // Check if the allocation's PK contains the production site ID
                const pk = allocation.pk || '';
                const parts = pk.split('_');
                // The production site ID is typically the second part of the PK
                return parts.length >= 2 && parts[1] === productionSiteId;
            });
        } catch (error) {
            console.error('Error fetching allocations by production site:', error);
            throw this.handleError(error);
        }
    }

    async fetchByType(type, month, companyId, options = {}) {
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
            
            const queryParams = [];
            if (month) queryParams.push(`month=${month}`);
            if (companyId) queryParams.push(`companyId=${companyId}`);
            if (options.charge !== undefined) queryParams.push(`charge=${options.charge ? 1 : 0}`);
            
            const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
            const url = `${endpoint}${queryString}`;
            
            const response = await api.get(url);
            const data = response.data?.data || [];
            
            const filteredData = companyId 
                ? data.filter(item => String(item.companyId) === String(companyId))
                : data;
            
            return filteredData.map(item => ({
                ...item,
                charge: item.charge === 1 || item.charge === true,
                allocated: item.allocated ? {
                    ...item.allocated,
                    charge: item.allocated.charge === 1 || item.allocated.charge === true
                } : undefined
            }));
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async createAllocation(data) {
        try {
            const formattedData = this.formatAllocationData(data, 'ALLOCATION');
            
            // Ensure we're sending the data in the format the backend expects
            const payload = {
                pk: formattedData.pk,
                sk: formattedData.sk,
                type: 'ALLOCATION',
                c1: formattedData.c1 || 0,
                c2: formattedData.c2 || 0,
                c3: formattedData.c3 || 0,
                c4: formattedData.c4 || 0,
                c5: formattedData.c5 || 0,
                charge: formattedData.charge || 0,
                companyId: formattedData.companyId,
                productionSiteId: formattedData.productionSiteId,
                consumptionSiteId: formattedData.consumptionSiteId,
                siteName: formattedData.siteName
            };
            
            console.log('Sending allocation payload:', JSON.stringify(payload, null, 2));
            
            // Send as a single object, the backend will handle it as an array
            const response = await api.post(API_CONFIG.ENDPOINTS.ALLOCATION.BASE, [payload]);
            
            // Return the first item if response is an array, otherwise return the response as is
            return Array.isArray(response.data) ? response.data[0] : response.data;
        } catch (error) {
            const msg = error.response?.data?.message || '';
            if (!(error.response?.status === 400 && msg.includes('already exists'))) {
                console.error('Error creating allocation:', error);
                console.error('Error details:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    config: error.config
                });
            }
            throw this.handleError(error);
        }
    }

    async createBanking(data) {
        let formattedData = this.formatAllocationData(data, 'BANKING');
        
        try {
            if (formattedData.pk && formattedData.sk) {
                const existingRecord = await this.get(formattedData.pk, formattedData.sk, 'BANKING').catch(() => null);
                if (existingRecord) {
                    return await this.update(formattedData.pk, formattedData.sk, formattedData, 'BANKING');
                }
            }
            
            const response = await api.post(API_CONFIG.ENDPOINTS.BANKING.CREATE, formattedData);
            return response.data;
            
        } catch (error) {
            const errorMessage = error.response?.data?.message || '';
            if ((errorMessage.includes('already exists') || errorMessage.includes('conditional check failed')) && 
                formattedData.pk && formattedData.sk) {
                return await this.update(formattedData.pk, formattedData.sk, formattedData, 'BANKING');
            }
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
            if (error.response?.status === 404) {
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
                    getEndpoint = `${API_CONFIG.ENDPOINTS.BANKING.BASE}/${pk}/${sk}`;
                    break;
                case 'LAPSE':
                    getEndpoint = `${API_CONFIG.ENDPOINTS.LAPSE.BASE}/${pk}/${sk}`;
                    break;
                default:
                    getEndpoint = `${API_CONFIG.ENDPOINTS.ALLOCATION.BASE}/${pk}/${sk}`;
            }

            const response = await api.get(getEndpoint);
            const data = response.data;

            return {
                ...data,
                charge: data.charge === 1 || data.charge === true,
                allocated: data.allocated ? {
                    ...data.allocated,
                    charge: data.allocated.charge === 1 || data.allocated.charge === true
                } : undefined
            };
        } catch (error) {
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
            console.error('Error:', error.message);
        }
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
    }

    formatMonth(month, year) {
        return `${month.toString().padStart(2, '0')}${year}`;
    }

    async fetchAllocationForMonth(month) {
        try {
            const response = await api.get(`/allocation/month/${month}`);

            if (!response.data) {
                throw new Error('No data received from the server');
            }

            const { data = [], banking = [], lapse = [] } = response.data;
            
            const processAllocationItem = (item) => {
                const allocated = item.allocated || {};
                const charge = item.charge !== undefined ? 
                    (item.charge === true || item.charge === 1) : 
                    (allocated.charge === true || allocated.charge === 1);

                return {
                    ...item,
                    allocated: {
                        c1: Number(allocated.c1 || 0),
                        c2: Number(allocated.c2 || 0),
                        c3: Number(allocated.c3 || 0),
                        c4: Number(allocated.c4 || 0),
                        c5: Number(allocated.c5 || 0),
                        charge: charge ? 1 : 0
                    },
                    charge: charge
                };
            };
            
            const processedData = data.map(processAllocationItem);
            
            const processedBanking = banking.map(item => ({
                ...item,
                type: 'BANKING',
                charge: item.charge === true || item.charge === 1
            }));
            
            const processedLapse = lapse.map(item => ({
                ...item,
                type: 'LAPSE',
                charge: false
            }));

            return {
                success: true,
                data: processedData,
                banking: processedBanking,
                lapse: processedLapse
            };
            
        } catch (error) {
            console.error('Error in fetchAllocationForMonth:', error);
            throw new Error(error.response?.data?.message || 'Failed to fetch allocation data');
        }
    }
}

const allocationApi = new AllocationApi();
export default allocationApi;
