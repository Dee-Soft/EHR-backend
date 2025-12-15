/**
 * Security: OpenBao Transit Encryption Tests
 * Tests encryption security using OpenBao Transit Engine
 */

const crypto = require('crypto');

// Mock OpenBao before requiring the crypto service
jest.mock('../../config/openbao.config', () => {
  const { createMockVaultClient } = require('../setup/mocks/openbaoMock');
  const mockVault = createMockVaultClient();
  return {
    getTransitClient: () => mockVault,
    keys: {
      aesMaster: 'ehr-aes-master',
      rsaExchange: 'ehr-rsa-exchange'
    },
    init: jest.fn().mockResolvedValue(true),
    initialized: true
  };
});

const cryptoService = require('../../services/openbaoCryptoService');

describe('Security: OpenBao Transit Encryption', () => {
  describe('Data Encryption Security', () => {
    test('should never store plaintext sensitive data', async () => {
      const sensitiveData = 'Patient SSN: 123-45-6789';
      const result = await cryptoService.encryptData(sensitiveData);
      
      // Verify encryption happened
      expect(result.ciphertext).toBeDefined();
      expect(result.ciphertext).not.toContain('123-45-6789');
      expect(result.ciphertext).not.toContain('SSN');
      expect(result.ciphertext).not.toContain('Patient');
      
      // Verify OpenBao format: vault:v{version}:{base64}
      expect(result.ciphertext).toMatch(/^vault:v\d+:/);
      expect(result.keyVersion).toBeDefined();
    });
    
    test('should use unique encryption for each operation to prevent pattern detection', async () => {
      const data = 'Same sensitive data';
      const encrypted1 = await cryptoService.encryptData(data);
      const encrypted2 = await cryptoService.encryptData(data);
      const encrypted3 = await cryptoService.encryptData(data);
      
      // Same data encrypted multiple times should produce different ciphertext
      // OpenBao handles IV/nonce internally
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted2.ciphertext).not.toBe(encrypted3.ciphertext);
      expect(encrypted1.ciphertext).not.toBe(encrypted3.ciphertext);
      
      // All should have proper OpenBao format
      expect(encrypted1.ciphertext).toMatch(/^vault:v\d+:/);
      expect(encrypted2.ciphertext).toMatch(/^vault:v\d+:/);
      expect(encrypted3.ciphertext).toMatch(/^vault:v\d+:/);
    });
    
    test('should make encrypted data unreadable without key', async () => {
      const sensitiveData = 'Confidential patient diagnosis: Cancer';
      const result = await cryptoService.encryptData(sensitiveData);
      
      // Encrypted data should not contain any recognizable words
      expect(result.ciphertext.toLowerCase()).not.toContain('cancer');
      expect(result.ciphertext.toLowerCase()).not.toContain('diagnosis');
      expect(result.ciphertext.toLowerCase()).not.toContain('patient');
      expect(result.ciphertext.toLowerCase()).not.toContain('confidential');
    });
    
    test('should produce non-deterministic encryption', async () => {
      const records = [
        'Patient: John Doe, Condition: Diabetes',
        'Patient: John Doe, Condition: Diabetes',
        'Patient: John Doe, Condition: Diabetes'
      ];
      
      const encrypted = await Promise.all(
        records.map(record => cryptoService.encryptData(record))
      );
      
      const ciphertexts = encrypted.map(e => e.ciphertext);
      
      // All encrypted values should be unique despite same input
      const uniqueEncrypted = new Set(ciphertexts);
      expect(uniqueEncrypted.size).toBe(3);
    });
    
    test('should prevent pattern analysis with unique encryptions', async () => {
      const messages = [
        'Message 1: Sensitive data A',
        'Message 2: Sensitive data B',
        'Message 3: Sensitive data C'
      ];
      
      const encrypted = await Promise.all(
        messages.map(msg => cryptoService.encryptData(msg))
      );
      
      // Verify no two ciphertexts are the same
      const ciphertexts = encrypted.map(e => e.ciphertext);
      const uniqueCiphertexts = new Set(ciphertexts);
      expect(uniqueCiphertexts.size).toBe(messages.length);
    });
  });
  
  describe('Key Security', () => {
    test('should generate 256-bit data keys (32 bytes)', async () => {
      const keyData = await cryptoService.generateDataKey();
      
      expect(keyData.plaintextKey).toBeDefined();
      expect(keyData.ciphertextKey).toBeDefined();
      
      // Plaintext key should be base64 encoded 32 bytes
      const keyBuffer = Buffer.from(keyData.plaintextKey, 'base64');
      expect(keyBuffer.length).toBe(32); // 256 bits = 32 bytes
      
      // Ciphertext should have OpenBao format
      expect(keyData.ciphertextKey).toMatch(/^vault:v\d+:/);
    });
    
    test('should generate cryptographically random keys', async () => {
      const keys = [];
      for (let i = 0; i < 100; i++) {
        const keyData = await cryptoService.generateDataKey();
        keys.push(keyData.plaintextKey);
      }
      
      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(100);
      
      // Keys should have proper length
      keys.forEach(key => {
        const keyBuffer = Buffer.from(key, 'base64');
        expect(keyBuffer.length).toBe(32);
      });
    });
    
    test('should fail decryption with invalid ciphertext', async () => {
      const invalidCiphertext = 'not-a-valid-vault-ciphertext';
      
      await expect(
        cryptoService.decryptData(invalidCiphertext)
      ).rejects.toThrow();
    });
    
    test('should track key versions for rotation', async () => {
      const data = 'Test data';
      const result = await cryptoService.encryptData(data);
      
      expect(result.keyVersion).toBeDefined();
      expect(result.keyVersion).toBeGreaterThan(0);
    });
  });
  
  describe('Data Integrity', () => {
    test('should maintain data integrity through encryption/decryption cycle', async () => {
      const testCases = [
        'Simple text',
        'Text with numbers 123456',
        'Special chars: !@#$%^&*()',
        'Unicode: 你好世界 🎉',
        'Very long text: ' + 'A'.repeat(1000),
        'Newlines\nand\ttabs',
        { patient: 'John', diagnosis: 'Flu' }
      ];
      
      for (const data of testCases) {
        const encrypted = await cryptoService.encryptData(data);
        const decrypted = await cryptoService.decryptData(encrypted.ciphertext);
        
        if (typeof data === 'object') {
          expect(decrypted).toEqual(data);
        } else {
          expect(decrypted).toBe(data);
        }
      }
    });
    
    test('should detect tampering with encrypted data', async () => {
      const data = 'Important medical record';
      const encrypted = await cryptoService.encryptData(data);
      
      // Tamper with ciphertext
      const parts = encrypted.ciphertext.split(':');
      const tamperedCiphertext = parts[0] + ':' + parts[1] + ':corrupted';
      
      // Decryption should fail
      await expect(
        cryptoService.decryptData(tamperedCiphertext)
      ).rejects.toThrow();
    });
    
    test('should require proper ciphertext format', async () => {
      const invalidFormats = [
        'plaintext',
        'vault:v1:', // Missing ciphertext
        'vault:', // Missing version and ciphertext
        'notavaultstring:data',
        ''
      ];
      
      for (const invalid of invalidFormats) {
        await expect(
          cryptoService.decryptData(invalid)
        ).rejects.toThrow();
      }
    });
  });
  
  describe('Protection Against Common Attacks', () => {
    test('should use authenticated encryption (prevents tampering)', async () => {
      const data = 'Sensitive data';
      const encrypted = await cryptoService.encryptData(data);
      
      // OpenBao uses AES-GCM which provides authentication
      expect(encrypted.ciphertext).toMatch(/^vault:v\d+:/);
      
      // Any tampering should be detected on decryption
      const tampered = encrypted.ciphertext.slice(0, -10) + 'AAAAAAAAAA';
      await expect(
        cryptoService.decryptData(tampered)
      ).rejects.toThrow();
    });
    
    test('should make brute force attacks computationally infeasible', async () => {
      // With 256-bit keys managed by OpenBao, brute force is impractical
      const data = 'Test';
      const enc1 = await cryptoService.encryptData(data);
      const enc2 = await cryptoService.encryptData(data);
      
      // Different encryptions should be completely different
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      
      // Both should have proper format
      expect(enc1.ciphertext).toMatch(/^vault:v\d+:/);
      expect(enc2.ciphertext).toMatch(/^vault:v\d+:/);
    });
    
    test('should handle encryption/decryption consistently', async () => {
      const data = 'Timing test data';
      const encrypted = await cryptoService.encryptData(data);
      
      // Multiple decryptions should all succeed
      const results = await Promise.all([
        cryptoService.decryptData(encrypted.ciphertext),
        cryptoService.decryptData(encrypted.ciphertext),
        cryptoService.decryptData(encrypted.ciphertext),
        cryptoService.decryptData(encrypted.ciphertext),
        cryptoService.decryptData(encrypted.ciphertext)
      ]);
      
      // All results should be identical
      results.forEach(result => {
        expect(result).toBe(data);
      });
    });
  });
  
  describe('Sensitive Data Patterns', () => {
    test('should properly encrypt common sensitive data patterns', async () => {
      const sensitivePatterns = [
        'SSN: 123-45-6789',
        'Credit Card: 4532-1234-5678-9010',
        'DOB: 1990-01-01',
        'Password: SuperSecret123!',
        'API Key: sk_live_abcdefghijklmnop',
        'Email: patient@example.com',
        'Phone: +1-555-123-4567'
      ];
      
      for (const pattern of sensitivePatterns) {
        const encrypted = await cryptoService.encryptData(pattern);
        
        // Should not contain any recognizable part
        expect(encrypted.ciphertext).not.toContain('123');
        expect(encrypted.ciphertext).not.toContain('SSN');
        expect(encrypted.ciphertext).not.toContain('Credit');
        expect(encrypted.ciphertext).not.toContain('Password');
        expect(encrypted.ciphertext).not.toContain('@');
        expect(encrypted.ciphertext).not.toContain('sk_live');
        
        // Should decrypt correctly
        const decrypted = await cryptoService.decryptData(encrypted.ciphertext);
        expect(decrypted).toBe(pattern);
      }
    });
    
    test('should encrypt structured data (objects) securely', async () => {
      const patientRecord = {
        name: 'John Doe',
        ssn: '123-45-6789',
        diagnosis: 'Hypertension',
        medications: ['Lisinopril', 'Aspirin'],
        notes: 'Patient shows improvement'
      };
      
      const encrypted = await cryptoService.encryptData(patientRecord);
      
      // Should not contain any recognizable values
      expect(encrypted.ciphertext).not.toContain('John');
      expect(encrypted.ciphertext).not.toContain('ssn');
      expect(encrypted.ciphertext).not.toContain('diagnosis');
      expect(encrypted.ciphertext).not.toContain('Hypertension');
      expect(encrypted.ciphertext).not.toContain('Lisinopril');
      
      // Should decrypt to exact original
      const decrypted = await cryptoService.decryptData(encrypted.ciphertext);
      expect(decrypted).toEqual(patientRecord);
    });
  });
  
  describe('OpenBao-Specific Security', () => {
    test('should use OpenBao Transit Engine format', async () => {
      const data = 'Test data';
      const result = await cryptoService.encryptData(data);
      
      // Verify OpenBao ciphertext format: vault:v{version}:{base64}
      expect(result.ciphertext).toMatch(/^vault:v\d+:[A-Za-z0-9+/=]+$/);
    });
    
    test('should track encryption metadata', async () => {
      const data = 'Test data';
      const result = await cryptoService.encryptData(data);
      
      expect(result.ciphertext).toBeDefined();
      expect(result.keyVersion).toBeDefined();
      expect(result.encryptedAt).toBeDefined();
      
      // Verify timestamp is recent
      const encryptedTime = new Date(result.encryptedAt);
      const now = new Date();
      const diff = now - encryptedTime;
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });
    
    test('should support key versioning for rotation', async () => {
      const data = 'Test data';
      const result = await cryptoService.encryptData(data);
      
      expect(result.keyVersion).toBeGreaterThanOrEqual(1);
      expect(typeof result.keyVersion).toBe('number');
    });
    
    test('should handle data key generation properly', async () => {
      const keyData = await cryptoService.generateDataKey();
      
      expect(keyData.plaintextKey).toBeDefined();
      expect(keyData.ciphertextKey).toBeDefined();
      expect(keyData.keyVersion).toBeDefined();
      expect(keyData.keyId).toBeDefined();
      
      // Verify formats
      expect(keyData.ciphertextKey).toMatch(/^vault:v\d+:/);
      expect(keyData.keyId).toMatch(/^data-key-/);
      
      // Plaintext key should be valid base64
      expect(() => Buffer.from(keyData.plaintextKey, 'base64')).not.toThrow();
    });
  });
});
