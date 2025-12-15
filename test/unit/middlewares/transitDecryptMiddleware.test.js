/**
 * Unit Tests for Transit Decrypt Middleware
 * Tests decryption of response fields using OpenBao Transit Engine
 */

const { createMockVaultClient } = require('../../setup/mocks/openbaoMock');

// Mock crypto service
jest.mock('../../../services/openbaoCryptoService', () => ({
  decryptData: jest.fn()
}));

describe('Transit Decrypt Middleware', () => {
  let transitDecryptMiddleware;
  let cryptoService;
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    cryptoService = require('../../../services/openbaoCryptoService');
    transitDecryptMiddleware = require('../../../middlewares/transitDecryptMiddleware');
    
    // Setup mock request, response, next
    req = {
      body: {
        diagnosis: 'vault:v1:encrypted-diagnosis',
        notes: 'vault:v1:encrypted-notes',
        medications: 'vault:v1:encrypted-meds'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
  });

  describe('Field Decryption', () => {
    test('should decrypt specified fields in request body', async () => {
      cryptoService.decryptData
        .mockResolvedValueOnce('Hypertension')
        .mockResolvedValueOnce('Patient stable');
      
      const middleware = transitDecryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(cryptoService.decryptData).toHaveBeenCalledTimes(2);
      expect(cryptoService.decryptData).toHaveBeenCalledWith('vault:v1:encrypted-diagnosis');
      expect(cryptoService.decryptData).toHaveBeenCalledWith('vault:v1:encrypted-notes');
      expect(next).toHaveBeenCalled();
    });

    test('should replace ciphertext with plaintext in request body', async () => {
      cryptoService.decryptData
        .mockResolvedValueOnce('Hypertension')
        .mockResolvedValueOnce('Patient shows improvement');
      
      const middleware = transitDecryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(req.body.diagnosis).toBe('Hypertension');
      expect(req.body.notes).toBe('Patient shows improvement');
      expect(req.body.medications).toBe('vault:v1:encrypted-meds'); // Not decrypted
    });

    test('should handle JSON string decryption', async () => {
      const medications = ['Lisinopril', 'Aspirin'];
      cryptoService.decryptData.mockResolvedValue(JSON.stringify(medications));
      
      const middleware = transitDecryptMiddleware(['medications']);
      await middleware(req, res, next);
      
      expect(req.body.medications).toBe(JSON.stringify(medications));
    });

    test('should skip undefined fields', async () => {
      req.body.diagnosis = undefined;
      
      const middleware = transitDecryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(cryptoService.decryptData).toHaveBeenCalledTimes(1);
      expect(cryptoService.decryptData).toHaveBeenCalledWith('vault:v1:encrypted-notes');
    });

    test('should skip null fields', async () => {
      req.body.notes = null;
      
      cryptoService.decryptData.mockResolvedValue('Hypertension');
      
      const middleware = transitDecryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(cryptoService.decryptData).toHaveBeenCalledTimes(1);
      expect(req.body.notes).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should return 500 when decryption fails', async () => {
      cryptoService.decryptData.mockRejectedValue(new Error('Decryption service down'));
      
      const middleware = transitDecryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Failed to decrypt fields',
        error: 'Decryption service down'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should log error message', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      cryptoService.decryptData.mockRejectedValue(new Error('Invalid ciphertext'));
      
      const middleware = transitDecryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('transitDecryptMiddleware error'),
        'Invalid ciphertext'
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle partial decryption failure', async () => {
      cryptoService.decryptData
        .mockResolvedValueOnce('Decrypted value')
        .mockRejectedValueOnce(new Error('Second field failed'));
      
      const middleware = transitDecryptMiddleware(['diagnosis', 'notes']);
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Fields', () => {
    test('should decrypt all specified fields', async () => {
      cryptoService.decryptData
        .mockResolvedValueOnce('Hypertension')
        .mockResolvedValueOnce('Patient stable')
        .mockResolvedValueOnce('["Lisinopril"]');
      
      const middleware = transitDecryptMiddleware(['diagnosis', 'notes', 'medications']);
      await middleware(req, res, next);
      
      expect(cryptoService.decryptData).toHaveBeenCalledTimes(3);
      expect(req.body.diagnosis).toBe('Hypertension');
      expect(req.body.notes).toBe('Patient stable');
      expect(req.body.medications).toBe('["Lisinopril"]');
    });

    test('should handle empty field list', async () => {
      const middleware = transitDecryptMiddleware([]);
      await middleware(req, res, next);
      
      expect(cryptoService.decryptData).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Integration with Request Flow', () => {
    test('should call next() after successful decryption', async () => {
      cryptoService.decryptData.mockResolvedValue('Decrypted value');
      
      const middleware = transitDecryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    test('should not modify fields not in decrypt list', async () => {
      cryptoService.decryptData.mockResolvedValue('Decrypted');
      
      req.body.otherField = 'should not change';
      
      const middleware = transitDecryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(req.body.otherField).toBe('should not change');
    });
  });

  describe('OpenBao Format Validation', () => {
    test('should handle valid OpenBao ciphertext format', async () => {
      cryptoService.decryptData.mockResolvedValue('Decrypted');
      
      req.body.diagnosis = 'vault:v1:abcd1234';
      
      const middleware = transitDecryptMiddleware(['diagnosis']);
      await middleware(req, res, next);
      
      expect(cryptoService.decryptData).toHaveBeenCalledWith('vault:v1:abcd1234');
    });

    test('should handle different vault versions', async () => {
      cryptoService.decryptData
        .mockResolvedValueOnce('Data v1')
        .mockResolvedValueOnce('Data v2');
      
      req.body.field1 = 'vault:v1:encrypted';
      req.body.field2 = 'vault:v2:encrypted';
      
      const middleware = transitDecryptMiddleware(['field1', 'field2']);
      await middleware(req, res, next);
      
      expect(req.body.field1).toBe('Data v1');
      expect(req.body.field2).toBe('Data v2');
    });
  });
});

