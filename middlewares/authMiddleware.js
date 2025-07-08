const jwt = require('jsonwebtoken');

// Middleware to authenticate users
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Token is missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('JWT verification failed:', err.message);
        return res.status(403).json({ message: 'Failed to authenticate token' });
    }
};

const requiredRole = (...roles) => {
  return (req, res, next) => {
    console.log('User role:', req.user?.role);
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  requiredRole,
};