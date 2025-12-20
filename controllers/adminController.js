const AuditLog = require('../models/AuditLog');
const { Parser } = require('json2csv');
const User = require('../models/User');
const logger = require('../config/logger');
const { AppError } = require('../middlewares/errorHandler');


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

/**
 * Get all users
 * @route GET /api/admin/users
 * @access Admin only
 */
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password');
        
        logger.info(`Admin ${req.user.id} retrieved ${users.length} users`);
        
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        logger.error('Failed to retrieve users:', error);
        next(new AppError('Failed to retrieve users', 500));
    }
};

/**
 * Get user by ID
 * @route GET /api/admin/users/:id
 * @access Admin only
 */
exports.getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            throw new AppError('User not found', 404);
        }
        
        logger.info(`Admin ${req.user.id} retrieved user ${req.params.id}`);
        
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        logger.error('Failed to retrieve user:', error);
        next(error);
    }
};

/**
 * Delete user by ID
 * @route DELETE /api/admin/users/:id
 * @access Admin only
 */
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            throw new AppError('User not found', 404);
        }
        
        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user.id) {
            throw new AppError('Cannot delete your own account', 400);
        }
        
        await User.findByIdAndDelete(req.params.id);
        
        await AuditLog.create({
            action: 'DELETE_USER',
            actorId: req.user.id,
            targetId: req.params.id,
            targetType: 'User',
            details: `Deleted user ${user.name} with role ${user.role}`,
            ipAddress: req.ip
        });
        
        logger.info(`Admin ${req.user.id} deleted user ${req.params.id}`);
        
        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        logger.error('Failed to delete user:', error);
        next(error);
    }
};