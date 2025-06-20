const validateConsumptionSite = (req, res, next) => {
    const item = req.body;
    const errors = [];

    if (!item.name || typeof item.name !== 'string' || item.name.trim().length < 3) {
        errors.push('Name is required and must be at least 3 characters');
    }

    if (!item.location || typeof item.location !== 'string' || item.location.trim().length < 2) {
        errors.push('Location is required and must be at least 2 characters');
    }

    const validTypes = ['industrial', 'textile', 'other'];
    if (!item.type || !validTypes.includes(item.type.toLowerCase())) {
        errors.push(`Type must be one of: ${validTypes.join(', ')}`);
    }

    if (item.annualConsumption !== undefined) {
        const consumption = Number(item.annualConsumption);
        if (isNaN(consumption) || consumption < 0) {
            errors.push('Annual consumption must be a non-negative number');
        }
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

module.exports = validateConsumptionSite;