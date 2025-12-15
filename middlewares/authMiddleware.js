const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const AuditLog = require('../models/AuditLog');

/**
 * Middleware to authenticate users via JWT token
 * Verifies JWT token from cookies and attaches user data to request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} 401 if token missing, 403 if token invalid
 */
const authMiddleware = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        logger.warn('Authentication failed: Token missing', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        return res.status(401).json({ message: 'Token is missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        logger.warn('Authentication failed: JWT verification failed', {
            error: err.message,
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        
        // Create audit log for failed authentication attempt
        try {
            await AuditLog.create({
                action: 'AUTH_FAILED',
                actorId: null,
                targetType: 'Authentication',
                details: `Failed authentication attempt: ${err.message}`,
                ipAddress: req.ip
            });
        } catch (auditErr) {
            logger.error('Failed to create audit log for auth failure', { error: auditErr.message });
        }
        
        return res.status(403).json({ message: 'Failed to authenticate token' });
    }
};

/**
 * Middleware to require specific roles for route access
 * Checks if authenticated user has one of the required roles
 * 
 * @param {...string} roles - Allowed roles (Admin, Manager, Provider, Employee, Patient)
 * @returns {Function} Express middleware function
 */
const requiredRole = (...roles) => {
  return async (req, res, next) => {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    
    logger.info('Authorization check', {
      userId,
      userRole,
      requiredRoles: roles,
      path: req.path,
      method: req.method
    });
    
    if (!roles.includes(userRole)) {
      logger.warn('Authorization denied: Insufficient permissions', {
        userId,
        userRole,
        requiredRoles: roles,
        path: req.path,
        method: req.method
      });
      
      // Create audit log for authorization failure
      try {
        await AuditLog.create({
          action: 'AUTHZ_DENIED',
          actorId: userId || null,
          targetType: 'Authorization',
          details: `Access denied to ${req.path} - Required: [${roles.join(', ')}], Has: ${userRole}`,
          ipAddress: req.ip
        });
      } catch (auditErr) {
        logger.error('Failed to create audit log for authz denial', { error: auditErr.message });
      }
      
      return res.status(403).json({ message: 'Access denied' });
    }
    
    next();
  };
};

module.exports = {
  authMiddleware,
  requiredRole,
};