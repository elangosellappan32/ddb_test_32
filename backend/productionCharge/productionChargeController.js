const productionChargeDAL = require('./productionChargeDAL');
const logger = require('../utils/logger');

// Helper functions
const formatToMMYYYY = (dateString) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}${year}`;
};

const formatToMonthYear = (mmyyyy) => {
    const month = mmyyyy.substring(0, 2);
    const year = mmyyyy.substring(2);
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
};

// Controller methods
exports.getAllCharges = async (req, res) => {
    try {
        const { companyId, productionSiteId } = req.params;
        const result = await productionChargeDAL.getAllCharges(companyId, productionSiteId);
        
        const transformedData = result.data.map(charge => ({
            ...charge,
            displayDate: formatToMonthYear(charge.sk)
        }));

        return res.json({
            success: true,
            message: result.message,
            data: transformedData
        });
    } catch (error) {
        logger.error('[ProductionChargeController] GetAll Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch charges',
            error: error.message
        });
    }
};

exports.getCharge = async (req, res) => {
    try {
        const { companyId, productionSiteId, sk } = req.params;
        const pk = `${companyId}_${productionSiteId}`;

        const charge = await productionChargeDAL.getItem(pk, sk);

        if (!charge) {
            return res.status(404).json({
                success: false,
                message: 'Charge not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...charge,
                displayDate: formatToMonthYear(charge.sk)
            }
        });
    } catch (error) {
        logger.error('[ProductionChargeController] Get Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch charge',
            error: error.message
        });
    }
};

exports.createCharge = async (req, res) => {
    try {
        const { companyId, productionSiteId } = req.params;
        const { date, ...chargeData } = req.body;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required'
            });
        }

        const sk = formatToMMYYYY(date);
        const pk = `${companyId}_${productionSiteId}`;

        const chargeItem = {
            pk,
            sk,
            companyId: String(companyId),
            productionSiteId: String(productionSiteId),
            ...chargeData
        };

        const result = await productionChargeDAL.create(chargeItem);

        res.status(201).json({
            success: true,
            message: 'Charge created successfully',
            data: {
                ...result,
                displayDate: formatToMonthYear(result.sk)
            }
        });
    } catch (error) {
        logger.error('[ProductionChargeController] Create Error:', error);
        if (error.name === 'ConditionalCheckFailedException') {
            return res.status(409).json({
                success: false,
                message: 'Charge already exists for this period'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to create charge',
            error: error.message
        });
    }
};

exports.updateCharge = async (req, res) => {
    try {
        const { companyId, productionSiteId, sk } = req.params;
        const { version, ...updateData } = req.body;
        const pk = `${companyId}_${productionSiteId}`;

        if (!version) {
            return res.status(400).json({
                success: false,
                message: 'Version is required for updates'
            });
        }

        logger.info('[ProductionChargeController] Updating charge:', { pk, sk, version });
        const result = await productionChargeDAL.updateItem(pk, sk, {
            ...updateData,
            version: Number(version)
        });

        res.json({
            success: true,
            message: 'Charge updated successfully',
            data: {
                ...result,
                displayDate: formatToMonthYear(sk)
            }
        });
    } catch (error) {
        logger.error('[ProductionChargeController] Update Error:', error);
        
        if (error.name === 'ConditionalCheckFailedException') {
            return res.status(409).json({
                success: false,
                message: 'Version conflict detected. Please refresh and try again.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update charge',
            error: error.message
        });
    }
};

exports.deleteCharge = async (req, res) => {
    try {
        const { companyId, productionSiteId, sk } = req.params;
        const pk = `${companyId}_${productionSiteId}`;

        logger.info('[ProductionChargeController] Deleting charge:', { pk, sk });
        const result = await productionChargeDAL.deleteItem(pk, sk);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Charge not found'
            });
        }

        res.json({
            success: true,
            message: 'Charge deleted successfully'
        });
    } catch (error) {
        logger.error('[ProductionChargeController] Delete Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete charge',
            error: error.message
        });
    }
};