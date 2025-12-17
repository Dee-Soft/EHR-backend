/**
 * OpenBao Mock for Testing
 * Simulates OpenBao Transit Engine responses without requiring a real OpenBao instance
 */

const crypto = require('crypto');

class OpenBaoMock {
  constructor() {
    this.initialized = true;
    this.sealed = false;
    this.keys = {
      'ehr-aes-master': {
        version: 1,
        type: 'aes256-gcm96',
        keys: {
          1: { creation_time: new Date().toISOString() }
        }
      },
      'ehr-rsa-exchange': {
        version: 1,
        type: 'rsa-2048',
        keys: {
          1: {
            creation_time: new Date().toISOString(),
            public_key: this._generateMockRSAPublicKey()
          }
        }
      }
    };
    this.dataKeys = new Map(); // Store generated data keys
    this.encryptedData = new Map(); // Store encrypted data for decryption
  }

  /**
   * Mock status check
   */
  async status() {
    return {
      initialized: this.initialized,
      sealed: this.sealed,
      version: '1.14.0',
      cluster_name: 'openbao-mock',
      cluster_id: 'mock-cluster-id'
    };
  }

  /**
   * Mock AppRole login
   */
  async approleLogin({ role_id, secret_id }) {
    if (!role_id || !secret_id) {
      throw new Error('role_id and secret_id required');
    }
    return {
      auth: {
        client_token: 'mock-token-' + crypto.randomBytes(16).toString('hex'),
        policies: ['backend-policy'],
        lease_duration: 3600
      }
    };
  }

  /**
   * Mock write operation (encrypt, decrypt, generate data key)
   */
  async write(path, data = {}) {
    // Generate data key
    if (path.includes('datakey/plaintext')) {
      const keyName = path.split('/').pop();
      const plaintextKey = crypto.randomBytes(32).toString('base64');
      const keyId = `key-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      
      this.dataKeys.set(keyId, plaintextKey);
      
      return {
        data: {
          plaintext: plaintextKey,
          ciphertext: `vault:v1:${crypto.randomBytes(32).toString('base64')}`,
          key_version: 1,
          key_id: keyId
        }
      };
    }

    // Encrypt operation
    if (path.includes('transit/encrypt')) {
      const { plaintext, context } = data;
      if (!plaintext) {
        throw new Error('plaintext required for encryption');
      }

      // Simulate OpenBao's encryption format: vault:v{version}:{ciphertext}
      const mockCiphertext = crypto.randomBytes(64).toString('base64');
      const fullCiphertext = `vault:v1:${mockCiphertext}`;
      
      // Store the plaintext so we can decrypt it later
      this.encryptedData.set(fullCiphertext, plaintext);
      
      return {
        data: {
          ciphertext: fullCiphertext,
          key_version: 1
        }
      };
    }

    // Decrypt operation
    if (path.includes('transit/decrypt')) {
      const { ciphertext, context } = data;
      if (!ciphertext || !ciphertext.startsWith('vault:v')) {
        throw new Error('invalid ciphertext format');
      }

      // Retrieve the stored plaintext
      const plaintext = this.encryptedData.get(ciphertext);
      if (!plaintext) {
        // If not found, return a mock 32-byte AES key (for key unwrapping scenarios)
        const mockPlaintext = crypto.randomBytes(32).toString('base64');
        return {
          data: {
            plaintext: mockPlaintext
          }
        };
      }
      
      return {
        data: {
          plaintext: plaintext
        }
      };
    }

    throw new Error(`Unsupported operation: ${path}`);
  }

  /**
   * Mock read operation (get key info, public keys)
   */
  async read(path) {
    // Read key information
    if (path.includes('transit/keys/')) {
      const keyName = path.split('/').pop();
      const keyData = this.keys[keyName];
      
      if (!keyData) {
        throw new Error(`Key ${keyName} not found`);
      }

      return {
        data: {
          type: keyData.type,
          latest_version: keyData.version,
          keys: keyData.keys,
          min_decryption_version: 1,
          min_encryption_version: 1,
          deletion_allowed: false,
          exportable: false
        }
      };
    }

    // Read secret from KV store (for backward compatibility)
    if (path.includes('ehr/data/')) {
      throw new Error('MongoDB credentials should come from environment variables');
    }

    throw new Error(`Unsupported read path: ${path}`);
  }

  /**
   * Mock delete operation
   */
  async delete(path) {
    return { data: {} };
  }

  /**
   * Generate mock RSA public key
   */
  _generateMockRSAPublicKey() {
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    return publicKey;
  }

  /**
   * Helper to create predictable encrypted data for testing
   */
  createMockEncryptedData(plaintext, version = 1) {
    const plaintextB64 = Buffer.from(JSON.stringify(plaintext)).toString('base64');
    const hash = crypto.createHash('sha256').update(plaintextB64).digest('base64');
    return `vault:v${version}:${hash}`;
  }

  /**
   * Helper to create mock data key response
   */
  createMockDataKey() {
    const plaintextKey = crypto.randomBytes(32).toString('base64');
    const ciphertextKey = `vault:v1:${crypto.randomBytes(32).toString('base64')}`;
    return {
      plaintextKey,
      ciphertextKey,
      keyVersion: 1,
      keyId: `data-key-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    };
  }

  /**
   * Reset mock state
   */
  reset() {
    this.initialized = false;
    this.sealed = false;
    this.dataKeys.clear();
    this.encryptedData.clear();
  }
}

/**
 * Create a mock vault client that mimics node-vault interface
 */
function createMockVaultClient(options = {}) {
  const mock = new OpenBaoMock();
  mock.initialized = options.initialized !== false;
  mock.sealed = options.sealed || false;

  return {
    status: mock.status.bind(mock),
    approleLogin: mock.approleLogin.bind(mock),
    write: mock.write.bind(mock),
    read: mock.read.bind(mock),
    delete: mock.delete.bind(mock),
    token: options.token || 'ehr-permanent-token',
    endpoint: options.endpoint || 'http://localhost:18200',
    // Helper methods for testing
    _mock: mock,
    _reset: mock.reset.bind(mock),
    _createMockEncryptedData: mock.createMockEncryptedData.bind(mock),
    _createMockDataKey: mock.createMockDataKey.bind(mock)
  };
}

/**
 * Mock responses for common operations
 */
const mockResponses = {
  // Successful encryption
  encrypt: (plaintext, version = 1) => ({
    data: {
      ciphertext: `vault:v${version}:${crypto.randomBytes(64).toString('base64')}`,
      key_version: version
    }
  }),

  // Successful decryption
  decrypt: (originalPlaintext) => ({
    data: {
      plaintext: Buffer.from(JSON.stringify(originalPlaintext)).toString('base64')
    }
  }),

  // Data key generation
  dataKey: () => {
    const plaintextKey = crypto.randomBytes(32).toString('base64');
    return {
      data: {
        plaintext: plaintextKey,
        ciphertext: `vault:v1:${crypto.randomBytes(32).toString('base64')}`,
        key_version: 1
      }
    };
  },

  // Public key retrieval
  publicKey: () => {
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return {
      data: {
        type: 'rsa-2048',
        latest_version: 1,
        keys: {
          1: {
            public_key: publicKey,
            creation_time: new Date().toISOString()
          }
        }
      }
    };
  },

  // Status check
  status: () => ({
    initialized: true,
    sealed: false,
    version: '1.14.0'
  })
};

module.exports = {
  OpenBaoMock,
  createMockVaultClient,
  mockResponses
};

