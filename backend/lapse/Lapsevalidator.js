const logger = require('../utils/logger');

const lapseValidator = (req, res, next) => {
    try {
        const lapse = req.body;
        const records = Array.isArray(lapse) ? lapse : [lapse];
        const errors = [];

        for (const rec of records) {
            const validationErrors = [];
            // Required fields for lapse
            const requiredFields = ['pk', 'sk', 'c1', 'c2', 'c3', 'c4', 'c5'];
            const missingFields = requiredFields.filter(field => {
                const value = rec[field];
                return value === undefined || value === null || value === '';
            });
            if (missingFields.length > 0) {
                validationErrors.push(`Missing required fields: ${missingFields.join(', ')}`);
            }
            // Coerce c1-c5 to numbers
            ['c1','c2','c3','c4','c5'].forEach(p => {
                rec[p] = Number(rec[p]) || 0;
            });
            if (validationErrors.length > 0) {
                errors.push({
                    lapse: rec,
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
        req.validatedLapse = records.map(rec => {
            const cleaned = {
                ...rec,
                validated: true,
                timestamp: new Date().toISOString(),
                version: rec.version || 1
            };
            return cleaned;
        });
        next();
    } catch (error) {
        logger.error('[ValidateLapse] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Validation error occurred',
            error: error.message
        });
    }
};

module.exports = lapseValidator;