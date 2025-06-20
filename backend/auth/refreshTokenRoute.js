const express = require('express');
const router = express.Router();
const AuthController = require('./authController');
const logger = require('../utils/logger');

const authController = new AuthController();

router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const result = await authController.refreshToken(refreshToken);
        res.json(result);
    } catch (error) {
        logger.error('Token refresh error:', error);
        
        // Handle specific error cases
        if (error.message.includes('invalid') || error.message.includes('expired')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to refresh token'
        });
    }
});

module.exports = router;
