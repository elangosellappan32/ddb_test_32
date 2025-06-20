const productionSiteDAL = require('./productionSiteDAL');
const logger = require('../utils/logger');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');
const TableNames = require('../constants/tableNames');
const { updateUserSiteAccess, removeSiteAccess } = require('../services/siteAccessService');

const dynamoDB = DynamoDBDocument.from(new DynamoDB({
    region: process.env.AWS_REGION || 'local',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
}));

// Validation functions
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

// CRUD Operations
const createProductionSite = async (req, res) => {
    try {
        logger.info('[REQUEST] Create Production Site');
        logger.debug('[REQUEST BODY]', req.body);

        // Validate required fields
        const fieldsValidation = validateRequiredFields(req.body);
        if (!fieldsValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: fieldsValidation.error,
                code: fieldsValidation.code
            });
        }

        // Validate decimal fields
        const decimalFields = {
            capacity_MW: 'Capacity (MW)',
            annualProduction_L: 'Annual Production (L)',
            injectionVoltage_KV: 'Injection Voltage (KV)'
        };

        for (const [field, label] of Object.entries(decimalFields)) {
            if (req.body[field] !== undefined) {
                const validation = validateDecimal(req.body[field], label);
                if (!validation.isValid) {
                    return res.status(400).json({
                        success: false,
                        message: validation.error,
                        code: validation.code
                    });
                }
                req.body[field] = validation.value.toString();
            }
        }

                // Ensure we have the company ID
        const companyId = req.body.companyId || (req.user && req.user.companyId);
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required',
                code: 'MISSING_COMPANY_ID'
            });
        }

        // Create site
        const result = await productionSiteDAL.create({
            ...req.body,
            companyId // Ensure companyId is set
        });
        
        logger.info('[RESPONSE] Production Site Created:', result);

        // Add site access for the creating user
        const userId = req.body.userId || (req.user && (req.user.id || req.user.userId));
        if (userId) {
            try {
                const siteKey = `${result.companyId}_${result.productionSiteId}`;
                logger.info(`Adding site access for user ${userId} to site ${siteKey}`);
                
                // Update user's site access
                await updateUserSiteAccess(
                    userId,
                    result.companyId,
                    result.productionSiteId.toString(), // Ensure it's a string
                    'production'
                );
                
                logger.info(`Successfully added site access for user ${userId} to site ${siteKey}`);
                
                // Add the siteKey to the response for the frontend
                result.siteKey = siteKey;
            } catch (accessError) {
                logger.error('Error updating user site access:', {
                    error: accessError.message,
                    stack: accessError.stack,
                    userId,
                    companyId: result.companyId,
                    siteId: result.productionSiteId
                });
                // Don't fail the request if access update fails
                logger.warn('Site was created but user access update failed:', accessError.message);
            }
        } else {
            logger.warn('No user ID found in request or session while creating production site');
        }

        res.status(201).json({
            success: true,
            message: 'Production site created successfully',
            data: result
        });
    } catch (error) {
        logger.error('[ProductionSiteController] Create Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create production site',
            error: error.message,
            code: 'CREATE_ERROR'
        });
    }
};

const updateProductionSite = async (req, res) => {
    try {
        const { companyId, productionSiteId } = req.params;
        
        // Normalize the request body
        const updates = { ...req.body };

        // Handle Annual Production field variations
        if (updates.annualProduction && !updates.annualProduction_L) {
            updates.annualProduction_L = updates.annualProduction;
            delete updates.annualProduction;
        }

        // Validate banking based on status
        if (updates.status === 'Inactive' || updates.status === 'Maintenance') {
            updates.banking = 0;
        }

        // Validate decimal fields
        const decimalFields = {
            capacity_MW: 'Capacity (MW)',
            annualProduction_L: 'Annual Production (L)',
            injectionVoltage_KV: 'Injection Voltage (KV)'
        };

        for (const [field, label] of Object.entries(decimalFields)) {
            if (updates[field] !== undefined) {
                const validation = validateDecimal(updates[field], label);
                if (!validation.isValid) {
                    return res.status(400).json({
                        success: false,
                        message: validation.error,
                        code: validation.code
                    });
                }
                updates[field] = validation.value.toString();
            }
        }

        const updatedItem = await productionSiteDAL.updateItem(
            companyId,
            productionSiteId,
            updates
        );
        
        res.json({
            success: true,
            data: updatedItem
        });
    } catch (error) {
        logger.error('[ProductionSiteController] Update Error:', error);
        const statusCode = error.message.includes('Version mismatch') ? 409 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: 'UPDATE_ERROR'
        });
    }
};

