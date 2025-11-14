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

        // Calculate net export values and clamp negatives to zero
        const diffC1 = Number(data.export_c1 || 0) - Number(data.import_c1 || 0);
        const diffC2 = Number(data.export_c2 || 0) - Number(data.import_c2 || 0);
        const diffC3 = Number(data.export_c3 || 0) - Number(data.import_c3 || 0);
        const diffC4 = Number(data.export_c4 || 0) - Number(data.import_c4 || 0);
        const diffC5 = Number(data.export_c5 || 0) - Number(data.import_c5 || 0);
        const netExportC1 = Math.max(0, diffC1);
        const netExportC2 = Math.max(0, diffC2);
        const netExportC3 = Math.max(0, diffC3);
        const netExportC4 = Math.max(0, diffC4);
        const netExportC5 = Math.max(0, diffC5);
        const netExportTotal = netExportC1 + netExportC2 + netExportC3 + netExportC4 + netExportC5;

        const unitData = {
            pk,
            sk,
            ...data,
            // Base C values (for backward compatibility)
            c1: netExportC1,
            c2: netExportC2,
            c3: netExportC3,
            c4: netExportC4,
            c5: netExportC5,
            total: netExportTotal,
            
            // Import C values
            import_c1: Number(data.import_c1 || 0),
            import_c2: Number(data.import_c2 || 0),
            import_c3: Number(data.import_c3 || 0),
            import_c4: Number(data.import_c4 || 0),
            import_c5: Number(data.import_c5 || 0),
            import_total: (Number(data.import_c1 || 0) + 
                          Number(data.import_c2 || 0) + 
                          Number(data.import_c3 || 0) + 
                          Number(data.import_c4 || 0) + 
                          Number(data.import_c5 || 0)),
            
            // Export C values
            export_c1: Number(data.export_c1 || 0),
            export_c2: Number(data.export_c2 || 0),
            export_c3: Number(data.export_c3 || 0),
            export_c4: Number(data.export_c4 || 0),
            export_c5: Number(data.export_c5 || 0),
            export_total: (Number(data.export_c1 || 0) + 
                          Number(data.export_c2 || 0) + 
                          Number(data.export_c3 || 0) + 
                          Number(data.export_c4 || 0) + 
                          Number(data.export_c5 || 0)),
            
            // Net export C values (export - import, clamped to zero)
            net_export_c1: netExportC1,
            net_export_c2: netExportC2,
            net_export_c3: netExportC3,
            net_export_c4: netExportC4,
            net_export_c5: netExportC5,
            net_export_total: netExportTotal,
            
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

    // Calculate net export values and clamp negatives to zero
    const diffC1 = Number(formattedData.export_c1 || 0) - Number(formattedData.import_c1 || 0);
    const diffC2 = Number(formattedData.export_c2 || 0) - Number(formattedData.import_c2 || 0);
    const diffC3 = Number(formattedData.export_c3 || 0) - Number(formattedData.import_c3 || 0);
    const diffC4 = Number(formattedData.export_c4 || 0) - Number(formattedData.import_c4 || 0);
    const diffC5 = Number(formattedData.export_c5 || 0) - Number(formattedData.import_c5 || 0);
    const netExportC1 = Math.max(0, diffC1);
    const netExportC2 = Math.max(0, diffC2);
    const netExportC3 = Math.max(0, diffC3);
    const netExportC4 = Math.max(0, diffC4);
    const netExportC5 = Math.max(0, diffC5);
    const netExportTotal = netExportC1 + netExportC2 + netExportC3 + netExportC4 + netExportC5;

    const updateData = {
      ...formattedData,
      pk,
      sk,
      updatedat: new Date().toISOString(),
      
      // Base C values (for backward compatibility)
      c1: netExportC1,
      c2: netExportC2,
      c3: netExportC3,
      c4: netExportC4,
      c5: netExportC5,
      total: netExportTotal,
      
      // Import C values
      import_c1: Number(formattedData.import_c1 || 0),
      import_c2: Number(formattedData.import_c2 || 0),
      import_c3: Number(formattedData.import_c3 || 0),
      import_c4: Number(formattedData.import_c4 || 0),
      import_c5: Number(formattedData.import_c5 || 0),
      import_total: (Number(formattedData.import_c1 || 0) + 
                    Number(formattedData.import_c2 || 0) + 
                    Number(formattedData.import_c3 || 0) + 
                    Number(formattedData.import_c4 || 0) + 
                    Number(formattedData.import_c5 || 0)),
      
      // Export C values
      export_c1: Number(formattedData.export_c1 || 0),
      export_c2: Number(formattedData.export_c2 || 0),
      export_c3: Number(formattedData.export_c3 || 0),
      export_c4: Number(formattedData.export_c4 || 0),
      export_c5: Number(formattedData.export_c5 || 0),
      export_total: (Number(formattedData.export_c1 || 0) + 
                    Number(formattedData.export_c2 || 0) + 
                    Number(formattedData.export_c3 || 0) + 
                    Number(formattedData.export_c4 || 0) + 
                    Number(formattedData.export_c5 || 0)),
      
      // Net export C values (export - import, clamped to zero)
      net_export_c1: netExportC1,
      net_export_c2: netExportC2,
      net_export_c3: netExportC3,
      net_export_c4: netExportC4,
      net_export_c5: netExportC5,
      net_export_total: netExportTotal
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
