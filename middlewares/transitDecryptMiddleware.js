/**
 * Transit Decrypt Middleware
 * Decrypts specified request body fields using OpenBao Transit Engine
 * Replaces the old decryptFieldsAESMiddleware
 */

const cryptoService = require('../services/openbaoCryptoService');
const logger = require('../config/logger');

/**
 * Decrypt specified fields in request body
 * @param {Array<string>} fieldsToDecrypt - Array of field names to decrypt
 * @returns {Function} Express middleware
 */
module.exports = function transitDecryptMiddleware(fieldsToDecrypt) {
  return async (req, res, next) => {
    try {
      // Decrypt each specified field
      for (const field of fieldsToDecrypt) {
        const value = req.body[field];
        
        // Skip undefined or null values
        if (value === undefined || value === null) {
          continue;
        }
        
        // Check if value is encrypted (starts with "vault:v")
        // If not encrypted, skip decryption (allows plaintext passthrough)
        const isEncrypted = typeof value === 'string' && value.startsWith('vault:v');
        
        if (isEncrypted) {
          // Decrypt using OpenBao Transit Engine
          const decrypted = await cryptoService.decryptData(value);
          
          // Replace ciphertext with plaintext
          req.body[field] = decrypted;
        }
        // If not encrypted, leave as is (already plaintext)
      }
      
      next();
    } catch (error) {
      logger.error('transitDecryptMiddleware error', { 
        error: error.message,
        fields: fieldsToDecrypt
      });
      res.status(500).json({
        message: 'Failed to decrypt fields',
        error: error.message
      });
    }
  };
};

