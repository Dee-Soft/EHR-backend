const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const { getMyRecord } = require('../controllers/patientRecordController');
const { updateUser } = require('../controllers/userController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply role restriction - Patient only for all routes in this file
router.use(requiredRole('Patient'));

/**
 * @route   GET /api/patients/my-records
 * @desc    Get patient's own medical records
 * @access  Patient only
 * @note    Uses the getMyRecord function from patientRecordController
 */
router.get('/my-records', getMyRecord);

/**
 * @route   PUT /api/patients/profile
 * @desc    Update patient's own profile information
 * @access  Patient only
 * @note    Uses the updateUser controller with the patient's own ID
 * @details Patients can only update their own phone and address fields
 */
router.put('/profile', (req, res, next) => {
  // Set the patient's ID as the route parameter for the updateUser controller
  req.params.id = req.user.id;
  
  // Call the updateUser controller directly
  updateUser(req, res, next);
});

/**
 * @route   GET /api/patients/profile
 * @desc    Get patient's own profile information
 * @access  Patient only
 * @note    Uses the authMiddleware to get current user info
 */
router.get('/profile', (req, res) => {
  // Return the patient's profile information from the authenticated user object
  // Exclude sensitive fields like password
  const { password, ...patientProfile } = req.user.toObject ? req.user.toObject() : req.user;
  
  res.status(200).json({
    success: true,
    message: 'Patient profile retrieved successfully',
    data: patientProfile
  });
});

module.exports = router;
