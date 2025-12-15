const { generateAESKey } = require('../../../helpers/cryptoHelper');

describe('Crypto Helper', () => {
  describe('generateAESKey', () => {
    test('should generate a 256-bit AES key (64 hex characters)', () => {
      const key = generateAESKey();
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes = 64 hex characters
    });
    
    test('should generate unique keys on each call', () => {
      const key1 = generateAESKey();
      const key2 = generateAESKey();
      const key3 = generateAESKey();
      
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });
    
    test('should generate keys with valid hexadecimal characters', () => {
      const key = generateAESKey();
      const hexPattern = /^[a-f0-9]{64}$/;
      
      expect(hexPattern.test(key)).toBe(true);
    });
    
    test('should generate cryptographically random keys', () => {
      // Generate multiple keys and ensure they're all different
      const keys = new Set();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        keys.add(generateAESKey());
      }
      
      // All keys should be unique
      expect(keys.size).toBe(iterations);
    });
    
    test('should generate keys that can be converted to Buffer', () => {
      const key = generateAESKey();
      const keyBuffer = Buffer.from(key, 'hex');
      
      expect(keyBuffer).toBeInstanceOf(Buffer);
      expect(keyBuffer.length).toBe(32); // 32 bytes
    });
  });
});
