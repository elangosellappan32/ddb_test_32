const logger = require('../utils/logger');
const { ALL_PERIODS } = require('../constants/periods');
const lapseService = require('../services/lapseService');

const calculateTotal = (data) => {
    return ALL_PERIODS.reduce((sum, key) => sum + (Number(data[key]) || 0), 0);
};

// Transform lapse record to group c1-c5 under allocated
function transformLapseRecord(record) {
  if (!record) return record;
  const { c1, c2, c3, c4, c5, ...rest } = record;
  return {
    ...rest,
    allocated: { c1, c2, c3, c4, c5 }
  };
}

// For response, you can still group c1-c5 under allocated if needed for frontend display
function transformLapseRecordForResponse(record) {
  if (!record) return record;
  const { c1, c2, c3, c4, c5, ...rest } = record;
  return {
    ...rest,
    allocated: { c1, c2, c3, c4, c5 }
  };
}

// Get all lapse records
exports.getAllLapse = async (req, res) => {
    try {
        const { month } = req.query;
        const result = await lapseService.getLapsesByMonth(month);
        res.json({
            success: true,
            data: result.map(transformLapseRecord)
        });
    } catch (error) {
        logger.error('[LapseController] GetAll Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

// Get specific lapse record
exports.getLapse = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        const result = await lapseService.getLapsesByProductionSite(pk, sk);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Lapse record not found'
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[LapseController] Get Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

// Accept batch creation for lapse
exports.createLapse = async (req, res) => {
    try {
        const isBatchRequest = Array.isArray(req.body);
        const data = isBatchRequest ? req.body : [req.body];
        const results = [];
        const errors = [];
        for (const lapse of data) {
            try {
                // Store c1-c5 at root level
                const result = await lapseService.create(lapse);
                results.push(result);
            } catch (error) {
                logger.error('[LapseController] Create Error:', { error: error.message, data: lapse });
                errors.push({ data: lapse, error: error.message || 'Failed to create lapse' });
            }
        }
        if (errors.length > 0 && results.length === 0) {
            return res.status(400).json({ success: false, message: 'All lapse creation failed', errors });
        }
        if (errors.length > 0) {
            return res.status(207).json({ success: true, message: 'Some lapse records created successfully', data: results, errors });
        }
        res.status(201).json({ success: true, message: isBatchRequest ? 'All lapse records created successfully' : 'Lapse record created successfully', data: isBatchRequest ? results : results[0] });
    } catch (error) {
        logger.error('[LapseController] Create Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

// Update lapse record
exports.updateLapse = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        const result = await lapseService.update(pk, sk, req.body);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[LapseController] Update Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

// Delete lapse record
exports.deleteLapse = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        await lapseService.delete(pk, sk);
        res.json({
            success: true,
            message: 'Lapse record deleted successfully'
        });
    } catch (error) {
        logger.error('[LapseController] Delete Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};