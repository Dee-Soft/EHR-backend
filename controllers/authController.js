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

        await AuditLog.create({
          action: 'login',
          actorId: user._id,
          targetId: user._id,
          targetType: 'User',
          details: `User ${user.name} logged in successfully`
        });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Login failed' });
    }
};