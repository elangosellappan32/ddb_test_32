const productionUnitDAL = require('./productionUnitDAL');
const logger = require('../utils/logger');

// Add helper functions at the top
const formatDateToMMYYYY = (dateString) => {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}${year}`;
};

// Get all production units
exports.getAllProductionUnits = async (req, res) => {
    try {
        const result = await productionUnitDAL.getAllProductionUnits();
        return res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[ProductionUnitController] GetAll Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
};

// Get production unit history
exports.getProductionUnitHistory = async (req, res) => {
    try {
        const { companyId, productionSiteId } = req.params;
        const result = await productionUnitDAL.getProductionUnitHistory(companyId, productionSiteId);
        return res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[ProductionUnitController] History Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
};

// Create production unit
exports.createProductionUnit = async (req, res) => {
    try {
        const { pk, sk, ...data } = req.body;
        
        if (!pk || !sk) {
            return res.status(400).json({
                success: false,
                message: 'pk and sk are required'
            });
        }

        const unitData = {
            pk,
            sk,
            ...data,
            c1: Number(data.c1 || 0),
            c2: Number(data.c2 || 0),
            c3: Number(data.c3 || 0),
            c4: Number(data.c4 || 0),
            c5: Number(data.c5 || 0),
            total: Number(data.c1 || 0) + 
                   Number(data.c2 || 0) + 
                   Number(data.c3 || 0) + 
                   Number(data.c4 || 0) + 
                   Number(data.c5 || 0),
            date: formatDateToMMYYYY(data.date),
            createdat: new Date().toISOString(),
            updatedat: new Date().toISOString()
        };

        const result = await productionUnitDAL.create(unitData);

        const isUpdate = result.version > 1;
        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: isUpdate ? 'Production unit updated' : 'Production unit created',
            data: result
        });

    } catch (error) {
        logger.error('[ProductionUnitController] Create Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get production unit
exports.getProductionUnit = async (req, res) => {
    try {
        const { companyId, productionSiteId, sk } = req.params;
        const pk = `${companyId}_${productionSiteId}`;

        const result = await productionUnitDAL.getItem(pk, sk);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Production unit not found',
                code: 'NOT_FOUND'
            });
        }

        return res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[ProductionUnitController] Get Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
};

// Update production unit
exports.updateProductionUnit = async (req, res) => {
  try {
    const { companyId, productionSiteId, sk } = req.params;
    const pk = `${companyId}_${productionSiteId}`;

    // Format date if provided
    const formattedData = {
      ...req.body,
      date: req.body.date ? formatDateToMMYYYY(req.body.date) : sk
    };

    // First check if item exists
    const existing = await productionUnitDAL.getItem(pk, sk);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Production unit not found'
      });
    }

    const updateData = {
      ...formattedData,
      pk,
      sk,
      updatedat: new Date().toISOString(),
      c1: Number(formattedData.c1 || 0),
      c2: Number(formattedData.c2 || 0),
      c3: Number(formattedData.c3 || 0),
      c4: Number(formattedData.c4 || 0),
      c5: Number(formattedData.c5 || 0),
      total: Number(formattedData.c1 || 0) + 
             Number(formattedData.c2 || 0) + 
             Number(formattedData.c3 || 0) + 
             Number(formattedData.c4 || 0) + 
             Number(formattedData.c5 || 0)
    };

    const result = await productionUnitDAL.updateItem(pk, sk, updateData);
    res.json({
      success: true,
      message: 'Production unit updated successfully',
      data: result
    });
  } catch (error) {
    logger.error('[ProductionUnitController] Update Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update production unit',
      error: error.message
    });
  }
};

// Delete production unit
exports.deleteProductionUnit = async (req, res) => {
    try {
        const { companyId, productionSiteId, sk } = req.params;
        const pk = `${companyId}_${productionSiteId}`;

        // First check if item exists
        const existingItem = await productionUnitDAL.getItem(pk, sk);
        if (!existingItem) {
            return res.status(404).json({
                success: false,
                message: 'Production unit not found',
                code: 'NOT_FOUND'
            });
        }

        const result = await productionUnitDAL.deleteItem(pk, sk);
        return res.json({
            success: true,
            message: 'Production unit deleted successfully',
            data: result
        });

    } catch (error) {
        logger.error('[ProductionUnitController] Delete Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
};
