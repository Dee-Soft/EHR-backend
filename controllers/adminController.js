const AuditLog = require('../models/AuditLog');
const { Parser } = require('json2csv');
const User = require('../models/User');
const logger = require('../config/logger');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Assign a patient to a provider
 * @route POST /api/admin/assign-patient
 * @access Admin only
 */
exports.assignPatientToProvider = async (req, res, next) => {
  const { providerId, patientId } = req.body;

  try {
    const provider = await User.findById(providerId);
    const patient = await User.findById(patientId);

    if (!provider || provider.role !== 'Provider') {
      logger.warn(`Invalid provider assignment attempt: ${providerId}`);
      throw new AppError('Provider not found or invalid role', 400);
    }

    if (!patient || patient.role !== 'Patient') {
      logger.warn(`Invalid patient assignment attempt: ${patientId}`);
      throw new AppError('Patient not found or invalid role', 400);
    }

    // Add patient to provider's assigned list
    if (!provider.assignedPatients.includes(patientId)) {
      provider.assignedPatients.push(patientId);
      await provider.save();
    }

    // Assign provider to patient
    if (!patient.assignedProviderId || patient.assignedProviderId.toString() !== providerId) {
      patient.assignedProviderId = providerId;
      await patient.save();
    }

    logger.info(`Patient ${patientId} assigned to Provider ${providerId} by Admin ${req.user.id}`);
    res.status(200).json({ message: 'Patient assigned to provider successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all audit logs
 * @route GET /api/admin/audit-logs
 * @access Admin only
 */
exports.getAuditLogs = async (req, res, next) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 });
        logger.info(`Admin ${req.user.id} retrieved ${logs.length} audit logs`);
        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        logger.error('Failed to retrieve audit logs:', error);
        next(new AppError('Failed to retrieve audit logs', 500));
    }
};

/**
 * Export audit logs as CSV
 * @route GET /api/admin/audit-logs/export
 * @access Admin only
 */
exports.exportAuditLogs = async (req, res, next) => {
    try {
        const logs = await AuditLog.find().lean();

        if (logs.length === 0) {
            throw new AppError('No audit logs to export', 404);
        }

        const csvParser = new Parser({
            fields: ['action', 'actorId', 'targetId', 'targetType', 'details', 'timestamp']
        });
        const csv = csvParser.parse(logs);

        logger.info(`Admin ${req.user.id} exported ${logs.length} audit logs as CSV`);

        res.header('Content-Type', 'text/csv');
        res.attachment(`audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
        res.status(200).send(csv);
    } catch (error) {
        logger.error('Failed to export audit logs:', error);
        next(error);
    }
};

/**
 * Export audit logs as JSON (simplified, removed complex ZIP encryption)
 * @route GET /api/admin/audit-logs/export-json
 * @access Admin only
 */
exports.exportAuditLogsJson = async (req, res, next) => {
    try {
        const logs = await AuditLog.find().lean();

        if (logs.length === 0) {
            throw new AppError('No audit logs to export', 404);
        }

        logger.info(`Admin ${req.user.id} exported ${logs.length} audit logs as JSON`);

        res.header('Content-Type', 'application/json');
        res.attachment(`audit-logs-${new Date().toISOString().split('T')[0]}.json`);
        res.status(200).json({
            exportDate: new Date().toISOString(),
            exportedBy: req.user.id,
            totalRecords: logs.length,
            logs: logs
        });
    } catch (error) {
        logger.error('Failed to export audit logs as JSON:', error);
        next(error);
    }
};