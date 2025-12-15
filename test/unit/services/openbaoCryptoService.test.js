/**
 * Unit Tests for OpenBao Crypto Service
 * Tests encryption, decryption, data key generation, and error handling
 */

const { createMockVaultClient: mockCreateMockVaultClient, mockResponses } = require('../../setup/mocks/openbaoMock');
const { openBaoTestData } = require('../../setup/fixtures/records.fixture');

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
      aesMaster: 'ehr-aes-master',
      rsaExchange: 'ehr-rsa-exchange'
    },
    validateConnection: jest.fn().mockResolvedValue(true)
  };
});

describe('OpenBao Crypto Service', () => {
  let cryptoService;
  let mockVault;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Get fresh instances
    const openbaoConfig = require('../../../config/openbao.config');
    mockVault = openbaoConfig.getTransitClient();
    cryptoService = require('../../../services/openbaoCryptoService');
  });

  describe('generateDataKey', () => {
    test('should generate a new data key successfully', async () => {
      const result = await cryptoService.generateDataKey();
      
      expect(result).toHaveProperty('plaintextKey');
      expect(result).toHaveProperty('ciphertextKey');
      expect(result).toHaveProperty('keyVersion');
      expect(result).toHaveProperty('keyId');
      expect(result.keyVersion).toBe(1);
    });

    test('should return ciphertext in OpenBao format', async () => {
      const result = await cryptoService.generateDataKey();
      
      expect(result.ciphertextKey).toMatch(/^vault:v\d+:/);
    });

    test('should throw error when OpenBao is unavailable', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      await expect(cryptoService.generateDataKey()).rejects.toThrow('Key generation service unavailable');
    });

    test('should generate unique keys on each call', async () => {
      const key1 = await cryptoService.generateDataKey();
      const key2 = await cryptoService.generateDataKey();
      
      expect(key1.plaintextKey).not.toBe(key2.plaintextKey);
      expect(key1.ciphertextKey).not.toBe(key2.ciphertextKey);
      expect(key1.keyId).not.toBe(key2.keyId);
    });
  });

  describe('encryptData', () => {
    test('should encrypt plaintext data successfully', async () => {
      const plaintext = { diagnosis: 'Hypertension', notes: 'Patient stable' };
      
      const result = await cryptoService.encryptData(plaintext);
      
      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('keyVersion');
      expect(result).toHaveProperty('encryptedAt');
      expect(result.ciphertext).toMatch(/^vault:v\d+:/);
    });

    test('should not expose plaintext in ciphertext', async () => {
      const plaintext = { ssn: '123-45-6789', diagnosis: 'Diabetes' };
      
      const result = await cryptoService.encryptData(plaintext);
      
      expect(result.ciphertext).not.toContain('123-45-6789');
      expect(result.ciphertext).not.toContain('Diabetes');
    });

    test('should handle encryption with key context', async () => {
      const plaintext = { test: 'data' };
      const keyCiphertext = 'vault:v1:somekey';
      
      const result = await cryptoService.encryptData(plaintext, keyCiphertext);
      
      expect(result.ciphertext).toMatch(/^vault:v\d+:/);
    });

    test('should throw error when encryption fails', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Encryption failed'));
      
      const plaintext = { test: 'data' };
      
      await expect(cryptoService.encryptData(plaintext)).rejects.toThrow('Encryption service unavailable');
    });

    test('should produce different ciphertext for same plaintext', async () => {
      const plaintext = { diagnosis: 'Same diagnosis' };
      
      const result1 = await cryptoService.encryptData(plaintext);
      const result2 = await cryptoService.encryptData(plaintext);
      
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });
  });

  describe('decryptData', () => {
    test('should decrypt ciphertext successfully', async () => {
      const ciphertext = 'vault:v1:' + Buffer.from('encrypted').toString('base64');
      
      mockVault.write = jest.fn().mockResolvedValue({
        data: {
          plaintext: Buffer.from(JSON.stringify({ test: 'data' })).toString('base64')
        }
      });
      
      const result = await cryptoService.decryptData(ciphertext);
      
      expect(result).toEqual({ test: 'data' });
    });

    test('should handle decryption with key context', async () => {
      const ciphertext = 'vault:v1:encrypted';
      const keyCiphertext = 'vault:v1:keycontext';
      
      mockVault.write = jest.fn().mockResolvedValue({
        data: {
          plaintext: Buffer.from(JSON.stringify({ decrypted: 'value' })).toString('base64')
        }
      });
      
      const result = await cryptoService.decryptData(ciphertext, keyCiphertext);
      
      expect(result).toEqual({ decrypted: 'value' });
      expect(mockVault.write).toHaveBeenCalledWith(
        expect.stringContaining('decrypt'),
        expect.objectContaining({ context: keyCiphertext })
      );
    });

    test('should throw error when decryption fails', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Invalid ciphertext'));
      
      const ciphertext = 'vault:v1:invalid';
      
      await expect(cryptoService.decryptData(ciphertext)).rejects.toThrow('Decryption failed');
    });

    test('should throw error for invalid ciphertext format', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Invalid format'));
      
      const invalidCiphertext = 'not-vault-format';
      
      await expect(cryptoService.decryptData(invalidCiphertext)).rejects.toThrow();
    });
  });

  describe('encryptPatientData', () => {
    test('should encrypt patient data fields', async () => {
      const patientData = {
        diagnosis: 'Hypertension',
        notes: 'Patient shows improvement',
        medications: ['Lisinopril', 'Aspirin']
      };
      
      const result = await cryptoService.encryptPatientData(patientData);
      
      expect(result.ciphertext).toMatch(/^vault:v\d+:/);
      expect(result.keyVersion).toBeDefined();
    });

    test('should handle complex nested data', async () => {
      const complexData = {
        diagnosis: 'Multiple conditions',
        history: {
          previous: ['Condition 1', 'Condition 2'],
          current: 'Active treatment'
        }
      };
      
      const result = await cryptoService.encryptPatientData(complexData);
      
      expect(result.ciphertext).toBeDefined();
      expect(result.ciphertext).not.toContain('Multiple conditions');
    });
  });

  describe('decryptPatientData', () => {
    test('should decrypt patient data to original format', async () => {
      const originalData = {
        diagnosis: 'Diabetes',
        medications: ['Insulin']
      };
      
      mockVault.write = jest.fn().mockResolvedValue({
        data: {
          plaintext: Buffer.from(JSON.stringify(originalData)).toString('base64')
        }
      });
      
      const ciphertext = 'vault:v1:encrypted';
      const result = await cryptoService.decryptPatientData(ciphertext);
      
      expect(result).toEqual(originalData);
    });
  });

  describe('reencryptData', () => {
    test('should re-encrypt data with new key', async () => {
      const oldCiphertext = 'vault:v1:oldencrypted';
      const oldKeyCiphertext = 'vault:v1:oldkey';
      const newKeyCiphertext = 'vault:v1:newkey';
      
      // Mock decrypt
      mockVault.write = jest.fn()
        .mockResolvedValueOnce({
          data: {
            plaintext: Buffer.from(JSON.stringify({ data: 'test' })).toString('base64')
          }
        })
        // Mock encrypt
        .mockResolvedValueOnce({
          data: {
            ciphertext: 'vault:v2:newencrypted',
            key_version: 2
          }
        });
      
      const result = await cryptoService.reencryptData(
        oldCiphertext,
        oldKeyCiphertext,
        newKeyCiphertext
      );
      
      expect(result.ciphertext).toBe('vault:v2:newencrypted');
      expect(result.keyVersion).toBe(2);
    });

    test('should throw error if re-encryption fails', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Re-encryption failed'));
      
      await expect(
        cryptoService.reencryptData('old', 'oldkey', 'newkey')
      ).rejects.toThrow('Data migration failed');
    });
  });

  describe('Error Handling', () => {
    test('should log errors with context', async () => {
      const logger = require('../../../config/logger');
      logger.error.mockClear();
      
      mockVault.write = jest.fn().mockRejectedValue(new Error('Network timeout'));
      
      await expect(cryptoService.generateDataKey()).rejects.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith(
        'Data key generation failed',
        expect.any(Object)
      );
    });

    test('should provide user-friendly error messages', async () => {
      mockVault.write = jest.fn().mockRejectedValue(new Error('Internal error'));
      
      await expect(cryptoService.encryptData({ test: 'data' }))
        .rejects.toThrow('Encryption service unavailable');
    });
  });

  describe('Key Version Tracking', () => {
    test('should track key version in encrypted data', async () => {
      const result = await cryptoService.encryptData({ test: 'data' });
      
      expect(result.keyVersion).toBeDefined();
      expect(typeof result.keyVersion).toBe('number');
    });

    test('should include timestamp in encryption metadata', async () => {
      const result = await cryptoService.encryptData({ test: 'data' });
      
      expect(result.encryptedAt).toBeDefined();
      expect(new Date(result.encryptedAt)).toBeInstanceOf(Date);
    });
  });
});

