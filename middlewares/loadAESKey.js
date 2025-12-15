/**
 * Load AES Key Middleware
 * Unwraps RSA-encrypted AES key from frontend using OpenBao Transit Engine
 * Replaces local RSA decryption with OpenBao-based unwrapping
 */

const keyExchangeService = require('../services/keyExchangeService');
const logger = require('../config/logger');

/**
 * Load and unwrap AES key from request headers
 * Frontend sends their AES key wrapped with backend's RSA public key
 */
async function loadAESKey(req, res, next) {
  try {
    // Get encrypted AES key from headers
    const encryptedAesKey = req.headers['x-encrypted-aes-key'];
    
    if (!encryptedAesKey) {
      return res.status(400).json({ 
        message: 'Missing encrypted AES key in headers' 
      });
    }
    
    // Unwrap using OpenBao Transit Engine
    const unwrapped = await keyExchangeService.unwrapAESKeyFromFrontend(encryptedAesKey);
    const aesKey = unwrapped.plaintextKey;
    
    logger.debug('Successfully unwrapped frontend AES key via OpenBao', {
      keyVersion: unwrapped.keyVersion,
      userId: req.user?.id
    });
    
    // Validate key format (should be base64 encoded)
    if (!aesKey || aesKey.length < 32) {
      throw new Error('Invalid AES key format after unwrapping');
    }
    
    // Attach unwrapped key to request for downstream middleware
    req.aesKey = aesKey;
    req.aesKeyVersion = unwrapped.keyVersion;
    
    next();
  } catch (error) {
    logger.error('Failed to load AES key', { 
      error: error.message,
      userId: req.user?.id
    });
    return res.status(500).json({ 
      message: 'Failed to load AES key', 
      error: error.message 
    });
  }
}

module.exports = { loadAESKey };
