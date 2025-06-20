const validateConsumptionUnit = (req, res, next) => {
    const errors = [];
    const { companyId, consumptionSiteId } = req.params;
    const item = req.body;

    // Validate route parameters
    if (!companyId) errors.push('Company ID is missing from URL');
    if (!consumptionSiteId) errors.push('Consumption Site ID is missing from URL');

    // Validate request body
    if (!item.sk) errors.push('Period (sk) is required');

    // Validate consumption values if present
    ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(field => {
        if (item[field] !== undefined) {
            const value = Number(item[field]);
            if (isNaN(value) || value < 0) {
                errors.push(`${field} must be a non-negative number`);
            }
        }
    });

    // Version check for updates
    if (req.method === 'PUT' && item.version === undefined) {
        errors.push('Version is required for updates');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

module.exports = validateConsumptionUnit;