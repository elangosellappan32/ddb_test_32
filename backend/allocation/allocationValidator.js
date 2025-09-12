const logger = require('../utils/logger');

const validateAllocation = (req, res, next) => {
    try {
        const allocation = req.body;
        const allocations = Array.isArray(allocation) ? allocation : [allocation];
        const errors = [];
        // Track charge=1 allocations by site and month (format: 'siteId#month')
        const siteMonthChargeMap = new Map(); 

        // First pass: collect all charges to validate uniqueness
        for (const alloc of allocations) {
            const type = (alloc.type || 'ALLOCATION').toUpperCase();
            if (type !== 'ALLOCATION') continue;
            
            // Parse site ID from pk (format: 'companyId_siteId_consumerId')
            const siteId = alloc.pk?.split('_')[1];
            const month = alloc.sk?.split('#')[0];
            
            if (!siteId || !month) continue;
            
            // Handle charge attribute
            const charge = alloc.charge === true || alloc.charge === 1 ? 1 : 0;
            
            if (charge === 1) {
                const key = `${siteId}#${month}`;
                if (siteMonthChargeMap.has(key) && siteMonthChargeMap.get(key) !== alloc.pk) {
                    errors.push({
                        allocation: alloc,
                        errors: [`Site ${siteId} already has a charge for month ${month}`]
                    });
                } else {
                    siteMonthChargeMap.set(key, alloc.pk);
                }
            }
        }
        
        // Second pass: validate each allocation
        for (const alloc of allocations) {
            const type = (alloc.type || 'ALLOCATION').toUpperCase();
            const validationErrors = [];

            // Common required fields: pk and sk
            const commonFields = ['pk', 'sk'];

            // Type-specific required fields
            const typeFields = {
                'ALLOCATION': ['consumptionSiteId', 'c1', 'c2', 'c3', 'c4', 'c5'],
                'BANKING': ['c1', 'c2', 'c3', 'c4', 'c5'],
                'LAPSE': ['c1', 'c2', 'c3', 'c4', 'c5']
            };

            const requiredFields = [...commonFields, ...(typeFields[type] || [])];
            const missingFields = requiredFields.filter(field => {
                const value = alloc[field];
                return value === undefined || value === null || value === '';
            });

            if (missingFields.length > 0) {
                validationErrors.push(`Missing required fields: ${missingFields.join(', ')}`);
            }

            // Coerce all allocation periods to numbers (default 0) and validate
            const periods = ['c1', 'c2', 'c3', 'c4', 'c5'];
            let totalAllocation = 0;
            periods.forEach(p => {
                alloc[p] = Number(alloc[p]) || 0;
                if (alloc[p] < 0) {
                    validationErrors.push(`${p} cannot be negative`);
                }
                totalAllocation += alloc[p];
            });

            // Set defaults for banking and lapse
            if (type === 'BANKING') {
                alloc.bankingEnabled = true;
            }
            
            // Handle charge attribute
            if (alloc.charge === undefined) {
                alloc.charge = 0;  // Default to 0 (no charge)
            } else {
                // Convert charge to number (0 or 1)
                alloc.charge = alloc.charge === true || alloc.charge === 1 ? 1 : 0;
            }

            // Additional charge validations for ALLOCATION type only
            if (type === 'ALLOCATION' && alloc.charge === 1) {
                if (totalAllocation === 0) {
                    validationErrors.push('Cannot set charge=1 for an allocation with zero units');
                }
            }

            if (validationErrors.length > 0) {
                errors.push({
                    allocation: alloc,
                    errors: validationErrors
                });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        // Add validated flag, metadata, and strip unwanted fields
        req.validatedAllocations = allocations.map(alloc => {
            const cleaned = {
                ...alloc,
                validated: true,
                timestamp: new Date().toISOString(),
                version: alloc.version || 1
            };
            delete cleaned.siteName;
            delete cleaned.productionSite;
            delete cleaned.siteType;
            delete cleaned.consumptionSite;
            return cleaned;
        });

        next();
    } catch (error) {
        logger.error('[ValidateAllocation] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Validation error occurred',
            error: error.message
        });
    }
};

module.exports = validateAllocation;