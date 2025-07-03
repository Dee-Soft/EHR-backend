const { encryptAES } = require('../utils/aesUtils');

function encryptFieldsAES(req, fields, aesKey) {
  fields.forEach(field => {
    const value = req.body[field];
    if (value !== undefined) {
      const toEncrypt = Array.isArray(value) ? JSON.stringify(value) : value;
      req.body[field] = encryptAES(toEncrypt, aesKey);
    }
  });
}

module.exports = function encryptFieldsAESMiddleware(fieldsToEncrypt) {
  return (req, res, next) => {
    try {
      const aesKey = req.aesKey; // Loaded by loadAESKey
      if (!aesKey) {
        return res.status(400).json({ message: 'Missing AES key in request context' });
      }
      encryptFieldsAES(req, fieldsToEncrypt, aesKey);
      next();
    } catch (error) {
      console.error('encryptFieldsAESMiddleware error:', error.message);
      res.status(500).json({ message: 'Failed to encrypt fields', error: error.message });
    }
  };
};

module.exports.encryptFieldsAES = encryptFieldsAES;
