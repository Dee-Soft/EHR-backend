/**
 * Frontend Decrypt Middleware
 * Decrypts fields encrypted by frontend using OpenBao's frontend AES key
 * Replaces transitDecryptMiddleware for frontend-encrypted data
 */

const openbaoConfig = require('../config/openbao.config');
const logger = require('../config/logger');

/**
 * Decrypt specified fields in request body using OpenBao's frontend AES key
 * @param {Array<string>} fieldsToDecrypt - Array of field names to decrypt
 * @returns {Function} Express middleware
 */
module.exports = function frontendDecryptMiddleware(fieldsToDecrypt) {
  return async (req, res, next) => {
    try {
      const vault = openbaoConfig.getTransitClient();
      const keyNames = openbaoConfig.keys;
      
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
          try {
            // Decrypt using OpenBao's frontend AES key
            const result = await vault.write(
              `transit/decrypt/${keyNames.aesMasterFrontend}`,
              {
                ciphertext: value
              }
            );
            
            // Parse the decrypted data
            const decrypted = JSON.parse(Buffer.from(result.data.plaintext, 'base64').toString());
            
            // Replace ciphertext with plaintext
            req.body[field] = decrypted;
            
            logger.debug(`Decrypted field ${field} using frontend AES key`, {
              field: field,
              keyUsed: keyNames.aesMasterFrontend,
              keyVersion: result.data.key_version
            });
          } catch (decryptError) {
            // If decryption with frontend key fails, try with backend key
            // (for backward compatibility or different encryption scenarios)
            try {
              const result = await vault.write(
                `transit/decrypt/${keyNames.aesMasterBackend}`,
                {
                  ciphertext: value
                }
              );
              
              const decrypted = JSON.parse(Buffer.from(result.data.plaintext, 'base64').toString());
              req.body[field] = decrypted;
              
              logger.debug(`Decrypted field ${field} using backend AES key (fallback)`, {
                field: field,
                keyUsed: keyNames.aesMasterBackend,
                keyVersion: result.data.key_version
              });
            } catch (fallbackError) {
              logger.error(`Failed to decrypt field ${field} with both frontend and backend keys`, {
                field: field,
                frontendError: decryptError.message,
                backendError: fallbackError.message
              });
              throw new Error(`Failed to decrypt field: ${field}`);
            }
          }
        }
        // If not encrypted, leave as is (already plaintext)
      }
      
      next();
    } catch (error) {
      logger.error('frontendDecryptMiddleware error', { 
        error: error.message,
        fields: fieldsToDecrypt,
        userId: req.user?.id
      });
      res.status(500).json({
        message: 'Failed to decrypt frontend-encrypted fields',
        error: error.message
      });
    }
  };
};
