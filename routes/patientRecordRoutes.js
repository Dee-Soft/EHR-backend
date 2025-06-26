const express = require('express');
const router = express.Router();
const controller = require('../controllers/patientRecordController');
const { verifyToken, permit } = require('../middlewares/authMiddleware');

// Admin, Manager, and Provider can create a patient record
router.post('/', verifyToken, permit('Admin', 'Manager', 'Provider'), controller.createRecord);
router.get('/', verifyToken, permit('Admin', 'Manager', 'Provider'), controller.getAllRecords);
//Patient, and Provider can view records
router.get('/:id', permit('Patient', 'Provider'), verifyToken, controller.getRecordById);
// Admin, Manager, and Provider can update or delete any record
router.put('/:id', verifyToken, permit('Admin', 'Manager', 'Provider'), controller.updateRecord);
router.delete('/:id', verifyToken, permit('Admin', 'Manager', 'Provider'), controller.deleteRecord);