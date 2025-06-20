const logger = require('../utils/logger');
const consumptionSiteDAL = require('./consumptionSiteDAL');
const { updateUserSiteAccess, removeSiteAccess } = require('../services/siteAccessService');

// Update validateRequiredFields to match production site validation
const validateRequiredFields = (data) => {
    const requiredFields = [
        'companyId',
        'name',
        'location',
        'type'
    ];

    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
        return {
            isValid: false,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            code: 'MISSING_FIELDS'
        };
    }

    return { isValid: true };
};

// Validate decimal fields consistently
const validateDecimal = (value, fieldName) => {
    try {
        if (value === undefined || value === null) {
            return { isValid: true, value: 0 };
        }
        const numValue = Number(value);
        if (isNaN(numValue)) {
            return {
                isValid: false,
                error: `${fieldName} must be a number`,
                code: 'INVALID_NUMBER'
            };
        }
        if (numValue < 0) {
            return {
                isValid: false,
                error: `${fieldName} cannot be negative`,
                code: 'INVALID_NUMBER'
            };
        }
        return { isValid: true, value: numValue };
    } catch (error) {
        return {
            isValid: false,
            error: `Invalid ${fieldName}`,
            code: 'INVALID_NUMBER'
        };
    }
};

// Validate and parse annual consumption field
const validateAnnualConsumption = (value) => {
    try {
        // If value is not provided, return 0 as default
        if (value === undefined || value === null || value === '') {
            return { isValid: true, value: 0 };
        }
        
        // Convert to number and round to nearest integer
        const numValue = Math.round(Number(value));
        
        // Check if conversion was successful
        if (isNaN(numValue)) {
            return {
                isValid: false,
                error: 'Annual consumption must be a valid number',
                code: 'INVALID_ANNUAL_CONSUMPTION'
            };
        }
        
        // Ensure non-negative value
        if (numValue < 0) {
            return {
                isValid: false,
                error: 'Annual consumption cannot be negative',
                code: 'NEGATIVE_ANNUAL_CONSUMPTION'
            };
        }
        
        return { 
            isValid: true, 
            value: numValue,
            message: 'Annual consumption validated successfully'
        };
    } catch (error) {
        logger.error('Error validating annual consumption:', { value, error });
        return {
            isValid: false,
            error: 'Invalid annual consumption value',
            code: 'VALIDATION_ERROR',
            details: error.message
        };
    }
};

