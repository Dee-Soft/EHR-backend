const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
  getAllProviders,
  getAllPatients,
  getAssignments,
  assignPatientToProvider
} = require('../controllers/employeeController');
const {
  registerPatient,
  registerPatientsBulk
} = require('../controllers/employeeRegistrationController');
const { updateUser } = require('../controllers/userController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/employees/providers
 * @desc    Get all available providers
 * @access  Employee, Manager, Admin
 */
router.get('/providers', requiredRole('Employee', 'Manager', 'Admin'), getAllProviders);

/**
 * @route   GET /api/employees/patients
 * @desc    Get all patients
 * @access  Employee, Manager, Admin
 */
router.get('/patients', requiredRole('Employee', 'Manager', 'Admin'), getAllPatients);

/**
 * @route   GET /api/employees/assignments
 * @desc    Get all patient-provider assignments
 * @access  Employee, Manager, Admin
 */
router.get('/assignments', requiredRole('Employee', 'Manager', 'Admin'), getAssignments);

/**
 * @route   POST /api/employees/assignments
 * @desc    Assign a patient to a provider
 * @access  Employee, Manager, Admin
 */
router.post('/assignments', requiredRole('Employee', 'Manager', 'Admin'), assignPatientToProvider);

/**
 * @route   PUT /api/employees/users/:id/update
 * @desc    Update user information (Employee can update Patient only)
 * @access  Employee, Manager, Admin
 * @note    Uses the updateUser controller with RBAC validation
 */
router.put('/users/:id/update', requiredRole('Employee', 'Manager', 'Admin'), updateUser);

// Patient registration routes (Employee, Manager, Admin)
/**
 * @route   POST /api/employees/register/patient
 * @desc    Register a new patient (Employee can register Patient only)
 * @access  Employee, Manager, Admin
 */
router.post('/register/patient', requiredRole('Employee', 'Manager', 'Admin'), registerPatient);

/**
 * @route   POST /api/employees/register/patients/bulk
 * @desc    Register multiple patients at once
 * @access  Employee, Manager, Admin
 */
router.post('/register/patients/bulk', requiredRole('Employee', 'Manager', 'Admin'), registerPatientsBulk);

module.exports = router;