const getProductionSite = async (req, res) => {
    try {
        const { companyId, productionSiteId } = req.params;
        logger.info(`[REQUEST] Get Production Site ${productionSiteId}`);

        const result = await productionSiteDAL.getItem(companyId, productionSiteId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Production site not found',
                code: 'NOT_FOUND'
            });
        }

        res.json({
            success: true,
            message: 'Production site retrieved successfully',
            data: result
        });
    } catch (error) {
        logger.error('[ProductionSiteController] Get Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve production site',
            error: error.message,
            code: 'GET_ERROR'
        });
    }
};

const deleteProductionSite = async (req, res) => {
    try {
        const { companyId, productionSiteId } = req.params;
        logger.info(`[REQUEST] Delete Production Site ${productionSiteId}`);

        // Authentication check
        if (!req.user) {
            logger.error('[ProductionSiteController] No authenticated user');
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'UNAUTHORIZED'
            });
        }

        // Permission check
        if (!req.user.permissions?.production?.includes('DELETE')) {
            logger.error('[ProductionSiteController] User lacks DELETE permission:', req.user.permissions);
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete sites',
                code: 'DELETE_NOT_ALLOWED'
            });
        }

        // Input validation
        if (!companyId || !productionSiteId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID and Production Site ID are required',
                code: 'INVALID_INPUT'
            });
        }

        // Check if site exists and is accessible
        let existingSite;
        try {
            existingSite = await productionSiteDAL.getItem(companyId, productionSiteId);
        } catch (error) {
            logger.error('[ProductionSiteController] Error checking site existence:', error);
            return res.status(500).json({
                success: false,
                message: 'Error checking site existence',
                code: 'DATABASE_ERROR'
            });
        }

        if (!existingSite) {
            return res.status(404).json({
                success: false,
                message: 'Production site not found',
                code: 'NOT_FOUND'
            });
        }

        // If user has restricted access, validate they can access this site
        if (req.user?.accessibleSites?.productionSites) {
            const accessibleSiteIds = req.user.accessibleSites.productionSites.L.map(site => site.S);
            const siteId = `${companyId}_${productionSiteId}`;
            if (!accessibleSiteIds.includes(siteId)) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to delete this site',
                    code: 'ACCESS_DENIED'
                });
            }
        }

        // Delete site and handle cleanup
        let result;
        try {
            result = await productionSiteDAL.deleteItem(companyId, productionSiteId);
        } catch (error) {
            logger.error('[ProductionSiteController] Error during site deletion:', error);
            
            if (error.code === 'ConditionalCheckFailedException') {
                return res.status(409).json({
                    success: false,
                    message: 'Site has been modified by another user',
                    code: 'CONFLICT'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to delete production site',
                code: 'DELETE_ERROR',
                error: error.message
            });
        }

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Deletion failed - no result returned',
                code: 'DELETE_ERROR'
            });
        }

        // Remove site access for all users
        try {
            await removeSiteAccess(companyId, productionSiteId, 'production');
            logger.info(`[SUCCESS] Site access removed for production site: ${companyId}_${productionSiteId}`);
        } catch (accessError) {
            logger.error('Error removing site access:', accessError);
            // Continue with the response even if access removal fails
        }

        // Log the successful deletion
        logger.info('[SUCCESS] Site deletion completed:', {
            siteId: productionSiteId,
            cleanupStats: result.relatedDataCleanup || {}
        });

        return res.json({
            success: true,
            message: 'Production site deleted successfully',
            data: result
        });
    } catch (error) {
        logger.error('[ProductionSiteController] Unexpected error during deletion:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while deleting the production site',
            error: error.message,
            code: 'UNEXPECTED_ERROR'
        });
    }
};

const getAllProductionSites = async (req, res) => {
    try {
        // Get all production sites
        let items = await productionSiteDAL.getAllProductionSites();
        
        // Filter items based on user's accessible sites
        if (req.user && req.user.accessibleSites) {
            const accessibleSiteIds = req.user.accessibleSites.productionSites.L.map(site => site.S);
            items = items.filter(item => {
                const siteId = `${item.companyId}_${item.productionSiteId}`;
                return accessibleSiteIds.includes(siteId);
            });
        }

        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        logger.error('[ProductionSiteController] Error fetching production sites:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch production sites',
            error: error.message
        });
    }
};

module.exports = {
    createProductionSite,
    getProductionSite,
    updateProductionSite,
    deleteProductionSite,
    getAllProductionSites
};