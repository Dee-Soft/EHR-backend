const express = require('express');
const { authMiddleware, requiredRole } = require('../middlewares/authMiddleware');
const {
    getAuditLogs,
    exportAuditLogs,
    exportAuditLogsZip
} = require('../controllers/adminController');

const router = express.Router();

router.get('/audit-logs', authMiddleware, requiredRole('admin'), getAuditLogs);
router.get('/audit-logs/export', authMiddleware, requiredRole('admin'), exportAuditLogs);
router.get('/audit-logs/export/zip', authMiddleware, requireRole('admin'), exportAuditLogsZip);

module.exports = router;
