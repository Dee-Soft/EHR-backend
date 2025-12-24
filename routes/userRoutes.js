const express = require('express');
const { registerUser, updateUser, getAllUsers } = require('../controllers/userController');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/users
 * @desc    Get all users (with RBAC in controller)
 * @access  Admin, Manager
 */
router.get('/', requiredRole('Admin', 'Manager'), getAllUsers);

/**
 * @route   POST /api/users/register
 * @desc    Register a new user (RBAC handled in controller - checks canRegister permissions)
 * @access  Admin, Manager, Employee
 */
router.post('/register', requiredRole('Admin', 'Manager', 'Employee'), registerUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user information (RBAC handled in controller)
 * @access  Authenticated users (RBAC in controller)
 */
router.put('/:id', updateUser);

module.exports = router;
