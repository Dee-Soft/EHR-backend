/**
 * Transit Encrypt Middleware
 * Encrypts specified request body fields using OpenBao Transit Engine
 * Replaces the old encryptFieldsAESMiddleware
 */

const cryptoService = require('../services/openbaoCryptoService');
const logger = require('../config/logger');

/**
 * Encrypt specified fields in request body
 * @param {Array<string>} fieldsToEncrypt - Array of field names to encrypt
 * @returns {Function} Express middleware
 */
module.exports = function transitEncryptMiddleware(fieldsToEncrypt) {
  return async (req, res, next) => {
    try {
      // Encrypt each specified field
      for (const field of fieldsToEncrypt) {
        const value = req.body[field];
        
        // Skip undefined or null values
        if (value === undefined || value === null) {
          continue;
        }
        
        // Convert arrays and objects to JSON string before encryption
        const toEncrypt = Array.isArray(value) || typeof value === 'object' 
          ? JSON.stringify(value)
          : value;
        
        // Encrypt using OpenBao Transit Engine
        const encrypted = await cryptoService.encryptData(toEncrypt);
        
        // Replace plaintext with ciphertext
        req.body[field] = encrypted.ciphertext;
      }
      
      next();
    } catch (error) {
      logger.error('transitEncryptMiddleware error', { 
        error: error.message,
        fields: fieldsToEncrypt
      });
      res.status(500).json({
        message: 'Failed to encrypt fields',
        error: error.message
      });
    }
  };
};

