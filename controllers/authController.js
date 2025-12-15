const User = require('../models/User');
const { generateJWT } = require('../utils/jwtUtils');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * User login
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        
        if (!user) {
            logger.warn('Login attempt failed: User not found', { email, ip: req.ip });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            logger.warn('Login attempt failed: Invalid password', { 
                email, 
                userId: user._id,
                ip: req.ip 
            });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = generateJWT(user);

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'strict', // protect against CSRF
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        await AuditLog.create({
          action: 'login',
          actorId: user._id,
          targetId: user._id,
          targetType: 'User',
          details: `User ${user.name} logged in successfully`,
          ipAddress: req.ip
        });
        
        logger.info('User login successful', { 
            userId: user._id, 
            role: user.role,
            email: user.email 
        });
        
        res.status(200).json({ message: 'Login successful',
            user: {
                id: user._id,
                role: user.role,
                name: user.name,
                email: user.email,
            },
        });
    } catch (err) {
        logger.error('Login error', { error: err.message, email });
        res.status(500).json({ message: 'Login failed' });
    }
};

/**
 * Get current authenticated user
 * @route GET /api/auth/me
 * @access Private
 */
exports.getCurrentUser = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    res.status(200).json({ user: req.user });
};

/**
 * User logout
 * @route POST /api/auth/logout
 * @access Private
 */
exports.logout = async (req, res) => {
    try {
        await AuditLog.create({
            action: 'LOGOUT',
            actorId: req.user?.id,
            targetId: req.user?.id,
            targetType: 'User',
            details: `User logged out`,
            ipAddress: req.ip
        });
        
        logger.info('User logout', { userId: req.user?.id });
    } catch (err) {
        logger.error('Error creating logout audit log', { error: err.message });
    }
    
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
};
