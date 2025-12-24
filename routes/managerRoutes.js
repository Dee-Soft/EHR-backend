const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
  manageProvider,
  getSystemStats,
  getAllProviders,
  getAllPatients,
  getAssignments,
  assignPatientToProvider
} = require('../controllers/managerController');
const {
  registerUser,
  registerEmployee,
  registerProvider
} = require('../controllers/managerRegistrationController');
const { updateUser } = require('../controllers/userController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Employee management routes
/**
 * @route   GET /api/managers/employees
 * @desc    Get all employees
 * @access  Manager, Admin
 */
router.get('/employees', requiredRole('Manager', 'Admin'), getAllEmployees);

/**
 * @route   PUT /api/managers/employees/:id
 * @desc    Update employee information
 * @access  Manager, Admin
 */
router.put('/employees/:id', requiredRole('Manager', 'Admin'), updateEmployee);

/**
 * @route   DELETE /api/managers/employees/:id
 * @desc    Delete employee
 * @access  Manager, Admin
 */
router.delete('/employees/:id', requiredRole('Manager', 'Admin'), deleteEmployee);

// Provider management routes
/**
 * @route   PUT /api/managers/providers/:id
 * @desc    Update provider information
 * @access  Manager, Admin
 */
router.put('/providers/:id', requiredRole('Manager', 'Admin'), manageProvider);

/**
 * @route   PUT /api/managers/users/:id/update
 * @desc    Update user information (Manager can update Patient, Employee, Provider)
 * @access  Manager, Admin
 * @note    Uses the updateUser controller with RBAC validation
 */
router.put('/users/:id/update', requiredRole('Manager', 'Admin'), updateUser);

// System statistics
/**
 * @route   GET /api/managers/system-stats
 * @desc    Get system statistics
 * @access  Manager, Admin
 */
router.get('/system-stats', requiredRole('Manager', 'Admin'), getSystemStats);

// Employee functionality that managers can also use
/**
 * @route   GET /api/managers/providers
 * @desc    Get all available providers
 * @access  Manager, Admin
 */
router.get('/providers', requiredRole('Manager', 'Admin'), getAllProviders);

/**
 * @route   GET /api/managers/patients
 * @desc    Get all patients
 * @access  Manager, Admin
 */
router.get('/patients', requiredRole('Manager', 'Admin'), getAllPatients);

/**
 * @route   GET /api/managers/assignments
 * @desc    Get all patient-provider assignments
 * @access  Manager, Admin
 */
router.get('/assignments', requiredRole('Manager', 'Admin'), getAssignments);

/**
 * @route   POST /api/managers/assignments
 * @desc    Assign a patient to a provider
 * @access  Manager, Admin
 */
router.post('/assignments', requiredRole('Manager', 'Admin'), assignPatientToProvider);

// User registration routes (Manager, Admin)
/**
 * @route   POST /api/managers/register
 * @desc    Register a new user (Manager can register Patient, Provider, Employee)
 * @access  Manager, Admin
 */
router.post('/register', requiredRole('Manager', 'Admin'), registerUser);

/**
 * @route   POST /api/managers/register/employee
 * @desc    Register a new employee
 * @access  Manager, Admin
 */
router.post('/register/employee', requiredRole('Manager', 'Admin'), registerEmployee);

/**
 * @route   POST /api/managers/register/provider
 * @desc    Register a new provider
 * @access  Manager, Admin
 */
router.post('/register/provider', requiredRole('Manager', 'Admin'), registerProvider);

module.exports = router;
