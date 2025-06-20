const bankingDAL = require('./bankingDAL');
const logger = require('../utils/logger');
const { ALL_PERIODS } = require('../constants/periods');

const validateBankingData = (data) => {
    const requiredFields = ['pk', 'sk', 'siteName'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
        return {
            isValid: false,
            error: `Missing required fields: ${missingFields.join(', ')}`
        };
    }

    // Clean and transform the data
    const transformedData = {
        ...data,
        c1: Number(data.c1 || 0),
        c2: Number(data.c2 || 0),
        c3: Number(data.c3 || 0),
        c4: Number(data.c4 || 0),
        c5: Number(data.c5 || 0),
        siteName: data.siteName.trim()
    };

    return { isValid: true, data: transformedData };
};

// Transform banking record to group c1-c5 under allocated
function transformBankingRecord(record) {
  if (!record) return record;
  const { c1, c2, c3, c4, c5, ...rest } = record;
  return {
    ...rest,
    allocated: { c1, c2, c3, c4, c5 }
  };
}

// For response, you can still group c1-c5 under allocated if needed for frontend display
function transformBankingRecordForResponse(record) {
  if (!record) return record;
  const { c1, c2, c3, c4, c5, ...rest } = record;
  return {
    ...rest,
    allocated: { c1, c2, c3, c4, c5 }
  };
}

// Accept batch creation for banking
const createBanking = async (req, res) => {
    try {
        const isBatchRequest = Array.isArray(req.body);
        const data = isBatchRequest ? req.body : [req.body];
        const results = [];
        const errors = [];
        for (const banking of data) {
            const validation = validateBankingData(banking);
            if (!validation.isValid) {
                errors.push({ data: banking, error: validation.error });
                continue;
            }
            try {
                // Store c1-c5 at root level
                const result = await bankingDAL.createBanking(validation.data);
                results.push(result);
            } catch (error) {
                logger.error('[BankingController] Create Error:', { error: error.message, data: banking });
                errors.push({ data: banking, error: error.message || 'Failed to create banking' });
            }
        }
        if (errors.length > 0 && results.length === 0) {
            return res.status(400).json({ success: false, message: 'All banking creation failed', errors });
        }
        if (errors.length > 0) {
            return res.status(207).json({ success: true, message: 'Some banking records created successfully', data: results, errors });
        }
        res.status(201).json({ success: true, message: isBatchRequest ? 'All banking records created successfully' : 'Banking record created successfully', data: isBatchRequest ? results : results[0] });
    } catch (error) {
        logger.error('[BankingController] Create Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

const getBanking = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        const result = await bankingDAL.getBanking(pk, sk);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Banking record not found'
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[BankingController] Get Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const queryBankingByPeriod = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        const result = await bankingDAL.queryBankingByPeriod(pk, sk);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[BankingController] Query Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateBanking = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        const validation = validateBankingData({ ...req.body, pk, sk });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: validation.error
            });
        }

        const result = await bankingDAL.updateBanking(pk, sk, validation.data);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('[BankingController] Update Error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

const deleteBanking = async (req, res) => {
    try {
        const { pk, sk } = req.params;
        await bankingDAL.deleteBanking(pk, sk);
        res.json({
            success: true,
            message: 'Banking record deleted successfully'
        });
    } catch (error) {
        logger.error('[BankingController] Delete Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllBanking = async (req, res) => {
    try {
        const result = await bankingDAL.getAllBanking();
        res.json({
            success: true,
            data: result.map(transformBankingRecord)
        });
    } catch (error) {
        logger.error('[BankingController] GetAll Error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getBankingData = async (req, res) => {
    try {
        const { year, month } = req.query;
        const startMonth = '04'; // April
        const endMonth = '03';   // May
        
        const bankingData = await bankingDAL.getAll();
        
        // Filter for the specified year's April-March period
        const filteredData = bankingData.filter(item => {
            const itemYear = item.sk.substring(2);
            const itemMonth = item.sk.substring(0, 2);
            return itemYear === year && 
                   parseInt(itemMonth) >= parseInt(startMonth) && 
                   parseInt(itemMonth) <= parseInt(endMonth);
        });

        // Aggregate the data
        const aggregatedData = filteredData.reduce((acc, curr) => {
            const key = curr.pk;
            if (!acc[key]) {
                acc[key] = {
                    ...curr,
                    c1: 0, c2: 0, c3: 0, c4: 0, c5: 0,
                    totalAmount: 0
                };
            }
            
            ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(period => {
                acc[key][period] += Number(curr[period] || 0);
            });
            
            acc[key].totalAmount = ['c1', 'c2', 'c3', 'c4', 'c5']
                .reduce((sum, period) => sum + Number(acc[key][period] || 0), 0);
            
            return acc;
        }, {});

        res.json(Object.values(aggregatedData));
    } catch (error) {
        console.error('Error in getBankingData:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createBanking,
    getBanking,
    queryBankingByPeriod,
    updateBanking,
    deleteBanking,
    getAllBanking,
    getBankingData
};