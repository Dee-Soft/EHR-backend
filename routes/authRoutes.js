const express = require('express');
const router = express.Router();
const {  login, getCurrentUser, logout} = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.post('/login', login);
router.get('/me', authMiddleware, getCurrentUser);
router.post('/logout', logout);

module.exports = router;
