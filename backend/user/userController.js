const logger = require('../utils/logger');
const userDal = require('./userDal');
const { transformUserRole, transformUsersRoles } = require('../utils/roleMapper');

/**
 * Get user by ID/username
 * @param {string} userId - The ID of the user to retrieve
 * @returns {Promise<Object|null>} The user object or null if not found
 */
const getUserById = async (userId) => {
    try {
        
        const user = await userDal.getUserByUsername(userId);
        
        if (!user) {
            logger.warn(`[UserController] User not found with username: ${userId}`);
            return null;
        }
        
        
        // Extract accessibleSites from metadata if it exists
        let accessibleSites = {
            productionSites: [],
            consumptionSites: []
        };
        
        // Check if accessibleSites exists in metadata
        if (user.metadata?.accessibleSites) {
            const siteData = user.metadata.accessibleSites;
            
            // Process production sites
            if (siteData.productionSites?.L) {
                accessibleSites.productionSites = siteData.productionSites.L
                    .map(item => item.S || '')
                    .filter(Boolean);
            }
            
            // Process consumption sites
            if (siteData.consumptionSites?.L) {
                accessibleSites.consumptionSites = siteData.consumptionSites.L
                    .map(item => item.S || '')
                    .filter(Boolean);
            }
        }
        
        // Add accessibleSites to the user object
        const userWithSites = {
            ...user,
            accessibleSites
        };
        
        
        // Transform roleId to frontend-friendly name
        return transformUserRole(userWithSites);
    } catch (error) {
        logger.error(`[UserController] Error getting user ${userId}:`, error);
        throw error;
    }
};

/**
 * Get all users
 * @returns {Promise<Array>} Array of all users
 */
const getAllUsers = async () => {
    try {
        logger.info('[UserController] Fetching all users');
        const users = await userDal.getAllUsers();
        // Transform roleIds to frontend-friendly names
        return transformUsersRoles(users);
    } catch (error) {
        logger.error('[UserController] Error getting all users:', error);
        throw error;
    }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
const createUser = async (userData) => {
    try {
        logger.info(`[UserController] Creating new user: ${userData.username}`);
        // If roleId is a friendly name (e.g., 'ADMIN'), convert it to database format (e.g., 'ROLE-2')
        const { mapRoleNameToId } = require('../utils/roleMapper');
        const processedData = {
            ...userData,
            roleId: mapRoleNameToId(userData.roleId)
        };
        const user = await userDal.createUser(processedData);
        // Transform the created user back to frontend format
        return transformUserRole(user);
    } catch (error) {
        logger.error('[UserController] Error creating user:', error);
        throw error;
    }
};

/**
 * Update an existing user
 * @param {string} username - Username to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user
 */
const updateUser = async (username, updateData) => {
    try {
        logger.info(`[UserController] Updating user: ${username}`);
        // If roleId is a friendly name, convert it to database format
        const { mapRoleNameToId } = require('../utils/roleMapper');
        const processedData = {
            ...updateData,
            ...(updateData.roleId && { roleId: mapRoleNameToId(updateData.roleId) })
        };
        const user = await userDal.updateUser(username, processedData);
        // Transform the updated user back to frontend format
        return transformUserRole(user);
    } catch (error) {
        logger.error('[UserController] Error updating user:', error);
        throw error;
    }
};

/**
 * Delete a user
 * @param {string} username - Username to delete
 * @returns {Promise<boolean>} Success status
 */
const deleteUser = async (username) => {
    try {
        logger.info(`[UserController] Deleting user: ${username}`);
        const result = await userDal.deleteUser(username);
        return result;
    } catch (error) {
        logger.error('[UserController] Error deleting user:', error);
        throw error;
    }
};

module.exports = {
    getUserById,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
};