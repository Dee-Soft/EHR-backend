const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
  getMyAssignedPatients,
  getPatientRecords,
  updateAvailability,
  getProviderProfile
} = require('../controllers/providerController');
const { createRecord } = require('../controllers/patientRecordController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Provider profile and information
/**
 * @route   GET /api/providers/profile
 * @desc    Get provider's own profile information
 * @access  Provider only
 */
router.get('/profile', requiredRole('Provider'), getProviderProfile);

/**
 * @route   PUT /api/providers/availability
 * @desc    Update provider availability status
 * @access  Provider only
 */
router.put('/availability', requiredRole('Provider'), updateAvailability);

// Patient management
/**
 * @route   GET /api/providers/assigned-patients
 * @desc    Get provider's assigned patients
 * @access  Provider only
 */
router.get('/assigned-patients', requiredRole('Provider'), getMyAssignedPatients);

/**
 * @route   GET /api/providers/patient-records
 * @desc    Get patient records for provider's assigned patients
 * @access  Provider only
 */
router.get('/patient-records', requiredRole('Provider'), getPatientRecords);

/**
 * @route   POST /api/providers/patient-records
 * @desc    Create a new patient record for assigned patient
 * @access  Provider only
 */
router.post('/patient-records', requiredRole('Provider'), createRecord);

module.exports = router;
