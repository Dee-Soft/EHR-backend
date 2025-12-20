const express = require('express');
const { 
    createRecord,
    getAllRecords,
    getMyRecord,
    getRecordById,
    getAssignedPatientRecords
} = require('../controllers/patientRecordController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Create a new patient record
router.post('/', authMiddleware, createRecord);

// Get all patient records
router.get('/', authMiddleware, getAllRecords);

// Get my patient record
router.get('/my-records', authMiddleware, getMyRecord);

// Get assigned patient records (Provider only)
router.get('/provider/assigned', authMiddleware, getAssignedPatientRecords);

// Get a patient record by ID
router.get('/:id', authMiddleware, getRecordById);

module.exports = router;
