/**
 * Key Exchange Controller
 * Handles RSA public key distribution for frontend-backend key exchange
 * Refactored to use OpenBao Transit Engine instead of file-based keys
 */

const keyExchangeService = require('../services/keyExchangeService');
const logger = require('../config/logger');

/**
 * Get backend's RSA public key for frontend
 * Frontend will use this to wrap their AES keys before sending to backend
 * @route GET /api/key-exchange/public-key
 * @access Private
 */
exports.getBackendPublicKey = async (req, res) => {
  try {
    const publicKeyData = await keyExchangeService.getPublicKeyForFrontend();
    
    logger.info('Public key retrieved successfully', { 
      userId: req.user?.id,
      keyVersion: publicKeyData.keyVersion 
    });
    
    res.status(200).json({
      message: 'Public key retrieved successfully',
      publicKey: publicKeyData.publicKey,
      keyVersion: publicKeyData.keyVersion,
      algorithm: publicKeyData.algorithm,
      validUntil: publicKeyData.validUntil
    });
  } catch (error) {
    logger.error('Failed to retrieve public key', { 
      error: error.message,
      userId: req.user?.id 
    });
    res.status(500).json({ 
      message: 'Failed to retrieve public key', 
      error: error.message 
    });
  }
};

/**
 * Manual key rotation trigger (for admin use)
 * @route POST /api/key-exchange/rotate
 * @access Private (Admin only)
 */
exports.triggerKeyRotation = async (req, res) => {
  try {
    // OpenBao handles key rotation automatically
    // This endpoint can be used to trigger manual rotation if needed
    logger.info('Manual key rotation requested', { 
      adminId: req.user?.id 
    });
    
    res.status(200).json({
      message: 'Key rotation is handled automatically by OpenBao',
      note: 'Check OpenBao Transit Engine for key rotation policies'
    });
  } catch (error) {
    logger.error('Key rotation trigger failed', { 
      error: error.message,
      adminId: req.user?.id 
    });
    res.status(500).json({ 
      message: 'Failed to trigger key rotation', 
      error: error.message 
    });
  }
};
