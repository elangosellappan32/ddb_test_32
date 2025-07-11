const express = require('express');
const router = express.Router();
const packageJson = require('../package.json');
const { ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const docClient = require('../utils/db');
const logger = require('../utils/logger');

/**
 * Test database connection
 */
async function testDatabaseConnection() {
    const startTime = Date.now();
    try {
        const command = new ListTablesCommand({});
        const response = await docClient.send(command);
        return {
            status: 'connected',
            tableCount: response.TableNames?.length || 0,
            responseTime: `${Date.now() - startTime}ms`
        };
    } catch (error) {
        logger.error('Database connection test failed', {
            error: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        return {
            status: 'error',
            error: error.message,
            code: error.code,
            responseTime: `${Date.now() - startTime}ms`
        };
    }
}

/**
 * Health check endpoint
 * Returns server status with database connection check
 */
router.get('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const dbStatus = await testDatabaseConnection();
        const serverInfo = {
            status: 'up',
            version: packageJson.version,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            apiVersion: 'v1',
            database: dbStatus,
            responseTime: `${Date.now() - startTime}ms`,
            services: {
                database: dbStatus.status === 'connected' ? 'up' : 'down'
            }
        };

        // If database is down, return 503 Service Unavailable
        if (dbStatus.status !== 'connected') {
            return res.status(503).json({
                ...serverInfo,
                status: 'degraded',
                message: 'Service degraded: Database connection failed'
            });
        }

        res.json(serverInfo);
    } catch (error) {
        logger.error('Health check failed', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;