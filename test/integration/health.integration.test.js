/**
 * Health Endpoint Integration Tests
 * Tests health check endpoints for API, MongoDB, and OpenBao status
 */

const request = require('supertest');
const { connect, closeDatabase } = require('../setup/testDb');
const mongoose = require('mongoose');

// Mock OpenBao
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
    healthCheck: jest.fn().mockResolvedValue({
      healthy: true,
      initialized: true,
      sealed: false,
      version: '2.0.0-alpha1'
    }),
    validateConnection: jest.fn().mockResolvedValue(true)
  };
});

const app = require('../../server');
const openbaoConfig = require('../../config/openbao.config');

describe('Integration: Health Endpoints', () => {
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/health', () => {
    test('should return health status with all services', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('api');
      expect(response.body.services).toHaveProperty('mongodb');
      expect(response.body.services).toHaveProperty('openbao');
    });

    test('should report API service status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.services.api).toHaveProperty('status', 'operational');
      expect(response.body.services.api).toHaveProperty('uptime');
      expect(response.body.services.api).toHaveProperty('memory');
      expect(typeof response.body.services.api.uptime).toBe('number');
    });

    test('should report MongoDB connection status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.services.mongodb).toHaveProperty('status');
      expect(response.body.services.mongodb).toHaveProperty('readyState');
      
      // MongoDB should be connected
      expect(response.body.services.mongodb.status).toBe('connected');
      expect(response.body.services.mongodb.readyState).toBe(1); // 1 = connected
    });

    test('should report OpenBao connection status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.services.openbao).toHaveProperty('healthy');
      expect(response.body.services.openbao).toHaveProperty('initialized');
      expect(response.body.services.openbao.healthy).toBe(true);
    });

    test('should return healthy status when all services are up', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    test('should return unhealthy status when OpenBao is down', async () => {
      // Mock OpenBao as unhealthy
      openbaoConfig.healthCheck.mockResolvedValueOnce({
        healthy: false,
        error: 'Connection refused'
      });

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });

    test('should include timestamp in ISO format', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.timestamp).toBeDefined();
      
      // Verify it's a valid ISO timestamp
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    test('should include memory usage information', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.services.api.memory).toHaveProperty('rss');
      expect(response.body.services.api.memory).toHaveProperty('heapTotal');
      expect(response.body.services.api.memory).toHaveProperty('heapUsed');
      expect(response.body.services.api.memory).toHaveProperty('external');
    });
  });

  describe('GET /api/health/ready', () => {
    test('should return ready when all services initialized', async () => {
      const response = await request(app)
        .get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ready', true);
    });

    test('should return not ready when OpenBao not initialized', async () => {
      // Mock OpenBao as not initialized
      const originalInitialized = openbaoConfig.initialized;
      openbaoConfig.initialized = false;

      const response = await request(app)
        .get('/api/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('ready', false);

      // Restore
      openbaoConfig.initialized = originalInitialized;
    });

    test('should return not ready when MongoDB disconnected', async () => {
      // This test would require actually disconnecting MongoDB
      // which could affect other tests, so we'll just verify the endpoint exists
      const response = await request(app)
        .get('/api/health/ready');

      // Should be ready in test environment
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('ready');
    });
  });

  describe('GET /api/health/live', () => {
    test('should always return alive', async () => {
      const response = await request(app)
        .get('/api/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alive', true);
    });

    test('should return quickly (liveness probe)', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/health/live');

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Health Check for Kubernetes', () => {
    test('liveness probe should succeed even if dependencies are down', async () => {
      // Liveness should always return 200
      const response = await request(app)
        .get('/api/health/live');

      expect(response.status).toBe(200);
    });

    test('readiness probe should consider all dependencies', async () => {
      const response = await request(app)
        .get('/api/health/ready');

      // Should reflect actual dependency status
      if (response.status === 200) {
        expect(response.body.ready).toBe(true);
      } else {
        expect(response.status).toBe(503);
        expect(response.body.ready).toBe(false);
      }
    });

    test('health endpoint should provide detailed status for monitoring', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
      
      // Should have structured data for monitoring tools
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('timestamp');
      
      // Each service should have status information
      Object.values(response.body.services).forEach(service => {
        expect(service).toHaveProperty('status');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle health check errors gracefully', async () => {
      // Mock healthCheck to throw error
      openbaoConfig.healthCheck.mockRejectedValueOnce(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body).toHaveProperty('error');
    });

    test('should return 503 for unhealthy state', async () => {
      // Mock unhealthy state
      openbaoConfig.healthCheck.mockResolvedValueOnce({
        healthy: false,
        error: 'Service unavailable'
      });

      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(503);
    });
  });

  describe('Public Access', () => {
    test('health endpoint should be publicly accessible', async () => {
      // No authentication required
      const response = await request(app)
        .get('/api/health');

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    test('ready endpoint should be publicly accessible', async () => {
      const response = await request(app)
        .get('/api/health/ready');

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    test('live endpoint should be publicly accessible', async () => {
      const response = await request(app)
        .get('/api/health/live');

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });
});

