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
const {
    registerUser,
    registerUsersBulk
} = require('../controllers/adminRegistrationController');
const { updateUser } = require('../controllers/userController');

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

/**
 * @route   PUT /api/admin/users/:id/update
 * @desc    Update user information (Admin can update all roles)
 * @access  Admin only
 * @note    Uses the updateUser controller with RBAC validation
 */
router.put('/users/:id/update', requiredRole('Admin'), updateUser);

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

// User registration routes (Admin only)
/**
 * @route   POST /api/admin/register
 * @desc    Register a new user (Admin can register all roles)
 * @access  Admin only
 */
router.post('/register', requiredRole('Admin'), registerUser);

/**
 * @route   POST /api/admin/register/bulk
 * @desc    Register multiple users at once
 * @access  Admin only
 */
router.post('/register/bulk', requiredRole('Admin'), registerUsersBulk);

module.exports = router;
