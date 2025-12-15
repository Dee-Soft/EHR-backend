/**
 * OpenBao Crypto Service
 * Handles all encryption/decryption operations using OpenBao Transit Engine
 * Replaces local AES/RSA crypto operations
 */

const openbaoConfig = require('../config/openbao.config');

class OpenBaoCryptoService {
  constructor() {
    this.vault = openbaoConfig.getTransitClient();
    this.keyNames = openbaoConfig.keys;
  }

  /**
   * Generate a new data key for encrypting patient records
   * OpenBao creates and manages the key lifecycle
   * @returns {Object} { plaintextKey, ciphertextKey, keyVersion, keyId }
   */
  async generateDataKey() {
    try {
      const result = await this.vault.write(
        `transit/datakey/plaintext/${this.keyNames.aesMaster}`
      );
      
      return {
        plaintextKey: result.data.plaintext,
        ciphertextKey: result.data.ciphertext,
        keyVersion: result.data.key_version,
        keyId: `data-key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      console.error('Data key generation failed:', error.message);
      throw new Error('Key generation service unavailable');
    }
  }

  /**
   * Encrypt patient data using OpenBao Transit Engine
   * @param {Object|String} plaintext - Data to encrypt
   * @param {String} keyCiphertext - Optional context for encryption
   * @returns {Object} { ciphertext, keyVersion, encryptedAt }
   */
  async encryptData(plaintext, keyCiphertext = null) {
    try {
      const payload = {
        plaintext: Buffer.from(JSON.stringify(plaintext)).toString('base64')
      };
      
      // Add context if using specific data key
      if (keyCiphertext) {
        payload.context = keyCiphertext;
      }
      
      const result = await this.vault.write(
        `transit/encrypt/${this.keyNames.aesMaster}`,
        payload
      );
      
      return {
        ciphertext: result.data.ciphertext,
        keyVersion: result.data.key_version,
        encryptedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Encryption failed:', error.message);
      throw new Error('Encryption service unavailable');
    }
  }

  /**
   * Decrypt patient data using OpenBao Transit Engine
   * @param {String} ciphertext - OpenBao ciphertext (vault:v1:...)
   * @param {String} keyCiphertext - Optional context for decryption
   * @returns {Object} Decrypted data
   */
  async decryptData(ciphertext, keyCiphertext = null) {
    try {
      const payload = {
        ciphertext: ciphertext
      };
      
      if (keyCiphertext) {
        payload.context = keyCiphertext;
      }
      
      const result = await this.vault.write(
        `transit/decrypt/${this.keyNames.aesMaster}`,
        payload
      );
      
      return JSON.parse(Buffer.from(result.data.plaintext, 'base64').toString());
    } catch (error) {
      console.error('Decryption failed:', error.message);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt patient data - convenience method
   * @param {Object} patientData - Patient record data
   * @returns {Object} Encryption result
   */
  async encryptPatientData(patientData) {
    return this.encryptData(patientData);
  }

  /**
   * Decrypt patient data - convenience method
   * @param {String} ciphertext - Encrypted patient data
   * @returns {Object} Decrypted patient data
   */
  async decryptPatientData(ciphertext) {
    return this.decryptData(ciphertext);
  }

  /**
   * Re-encrypt data with new key (for key rotation)
   * @param {String} oldCiphertext - Current ciphertext
   * @param {String} oldKeyCiphertext - Old key context
   * @param {String} newKeyCiphertext - New key context
   * @returns {Object} Re-encrypted data
   */
  async reencryptData(oldCiphertext, oldKeyCiphertext, newKeyCiphertext) {
    try {
      // Decrypt with old key
      const decrypted = await this.decryptData(oldCiphertext, oldKeyCiphertext);
      
      // Encrypt with new key
      return await this.encryptData(decrypted, newKeyCiphertext);
    } catch (error) {
      console.error('Re-encryption failed:', error.message);
      throw new Error('Data migration failed');
    }
  }

  /**
   * Get key version information
   * @returns {Object} Key version details
   */
  async getKeyVersion() {
    try {
      const result = await this.vault.read(
        `transit/keys/${this.keyNames.aesMaster}`
      );
      
      return {
        latestVersion: result.data.latest_version,
        minDecryptionVersion: result.data.min_decryption_version,
        minEncryptionVersion: result.data.min_encryption_version
      };
    } catch (error) {
      console.error('Failed to get key version:', error.message);
      throw new Error('Key version unavailable');
    }
  }
}

module.exports = new OpenBaoCryptoService();

