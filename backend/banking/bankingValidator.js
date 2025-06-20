const logger = require('../utils/logger');

const bankingValidator = (req, res, next) => {
    try {
        const banking = req.body;
        const records = Array.isArray(banking) ? banking : [banking];
        const errors = [];

        for (const rec of records) {
            const validationErrors = [];
            // Required fields for banking
            const requiredFields = ['pk', 'sk', 'siteName', 'c1', 'c2', 'c3', 'c4', 'c5'];
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
            rec.bankingEnabled = true;
            if (validationErrors.length > 0) {
                errors.push({
                    banking: rec,
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
        req.validatedBanking = records.map(rec => {
            const cleaned = {
                ...rec,
                validated: true,
                timestamp: new Date().toISOString(),
                version: rec.version || 1
            };
            delete cleaned.siteType;
            return cleaned;
        });
        next();
    } catch (error) {
        logger.error('[ValidateBanking] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Validation error occurred',
            error: error.message
        });
    }
};

module.exports = bankingValidator;