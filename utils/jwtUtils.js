const jwt = require('jsonwebtoken');

function generateJWT(user) {
    const payload = {
        id: user._id,
        role: user.role,
        email: user.email,
        aesKey: user.aesKey
    };
    const options = {
        expiresIn: '1h'
    };
    return jwt.sign(payload, process.env.JWT_SECRET, options);
};

module.exports = { generateJWT };