class AllocationService {
    calculatePeakTotal(allocation) {
        if (!allocation?.allocated) return 0;
        return ['c2', 'c3'].reduce((sum, period) => 
            sum + Math.round(Number(allocation.allocated[period] || 0)), 0
        );
    }

    calculateNonPeakTotal(allocation) {
        if (!allocation?.allocated) return 0;
        return ['c1', 'c4', 'c5'].reduce((sum, period) => 
            sum + Math.round(Number(allocation.allocated[period] || 0)), 0
        );
    }

    calculateAllocationTotal(allocation) {
        if (!allocation?.allocated) return 0;
        return Object.values(allocation.allocated).reduce((sum, val) => 
            sum + Math.round(Number(val || 0)), 0
        );
    }

    validateAllocation(allocation) {
        const errors = [];
        if (!allocation?.allocated) {
            errors.push('No allocation data provided');
            return { isValid: false, errors };
        }

        // Validate peak and non-peak mixing
        const hasPeak = ['c2', 'c3'].some(p => Math.round(Number(allocation.allocated[p] || 0)) > 0);
        const hasNonPeak = ['c1', 'c4', 'c5'].some(p => Math.round(Number(allocation.allocated[p] || 0)) > 0);
        
        if (hasPeak && hasNonPeak) {
            errors.push('Cannot mix peak and non-peak period allocations');
        }

        // Check for negative values
        Object.entries(allocation.allocated).forEach(([period, value]) => {
            if (Number(value) < 0) {
                errors.push(`Period ${period} cannot have negative value`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            allocation
        };
    }

    async createAllocation(data) {
        try {
            const validation = this.validateAllocation(data);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            const response = await fetch('/api/allocations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create allocation');
            }

            return await response.json();
        } catch (error) {
            console.error('[AllocationService] Create Error:', error);
            throw error;
        }
    }

    async updateAllocation(pk, sk, data) {
        try {
            const validation = this.validateAllocation(data);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            const response = await fetch(`/api/allocations/${pk}/${sk}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update allocation');
            }

            return await response.json();
        } catch (error) {
            console.error('[AllocationService] Update Error:', error);
            throw error;
        }
    }

    async fetchAllocationsByMonth(month) {
        try {
            const response = await fetch(`/api/allocations/month/${month}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch allocations');
            }
            return await response.json();
        } catch (error) {
            console.error('[AllocationService] FetchByMonth Error:', error);
            throw error;
        }
    }
}

const allocationService = new AllocationService();
export default allocationService;