const express = require('express');
const { 
    createRecord,
    getAllRecords,
    getMyRecord,
    getRecordById
} = require('../controllers/patientRecordController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Create a new patient record
router.post('/', authMiddleware, createRecord);

// Get all patient records
router.get('/', authMiddleware, getAllRecords);

// Get my patient record
router.get('/mine', authMiddleware, getMyRecord);

// Get a patient record by ID
router.get('/:id', authMiddleware, getRecordById);

module.exports = router;
