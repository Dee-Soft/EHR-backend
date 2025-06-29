const express = require('express');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const {
    getAuditLogs,
    exportAuditLogs,
    exportAuditLogsZip
} = require('../controllers/adminController');

const router = express.Router();

router.get('/audit-logs', authMiddleware, requireRole('admin'), getAuditLogs);
router.get('/audit-logs/export', authMiddleware, requireRole('admin'), exportAuditLogs);
router.get('/audit-logs/export/zip', authMiddleware, requireRole('admin'), exportAuditLogsZip);

module.exports = router;
