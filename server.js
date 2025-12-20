// Load environment variables based on NODE_ENV
const path = require('path');
const dotenv = require('dotenv');

// Determine which .env file to load
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const envPath = path.resolve(__dirname, envFile);

try {
  // Try to load specific environment file
  dotenv.config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
} catch (error) {
  // Fall back to default .env file
  console.log(`Falling back to default .env file: ${error.message}`);
  dotenv.config();
}

const express = require('express');
const cookieParser = require('cookie-parser');

// Configuration imports
const connectDB = require('./config/db');
const openbaoConfig = require('./config/openbao.config');
const logger = require('./config/logger');
const { helmetConfig, corsOptions, apiLimiter, authLimiter } = require('./config/security');

// Middleware imports
const httpLogger = require('./middlewares/httpLogger');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

// Cron jobs
const startAllCrons = require('./crons');

// Route imports
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const patientRecordRoutes = require('./routes/patientRecordRoutes');
const adminRoutes = require('./routes/adminRoutes');
const keyExchangeRoutes = require('./routes/keyExchangeRoutes');
const healthRoutes = require('./routes/healthRoutes');
// New role-based routes
const employeeRoutes = require('./routes/employeeRoutes');
const managerRoutes = require('./routes/managerRoutes');
const providerRoutes = require('./routes/providerRoutes');

const app = express();

// Security middleware
app.use(helmetConfig);
app.use(cookieParser());
app.use(corsOptions);

// HTTP request logging
app.use(httpLogger);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Connect to database and OpenBao only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Initialize OpenBao connection
  openbaoConfig.init().then(success => {
    if (success) {
      logger.info('OpenBao initialized successfully');
    } else {
      logger.warn('OpenBao initialization failed - crypto operations may fail');
    }
  }).catch(error => {
    logger.error('OpenBao initialization error:', error);
  });
  
  // Connect to MongoDB
  connectDB();
  
  // Start cron jobs
  startAllCrons();
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'EHR Backend API',
    version: '2.0.0',
    status: 'running',
    documentation: '/api/docs'
  });
});

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patient-records', patientRecordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/key-exchange', keyExchangeRoutes);
// New role-based routes
app.use('/api/employees', employeeRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/providers', providerRoutes);

// Error handling middleware (must be after all routes)
app.use(notFound);
app.use(errorHandler);

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`API Documentation: http://localhost:${PORT}/api/docs`);
  });
}

// Export app for testing
module.exports = app;
