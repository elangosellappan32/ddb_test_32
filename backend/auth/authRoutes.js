const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const AuthDAL = require('./authDal');
const authDal = new AuthDAL();

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        logger.info(`Login attempt for user: ${username}`);        // Get user data
        const user = await authDal.getUserByUsername(username);
        
        if (!user) {
            logger.warn(`User not found: ${username}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Password check would normally use bcrypt.compare
        if (password !== user.password) {
            logger.warn(`Invalid password for user: ${username}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Get role information
        const role = await authDal.getRoleById(user.roleId);
        if (!role) {
            logger.error(`Role not found for user ${username} with roleId ${user.roleId}`);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving user role'
            });
        }

        // Determine company ID from metadata
        let companyId = user.metadata?.companyId;
        if (!companyId && user.metadata?.accessibleSites?.productionSites?.L?.length > 0) {
            // Extract company ID from the first production site ID (format: companyId_siteId)
            const firstSiteId = user.metadata.accessibleSites.productionSites.L[0].S;
            companyId = parseInt(firstSiteId.split('_')[0], 10);
        }

        if (!companyId && user.metadata?.department) {
            // Fallback: Extract from department if possible
            if (user.metadata.department.toLowerCase().includes('smr')) {
                companyId = 5; // SMR Energy's company ID
            } else if (user.metadata.department.toLowerCase().includes('strio')) {
                companyId = 1; // STRIO's company ID
            }
        }

        // Create JWT token with role permissions, accessible sites, and company ID
        const token = jwt.sign(
            {
                username,
                roleId: role.roleId,
                roleName: role.roleName,
                permissions: role.permissions,
                accessibleSites: user.metadata?.accessibleSites || {
                    productionSites: { L: [] },
                    consumptionSites: { L: [] }
                },
                companyId: companyId || null
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Update last login time
        await authDal.updateLastLogin(username);

        logger.info(`Successful login for user: ${username}`);        res.json({
            success: true,
            token,
            user: {
                username,
                email: user.email,
                roleId: role.roleId,
                roleName: role.roleName,
                permissions: role.permissions,
                companyId,
                metadata: {
                    department: user.metadata?.department || 'General',
                    accessLevel: role.metadata?.accessLevel || 'Basic',
                    companyId,
                    accessibleSites: user.metadata?.accessibleSites || {
                        productionSites: { L: [] },
                        consumptionSites: { L: [] }
                    }
                }
            }
        });    } catch (error) {
        logger.error('Login error:', error);
        let statusCode = 500;
        let message = 'Internal server error';

        if (error.message === 'User table not found' || error.message === 'Required database tables do not exist') {
            statusCode = 503;
            message = 'Service temporarily unavailable';
        } else if (error.message === 'Database connection failed') {
            statusCode = 503;
            message = 'Unable to connect to database';
        }

        res.status(statusCode).json({
            success: false,
            message: process.env.NODE_ENV === 'development' ? error.message : message
        });
    }
});

// Get current user profile
router.get('/profile', async (req, res) => {
    try {
        const username = req.user && req.user.username; // Assuming middleware sets req.user
        if (!username) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await authDal.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const role = await authDal.getRoleById(user.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json({
            username: user.username,
            email: user.email,
            roleId: role.roleId,
            roleName: role.roleName,
            permissions: role.permissions,
            metadata: {
                department: user.metadata.department,
                accessLevel: role.metadata.accessLevel
            }
        });
    } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to retrieve user profile' });
    }
});

module.exports = router;