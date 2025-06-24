const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'your_jwt_secret';

exports.generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role, email: user.email }, secret, { expiresIn: '1h' });
};
