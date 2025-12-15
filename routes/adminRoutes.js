const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
    getAuditLogs,
    exportAuditLogs,
    exportAuditLogsJson,
    assignPatientToProvider,
    getAllUsers,
    getUserById,
    deleteUser
} = require('../controllers/adminController');

const router = express.Router();

// User management routes
router.get('/users', authMiddleware, requiredRole('Admin'), getAllUsers);
router.get('/users/:id', authMiddleware, requiredRole('Admin'), getUserById);
router.delete('/users/:id', authMiddleware, requiredRole('Admin'), deleteUser);

// Assign a patient to a provider
router.post(
  '/assign-patient',
  authMiddleware,
  requiredRole('Admin'),
  assignPatientToProvider
);

// Fetch audit logs for a specific user or all users
router.get('/audit-logs', authMiddleware, requiredRole('Admin'), getAuditLogs);
router.get('/audit-logs/export', authMiddleware, requiredRole('Admin'), exportAuditLogs);
router.get('/audit-logs/export/json', authMiddleware, requiredRole('Admin'), exportAuditLogsJson);

module.exports = router;
