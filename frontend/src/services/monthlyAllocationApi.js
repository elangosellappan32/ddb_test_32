import api from './api';

/**
 * Fetches and processes monthly allocation data including charge information
 * @param {string} month - The month in MMyyyy format (e.g., '082025' for August 2025)
 * @returns {Promise<Object>} - Processed allocation data with charge information
 */
const fetchMonthlyAllocation = async (month) => {
    try {
        const response = await api.get(`/allocation/month/${month}`);
        
        if (!response.data) {
            throw new Error('No data received from the server');
        }

        // Process the response data
        const { data = [], banking = [], lapse = [] } = response.data;
        
        // Process regular allocations
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
        
        // Process banking data
        const processedBanking = banking.map(item => ({
            ...item,
            type: 'BANKING',
            charge: item.charge === true || item.charge === 1
        }));
        
        // Process lapse data
        const processedLapse = lapse.map(item => ({
            ...item,
            type: 'LAPSE',
            charge: false // Lapse items typically don't have charge
        }));

        return {
            success: true,
            data: processedData,
            banking: processedBanking,
            lapse: processedLapse
        };
        
    } catch (error) {
        console.error('Error in fetchMonthlyAllocation:', error);
        throw new Error(error.response?.data?.message || 'Failed to fetch allocation data');
    }
};

export default {
    fetchMonthlyAllocation
};
