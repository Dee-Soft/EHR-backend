const { decryptAES } = require('../utils/aesUtils');

function decryptFieldsAES(req, fields, aesKey) {
  fields.forEach(field => {
    const value = req.body[field];
    if (value !== undefined) {
      req.body[field] = decryptAES(value, aesKey);
    }
  });
}

module.exports = function decryptFieldsAESMiddleware(fieldsToDecrypt) {
  return (req, res, next) => {
    try {
      const aesKey = req.aesKey; // Loaded by loadAESKey
      if (!aesKey) {
        return res.status(400).json({ message: 'Missing AES key in request context' });
      }
      decryptFieldsAES(req, fieldsToDecrypt, aesKey);
      next();
    } catch (error) {
      console.error('decryptFieldsAESMiddleware error:', error.message);
      res.status(500).json({ message: 'Failed to decrypt fields', error: error.message });
    }
  };
};

module.exports.decryptFieldsAES = decryptFieldsAES;
