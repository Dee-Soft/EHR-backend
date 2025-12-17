const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: process.env.OPENBAO_ADDR || 'http://localhost:18200',
  token: process.env.OPENBAO_TOKEN || 'ehr-permanent-token',
});

// Note: logger is conditionally imported to avoid circular dependency during initialization
let logger;
try {
  logger = require('./logger');
} catch (e) {
  // Fallback to console if logger not yet available
  logger = console;
}

class OpenBaoConfig {
  constructor() {
    this.initialized = false;
    this.keys = {
      aesMaster: process.env.OPENBAO_TRANSIT_AES_KEY || 'ehr-aes-master',
      rsaExchange: process.env.OPENBAO_TRANSIT_RSA_KEY || 'ehr-rsa-exchange'
    };
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.endpoints = [
      process.env.OPENBAO_ADDR || 'http://localhost:18200',
      'http://openbao:8200'
    ];
    this.currentEndpointIndex = 0;
  }

  /**
   * Initialize OpenBao connection with retry logic and endpoint fallback
   */
  async init() {
    let lastError;
    
    // Try each endpoint with retries
    for (let endpointIndex = 0; endpointIndex < this.endpoints.length; endpointIndex++) {
      const endpoint = this.endpoints[endpointIndex];
      vault.endpoint = endpoint;
      this.currentEndpointIndex = endpointIndex;
      
      logger.info(`Attempting to connect to OpenBao at ${endpoint}`);
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          // Test connection
          await vault.status();
          this.initialized = true;
          logger.info(`OpenBao connection established at ${endpoint}`);
          
          // If using AppRole, authenticate here
          if (process.env.OPENBAO_ROLE_ID && process.env.OPENBAO_SECRET_ID) {
            await this.appRoleLogin();
          }
          
          return true;
        } catch (error) {
          lastError = error;
          logger.warn(`OpenBao connection attempt ${attempt}/${this.maxRetries} to ${endpoint} failed`, { 
            error: error.message 
          });
          
          if (attempt < this.maxRetries) {
            // Exponential backoff
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            logger.info(`Retrying OpenBao connection in ${delay}ms`);
            await this._sleep(delay);
          }
        }
      }
      
      // If we get here, all retries for this endpoint failed
      logger.warn(`All connection attempts to ${endpoint} failed, trying next endpoint if available`);
    }
    
    // All endpoints and retries failed
    logger.error('OpenBao connection failed after trying all endpoints', { 
      error: lastError?.message || 'Unknown error',
      endpointsTried: this.endpoints
    });
    logger.warn('Application will continue but crypto operations will fail');
    return false;
  }

  /**
   * AppRole authentication (for production)
   */
  async appRoleLogin() {
    try {
      const result = await vault.approleLogin({
        role_id: process.env.OPENBAO_ROLE_ID,
        secret_id: process.env.OPENBAO_SECRET_ID,
      });
      
      vault.token = result.auth.client_token;
      logger.info('AppRole authentication successful');
      return true;
    } catch (error) {
      logger.error('AppRole authentication failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Transit Engine client for crypto operations
   */
  getTransitClient() {
    return vault;
  }

  /**
   * Get current endpoint being used
   */
  getCurrentEndpoint() {
    return this.endpoints[this.currentEndpointIndex] || vault.endpoint;
  }

  /**
   * Get all configured endpoints
   */
  getConfiguredEndpoints() {
    return [...this.endpoints];
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = await vault.status();
      return {
        healthy: true,
        initialized: status.initialized,
        sealed: status.sealed,
        version: status.version,
        endpoint: this.getCurrentEndpoint(),
        endpointsConfigured: this.getConfiguredEndpoints()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        endpoint: this.getCurrentEndpoint(),
        endpointsConfigured: this.getConfiguredEndpoints()
      };
    }
  }

  /**
   * Validate OpenBao connection before operations
   */
  async validateConnection() {
    if (!this.initialized) {
      throw new Error('OpenBao not initialized. Call init() first.');
    }
    
    try {
      await vault.status();
      return true;
    } catch (error) {
      logger.error('OpenBao connection validation failed', { error: error.message });
      throw new Error('OpenBao service unavailable');
    }
  }

  /**
   * Helper method for exponential backoff
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
module.exports = new OpenBaoConfig();
