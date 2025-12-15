require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const openbaoConfig = require('./config/openbao.config');

// cron jobs auto loader
const startAllCrons = require('./crons');

const cookieParser = require('cookie-parser');


//routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const patientRecordRoutes = require('./routes/patientRecordRoutes');
const adminRoutes = require('./routes/adminRoutes');

const keyExchangeRoutes = require('./routes/keyExchangeRoutes');


const app = express();

// middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // Allow cookies to be sent with requests
}));
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
app.use(express.json());

// Connect to database and OpenBao only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Initialize OpenBao connection
  openbaoConfig.init().then(success => {
    if (success) {
      console.log('✅ OpenBao initialized successfully');
    } else {
      console.warn('⚠️  OpenBao initialization failed - crypto operations may fail');
    }
  });
  
  // Connect to MongoDB
  connectDB();
  
  // Start cron jobs only in production
  startAllCrons();
}

// api endpoints
app.get('/', (req, res) => {
  res.send('Electronic Health Record System backend is running securely!');
});

// Health check endpoint including OpenBao status
app.get('/api/health', async (req, res) => {
  const openbaoHealth = await openbaoConfig.healthCheck();
  res.status(openbaoHealth.healthy ? 200 : 503).json({
    status: openbaoHealth.healthy ? 'healthy' : 'unhealthy',
    services: {
      api: 'operational',
      openbao: openbaoHealth
    },
    timestamp: new Date().toISOString()
  });
});

app.use('/api/users', userRoutes);
app.use('/api/patient-records', patientRecordRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/key-exchange', keyExchangeRoutes);

// start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export app for testing
module.exports = app;
