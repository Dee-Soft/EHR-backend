/**
 * Morgan HTTP Logger Middleware
 * Logs HTTP requests to Winston logger
 */

const morgan = require('morgan');
const logger = require('../config/logger');

// Morgan stream to Winston
const stream = {
  write: (message) => logger.http(message.trim())
};

// Different formats for development and production
const morganMiddleware = process.env.NODE_ENV === 'production'
  ? morgan('combined', { stream })
  : morgan('dev', { stream });

module.exports = morganMiddleware;

