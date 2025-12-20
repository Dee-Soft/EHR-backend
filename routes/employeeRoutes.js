const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
  getAllProviders,
  getAllPatients,
  getAssignments,
  assignPatientToProvider
} = require('../controllers/employeeController');

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

module.exports = router;
