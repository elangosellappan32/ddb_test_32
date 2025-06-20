const captiveDAL = require('./captiveDAL');
const logger = require('../utils/logger');

// Get Captive entries by Generator Company ID
exports.getCaptiveEntriesByGenerator = async (req, res) => {
    try {
        const { generatorCompanyId } = req.params;
        const entries = await captiveDAL.getCaptivesByGenerator(generatorCompanyId);
        res.status(200).json(entries);
    } catch (error) {
        logger.error('Controller error in getCaptiveEntriesByGenerator:', error);
        res.status(500).json({ 
            message: 'Error fetching Captive entries', 
            error: error.message 
        });
    }
};

// Get Captive entries by Shareholder Company ID
exports.getCaptiveEntriesByShareholder = async (req, res) => {
    try {
        const { shareholderCompanyId } = req.params;
        const entries = await captiveDAL.getCaptivesByShareholder(shareholderCompanyId);
        res.status(200).json(entries);
    } catch (error) {
        logger.error('Controller error in getCaptiveEntriesByShareholder:', error);
        res.status(500).json({ 
            message: 'Error fetching Captive entries', 
            error: error.message 
        });
    }
};

// Get specific Captive entry
exports.getCaptiveEntry = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId } = req.params;
        const entry = await captiveDAL.getCaptive(generatorCompanyId, shareholderCompanyId);
        if (!entry) {
            return res.status(404).json({ 
                message: 'Captive entry not found' 
            });
        }
        res.status(200).json(entry);
    } catch (error) {
        logger.error('Controller error in getCaptiveEntry:', error);
        res.status(500).json({ 
            message: 'Error fetching Captive entry', 
            error: error.message 
        });
    }
};

// Get all Captive entries
exports.getAllCaptives = async (req, res) => {
    try {
        const entries = await captiveDAL.getAllCaptives();
        res.status(200).json(entries);
    } catch (error) {
        logger.error('Controller error in getAllCaptives:', error);
        res.status(500).json({ 
            message: 'Error fetching all Captive entries', 
            error: error.message 
        });
    }
};

// Update Captive entry
exports.updateCaptiveEntry = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId } = req.params;
        const { effectiveFrom, shareholdingPercentage, consumptionSiteId } = req.body;

        // Update the entry
        const updatedEntry = await captiveDAL.updateCaptive(
            Number(generatorCompanyId),
            Number(shareholderCompanyId),
            effectiveFrom,
            shareholdingPercentage,
            consumptionSiteId
        );

        if (!updatedEntry) {
            return res.status(404).json({
                success: false,
                message: 'Captive entry not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Captive entry updated successfully',
            data: updatedEntry
        });
    } catch (error) {
        logger.error('Controller error in updateCaptiveEntry:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating Captive entry',
            error: error.message
        });
    }
};

// Create new Captive entry
exports.createCaptiveEntry = async (req, res) => {
    try {
        const { generatorCompanyId, shareholderCompanyId, effectiveFrom, shareholdingPercentage, consumptionSiteId } = req.body;

        // Create the entry
        const newEntry = await captiveDAL.createCaptive(
            Number(generatorCompanyId),
            Number(shareholderCompanyId),
            effectiveFrom,
            shareholdingPercentage,
            consumptionSiteId
        );

        res.status(201).json({
            success: true,
            message: 'Captive entry created successfully',
            data: newEntry
        });
    } catch (error) {
        logger.error('Controller error in createCaptiveEntry:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating Captive entry',
            error: error.message
        });
    }
};
