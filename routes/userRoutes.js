const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const { verifyToken, permit } = require('../middleware/authMiddleware');

router.get('/', verifyToken, permit('Admin', 'Manager'), controller.getUsers);
router.get('/me', verifyToken, controller.currentUser);
router.get('/:id', verifyToken, permit('Patient', 'Provider', 'Employee', 'Manager', 'Admin'), controller.getUserById);
router.put('/:id', verifyToken, permit('Admin', 'Manager'), controller.updateUser);
router.delete('/:id', verifyToken, permit('Admin'), controller.deleteUser);

module.exports = router;
