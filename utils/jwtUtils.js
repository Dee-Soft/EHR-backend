const jwt = require('jsonwebtoken');

function generateJWT(user) {
    const payload = {
        id: user._id,
        role: user.role,
        email: user.email
    };
    const options = {
        expiresIn: '1day' // Token will expire in 1 day
    };
    return jwt.sign(payload, process.env.JWT_SECRET, options);
};

module.exports = { generateJWT };