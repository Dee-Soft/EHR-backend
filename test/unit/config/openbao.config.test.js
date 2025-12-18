/**
 * Unit Tests for OpenBao Configuration
 * Tests connection, initialization, health checks, and error handling
 */

const { createMockVaultClient: mockCreateMockVaultClient } = require('../../setup/mocks/openbaoMock');

// Mock logger module
jest.mock('../../../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock node-vault module - create mock inline to avoid scope issues
jest.mock('node-vault', () => {
  const { createMockVaultClient } = require('../../setup/mocks/openbaoMock');
  const mockInstance = createMockVaultClient();
  return jest.fn(() => mockInstance);
});

describe('OpenBao Configuration', () => {
  let OpenBaoConfig;
  let mockVault;

  beforeEach(() => {
    // Clear module cache to get fresh instance
    jest.clearAllMocks();
    jest.resetModules();
    
    // Set environment variables
    process.env.OPENBAO_ADDR = 'http://localhost:18200';
    process.env.OPENBAO_TOKEN = 'ehr-permanent-token';
    
    // Re-mock logger after resetModules
    jest.doMock('../../../config/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }));
    
    // Re-mock node-vault after resetModules
    jest.doMock('node-vault', () => {
      const { createMockVaultClient } = require('../../setup/mocks/openbaoMock');
      const mockInstance = createMockVaultClient();
      return jest.fn(() => mockInstance);
    });
    
    // Require after setting env vars
    OpenBaoConfig = require('../../../config/openbao.config');
    mockVault = mockCreateMockVaultClient();
  });

  afterEach(() => {
    delete process.env.OPENBAO_ADDR;
    delete process.env.OPENBAO_TOKEN;
    delete process.env.OPENBAO_ROLE_ID;
    delete process.env.OPENBAO_SECRET_ID;
  });

  describe('Initialization', () => {
    test('should initialize successfully when OpenBao is available', async () => {
      const result = await OpenBaoConfig.init();
      
      expect(result).toBe(true);
      expect(OpenBaoConfig.initialized).toBe(true);
    });

    test('should return false when OpenBao is unavailable', async () => {
      // Mock status to throw error
      const nodeVault = require('node-vault');
      const mockClient = nodeVault();
      mockClient.status = jest.fn().mockRejectedValue(new Error('Connection refused'));
      
      // Recreate config with failing client
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      const FailingConfig = require('../../../config/openbao.config');
      const result = await FailingConfig.init();
      
      expect(result).toBe(false);
      expect(FailingConfig.initialized).toBe(false);
    });

    test('should not throw error on initialization failure', async () => {
      const nodeVault = require('node-vault');
      const mockClient = nodeVault();
      mockClient.status = jest.fn().mockRejectedValue(new Error('Network error'));
      
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      const FailingConfig = require('../../../config/openbao.config');
      
      await expect(FailingConfig.init()).resolves.toBe(false);
    });
  });

  describe('AppRole Authentication', () => {
    beforeEach(() => {
      process.env.OPENBAO_ROLE_ID = 'test-role-id';
      process.env.OPENBAO_SECRET_ID = 'test-secret-id';
    });

    test('should authenticate with AppRole when credentials provided', async () => {
      const nodeVault = require('node-vault');
      const mockClient = nodeVault();
      mockClient.approleLogin = jest.fn().mockResolvedValue({
        auth: {
          client_token: 'new-token-from-approle',
          policies: ['backend-policy'],
          lease_duration: 3600
        }
      });
      
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      const AppRoleConfig = require('../../../config/openbao.config');
      await AppRoleConfig.init();
      
      expect(mockClient.approleLogin).toHaveBeenCalledWith({
        role_id: 'test-role-id',
        secret_id: 'test-secret-id'
      });
    });

    test('should handle AppRole authentication failure', async () => {
      const nodeVault = require('node-vault');
      const mockClient = nodeVault();
      mockClient.approleLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      const AppRoleConfig = require('../../../config/openbao.config');
      
      await expect(AppRoleConfig.appRoleLogin()).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status when OpenBao is operational', async () => {
      // Initialize OpenBao first
      await OpenBaoConfig.init();
      
      const health = await OpenBaoConfig.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.initialized).toBeDefined();
      expect(health.sealed).toBeDefined();
      expect(health.version).toBeDefined();
    });

    test('should return unhealthy status when OpenBao is down', async () => {
      const nodeVault = require('node-vault');
      const mockClient = nodeVault();
      mockClient.status = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      const FailingConfig = require('../../../config/openbao.config');
      const health = await FailingConfig.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    test('should include version information in health check', async () => {
      // Initialize OpenBao first
      await OpenBaoConfig.init();
      
      const health = await OpenBaoConfig.healthCheck();
      
      expect(health.version).toBeDefined();
      expect(typeof health.version).toBe('string');
    });
  });

  describe('Transit Client', () => {
    test('should return transit client for crypto operations', () => {
      const client = OpenBaoConfig.getTransitClient();
      
      expect(client).toBeDefined();
      expect(typeof client.write).toBe('function');
      expect(typeof client.read).toBe('function');
    });

    test('should return same client instance', () => {
      const client1 = OpenBaoConfig.getTransitClient();
      const client2 = OpenBaoConfig.getTransitClient();
      
      expect(client1).toBe(client2);
    });
  });

  describe('Key Names Configuration', () => {
    test('should have configured AES master key name', () => {
      expect(OpenBaoConfig.keys.aesMaster).toBe('test-aes-key');
    });

    test('should have configured RSA exchange key name', () => {
      expect(OpenBaoConfig.keys.rsaExchange).toBe('test-rsa-key');
    });
  });

  describe('Error Handling', () => {
    test('should log error message on initialization failure', async () => {
      const logger = require('../../../config/logger');
      logger.error.mockClear();
      
      const nodeVault = require('node-vault');
      const mockClient = nodeVault();
      mockClient.status = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      // Re-mock logger after resetModules
      jest.doMock('../../../config/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }));
      
      const FailingConfig = require('../../../config/openbao.config');
      await FailingConfig.init();
      
      const loggerAfterInit = require('../../../config/logger');
      expect(loggerAfterInit.error).toHaveBeenCalledWith(
        'OpenBao connection failed after trying all endpoints',
        expect.objectContaining({
          error: expect.any(String),
          endpointsTried: expect.any(Array)
        })
      );
    });

    test('should log success message on successful initialization', async () => {
      const logger = require('../../../config/logger');
      logger.info.mockClear();
      
      await OpenBaoConfig.init();
      
      // Should log both attempt and success messages
      // Check that the messages were logged (they might not have additional parameters)
      const infoCalls = logger.info.mock.calls;
      const messages = infoCalls.map(call => call[0]);
      
      expect(messages).toContain('Attempting to connect to OpenBao at http://localhost:18200');
      expect(messages).toContain('OpenBao connection established at http://localhost:18200');
    });
  });

  describe('Environment Configuration', () => {
    test('should use default endpoint when OPENBAO_ADDR not set', () => {
      delete process.env.OPENBAO_ADDR;
      
      jest.resetModules();
      const DefaultConfig = require('../../../config/openbao.config');
      const client = DefaultConfig.getTransitClient();
      
      expect(client.endpoint).toBeDefined();
    });
    
    test('should use environment OPENBAO_ADDR when set', () => {
      // Set env var BEFORE requiring the module
      process.env.OPENBAO_ADDR = 'http://custom-vault:9200';
      
      // Reset modules to force re-creation with new env var
      jest.resetModules();
      
      // Re-mock logger
      jest.doMock('../../../config/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }));
      
      // Re-mock node-vault to use the env var
      jest.doMock('node-vault', () => {
        return jest.fn((options) => {
          const mock = mockCreateMockVaultClient();
          mock.endpoint = options.endpoint;
          return mock;
        });
      });
      
      // NOW require the config
      const CustomConfig = require('../../../config/openbao.config');
      const client = CustomConfig.getTransitClient();
      
      expect(client.endpoint).toBe('http://custom-vault:9200');
    });
    
    test('should have multiple endpoints configured for fallback', () => {
      const endpoints = OpenBaoConfig.getConfiguredEndpoints();
      expect(endpoints).toContain('http://localhost:18200');
      expect(endpoints).toContain('http://openbao:8200');
      expect(endpoints.length).toBe(2);
    });
    
    test('should get current endpoint', () => {
      const endpoint = OpenBaoConfig.getCurrentEndpoint();
      expect(endpoint).toBeDefined();
      expect(typeof endpoint).toBe('string');
    });
  });
  
  describe('Endpoint Fallback', () => {
    test('should try multiple endpoints when connection fails', async () => {
      // Create a fresh mock that will fail
      const { createMockVaultClient } = require('../../setup/mocks/openbaoMock');
      const mockClient = createMockVaultClient();
      
      // Override status to always fail
      mockClient.status = jest.fn()
        .mockRejectedValueOnce(new Error('Connection refused to localhost:18200'))
        .mockRejectedValueOnce(new Error('Connection refused to openbao:8200'))
        .mockRejectedValue(new Error('All endpoints failed'));
      
      jest.resetModules();
      jest.doMock('node-vault', () => {
        return jest.fn(() => mockClient);
      });
      
      // Re-mock logger
      jest.doMock('../../../config/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }));
      
      const FailingConfig = require('../../../config/openbao.config');
      const result = await FailingConfig.init();
      
      expect(result).toBe(false);
      // Should try both endpoints (3 retries each = 6 calls total)
      expect(mockClient.status.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

