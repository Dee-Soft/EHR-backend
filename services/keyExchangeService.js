/**
 * Key Exchange Service
 * Manages RSA key pairs and AES key wrapping/unwrapping via OpenBao Transit Engine
 * Handles secure key exchange between frontend and backend
 */

const openbaoConfig = require('../config/openbao.config');
const logger = require('../config/logger');

class KeyExchangeService {
  constructor() {
    this.vault = openbaoConfig.getTransitClient();
    this.keyNames = openbaoConfig.keys;
  }

  /**
   * Get RSA public key for frontend to use
   * Frontend will use this to wrap their AES keys before sending to backend
   * @returns {Object} { publicKey, keyVersion, algorithm, validUntil }
   */
  async getPublicKeyForFrontend() {
    try {
      const result = await this.vault.read(`transit/keys/${this.keyNames.rsaExchangeBackend}`);
      const latestVersion = result.data.latest_version;
      
      return {
        publicKey: result.data.keys[latestVersion].public_key.trim(),
        keyVersion: latestVersion,
        algorithm: 'RSA-2048',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };
    } catch (error) {
      logger.error('Failed to get public key', { error: error.message });
      throw new Error('Public key unavailable');
    }
  }

  /**
   * Wrap (encrypt) AES key with RSA for sending to frontend
   * Used when backend needs to send encrypted data key to frontend
   * @param {String} plaintextKey - AES key in base64
   * @returns {Object} { wrappedKey, keyVersion, algorithm, wrappedAt }
   */
  async wrapAESKeyForFrontend(plaintextKey) {
    try {
      const result = await this.vault.write(
        `transit/encrypt/${this.keyNames.rsaExchangeFrontend}`,
        {
          plaintext: plaintextKey,
          key_version: 1
        }
      );
      
      return {
        wrappedKey: result.data.ciphertext,
        keyVersion: result.data.key_version,
        algorithm: 'RSA-OAEP-2048',
        wrappedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Key wrapping failed', { error: error.message });
      throw new Error('Key exchange failed');
    }
  }

  /**
   * Wrap backend's AES key with frontend's RSA public key
   * Used when backend needs to send its AES key to frontend for decryption
   * @param {String} backendAesKey - Backend's AES key to wrap (base64)
   * @param {String} frontendPublicKey - Frontend's RSA public key (PEM format)
   * @returns {Object} { wrappedKey, keyVersion, algorithm, wrappedAt }
   */
  async wrapBackendAESKeyForFrontend(backendAesKey, frontendPublicKey) {
    try {
      // Note: This is a simplified implementation
      // In a real scenario, we would need to use the frontend's RSA public key
      // to encrypt the backend's AES key. However, OpenBao Transit Engine
      // requires the key to be managed by OpenBao.
      // For now, we'll use the frontend's RSA key in OpenBao
      const result = await this.vault.write(
        `transit/encrypt/${this.keyNames.rsaExchangeFrontend}`,
        {
          plaintext: backendAesKey,
          key_version: 1
        }
      );
      
      return {
        wrappedKey: result.data.ciphertext,
        keyVersion: result.data.key_version,
        algorithm: 'RSA-OAEP-2048',
        wrappedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to wrap backend AES key for frontend', { error: error.message });
      throw new Error('Key wrapping failed');
    }
  }

  /**
   * Unwrap (decrypt) AES key received from frontend
   * Frontend sends their AES key wrapped with backend's public key
   * @param {String} wrappedKey - RSA-encrypted AES key from frontend
   * @returns {Object} { plaintextKey, keyVersion, unwrappedAt }
   */
  async unwrapAESKeyFromFrontend(wrappedKey) {
    try {
      const result = await this.vault.write(
        `transit/decrypt/${this.keyNames.rsaExchangeBackend}`,
        {
          ciphertext: wrappedKey
        }
      );
      
      return {
        plaintextKey: result.data.plaintext,
        keyVersion: result.data.key_version,
        unwrappedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Key unwrapping failed', { error: error.message });
      throw new Error('Invalid key material');
    }
  }

  /**
   * Validate that a wrapped key can be unwrapped
   * @param {String} wrappedKey - Key to validate
   * @returns {Boolean} True if valid
   */
  async validateWrappedKey(wrappedKey) {
    try {
      await this.unwrapAESKeyFromFrontend(wrappedKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get frontend's RSA public key from OpenBao
   * Frontend can use this to verify its public key matches OpenBao
   * @returns {Object} { publicKey, keyVersion, algorithm, validUntil }
   */
  async getFrontendPublicKey() {
    try {
      const result = await this.vault.read(`transit/keys/${this.keyNames.rsaExchangeFrontend}`);
      const latestVersion = result.data.latest_version;
      
      return {
        publicKey: result.data.keys[latestVersion].public_key.trim(),
        keyVersion: latestVersion,
        algorithm: 'RSA-2048',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    } catch (error) {
      logger.error('Failed to get frontend public key', { error: error.message });
      throw new Error('Frontend public key unavailable');
    }
  }

  /**
   * Check OpenBao connection status for key exchange operations
   * @returns {Object} Connection status
   */
  async getConnectionStatus() {
    try {
      const health = await openbaoConfig.healthCheck();
      return {
        connected: health.healthy,
        endpoint: health.endpoint,
        rsaKeyAvailable: health.healthy, // If healthy, RSA key should be available
        endpointsConfigured: health.endpointsConfigured
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        endpoint: openbaoConfig.getCurrentEndpoint(),
        rsaKeyAvailable: false,
        endpointsConfigured: openbaoConfig.getConfiguredEndpoints()
      };
    }
  }
}

module.exports = new KeyExchangeService();

