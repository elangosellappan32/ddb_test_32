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

    validateAllocation(allocation, existingAllocations = []) {
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
            if (period !== 'charge' && Number(value) < 0) {
                errors.push(`Period ${period} cannot have negative value`);
            }
        });

        // Validate charge attribute
        if (allocation.allocated.charge || allocation.charge) {
            // Check if another allocation for the same month is already charged
            const hasExistingCharge = existingAllocations.some(existing => 
                existing.sk === allocation.sk && // Same month
                existing.pk !== allocation.pk && // Different allocation
                (existing.charge === 1 || existing.charge === true || 
                 existing.allocated?.charge === 1 || existing.allocated?.charge === true)
            );

            if (hasExistingCharge) {
                errors.push('Another allocation is already marked as charged for this month');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            allocation
        };
    }

    async createAllocation(data) {
        try {
            // Get existing allocations for the same month to validate charge
            const existingAllocations = await this.fetchAllocationsByMonth(data.sk);
            
            const validation = this.validateAllocation(data, existingAllocations);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            const response = await fetch('/api/allocation', {
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

            const body = await response.json();
            return Array.isArray(body?.data) ? body.data : body;
        } catch (error) {
            console.error('[AllocationService] Create Error:', error);
            throw error;
        }
    }

    async updateAllocation(pk, sk, data) {
        try {
            // Get existing allocations for the same month to validate charge
            const existingAllocations = await this.fetchAllocationsByMonth(data.sk);
            
            const validation = this.validateAllocation(data, existingAllocations);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            const response = await fetch(`/api/allocation/${pk}/${sk}`, {
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

            const body = await response.json();
            return Array.isArray(body?.data) ? body.data : body;
        } catch (error) {
            console.error('[AllocationService] Update Error:', error);
            throw error;
        }
    }

    async getAllAllocations() {
        const response = await fetch('/api/allocation');
        if (!response.ok) throw new Error('Failed to fetch allocations');
        const { data } = await response.json();
        return Array.isArray(data) ? data : [];
    }

    async fetchAllocationsByMonth(month) {
        try {
            const response = await fetch(`/api/allocation/month/${month}`);
            // Handle 404 - no allocations for this month
        if (response.status === 404) {
                // No data for this month; return empty list
                return [];
            }
            if (!response.ok) {
                let message = 'Failed to fetch allocations';
                try {
                  const err = await response.json();
                  message = err.message || message;
                } catch {}
                throw new Error(message);
            }
            const body = await response.json();
            return Array.isArray(body?.data) ? body.data : body;
        } catch (error) {
            // Only log other errors (not 404 which we already handled)
            if (error.message !== 'Failed to fetch allocations') {
              console.error('[AllocationService] FetchByMonth Error:', error);
            }
            throw error;
        }
    }
}

const allocationService = new AllocationService();
export default allocationService;