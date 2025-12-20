const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
    getAuditLogs,
    exportAuditLogs,
    exportAuditLogsJson,
    getAllUsers,
    getUserById,
    deleteUser
} = require('../controllers/adminController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// User management routes (Admin only)
/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Admin only
 */
router.get('/users', requiredRole('Admin'), getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user by ID
 * @access  Admin only
 */
router.get('/users/:id', requiredRole('Admin'), getUserById);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user by ID
 * @access  Admin only
 */
router.delete('/users/:id', requiredRole('Admin'), deleteUser);

// Audit logs (Admin only)
/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get all audit logs
 * @access  Admin only
 */
router.get('/audit-logs', requiredRole('Admin'), getAuditLogs);

/**
 * @route   GET /api/admin/audit-logs/export
 * @desc    Export audit logs as CSV
 * @access  Admin only
 */
router.get('/audit-logs/export', requiredRole('Admin'), exportAuditLogs);

/**
 * @route   GET /api/admin/audit-logs/export/json
 * @desc    Export audit logs as JSON
 * @access  Admin only
 */
router.get('/audit-logs/export/json', requiredRole('Admin'), exportAuditLogsJson);

module.exports = router;
