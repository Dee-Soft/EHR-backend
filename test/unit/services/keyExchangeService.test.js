/**
 * Unit Tests for Key Exchange Service
 * Tests RSA key pair management and AES key wrapping/unwrapping via OpenBao
 */

const { createMockVaultClient: mockCreateMockVaultClient } = require('../../setup/mocks/openbaoMock');
const crypto = require('crypto');

// Mock logger
jest.mock('../../../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock the openbao config
jest.mock('../../../config/openbao.config', () => {
  const mockVault = mockCreateMockVaultClient();
  return {
    getTransitClient: () => mockVault,
    keys: {
      aesMaster: 'test-aes-key',
      rsaExchange: 'test-rsa-key'
    },
    validateConnection: jest.fn().mockResolvedValue(true)
  };
});

describe('Key Exchange Service', () => {
  let keyExchangeService;
  let mockVault;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    const openbaoConfig = require('../../../config/openbao.config');
    mockVault = openbaoConfig.getTransitClient();
    keyExchangeService = require('../../../services/keyExchangeService');
  });

  describe('getPublicKeyForFrontend', () => {
    test('should retrieve RSA public key from OpenBao', async () => {
      const result = await keyExchangeService.getPublicKeyForFrontend();
      
      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('keyVersion');
      expect(result).toHaveProperty('algorithm');
      expect(result).toHaveProperty('validUntil');
    });

    test('should return valid PEM formatted public key', async () => {
      const result = await keyExchangeService.getPublicKeyForFrontend();
      
      expect(result.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(result.publicKey).toContain('END PUBLIC KEY');
    });

    test('should include algorithm information', async () => {
      const result = await keyExchangeService.getPublicKeyForFrontend();
      
      expect(result.algorithm).toBe('RSA-2048');
    });

    test('should include validity period', async () => {
      const result = await keyExchangeService.getPublicKeyForFrontend();
      
      expect(new Date(result.validUntil)).toBeInstanceOf(Date);
      expect(new Date(result.validUntil).getTime()).toBeGreaterThan(Date.now());
    });

    test('should throw error when OpenBao is unavailable', async () => {
      mockVault.read = jest.fn().mockRejectedValue(new Error('Service down'));
      
      await expect(keyExchangeService.getPublicKeyForFrontend())
        .rejects.toThrow('Public key unavailable');
    });
  });

  describe('wrapAESKeyForFrontend', () => {
    test('should wrap AES key with RSA encryption', async () => {
      const plaintextKey = crypto.randomBytes(32).toString('base64');
      
      const result = await keyExchangeService.wrapAESKeyForFrontend(plaintextKey);
      
      expect(result).toHaveProperty('wrappedKey');
      expect(result).toHaveProperty('keyVersion');
      expect(result).toHaveProperty('algorithm');
      expect(result).toHaveProperty('wrappedAt');
    });

    test('should return wrapped key in OpenBao format', async () => {
      const plaintextKey = crypto.randomBytes(32).toString('base64');
      
      const result = await keyExchangeService.wrapAESKeyForFrontend(plaintextKey);
      
      expect(result.wrappedKey).toMatch(/^vault:v\d+:/);
    });

    test('should not expose plaintext key in wrapped result', async () => {
      const plaintextKey = 'test-plaintext-key-32-bytes-long';
      
      const result = await keyExchangeService.wrapAESKeyForFrontend(plaintextKey);
      
      expect(result.wrappedKey).not.toContain(plaintextKey);
    });

    test('should include RSA-OAEP algorithm info', async () => {
      const plaintextKey = crypto.randomBytes(32).toString('base64');
      
      const result = await keyExchangeService.wrapAESKeyForFrontend(plaintextKey);
      
      expect(result.algorithm).toBe('RSA-OAEP-2048');
    });

    test('should throw error when wrapping fails', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Wrap failed'));
      
      await expect(keyExchangeService.wrapAESKeyForFrontend('test-key'))
        .rejects.toThrow('Key exchange failed');
    });

    test('should include timestamp in result', async () => {
      const plaintextKey = crypto.randomBytes(32).toString('base64');
      
      const result = await keyExchangeService.wrapAESKeyForFrontend(plaintextKey);
      
      expect(result.wrappedAt).toBeDefined();
      expect(new Date(result.wrappedAt)).toBeInstanceOf(Date);
    });
  });

  describe('unwrapAESKeyFromFrontend', () => {
    test('should unwrap RSA-encrypted AES key', async () => {
      const wrappedKey = 'vault:v1:' + crypto.randomBytes(256).toString('base64');
      
      mockVault.write = jest.fn().mockResolvedValue({
        data: {
          plaintext: crypto.randomBytes(32).toString('base64'),
          key_version: 1
        }
      });
      
      const result = await keyExchangeService.unwrapAESKeyFromFrontend(wrappedKey);
      
      expect(result).toHaveProperty('plaintextKey');
      expect(result).toHaveProperty('keyVersion');
      expect(result).toHaveProperty('unwrappedAt');
    });

    test('should return base64 encoded plaintext key', async () => {
      const expectedPlaintext = crypto.randomBytes(32).toString('base64');
      const wrappedKey = 'vault:v1:wrapped';
      
      mockVault.write = jest.fn().mockResolvedValue({
        data: {
          plaintext: expectedPlaintext,
          key_version: 1
        }
      });
      
      const result = await keyExchangeService.unwrapAESKeyFromFrontend(wrappedKey);
      
      expect(result.plaintextKey).toBe(expectedPlaintext);
    });

    test('should throw error for invalid wrapped key', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Invalid key'));
      
      await expect(keyExchangeService.unwrapAESKeyFromFrontend('invalid'))
        .rejects.toThrow('Invalid key material');
    });

    test('should handle OpenBao service errors', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      await expect(keyExchangeService.unwrapAESKeyFromFrontend('vault:v1:test'))
        .rejects.toThrow('Invalid key material');
    });

    test('should include unwrap timestamp', async () => {
      const wrappedKey = 'vault:v1:wrapped';
      
      mockVault.write = jest.fn().mockResolvedValue({
        data: {
          plaintext: crypto.randomBytes(32).toString('base64'),
          key_version: 1
        }
      });
      
      const result = await keyExchangeService.unwrapAESKeyFromFrontend(wrappedKey);
      
      expect(result.unwrappedAt).toBeDefined();
      expect(new Date(result.unwrappedAt)).toBeInstanceOf(Date);
    });
  });

  describe('Wrap and Unwrap Round Trip', () => {
    test('should successfully wrap and unwrap AES key', async () => {
      const originalKey = crypto.randomBytes(32).toString('base64');
      
      // Mock wrap
      mockVault.write = jest.fn()
        .mockResolvedValueOnce({
          data: {
            ciphertext: 'vault:v1:wrapped-key',
            key_version: 1
          }
        })
        // Mock unwrap
        .mockResolvedValueOnce({
          data: {
            plaintext: originalKey,
            key_version: 1
          }
        });
      
      const wrapped = await keyExchangeService.wrapAESKeyForFrontend(originalKey);
      const unwrapped = await keyExchangeService.unwrapAESKeyFromFrontend(wrapped.wrappedKey);
      
      expect(unwrapped.plaintextKey).toBe(originalKey);
    });
  });

  describe('Error Handling', () => {
    test('should log errors with context', async () => {
      const logger = require('../../../config/logger');
      logger.error.mockClear();
      
      mockVault.read = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(keyExchangeService.getPublicKeyForFrontend()).rejects.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get public key',
        expect.any(Object)
      );
    });

    test('should provide user-friendly error messages', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Internal error'));
      
      await expect(keyExchangeService.wrapAESKeyForFrontend('test'))
        .rejects.toThrow('Key exchange failed');
    });
  });

  describe('Key Rotation Support', () => {
    test('should handle multiple key versions', async () => {
      mockVault.read = jest.fn().mockResolvedValue({
        data: {
          type: 'rsa-2048',
          latest_version: 2,
          keys: {
            1: { public_key: 'old-key', creation_time: '2024-01-01' },
            2: { public_key: 'new-key', creation_time: '2024-06-01' }
          }
        }
      });
      
      const result = await keyExchangeService.getPublicKeyForFrontend();
      
      expect(result.keyVersion).toBe(2);
    });

    test('should use latest key version for wrapping', async () => {
      const plaintextKey = crypto.randomBytes(32).toString('base64');
      
      const result = await keyExchangeService.wrapAESKeyForFrontend(plaintextKey);
      
      expect(result.keyVersion).toBeDefined();
      expect(result.keyVersion).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    test('should not log sensitive key material', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const sensitiveKey = 'super-secret-key-material';
      
      await keyExchangeService.wrapAESKeyForFrontend(sensitiveKey);
      
      const logs = consoleSpy.mock.calls.flat().join(' ');
      expect(logs).not.toContain(sensitiveKey);
      
      consoleSpy.mockRestore();
    });
  });
});

