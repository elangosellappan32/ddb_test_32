const captiveDAL = require('./captiveDAL');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
// DynamoDB client is already required via captiveDAL

// Get allocation percentages for a company
exports.getAllocationPercentages = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required',
                code: 'VALIDATION_ERROR'
            });
        }

        // Get all captives where the company is either generator or shareholder
        const [asGenerator, asShareholder] = await Promise.all([
            captiveDAL.getCaptivesByGenerator(companyId),
            captiveDAL.getCaptivesByShareholder(companyId)
        ]);

        const allCaptives = [...asGenerator, ...asShareholder];
        
        if (allCaptives.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No allocation data found for the company',
                code: 'NOT_FOUND'
            });
        }

        // Calculate total allocation for the company as a generator
        const generatorAllocations = asGenerator
            .reduce((total, captive) => total + (Number(captive.allocationPercentage) || 0), 0);

        // Calculate total allocation for the company as a shareholder
        const shareholderAllocations = asShareholder
            .reduce((total, captive) => total + (Number(captive.allocationPercentage) || 0), 0);

        // Prepare response with detailed allocation data
        const response = {
            companyId: Number(companyId),
            totalAllocationAsGenerator: generatorAllocations,
            totalAllocationAsShareholder: shareholderAllocations,
            allocations: allCaptives.map(captive => ({
                generatorCompanyId: captive.generatorCompanyId,
                generatorCompanyName: captive.generatorCompanyName,
                shareholderCompanyId: captive.shareholderCompanyId,
                shareholderCompanyName: captive.shareholderCompanyName,
                allocationPercentage: Number(captive.allocationPercentage) || 0,
                allocationStatus: captive.allocationStatus || 'active',
                lastUpdated: captive.updatedAt || captive.createdAt
            }))
        };

        res.json({
            success: true,
            data: response
        });

    } catch (error) {
        logger.error('Error getting allocation percentages:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving allocation data',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
};

// Get all Captive entries
exports.getAllCaptives = async (req, res) => {
    try {
        logger.info('Fetching all captive entries');
        const captives = await captiveDAL.getAllCaptives();
        
        // Ensure we always return an array, even if empty
        const result = Array.isArray(captives) ? captives : [];
        
        logger.info(`Found ${result.length} captive entries`);
        
        res.status(200).json({
            success: true,
            data: result,
            count: result.length
        });
    } catch (error) {
        logger.error('Error in getAllCaptives:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching captive entries',
            error: error.message
        });
    }
};

// Get Captive entries by Generator Company ID
exports.getCaptivesByGenerator = async (req, res) => {
    try {
        const { id } = req.params;
        logger.info('Fetching captive entries for generator company:', { id });
        
        const entries = await captiveDAL.getCaptivesByGenerator(id);
        
        logger.info(`Found ${entries.length} entries for generator company ${id}`);
        res.status(200).json({
            success: true,
            data: entries || [],
            count: entries.length
        });
    } catch (error) {
        logger.error('Error in getCaptivesByGenerator:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching Captive entries', 
            error: error.message 
        });
    }
};

// Get specific Captive entry by generator and shareholder company IDs
exports.getCaptiveByCompanies = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId } = req.params;
        logger.info('Fetching captive entry for companies:', { generatorCompanyId, shareholderCompanyId });
        
        const entry = await captiveDAL.getCaptiveByCompanies(generatorCompanyId, shareholderCompanyId);
        if (!entry) {
            return res.status(404).json({ 
                success: false,
                message: 'Captive entry not found' 
            });
        }
        res.status(200).json({
            success: true,
            data: entry
        });
    } catch (error) {
        logger.error('Controller error in getCaptiveByCompanies:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching Captive entry', 
            error: error.message 
        });
    }
};

