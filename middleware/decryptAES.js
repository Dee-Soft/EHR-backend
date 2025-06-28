const { decryptAES } = require('../utils/aesUtils');
const jwt = require('jsonwebtoken');

// Middleware to decrypt AES key encrypted in the request body
module.exports = (fieldsToDecrypt) => {
    return (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Token is missing' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const aesKey = decoded.aesKey;

            if (!aesKey) {
                return res.status(403).json({ message: 'AES key is missing in token' });
            }

            fieldsToDecrypt.forEach(field => {
                if (req.body[field]) {
                    req.body[field] = decryptAES(req.body[field], aesKey);
                }
            });
            next();
        } catch (error) {
            return res.status(400).json({ message: 'Failed to decrypt' });
        }
    };
};