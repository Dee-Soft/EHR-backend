const User = require('../models/User');
const { generateJWT } = require('../utils/jwtUtils');
const AuditLog = require('../models/AuditLog');


exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        console.log('Retrieved User:', user);

        const isMatch = await user.comparePassword(password);
        console.log('Password Match:', isMatch);
        
        if (!user || !isMatch) {
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
          details: `User ${user.name} logged in successfully`
        });
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        res.status(500).json({ message: 'Login failed' });
    }
};

// GET /api/auth/me
exports.getCurrentUser = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    res.status(200).json({ user: req.user });
};

// POST /api/auth/logout
exports.logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
};
