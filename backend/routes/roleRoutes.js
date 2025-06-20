const express = require('express');
const router = express.Router();
const AuthDAL = require('../auth/authDal');
const authDal = new AuthDAL();
const logger = require('../utils/logger');

// Get all roles
router.get('/all', async (req, res) => {
    try {
        const roles = await authDal.getAllRoles();
        res.json(roles);
    } catch (error) {
        logger.error('Error getting all roles:', error);
        res.status(500).json({ error: 'Failed to retrieve roles' });
    }
});

// Get role by ID
router.get('/:roleId', async (req, res) => {
    try {
        const role = await authDal.getRoleById(req.params.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }
        res.json(role);
    } catch (error) {
        logger.error('Error getting role by ID:', error);
        res.status(500).json({ error: 'Failed to retrieve role' });
    }
});

// Get role by username (through user's roleId)
router.get('/user/:username', async (req, res) => {
    try {
        const user = await authDal.getUserByUsername(req.params.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const role = await authDal.getRoleById(user.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json(role);
    } catch (error) {
        logger.error('Error getting role by username:', error);
        res.status(500).json({ error: 'Failed to retrieve role' });
    }
});

module.exports = router;