// CRUD Operations
const getAllConsumptionSites = async (req, res) => {
    try {
        let items = await consumptionSiteDAL.getAllConsumptionSites();

        // Filter items based on user's accessible sites
        if (req.user && req.user.accessibleSites) {
            const accessibleSiteIds = req.user.accessibleSites.consumptionSites.L.map(site => site.S);
            items = items.filter(item => {
                const siteId = `${item.companyId}_${item.consumptionSiteId}`;
                return accessibleSiteIds.includes(siteId);
            });
        }

        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        logger.error('[ConsumptionSiteController] GetAll Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getConsumptionSite = async (req, res) => {
    try {
        const { companyId, consumptionSiteId } = req.params;
        const item = await consumptionSiteDAL.getConsumptionSite(companyId, consumptionSiteId);
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Consumption site not found'
            });
        }

        // Additional validation at controller level
        if (!item.name || !item.type || !item.location) {
            return res.status(500).json({
                success: false,
                message: 'Invalid site data structure'
            });
        }

        res.json({
            success: true,
            data: {
                ...item,
                type: item.type.toLowerCase(),
                status: item.status?.toLowerCase() || 'active',
                version: Number(item.version || 1),
                drawalVoltage_KV: Number(item.drawalVoltage_KV || 0),
                contractDemand_KVA: Number(item.contractDemand_KVA || 0),
                annualConsumption_L: Number(item.annualConsumption_L || 0),
                createdat: item.createdat || new Date().toISOString(),
                updatedat: item.updatedat || new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('[ConsumptionSiteController] Get Error:', error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const createConsumptionSite = async (req, res) => {
    try {
        // 1. Validate required fields
        const validation = validateRequiredFields(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: validation.error,
                code: validation.code || 'VALIDATION_ERROR'
            });
        }

        // 2. Validate annual consumption
        const consumptionValidation = validateAnnualConsumption(req.body.annualConsumption);
        if (!consumptionValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: consumptionValidation.error,
                code: consumptionValidation.code || 'INVALID_ANNUAL_CONSUMPTION'
            });
        }

        // 3. Ensure we have the company ID
        const companyId = req.body.companyId || (req.user && req.user.companyId);
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required',
                code: 'MISSING_COMPANY_ID'
            });
        }

        // 4. Prepare site data with validated values
        const siteData = {
            ...req.body,
            annualConsumption: consumptionValidation.value, // Use validated value
            status: 'active',
            companyId // Ensure companyId is set
        };

        // 5. Create the site in the database
        const newSite = await consumptionSiteDAL.createConsumptionSite(siteData);
        logger.info('Created new consumption site:', { 
            siteId: newSite.consumptionSiteId,
            companyId: newSite.companyId
        });

        // 6. Update user's accessible sites if user ID is provided
        const userId = req.body.userId || (req.user && (req.user.id || req.user.userId));
        if (userId) {
            try {
                const siteKey = `${newSite.companyId}_${newSite.consumptionSiteId}`;
                logger.info(`Adding site access for user ${userId} to site ${siteKey}`);
                
                // Update user's site access with proper types
                await updateUserSiteAccess(
                    userId,
                    newSite.companyId.toString(),
                    newSite.consumptionSiteId.toString(),
                    'consumption'
                );
                
                logger.info(`Successfully added site access for user ${userId} to site ${siteKey}`);
                
                // Add the siteKey to the response for the frontend
                newSite.siteKey = siteKey;
            } catch (accessError) {
                // Log detailed error but don't fail the request
                logger.error('Failed to update user site access:', {
                    error: accessError.message,
                    stack: accessError.stack,
                    userId,
                    companyId: newSite.companyId,
                    siteId: newSite.consumptionSiteId
                });
                logger.warn('Site was created but user access update failed');
            }
        } else {
            logger.warn('No user ID found in request or session while creating consumption site');
        }

        // 6. Return success response
        res.status(201).json({
            success: true,
            data: newSite,
            message: 'Consumption site created successfully',
            code: 'SITE_CREATED'
        });
    } catch (error) {
        logger.error('[ConsumptionSiteController] Create Error:', error);
        
        // Handle specific error cases
        if (error.code === 'ConditionalCheckFailedException') {
            return res.status(409).json({
                success: false,
                message: 'A site with this ID already exists',
                code: 'SITE_ALREADY_EXISTS'
            });
        }
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: error.code || 'VALIDATION_ERROR',
                details: error.details
            });
        }
        
        // Handle other errors
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'An unexpected error occurred while creating the consumption site',
            code: error.code || 'INTERNAL_SERVER_ERROR',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

const updateConsumptionSite = async (req, res) => {
    try {
        const { companyId, consumptionSiteId } = req.params;
        const updates = req.body;

        // 1. Validate update data
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No update data provided',
                code: 'NO_UPDATE_DATA'
            });
        }

        // 2. If annualConsumption is being updated, validate it
        if (updates.annualConsumption !== undefined) {
            const validation = validateAnnualConsumption(updates.annualConsumption);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error,
                    code: validation.code || 'INVALID_ANNUAL_CONSUMPTION'
                });
            }
            updates.annualConsumption = validation.value;
        }

        // 3. Log the update attempt
        logger.info('Updating consumption site:', { 
            companyId, 
            consumptionSiteId, 
            updates: Object.keys(updates) 
        });

        // 4. Perform the update
        const updatedSite = await consumptionSiteDAL.updateConsumptionSite(
            companyId,
            consumptionSiteId,
            updates
        );

        // 5. Return success response
        res.json({
            success: true,
            data: updatedSite,
            message: 'Consumption site updated successfully',
            code: 'SITE_UPDATED'
        });
    } catch (error) {
        logger.error('[ConsumptionSiteController] Update Error:', error);
        
        // 6. Handle specific error cases
        if (error.statusCode === 404) {
            return res.status(404).json({
                success: false,
                message: 'Consumption site not found',
                code: 'SITE_NOT_FOUND',
                details: `No site found with companyId: ${req.params.companyId}, siteId: ${req.params.consumptionSiteId}`
            });
        }
        
        if (error.statusCode === 409) {
            return res.status(409).json({
                success: false,
                message: 'Version conflict. The site was modified by another user.',
                code: 'VERSION_CONFLICT',
                details: 'Please refresh and try again'
            });
        }
        
        // 7. Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: error.code || 'VALIDATION_ERROR',
                details: error.details
            });
        }
        
        // 8. Handle other errors
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'An unexpected error occurred while updating the consumption site',
            code: error.code || 'INTERNAL_SERVER_ERROR',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

