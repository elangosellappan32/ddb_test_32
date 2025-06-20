const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    if (err.name === 'ConditionalCheckFailedException') {
        return res.status(409).json({
            success: false,
            message: 'Conflict: Item already exists or version mismatch'
        });
    }

    // DynamoDB specific errors
    if (err.name === 'ResourceNotFoundException') {
        return res.status(404).json({
            error: 'Resource not found',
            details: 'The requested resource does not exist'
        });
    }

    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
};

module.exports = errorHandler;