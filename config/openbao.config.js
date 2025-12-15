const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: process.env.OPENBAO_ADDR || 'http://openbao:8200',
  token: process.env.OPENBAO_TOKEN,
});

class OpenBaoConfig {
  constructor() {
    this.initialized = false;
    this.keys = {
      aesMaster: process.env.OPENBAO_TRANSIT_AES_KEY || 'ehr-aes-master',
      rsaExchange: process.env.OPENBAO_TRANSIT_RSA_KEY || 'ehr-rsa-exchange'
    };
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Initialize OpenBao connection with retry logic
   */
  async init() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Test connection
        await vault.status();
        this.initialized = true;
        console.log('OpenBao connection established');
        
        // If using AppRole, authenticate here
        if (process.env.OPENBAO_ROLE_ID && process.env.OPENBAO_SECRET_ID) {
          await this.appRoleLogin();
        }
        
        return true;
      } catch (error) {
        lastError = error;
        console.error(`OpenBao connection attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await this._sleep(delay);
        }
      }
    }
    
    // All retries failed
    console.error('OpenBao connection failed after all retries:', lastError.message);
    console.error('Application will continue but crypto operations will fail');
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
      console.log('AppRole authentication successful');
      return true;
    } catch (error) {
      console.error('AppRole authentication failed:', error.message);
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
   * Health check
   */
  async healthCheck() {
    try {
      const status = await vault.status();
      return {
        healthy: true,
        initialized: status.initialized,
        sealed: status.sealed,
        version: status.version
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
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
      console.error('OpenBao connection validation failed:', error.message);
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
