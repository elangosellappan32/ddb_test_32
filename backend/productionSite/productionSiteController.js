const productionSiteDAL = require('./productionSiteDAL');
const companyDAL = require('../company/companyDAL');
const logger = require('../utils/logger');
const TableNames = require('../constants/tableNames');
const { updateUserSiteAccess, removeSiteAccess } = require('../services/siteAccessService');

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

const validateDate = (dateInput, fieldName) => {
    // Handle null/undefined/empty string
    if (!dateInput) {
        return { isValid: true, value: null };
    }
    
    // If it's already a valid date object
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return { 
            isValid: true, 
            value: dateInput.toISOString() 
        };
    }
    
    // Handle string dates (ISO format or other common formats)
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return {
            isValid: false,
            error: `${fieldName} must be a valid date`,
            code: 'INVALID_DATE'
        };
    }
    
    // Ensure the date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date > today) {
        return {
            isValid: false,
            error: `${fieldName} cannot be in the future`,
            code: 'FUTURE_DATE'
        };
    }
    
    return { 
        isValid: true, 
        value: date.toISOString() 
    };
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
            injectionVoltage_KV: 'Injection Voltage (KV)',
            revenuePerUnit: 'Revenue Per Unit'
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

        // Validate dateOfCommission if provided
        if (req.body.dateOfCommission !== undefined) {
            const dateValidation = validateDate(req.body.dateOfCommission, 'Date of Commission');
            if (!dateValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: dateValidation.error,
                    code: dateValidation.code
                });
            }
            req.body.dateOfCommission = dateValidation.value;
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
        logger.error('[ProductionSiteController] Create Error:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack,
            fullError: error
        });
        
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create production site',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: error.code || 'CREATE_ERROR'
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
            injectionVoltage_KV: 'Injection Voltage (KV)',
            revenuePerUnit: 'Revenue Per Unit'
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
                updates[field] = validation.value;
            }
        }

        // Validate dateOfCommission if provided
        if (updates.dateOfCommission !== undefined) {
            const dateValidation = validateDate(updates.dateOfCommission, 'Date of Commission');
            if (!dateValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: dateValidation.error,
                    code: dateValidation.code
                });
            }
            updates.dateOfCommission = dateValidation.value;
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

        // Get company name
        let companyName = 'Unknown Company';
        try {
            const company = await companyDAL.getCompanyById(companyId);
            if (company && company.companyName) {
                companyName = company.companyName;
            }
        } catch (error) {
            logger.error(`Error fetching company ${companyId}:`, error);
        }

        // Add company name to the result
        const resultWithCompany = {
            ...result,
            companyName: result.companyName || companyName
        };

        res.json({
            success: true,
            message: 'Production site retrieved successfully',
            data: resultWithCompany
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
            try {
                const accessibleSiteIds = req.user.accessibleSites.productionSites.L?.map(site => site.S) || [];
                const siteId = `${companyId}_${productionSiteId}`;
                if (!accessibleSiteIds.includes(siteId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'You do not have permission to delete this site',
                        code: 'ACCESS_DENIED'
                    });
                }
            } catch (accessError) {
                logger.warn('[ProductionSiteController] Error checking site access:', accessError);
                // If access check fails, allow operation to continue with permission check based on role
            }
        }

        // Delete site and handle cleanup
        let result;
        let siteAccessRemoved = false;

        try {
            // 1. Remove site access first to prevent new operations during deletion
            try {
                await removeSiteAccess(companyId, productionSiteId, 'production');
                logger.info(`[SUCCESS] Site access removed for production site: ${companyId}_${productionSiteId}`);
                siteAccessRemoved = true;
            } catch (accessError) {
                logger.error('[ProductionSiteController] Error removing site access:', {
                    error: accessError,
                    companyId,
                    productionSiteId
                });
                // Continue with deletion even if access removal fails
            }

            // 2. Delete the site and its related data
            result = await productionSiteDAL.deleteItem(companyId, productionSiteId);
            
            if (!result) {
                throw new Error('Deletion failed - no result returned from DAL');
            }

            // 3. Log the successful deletion
            logger.info('[SUCCESS] Site deletion completed:', {
                siteId: productionSiteId,
                cleanupStats: result.relatedDataCleanup || {},
                siteAccessRemoved
            });

            // 4. Return success response
            return res.json({
                success: true,
                message: 'Production site deleted successfully',
                data: {
                    ...result,
                    siteAccessRemoved
                }
            });

        } catch (error) {
            // Log the complete error for debugging
            logger.error('[ProductionSiteController] Error during site deletion:', {
                error,
                stack: error.stack,
                companyId,
                productionSiteId,
                siteAccessRemoved
            });

            // Handle specific error cases
            if (error.code === 'ConditionalCheckFailedException') {
                return res.status(409).json({
                    success: false,
                    message: 'Site has been modified by another user',
                    code: 'CONFLICT'
                });
            }

            if (error.code === 'ResourceNotFoundException' || error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Production site not found',
                    code: 'NOT_FOUND'
                });
            }

            // Generic error response
            return res.status(500).json({
                success: false,
                message: 'Failed to delete production site',
                code: 'DELETE_ERROR',
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
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
        if (req.user && req.user.accessibleSites && req.user.accessibleSites.productionSites) {
            try {
                const accessibleSiteIds = req.user.accessibleSites.productionSites.L?.map(site => site.S) || [];
                items = items.filter(item => {
                    const siteId = `${item.companyId}_${item.productionSiteId}`;
                    return accessibleSiteIds.includes(siteId);
                });
            } catch (filterError) {
                logger.warn('[ProductionSiteController] Error filtering sites by accessibility:', filterError);
                // If filtering fails, return all sites for the user's company
                if (req.user.companyId) {
                    items = items.filter(item => item.companyId === String(req.user.companyId));
                }
            }
        }

        if (!items || items.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No production sites found',
                data: []
            });
        }

        // Get unique company IDs and log them
        const companyIds = [...new Set(items.map(item => {
            const id = item.companyId;
            return id;
        }))];
        
        
        // Fetch company details for all unique company IDs with better error handling
        const companies = await Promise.all(
            companyIds.map(async (companyId) => {
                try {
                    const company = await companyDAL.getCompanyById(companyId);
                    
                    if (!company) {
                        logger.warn(`[ProductionSiteController] No company found for ID: ${companyId}`);
                        return null;
                    }
                    
                    
                    return company;
                } catch (error) {
                    logger.error(`[ProductionSiteController] Error fetching company ${companyId}:`, error);
                    return null;
                }
            })
        );

        

        // Create a map of companyId to companyName with type handling
        const companyMap = {};
        companies.forEach(company => {
            if (company && company.companyId !== undefined) {
                // Map both string and number versions of the ID
                const id = company.companyId;
                companyMap[String(id)] = company.companyName;
                companyMap[Number(id)] = company.companyName;
            }
        });

        // Add companyName to each site with type handling
        const itemsWithCompanyNames = items.map(item => {
            const companyName = companyMap[item.companyId] || 
                              companyMap[String(item.companyId)] || 
                              companyMap[Number(item.companyId)] || 
                              'Unknown Company';
            
            
            return {
                ...item,
                companyName: companyName
            };
        });


        return res.status(200).json({
            success: true,
            message: 'Production sites retrieved successfully',
            data: itemsWithCompanyNames
        });
    } catch (error) {
        logger.error('[ProductionSiteController] Error getting production sites:', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve production sites',
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