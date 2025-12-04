class AllocationService {
    // Helper method to safely parse numbers
    parseNumber(value, isCharge = false) {
        if (value === undefined || value === null) return isCharge ? 0 : 0;
        if (typeof value === 'boolean') return value ? 1 : 0;
        const num = Number(value);
        return isNaN(num) ? (isCharge ? 0 : 0) : num;
    }
    
    // Process allocation data from API to ensure consistent format
    processAllocation(allocation) {
        if (!allocation) return null;
        
        // Create a deep copy to avoid modifying the original
        const allocationCopy = JSON.parse(JSON.stringify(allocation));
        
        // Get the source object that contains the actual data
        const source = allocationCopy.original || allocationCopy;
        
        // Helper to safely get a value from any level of nesting with case-insensitive key matching
        const getValue = (obj, keys, defaultValue = 0) => {
            if (!obj) return defaultValue;
            
            // Try all possible key variations (case-insensitive)
            const keyVariations = [
                ...keys.flatMap(k => [k, k.toLowerCase(), k.toUpperCase()]),
                ...keys.flatMap(k => [`c${k}`, `C${k}`])
            ];
            
            // Try direct properties first
            for (const key of keyVariations) {
                if (obj[key] !== undefined && obj[key] !== null) {
                    return obj[key];
                }
            }
            
            // Try nested cValues
            if (obj.cValues || obj.allocated) {
                for (const key of keyVariations) {
                    if (obj.cValues?.[key] !== undefined) return obj.cValues[key];
                    if (obj.allocated?.[key] !== undefined) return obj.allocated[key];
                }
            }
            
            // Try original object if it exists
            if (obj.original) {
                const originalValue = getValue(obj.original, keys, undefined);
                if (originalValue !== undefined) return originalValue;
            }
            
            return defaultValue;
        };
        
        // Extract C values with proper fallbacks
        const cValues = {};
        const cKeys = ['1', '2', '3', '4', '5'];
        
        // First try to get all C values from the original source
        cKeys.forEach(key => {
            cValues[`c${key}`] = this.parseNumber(
                getValue(source, [`c${key}`, `C${key}`, key])
            );
        });
        
        // Get charge value with proper fallback
        const charge = this.parseNumber(
            getValue(source, ['charge']),
            true
        );
        
        // Calculate total from C values (excluding charge)
        const total = Object.entries(cValues).reduce(
            (sum, [_, value]) => sum + (Number(value) || 0), 
            0
        );
        
        // Create the final processed object
        const processed = {
            ...allocationCopy,
            // Preserve the original data structure
            original: source === allocationCopy ? undefined : source,
            // Include the normalized C values
            cValues: {
                ...cValues,
                charge: charge
            },
            // For backward compatibility
            charge: Boolean(charge),
            // Track if charge was explicitly set
            hasChargeProp: getValue(source, ['charge']) !== undefined,
            // Include calculated totals
            total: total,
            totalAllocation: total
        };
        
        // Debug logging
        console.log('[processAllocation] Processed allocation:', {
            input: allocation,
            source: source,
            processed: {
                ...processed,
                _debug: {
                    cValuesSource: cValues,
                    chargeSource: getValue(source, ['charge'], 'not found')
                }
            }
        });
        
        return processed;
    }

    calculatePeakTotal(allocation) {
        if (!allocation?.cValues) return 0;
        return ['c2', 'c3'].reduce((sum, period) => 
            sum + Math.round(Number(allocation.cValues[period] || 0)), 0
        );
    }

    calculateNonPeakTotal(allocation) {
        if (!allocation?.cValues) return 0;
        return ['c1', 'c4', 'c5'].reduce((sum, period) => 
            sum + Math.round(Number(allocation.cValues[period] || 0)), 0
        );
    }

    calculateAllocationTotal(allocation) {
        if (!allocation?.cValues) return 0;
        return Object.entries(allocation.cValues).reduce((sum, [key, value]) => 
            key !== 'charge' ? sum + Math.round(Number(value || 0)) : sum, 0
        );
    }

    validateAllocation(allocation, existingAllocations = []) {
        const errors = [];
        const cValues = allocation.cValues || allocation.allocated || {};
        
        if (!cValues) {
            errors.push('No allocation data provided');
            return { isValid: false, errors };
        }

        // Process charge - can be boolean or number (0/1)
        const charge = Boolean(cValues.charge || allocation.charge);

        // Validate peak and non-peak mixing
        const hasPeak = ['c2', 'c3'].some(p => Math.round(Number(cValues[p] || 0)) > 0);
        const hasNonPeak = ['c1', 'c4', 'c5'].some(p => Math.round(Number(cValues[p] || 0)) > 0);
        
        if (hasPeak && hasNonPeak) {
            errors.push('Cannot mix peak and non-peak period allocations');
        }

        // Check for negative values
        Object.entries(cValues).forEach(([period, value]) => {
            if (period !== 'charge' && Number(value) < 0) {
                errors.push(`Period ${period} cannot have negative value`);
            }
        });

        // Get the site ID and month for the current allocation
        const siteId = allocation.pk?.split('#')[1] || allocation.siteId;
        const monthYear = allocation.sk?.split('#')[0] || '';

        // Validate charge attribute
        if (charge && siteId && monthYear) {
            // Check if another allocation for the same site and month is already charged
            const hasExistingCharge = existingAllocations.some(existing => {
                const existingCValues = existing.cValues || existing.allocated || {};
                const existingCharge = Boolean(existingCValues.charge || existing.charge);
                const existingSiteId = existing.pk?.split('#')[1] || existing.siteId;
                const existingMonthYear = existing.sk?.split('#')[0] || '';
                
                return (
                    existingSiteId === siteId &&
                    existingMonthYear === monthYear &&
                    existing.pk !== allocation.pk && // Different allocation
                    existingCharge
                );
            });

            if (hasExistingCharge) {
                errors.push('This site already has a charge record for the selected month');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            allocation: {
                ...allocation,
                siteId: siteId,
                monthYear: monthYear
            }
        };
    }

    async createAllocation(data) {
        try {
            // Process the allocation to ensure consistent format
            const processedData = this.processAllocation(data);
            
            // Get existing allocations for the same month to validate charge
            const month = processedData.sk?.split('#')[0] || '';
            const existingAllocations = await this.fetchAllocationsByMonth(month);
            
            // Extract production site ID from PK (format: companyId_productionSiteId_consumptionSiteId)
            const pkParts = (processedData.pk || '').split('_');
            const productionSiteId = pkParts.length >= 2 ? pkParts[1] : null;
            
            if (!productionSiteId) {
                throw new Error('Invalid allocation: Missing production site ID in primary key');
            }
            
            // Check if this is a charge allocation
            const isCharge = processedData.cValues?.charge || processedData.charge;
            
            // If this is a charge allocation, ensure no other charge exists for this production site/month
            if (isCharge) {
                const existingCharge = existingAllocations.find(alloc => {
                    const allocPkParts = (alloc.pk || '').split('_');
                    const allocProductionSiteId = allocPkParts.length >= 2 ? allocPkParts[1] : null;
                    const allocMonth = alloc.sk?.split('#')[0] || '';
                    const allocCharge = alloc.cValues?.charge || alloc.charge;
                    
                    return (allocProductionSiteId === productionSiteId && 
                            allocMonth === month && 
                            allocCharge);
                });

                if (existingCharge) {
                    throw new Error(`Production site ${productionSiteId} already has a charge for ${month}. Only one charge per production site per month is allowed.`);
                }
            }
            
            // For non-charge allocations, ensure they don't exceed the allocated amounts
            // when combined with other allocations for the same production site/month
            
            // Validate the allocation
            const validation = this.validateAllocation(processedData, existingAllocations);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Format the data for the API
            const requestData = {
                ...processedData,
                // Ensure charge is included in the allocated object for the API
                allocated: {
                    ...(processedData.cValues || {}),
                    charge: isCharge ? 1 : 0
                }
            };

            const response = await fetch('/api/allocations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create allocation');
            }

            const responseData = await response.json();
            return this.processAllocation(responseData.data || responseData);
        } catch (error) {
            console.error('[AllocationService] Create Error:', error);
            throw error;
        }
    }

    async updateAllocation(pk, sk, data) {
        try {
            // Process the allocation to ensure consistent format
            const processedData = this.processAllocation({
                ...data,
                pk,
                sk
            });
            
            // Get existing allocations for the same month to validate charge
            const month = sk?.split('#')[0] || '';
            const existingAllocations = await this.fetchAllocationsByMonth(month);
            const otherAllocations = existingAllocations.filter(a => a.pk !== pk);
            
            // Extract production site ID from PK (format: companyId_productionSiteId_consumptionSiteId)
            const pkParts = (pk || '').split('_');
            const productionSiteId = pkParts.length >= 2 ? pkParts[1] : null;
            
            if (!productionSiteId) {
                throw new Error('Invalid allocation: Missing production site ID in primary key');
            }
            
            // Check if this is a charge allocation
            const isCharge = processedData.cValues?.charge || processedData.charge;
            
            // If this is a charge allocation, ensure no other charge exists for this production site/month
            if (isCharge) {
                const existingCharge = otherAllocations.find(alloc => {
                    const allocPkParts = (alloc.pk || '').split('_');
                    const allocProductionSiteId = allocPkParts.length >= 2 ? allocPkParts[1] : null;
                    const allocMonth = alloc.sk?.split('#')[0] || '';
                    const allocCharge = alloc.cValues?.charge || alloc.charge;
                    
                    return (allocProductionSiteId === productionSiteId && 
                            allocMonth === month && 
                            allocCharge);
                });

                if (existingCharge) {
                    throw new Error(`Production site ${productionSiteId} already has a charge for ${month}. Only one charge per production site per month is allowed.`);
                }
            }

            // Format the data for the API
            const requestData = {
                ...processedData,
                // Ensure charge is included in the allocated object for the API
                allocated: {
                    ...(processedData.cValues || {}),
                    charge: isCharge ? 1 : 0
                }
            };

            const response = await fetch(`/api/allocations/${pk}/${sk}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update allocation');
            }

            const responseData = await response.json();
            return this.processAllocation(responseData.data || responseData);
        } catch (error) {
            console.error('[AllocationService] Update Error:', error);
            throw error;
        }
    }

    async fetchAllocationsByMonth(month) {
        try {
            console.log(`[fetchAllocationsByMonth] Fetching allocations for month: ${month}`);
            const response = await fetch(`/api/allocation/month/${month}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json',
                }
            });
            
            // Handle 404 - no allocations for this month
            if (response.status === 404) {
                console.log(`[AllocationService] No allocations found for month: ${month}`);
                return [];
            }
            
            if (!response.ok) {
                let message = 'Failed to fetch allocations';
                try {
                    const err = await response.json();
                    message = err.message || message;
                    console.error(`[fetchAllocationsByMonth] API Error (${response.status}):`, message);
                } catch (e) {
                    console.error('[fetchAllocationsByMonth] Error parsing error response:', e);
                }
                throw new Error(message);
            }
            
            const responseData = await response.json();
            console.log('[fetchAllocationsByMonth] Raw API Response:', responseData);
            
            // Handle different response formats
            let allocations = [];
            if (Array.isArray(responseData)) {
                allocations = responseData;
            } else if (responseData && Array.isArray(responseData.data)) {
                allocations = responseData.data;
            } else if (responseData && responseData.Items) {
                allocations = Array.isArray(responseData.Items) ? responseData.Items : [responseData.Items];
            }
            
            console.log(`[fetchAllocationsByMonth] Found ${allocations.length} allocations`);
            
            // Process each allocation through processAllocation for consistency
            const processedAllocations = allocations.map(item => this.processAllocation(item));
            console.log('[fetchAllocationsByMonth] Processed allocations:', processedAllocations);
            
            return processedAllocations;
            
        } catch (error) {
            console.error('[AllocationService] Error in fetchAllocationsByMonth:', error);
            throw error;
        }
    }

    async saveAllocation(allocation) {
        try {
            // Process the allocation to ensure consistent format
            const processedAllocation = this.processAllocation(allocation);
            
            // Format the allocation data for the API
            const formattedAllocation = {
                ...processedAllocation,
                allocated: {
                    // Include all cValues
                    ...processedAllocation.cValues,
                    // Ensure charge is included
                    charge: processedAllocation.cValues.charge ? 1 : 0
                }
            };

            // Remove any undefined or null values
            Object.keys(formattedAllocation.allocated).forEach(key => {
                if (formattedAllocation.allocated[key] === undefined || 
                    formattedAllocation.allocated[key] === null) {
                    delete formattedAllocation.allocated[key];
                }
            });

            const response = await fetch('/api/allocations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formattedAllocation)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save allocation');
            }
            
            const responseData = await response.json();
            
            // Process the response to ensure consistent format
            return { 
                data: this.processAllocation(responseData.data || responseData), 
                error: null 
            };
        } catch (error) {
            console.error('Error saving allocation:', error);
            return { 
                data: null, 
                error: error.response?.data?.message || 'Failed to save allocation' 
            };
        }
    }
}

const allocationService = new AllocationService();
export default allocationService;