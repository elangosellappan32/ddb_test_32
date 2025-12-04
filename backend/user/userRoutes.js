const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authorization');
const {
    getUserById,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
} = require('./userController');
const logger = require('../utils/logger');

/**
 * @route   GET /api/user/all
 * @desc    Get all users
 * @access  Private (Admin only recommended)
 */
router.get('/all', authenticateToken, async (req, res) => {
    try {
        logger.info('[UserRoutes] Fetching all users');
        const users = await getAllUsers();

        res.json({
            success: true,
            data: users,
            count: users.length
        });
    } catch (error) {
        logger.error('[UserRoutes] Error fetching all users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/user/me
 * @desc    Get current user's data
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Remove sensitive information before sending the response
        const { password, ...userData } = user;
        
        res.json({
            success: true,
            data: userData
        });
    } catch (error) {
        logger.error('Error fetching user data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user data',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * @route   GET /api/user/:username
 * @desc    Get user by username
 * @access  Private
 */
router.get('/:username', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.params.username);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Remove sensitive information
        const { password, ...userData } = user;
        
        res.json({
            success: true,
            data: userData
        });
    } catch (error) {
        logger.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user'
        });
    }
});

/**
 * @route   POST /api/user
 * @desc    Create a new user
 * @access  Private (Admin only)
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { username, email, password, roleId, metadata } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const userData = {
            username,
            email: email || '',
            password,
            roleId: roleId || 'USER',
            metadata: metadata || {}
        };

        const user = await createUser(userData);

        // Remove sensitive information
        const { password: _, ...userWithoutPassword } = user;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: userWithoutPassword
        });
    } catch (error) {
        logger.error('Error creating user:', error);
        
        if (error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   PUT /api/user/:username
 * @desc    Update an existing user
 * @access  Private (Admin only)
 */
router.put('/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const updateData = req.body;

        // Don't allow direct password updates through this endpoint
        if (updateData.password) {
            delete updateData.password;
        }

        const user = await updateUser(username, updateData);

        // Remove sensitive information
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            message: 'User updated successfully',
            data: userWithoutPassword
        });
    } catch (error) {
        logger.error('Error updating user:', error);
        
        // Handle specific error cases
        if (error.message && error.message.includes('already exists')) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        
        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   DELETE /api/user/:username
 * @desc    Delete a user
 * @access  Private (Admin only)
 */
router.delete('/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;

        // Prevent deleting the current user
        if (username === req.user.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own user account'
            });
        }

        await deleteUser(username);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/user/accessible-sites
 * @desc    Get accessible sites for the current user
 * @access  Private
 */
router.get('/accessible-sites', authenticateToken, async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Log request start
    logger.info(`[${requestId}] [UserRoutes] Starting accessible sites request for user ${req.user.userId}`, {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('user-agent'),
        ip: req.ip
    });

    try {
        // Validate user ID
        if (!req.user?.userId) {
            logger.warn(`[${requestId}] [UserRoutes] Missing or invalid user ID in request`);
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                code: 'INVALID_USER_ID',
                requestId
            });
        }
        
        const userId = req.user.userId;
        
        // Get user data with accessible sites
        const user = await getUserById(userId);
        
        if (!user) {
            logger.warn(`[${requestId}] [UserRoutes] User not found: ${userId}`);
            return res.status(404).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND',
                requestId
            });
        }

        

        // Helper function to normalize site IDs from different formats
        const normalizeSiteIds = (sites) => {
            if (!sites) return [];
            
            // Handle array of strings
            if (Array.isArray(sites)) {
                return sites.filter(site => typeof site === 'string' && site.trim() !== '');
            }
            
            // Handle DynamoDB document format
            if (sites.M?.L) {
                return sites.M.L
                    .map(item => {
                        if (item.S) return item.S; // Simple string value
                        if (item.M?.S?.S) return item.M.S.S; // Nested string value
                        return null;
                    })
                    .filter(Boolean);
            }
            
            return [];
        };

        // Extract production and consumption sites
        let productionSites = [];
        let consumptionSites = [];

        // Check for new format first
        if (user.accessibleSites) {
           
            productionSites = normalizeSiteIds(user.accessibleSites.productionSites);
            consumptionSites = normalizeSiteIds(user.accessibleSites.consumptionSites);
        } 
        // Fall back to legacy metadata format
        else if (user.metadata?.accessibleSites) {
            const accessibleSites = user.metadata.accessibleSites;
            productionSites = normalizeSiteIds(accessibleSites.productionSites);
            consumptionSites = normalizeSiteIds(accessibleSites.consumptionSites);
        }

        // Log the number of sites found
        logger.info(`[${requestId}] [UserRoutes] Found accessible sites`, {
            productionSitesCount: productionSites.length,
            consumptionSitesCount: consumptionSites.length,
            processingTimeMs: Date.now() - startTime
        });

        // Format the response
        const response = {
            success: true,
            data: {
                productionSites,
                consumptionSites
            },
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
                processingTimeMs: Date.now() - startTime
            }
        };
        
        res.json(response);
    } catch (error) {
        const errorId = `err_${Date.now()}`;
        const errorDetails = {
            requestId,
            errorId,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            userId: req.user?.userId,
            processingTimeMs: Date.now() - startTime
        };
        
        logger.error(`[${requestId}] [UserRoutes] Error in accessible-sites endpoint: ${error.message}`, errorDetails);
        
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching accessible sites',
            code: 'SERVER_ERROR',
            errorId,
            requestId,
            timestamp: new Date().toISOString()
        });
    } finally {
    }
});

module.exports = router;