/**
 * Health Check Controller
 * Provides health, readiness, and liveness endpoints
 */

const openbaoConfig = require('../config/openbao.config');
const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Get system health status
 * @route GET /api/health
 * @access Public
 * @returns {Object} Health status of all services
 */
exports.getHealth = async (req, res) => {
  try {
    const openbaoHealth = await openbaoConfig.healthCheck();
    const mongoHealth = mongoose.connection.readyState === 1;

    // Defensive check for openbaoHealth structure
    const isOpenbaoHealthy = openbaoHealth && openbaoHealth.healthy === true;

    const health = {
      status: isOpenbaoHealthy && mongoHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'operational',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '1.0.0'
        },
        mongodb: {
          status: mongoHealth ? 'connected' : 'disconnected',
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          name: mongoose.connection.name
        },
        openbao: {
          status: openbaoHealth?.healthy ? 'healthy' : 'unhealthy',
          healthy: openbaoHealth?.healthy || false,
          initialized: openbaoHealth?.initialized || false,
          sealed: openbaoHealth?.sealed ?? true,
          version: openbaoHealth?.version || 'unknown'
        }
      }
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    logger.info('Health check performed', { 
      status: health.status,
      services: Object.keys(health.services).reduce((acc, key) => {
        acc[key] = health.services[key].status;
        return acc;
      }, {})
    });

    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get readiness status
 * @route GET /api/health/ready
 * @access Public
 * @description Used by Kubernetes to determine if pod is ready to accept traffic
 * @returns {Object} Readiness status
 */
exports.getReadiness = async (req, res) => {
  try {
    const openbaoReady = openbaoConfig.initialized;
    const mongoReady = mongoose.connection.readyState === 1;

    const ready = openbaoReady && mongoReady;

    if (ready) {
      res.status(200).json({ 
        ready: true,
        services: {
          openbao: openbaoReady,
          mongodb: mongoReady
        }
      });
    } else {
      res.status(503).json({ 
        ready: false,
        services: {
          openbao: openbaoReady,
          mongodb: mongoReady
        }
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ ready: false, error: error.message });
  }
};

/**
 * Get liveness status
 * @route GET /api/health/live
 * @access Public
 * @description Used by Kubernetes to determine if pod is alive
 * @returns {Object} Liveness status
 */
exports.getLiveness = (req, res) => {
  res.status(200).json({ 
    alive: true,
    timestamp: new Date().toISOString()
  });
};

