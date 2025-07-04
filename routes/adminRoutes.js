const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
    getAuditLogs,
    exportAuditLogs,
    exportAuditLogsZip
} = require('../controllers/adminController');

const { assignPatientToProvider } = require('../controllers/adminController');

const router = express.Router();

// Assign a patient to a provider
router.post(
  '/assign-patient',
  authMiddleware,
  requiredRole('Admin', 'Manager'),
  assignPatientToProvider
);

// Fetch audit logs for a specific user or all users
router.get('/audit-logs', authMiddleware, requiredRole('Admin'), getAuditLogs);
router.get('/audit-logs/export', authMiddleware, requiredRole('Admin'), exportAuditLogs);
router.get('/audit-logs/export/zip', authMiddleware, requiredRole('Admin'), exportAuditLogsZip);

module.exports = router;
