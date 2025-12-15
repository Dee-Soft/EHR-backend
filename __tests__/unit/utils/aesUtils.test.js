const { encryptAES, decryptAES } = require('../../../utils/aesUtils');
const crypto = require('crypto');

describe('AES Utils', () => {
  let testKey;
  const testData = 'Sensitive patient data';
  
  beforeEach(() => {
    // Generate a fresh key for each test
    testKey = crypto.randomBytes(32).toString('hex');
  });
  
  describe('encryptAES', () => {
    test('should encrypt string data successfully', () => {
      const encrypted = encryptAES(testData, testKey);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
      expect(encrypted).not.toBe(testData);
      expect(typeof encrypted).toBe('string');
    });
    
    test('should produce different ciphertext for same data (unique IV)', () => {
      const encrypted1 = encryptAES(testData, testKey);
      const encrypted2 = encryptAES(testData, testKey);
      
      expect(encrypted1).not.toBe(encrypted2);
    });
    
    test('should throw error when data is empty string', () => {
      expect(() => encryptAES('', testKey)).toThrow('encryptAES expects a non-empty string');
    });
    
    test('should throw error when data is not a string', () => {
      expect(() => encryptAES(null, testKey)).toThrow('encryptAES expects a non-empty string');
      expect(() => encryptAES(undefined, testKey)).toThrow('encryptAES expects a non-empty string');
      expect(() => encryptAES(123, testKey)).toThrow('encryptAES expects a non-empty string');
    });
    
    test('should throw error when key is missing', () => {
      expect(() => encryptAES(testData, null)).toThrow('AES key missing');
      expect(() => encryptAES(testData, undefined)).toThrow('AES key missing');
      expect(() => encryptAES(testData, '')).toThrow('AES key missing');
    });
    
    test('should handle special characters in data', () => {
      const specialData = 'Test!@#$%^&*()_+{}[]|\\:;"\'<>,.?/~`';
      const encrypted = encryptAES(specialData, testKey);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
    });
    
    test('should handle unicode characters', () => {
      const unicodeData = 'Test 你好 世界 🎉';
      const encrypted = encryptAES(unicodeData, testKey);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
    });
  });
  
  describe('decryptAES', () => {
    test('should decrypt encrypted data back to original', () => {
      const encrypted = encryptAES(testData, testKey);
      const decrypted = decryptAES(encrypted, testKey);
      
      expect(decrypted).toBe(testData);
    });
    
    test('should handle round-trip encryption/decryption correctly', () => {
      const originalData = 'Patient Record: John Doe, DOB: 1990-01-01';
      const encrypted = encryptAES(originalData, testKey);
      const decrypted = decryptAES(encrypted, testKey);
      
      expect(decrypted).toBe(originalData);
      expect(encrypted).not.toBe(originalData);
    });
    
    test('should throw error with invalid format (missing colon)', () => {
      expect(() => decryptAES('invalidformat', testKey)).toThrow('decryptAES expects data in "iv:encrypted" format');
    });
    
    test('should throw error with empty string', () => {
      expect(() => decryptAES('', testKey)).toThrow('decryptAES expects data in "iv:encrypted" format');
    });
    
    test('should throw error with null or undefined data', () => {
      expect(() => decryptAES(null, testKey)).toThrow('decryptAES expects data in "iv:encrypted" format');
      expect(() => decryptAES(undefined, testKey)).toThrow('decryptAES expects data in "iv:encrypted" format');
    });
    
    test('should throw error when key is missing', () => {
      const encrypted = encryptAES(testData, testKey);
      
      expect(() => decryptAES(encrypted, null)).toThrow('AES key missing');
      expect(() => decryptAES(encrypted, undefined)).toThrow('AES key missing');
      expect(() => decryptAES(encrypted, '')).toThrow('AES key missing');
    });
    
    test('should throw error with wrong key', () => {
      const encrypted = encryptAES(testData, testKey);
      const wrongKey = crypto.randomBytes(32).toString('hex');
      
      expect(() => decryptAES(encrypted, wrongKey)).toThrow();
    });
    
    test('should throw error with malformed encrypted data', () => {
      const malformed = 'abcd:efgh'; // Invalid hex
      
      expect(() => decryptAES(malformed, testKey)).toThrow();
    });
    
    test('should throw error when IV part is missing', () => {
      const invalidData = ':encrypteddata';
      
      expect(() => decryptAES(invalidData, testKey)).toThrow('decryptAES: Invalid encrypted data format');
    });
    
    test('should throw error when encrypted part is missing', () => {
      const invalidData = 'ivdata:';
      
      expect(() => decryptAES(invalidData, testKey)).toThrow('decryptAES: Invalid encrypted data format');
    });
  });
  
  describe('edge cases', () => {
    test('should handle very long strings', () => {
      const longData = 'A'.repeat(10000);
      const encrypted = encryptAES(longData, testKey);
      const decrypted = decryptAES(encrypted, testKey);
      
      expect(decrypted).toBe(longData);
    });
    
    test('should handle single character', () => {
      const singleChar = 'A';
      const encrypted = encryptAES(singleChar, testKey);
      const decrypted = decryptAES(encrypted, testKey);
      
      expect(decrypted).toBe(singleChar);
    });
    
    test('should work with Buffer key format', () => {
      const bufferKey = crypto.randomBytes(32);
      const encrypted = encryptAES(testData, bufferKey);
      const decrypted = decryptAES(encrypted, bufferKey);
      
      expect(decrypted).toBe(testData);
    });
  });
});
