/**
 * Key Exchange Controller
 * Handles RSA public key distribution for frontend-backend key exchange
 * Refactored to use OpenBao Transit Engine instead of file-based keys
 */

const keyExchangeService = require('../services/keyExchangeService');

/**
 * Get backend's RSA public key for frontend
 * Frontend will use this to wrap their AES keys before sending to backend
 * GET /api/key-exchange/public-key
 */
exports.getBackendPublicKey = async (req, res) => {
  try {
    const publicKeyData = await keyExchangeService.getPublicKeyForFrontend();
    
    res.status(200).json({
      message: 'Public key retrieved successfully',
      publicKey: publicKeyData.publicKey,
      keyVersion: publicKeyData.keyVersion,
      algorithm: publicKeyData.algorithm,
      validUntil: publicKeyData.validUntil
    });
  } catch (error) {
    console.error('[KeyExchange] Failed to retrieve public key:', error.message);
    res.status(500).json({ 
      message: 'Failed to retrieve public key', 
      error: error.message 
    });
  }
};

/**
 * Manual key rotation trigger (for admin use)
 * POST /api/key-exchange/rotate
 * Note: Requires Admin authentication middleware
 */
exports.triggerKeyRotation = async (req, res) => {
  try {
    // OpenBao handles key rotation automatically
    // This endpoint can be used to trigger manual rotation if needed
    console.log('[KeyExchange] Manual key rotation requested by admin');
    
    res.status(200).json({
      message: 'Key rotation is handled automatically by OpenBao',
      note: 'Check OpenBao Transit Engine for key rotation policies'
    });
  } catch (error) {
    console.error('[KeyExchange] Key rotation trigger failed:', error.message);
    res.status(500).json({ 
      message: 'Failed to trigger key rotation', 
      error: error.message 
    });
  }
};
