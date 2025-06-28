const jwt = require('jsonwebtoken');

function generateJWT(user, aesKey) {
    const payload = {
        id: user._id,
        role: user.role,
        email: user.email,
        aesKey: aesKey
    };
    const options = {
        expiresIn: '1h'
    };
    return jwt.sign(payload, process.env.JWT_SECRET, options);
};

module.exports = { generateJWT };