const deleteConsumptionSite = async (req, res) => {
    try {
        const { companyId, consumptionSiteId } = req.params;

        // Authentication check
        if (!req.user) {
            logger.error('[ConsumptionSiteController] No authenticated user');
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'UNAUTHORIZED'
            });
        }

        // Permission check
        if (!req.user.permissions?.consumption?.includes('DELETE')) {
            logger.error('[ConsumptionSiteController] User lacks DELETE permission:', req.user.permissions);
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete sites',
                code: 'DELETE_NOT_ALLOWED'
            });
        }

        // Input validation
        if (!companyId || !consumptionSiteId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID and Consumption Site ID are required',
                code: 'INVALID_INPUT'
            });
        }

        // If user has restricted access, validate they can access this site
        if (req.user?.accessibleSites?.consumptionSites) {
            const accessibleSiteIds = req.user.accessibleSites.consumptionSites.L.map(site => site.S);
            const siteId = `${companyId}_${consumptionSiteId}`;
            if (!accessibleSiteIds.includes(siteId)) {
                logger.error(`[ConsumptionSiteController] User ${req.user.username} attempted to delete inaccessible site ${siteId}`);
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to delete this site',
                    code: 'ACCESS_DENIED'
                });
            }
        }

        // Check if site exists
        const existingSite = await consumptionSiteDAL.getConsumptionSite(companyId, consumptionSiteId);
        if (!existingSite) {
            logger.warn(`[ConsumptionSiteController] Attempt to delete non-existent site: ${companyId}_${consumptionSiteId}`);
            return res.status(404).json({
                success: false,
                message: 'Consumption site not found',
                code: 'NOT_FOUND'
            });
        }

        // Proceed with deletion and cleanup
        let result;
        try {
            result = await consumptionSiteDAL.deleteConsumptionSite(companyId, consumptionSiteId);
            logger.info(`[ConsumptionSiteController] Successfully deleted site: ${companyId}_${consumptionSiteId}`);

            // Remove site access for all users
            try {
                await removeSiteAccess(companyId, consumptionSiteId, 'consumption');
                logger.info(`[ConsumptionSiteController] Removed site access for consumption site: ${companyId}_${consumptionSiteId}`);
            } catch (accessError) {
                logger.error('Error removing site access:', accessError);
                // Continue with the response even if access removal fails
            }
        } catch (error) {
            logger.error('[ConsumptionSiteController] Error during site deletion:', error);
            
            if (error.code === 'ConditionalCheckFailedException') {
                return res.status(409).json({
                    success: false,
                    message: 'Site has been modified by another user',
                    code: 'CONFLICT'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to delete consumption site',
                code: 'DELETE_ERROR',
                error: error.message
            });
        }

        if (!result) {
            logger.error('[ConsumptionSiteController] Deletion returned no result');
            return res.status(500).json({
                success: false,
                message: 'Deletion failed - no result returned',
                code: 'DELETE_ERROR'
            });
        }

        // Log the successful deletion with cleanup details
        logger.info('[SUCCESS] Site deletion completed:', {
            siteId: consumptionSiteId,
            cleanupStats: result.relatedDataCleanup
        });

        return res.json({
            success: true,
            message: 'Consumption site deleted successfully',
            data: result
        });
    } catch (error) {
        logger.error('[ConsumptionSiteController] Delete Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'An unexpected error occurred while deleting the consumption site',
            code: 'UNEXPECTED_ERROR'
        });
    }
};

module.exports = {
    getAllConsumptionSites,
    getConsumptionSite,
    createConsumptionSite,
    updateConsumptionSite,
    deleteConsumptionSite
};