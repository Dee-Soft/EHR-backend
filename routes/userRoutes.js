const express = require('express');
const { registerUser, updateUser } = require('../controllers/userController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/register', authMiddleware, requireRole('Employee', 'Manager', 'Admin'), registerUser);
router.put('/:id', authMiddleware, requireRole('Patient', 'Employee', 'Manager', 'Admin'), updateUser);

module.exports = router;
