const logger = require('../utils/logger');
const AuthDAL = require('../auth/authDal');

class BaseController {
    constructor() {
        this.authDal = new AuthDAL();
    }

    /**
     * Check if a user has permission to perform an action on a resource
     */
    async hasPermission(username, resource, action) {
        try {
            const user = await this.authDal.getUserByUsername(username);
            if (!user) {
                return false;
            }

            const role = await this.authDal.getRoleById(user.roleId);
            if (!role) {
                return false;
            }

            return role.permissions[resource]?.includes(action) || false;
        } catch (error) {
            logger.error(`Permission check error for user ${username}:`, error);
            return false;
        }
    }

    /**
     * Get user's role details
     */
    async getUserRole(username) {
        try {
            const user = await this.authDal.getUserByUsername(username);
            if (!user) {
                return null;
            }

            return await this.authDal.getRoleById(user.roleId);
        } catch (error) {
            logger.error(`Error getting role for user ${username}:`, error);
            return null;
        }
    }

    /**
     * Handle common error responses
     */
    handleError(res, error, customMessage = 'Internal server error') {
        logger.error('Operation failed:', error);
        const statusCode = error.statusCode || 500;
        const message = error.message || customMessage;
        
        res.status(statusCode).json({
            success: false,
            error: message
        });
    }

    /**
     * Handle successful responses
     */
    handleSuccess(res, data, message = 'Operation successful') {
        res.json({
            success: true,
            message,
            data
        });
    }
}

module.exports = BaseController;