// Create or update captive entries
exports.upsertCaptives = async (req, res) => {
    try {
        const captiveEntries = req.body;
        
        if (!Array.isArray(captiveEntries) || captiveEntries.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body. Expected an array of captive entries.',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validate each entry
        const invalidEntries = [];
        captiveEntries.forEach((entry, index) => {
            // Check required fields
            const requiredFields = ['generatorCompanyId', 'shareholderCompanyId', 'generatorCompanyName', 'shareholderCompanyName'];
            const missingFields = requiredFields.filter(field => !entry[field]);
            
            if (missingFields.length > 0) {
                invalidEntries.push({
                    index,
                    error: `Missing required fields: ${missingFields.join(', ')}`,
                    data: entry
                });
            }

            // Validate numeric values
            if (!Number.isInteger(Number(entry.generatorCompanyId))) {
                invalidEntries.push({
                    index,
                    error: 'generatorCompanyId must be a valid integer',
                    data: entry
                });
            }

            if (!Number.isInteger(Number(entry.shareholderCompanyId))) {
                invalidEntries.push({
                    index,
                    error: 'shareholderCompanyId must be a valid integer',
                    data: entry
                });
            }

            // Validate allocation percentage
            if (entry.allocationPercentage !== undefined && 
                (isNaN(entry.allocationPercentage) || 
                entry.allocationPercentage < 0 || 
                entry.allocationPercentage > 100)) {
                invalidEntries.push({
                    index,
                    error: 'Invalid allocation percentage. Must be between 0 and 100.',
                    data: entry
                });
            }
        });

        if (invalidEntries.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid captive data',
                errors: invalidEntries,
                code: 'VALIDATION_ERROR'
            });
        }

        await captiveDAL.batchUpsertCaptives(captiveEntries);

        res.status(200).json({
            success: true,
            message: 'Captive entries processed successfully',
            count: captiveEntries.length
        });

    } catch (error) {
        logger.error('Error in upsertCaptives:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing captive entries',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
};
// captiveController.js

// ... existing imports and code ...

// Update existing captive entry
exports.updateCaptive = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId } = req.params;
        const updateData = req.body;
        
        logger.info('Updating captive entry:', { generatorCompanyId, shareholderCompanyId, updateData });
        
        // Validate the allocation percentage if it's being updated
        if (updateData.allocationPercentage !== undefined) {
            if (isNaN(updateData.allocationPercentage) || 
                updateData.allocationPercentage < 0 || 
                updateData.allocationPercentage > 100) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid allocation percentage. Must be between 0 and 100.' 
                });
            }
        }

        // Check if entry exists first
        const existing = await captiveDAL.getCaptiveByCompanies(generatorCompanyId, shareholderCompanyId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Captive entry not found'
            });
        }

        // Add update timestamp
        const updatedEntry = await captiveDAL.updateCaptive(generatorCompanyId, shareholderCompanyId, {
            ...updateData,
            updatedAt: new Date().toISOString()
        });
        
        res.json({ 
            success: true, 
            message: 'Captive entry updated successfully',
            data: updatedEntry
        });
    } catch (error) {
        logger.error('Error updating captive entry:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating captive entry',
            error: error.message 
        });
    }
};

// Delete a captive entry
exports.deleteCaptive = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId } = req.params;
        
        logger.info('Deleting captive entry:', { generatorCompanyId, shareholderCompanyId });
        
        // Check if entry exists first
        const existing = await captiveDAL.getCaptiveByCompanies(generatorCompanyId, shareholderCompanyId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Captive entry not found'
            });
        }

        await captiveDAL.deleteCaptive(generatorCompanyId, shareholderCompanyId);
        
        res.json({ 
            success: true, 
            message: 'Captive entry deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting captive entry:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting captive entry',
            error: error.message 
        });
    }
};

// Update multiple captive entries in bulk
exports.bulkUpdateCaptives = async (req, res) => {
    try {
        const updates = req.body;
        
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body. Expected an array of update objects.',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validate each update
        const validationErrors = [];
        const validUpdates = [];
        
        for (const [index, update] of updates.entries()) {
            // Check required fields
            if (!update.generatorCompanyId || !update.shareholderCompanyId) {
                validationErrors.push({
                    index,
                    error: 'Missing required fields: generatorCompanyId and shareholderCompanyId are required',
                    data: update
                });
                continue;
            }

            // Validate allocation percentage
            if (update.allocationPercentage === undefined || 
                isNaN(update.allocationPercentage) || 
                update.allocationPercentage < 0 || 
                update.allocationPercentage > 100) {
                validationErrors.push({
                    index,
                    error: 'allocationPercentage must be a number between 0 and 100',
                    data: update
                });
                continue;
            }

            validUpdates.push(update);
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed for some updates',
                errors: validationErrors,
                code: 'VALIDATION_ERROR'
            });
        }

        // Process updates in parallel without transactions
        const results = await Promise.all(
            validUpdates.map(update => 
                captiveDAL.updateCaptive(
                    update.generatorCompanyId,
                    update.shareholderCompanyId,
                    {
                        allocationPercentage: update.allocationPercentage,
                        allocationStatus: update.allocationStatus || 'active',
                        generatorCompanyName: update.generatorCompanyName,
                        shareholderCompanyName: update.shareholderCompanyName
                    }
                )
            )
        );
        
        res.status(200).json({
            success: true,
            data: {
                updatedCount: results.filter(Boolean).length,
                totalUpdates: validUpdates.length
            },
            message: 'Bulk update completed successfully'
        });

    } catch (error) {
        logger.error('Error in bulkUpdateCaptives:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating captive entries',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
};

// Create a new captive entry
exports.createCaptive = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId } = req.body;
        
        // Validate required fields
        const requiredFields = ['generatorCompanyId', 'shareholderCompanyId', 'generatorCompanyName', 'shareholderCompanyName'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate numeric values
        if (!Number.isInteger(Number(generatorCompanyId))) {
            return res.status(400).json({
                success: false,
                message: 'generatorCompanyId must be a valid integer'
            });
        }

        if (!Number.isInteger(Number(shareholderCompanyId))) {
            return res.status(400).json({
                success: false,
                message: 'shareholderCompanyId must be a valid integer'
            });
        }

        // Check if entry already exists
        const existing = await captiveDAL.getCaptiveByCompanies(generatorCompanyId, shareholderCompanyId);
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Captive entry already exists'
            });
        }

        // Create new entry with timestamps
        const newEntry = await captiveDAL.createCaptive({
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.status(201).json({
            success: true,
            message: 'Captive entry created successfully',
            data: newEntry
        });
    } catch (error) {
        logger.error('Error creating captive entry:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating captive entry',
            error: error.message
        });
    }
};
