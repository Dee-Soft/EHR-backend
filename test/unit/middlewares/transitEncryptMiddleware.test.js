/**
 * Unit Tests for Transit Encrypt Middleware
 * Tests encryption of request fields using OpenBao Transit Engine
 */

const { createMockVaultClient } = require('../../setup/mocks/openbaoMock');

// Mock crypto service
jest.mock('../../../services/openbaoCryptoService', () => ({
  encryptData: jest.fn()
}));

describe('Transit Encrypt Middleware', () => {
  let transitEncryptMiddleware;
  let cryptoService;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    cryptoService = require('../../../services/openbaoCryptoService');
    transitEncryptMiddleware = require('../../../middlewares/transitEncryptMiddleware');
    
    // Setup mock request, response, next
    req = {
      body: {
        diagnosis: 'Hypertension',
        notes: 'Patient stable',
        medications: ['Lisinopril', 'Aspirin']
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
  });

  describe('Field Encryption', () => {
    test('should encrypt specified fields in request body', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted',
        keyVersion: 1,
        encryptedAt: new Date().toISOString()
      });
      
      const middleware = transitEncryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledTimes(2);
      expect(cryptoService.encryptData).toHaveBeenCalledWith('Hypertension');
      expect(cryptoService.encryptData).toHaveBeenCalledWith('Patient stable');
      expect(next).toHaveBeenCalled();
    });

    test('should replace plaintext with ciphertext in request body', async () => {
      cryptoService.encryptData
        .mockResolvedValueOnce({ ciphertext: 'vault:v1:encrypted-diagnosis' })
        .mockResolvedValueOnce({ ciphertext: 'vault:v1:encrypted-notes' });
      
      const middleware = transitEncryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(req.body.diagnosis).toBe('vault:v1:encrypted-diagnosis');
      expect(req.body.notes).toBe('vault:v1:encrypted-notes');
      expect(req.body.medications).toEqual(['Lisinopril', 'Aspirin']); // Unencrypted
    });

    test('should handle array fields by converting to JSON string', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted-array',
        keyVersion: 1
      });
      
      const middleware = transitEncryptMiddleware(['medications']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledWith(
        JSON.stringify(['Lisinopril', 'Aspirin'])
      );
    });

    test('should skip undefined fields', async () => {
      req.body.diagnosis = undefined;
      
      const middleware = transitEncryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledTimes(1);
      expect(cryptoService.encryptData).toHaveBeenCalledWith('Patient stable');
    });

    test('should skip null fields', async () => {
      req.body.notes = null;
      
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted'
      });
      
      const middleware = transitEncryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledTimes(1);
      expect(req.body.notes).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should return 500 when encryption fails', async () => {
      cryptoService.encryptData.mockRejectedValue(new Error('Encryption service down'));
      
      const middleware = transitEncryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to encrypt fields',
        error: 'Encryption service down'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should log error message', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      cryptoService.encryptData.mockRejectedValue(new Error('Test error'));
      
      const middleware = transitEncryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('transitEncryptMiddleware error'),
        'Test error'
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle partial encryption failure gracefully', async () => {
      cryptoService.encryptData
        .mockResolvedValueOnce({ ciphertext: 'vault:v1:encrypted-first' })
        .mockRejectedValueOnce(new Error('Second field failed'));
      
      const middleware = transitEncryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Fields', () => {
    test('should encrypt all specified fields', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted',
        keyVersion: 1
      });
      
      const middleware = transitEncryptMiddleware(['diagnosis', 'notes', 'medications']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledTimes(3);
      expect(req.body.diagnosis).toContain('vault:v1:');
      expect(req.body.notes).toContain('vault:v1:');
      expect(req.body.medications).toContain('vault:v1:');
    });

    test('should handle empty field list', async () => {
      const middleware = transitEncryptMiddleware([]);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Integration with Request Flow', () => {
    test('should call next() after successful encryption', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted'
      });
      
      const middleware = transitEncryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    test('should not modify request body if no fields to encrypt', async () => {
      const originalBody = { ...req.body };
      
      const middleware = transitEncryptMiddleware(['nonexistent']);
      await middleware(req, res, next);
      
      expect(req.body).toEqual(originalBody);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Data Types', () => {
    test('should handle string fields', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted'
      });
      
      req.body.stringField = 'test string';
      const middleware = transitEncryptMiddleware(['stringField']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledWith('test string');
    });

    test('should handle number fields by converting to string', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted'
      });
      
      req.body.age = 45;
      const middleware = transitEncryptMiddleware(['age']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledWith(45);
    });

    test('should handle object fields by converting to JSON', async () => {
      cryptoService.encryptData.mockResolvedValue({
        ciphertext: 'vault:v1:encrypted'
      });
      
      req.body.metadata = { key: 'value' };
      const middleware = transitEncryptMiddleware(['metadata']);
      await middleware(req, res, next);
      
      expect(cryptoService.encryptData).toHaveBeenCalledWith(
        JSON.stringify({ key: 'value' })
      );
    });
  });
});

