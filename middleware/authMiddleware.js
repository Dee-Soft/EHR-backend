const jwt = require('jsonwebtoken');
const roles = require('../config/roles');
const secret = process.env.JWT_SECRET || 'your_jwt_secret';

exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

exports.permit = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

exports.checkPermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!roles[userRole]?.can.includes(permission)) {
      return res.status(403).json({ message: 'Missing permission' });
    }
    next();
  };
};
