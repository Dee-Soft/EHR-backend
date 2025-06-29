const { encryptAES } = require('../utils/aesUtils');
const jwt = require('jsonwebtoken');

module.exports = (fieldsToEncrypt) => {
    return (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Token is missing' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const aesKey = decoded.aesKey || req.headers['x-plaintext-key'];

            if (!aesKey) {
                return res.status(403).json({ message: 'AES key is missing in token' });
            }

            fieldsToEncrypt.forEach(field => {
                const value = req.body[field];
                if (value !== undefined) {
                    const toEncrypt = Array.isArray(value) ? JSON.stringify(value) : value;
                    req.body[field] = encryptAES(toEncrypt, aesKey);
                }
            });
            next();
        } catch (error) {
            return res.status(400).json({ message: 'Failed to encrypt' });
        }
    };
}
// This middleware encrypts specified fields in the request body using AES encryption