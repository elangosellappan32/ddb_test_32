const validateConsumptionSiteUpdate = (req, res, next) => {
    const updates = req.body;
    const errors = [];

    if (typeof updates.version !== 'number') {
        errors.push('Version number is required for updates');
    }

    if (updates.name !== undefined) {
        if (typeof updates.name !== 'string' || updates.name.trim().length < 3) {
            errors.push('Name must be at least 3 characters');
        }
    }

    if (updates.location !== undefined) {
        if (typeof updates.location !== 'string' || updates.location.trim().length < 2) {
            errors.push('Location must be at least 2 characters');
        }
    }

    if (updates.type !== undefined) {
        const validTypes = ['industrial', 'textile', 'other'];
        if (!validTypes.includes(updates.type.toLowerCase())) {
            errors.push(`Type must be one of: ${validTypes.join(', ')}`);
        }
    }

    if (updates.annualConsumption !== undefined) {
        const consumption = Number(updates.annualConsumption);
        if (isNaN(consumption) || consumption < 0) {
            errors.push('Annual consumption must be a non-negative number');
        }
    }

    if (updates.status !== undefined) {
        const validStatuses = ['active', 'inactive'];
        if (!validStatuses.includes(updates.status.toLowerCase())) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
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

module.exports = validateConsumptionSiteUpdate;