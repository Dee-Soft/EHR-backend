/**
 * Integration Tests for Key Exchange API
 * Tests RSA public key distribution and key exchange flow
 */

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../setup/testDb');

// Mock OpenBao before requiring app
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
    initialized: true,
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, initialized: true, sealed: false }),
    validateConnection: jest.fn().mockResolvedValue(true)
  };
});

// App will be imported inside beforeAll hook to ensure mocks are set up
let app;

describe('Integration: Key Exchange API', () => {
  beforeAll(async () => {
    await connect();
    // Import app after DB connection and mock setup
    app = require('../../server');
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/key-exchange/public-key', () => {
    test('should return backend RSA public key', async () => {
      const response = await request(app)
        .get('/api/key-exchange/public-key');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('publicKey');
      expect(response.body).toHaveProperty('keyVersion');
      expect(response.body).toHaveProperty('algorithm');
      expect(response.body.publicKey).toContain('BEGIN PUBLIC KEY');
    });

    test('should return RSA-2048 algorithm', async () => {
      const response = await request(app)
        .get('/api/key-exchange/public-key');
      
      expect(response.body.algorithm).toBe('RSA-2048');
    });

    test('should include key validity period', async () => {
      const response = await request(app)
        .get('/api/key-exchange/public-key');
      
      expect(response.body).toHaveProperty('validUntil');
      expect(new Date(response.body.validUntil)).toBeInstanceOf(Date);
    });

    test('should return same key for multiple requests within validity', async () => {
      const response1 = await request(app)
        .get('/api/key-exchange/public-key');
      
      const response2 = await request(app)
        .get('/api/key-exchange/public-key');
      
      expect(response1.body.publicKey).toBe(response2.body.publicKey);
      expect(response1.body.keyVersion).toBe(response2.body.keyVersion);
    });
  });

  describe('Error Handling', () => {
    test('should return 500 when OpenBao is unavailable', async () => {
      // Mock OpenBao failure
      const keyExchangeService = require('../../services/keyExchangeService');
      jest.spyOn(keyExchangeService, 'getPublicKeyForFrontend')
        .mockRejectedValueOnce(new Error('Service unavailable'));
      
      const response = await request(app)
        .get('/api/key-exchange/public-key');
      
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Failed to retrieve public key');
    });
  });

  describe('Security', () => {
    test('should not expose private key information', async () => {
      const response = await request(app)
        .get('/api/key-exchange/public-key');
      
      const body = JSON.stringify(response.body);
      expect(body).not.toContain('PRIVATE');
      expect(body).not.toContain('BEGIN RSA PRIVATE KEY');
    });

    test('should return valid PEM format', async () => {
      const response = await request(app)
        .get('/api/key-exchange/public-key');
      
      const publicKey = response.body.publicKey;
      expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
      expect(publicKey).toMatch(/-----END PUBLIC KEY-----$/);
    });
  });

  describe('Performance', () => {
    test('should respond quickly (< 1000ms)', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/key-exchange/public-key');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });
});

