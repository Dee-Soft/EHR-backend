const express = require('express');
const { registerUser, updateUser, getAllUsers } = require('../controllers/userController');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/', authMiddleware, getAllUsers);
router.post('/register', authMiddleware, requiredRole('Employee', 'Manager', 'Admin'), registerUser);
router.put('/:id', authMiddleware, requiredRole('Patient', 'Employee', 'Manager', 'Admin'), updateUser);

module.exports = router;
