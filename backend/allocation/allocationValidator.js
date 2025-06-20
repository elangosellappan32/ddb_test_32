const logger = require('../utils/logger');

const validateAllocation = (req, res, next) => {
    try {
        const allocation = req.body;
        const allocations = Array.isArray(allocation) ? allocation : [allocation];
        const errors = [];

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

            // Coerce all allocation periods to numbers (default 0)
            const periods = ['c1', 'c2', 'c3', 'c4', 'c5'];
            periods.forEach(p => {
                alloc[p] = Number(alloc[p]) || 0;
            });

            // Set defaults for banking and lapse
            if (type === 'BANKING') {
                alloc.bankingEnabled = true;
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