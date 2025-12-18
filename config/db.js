const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    
    // Add timeout options if specified in environment
    if (process.env.MONGO_CONNECT_TIMEOUT_MS) {
      options.connectTimeoutMS = parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS);
    }
    if (process.env.MONGO_SOCKET_TIMEOUT_MS) {
      options.socketTimeoutMS = parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS);
    }
    
    await mongoose.connect(process.env.MONGO_URI, options);
    logger.info('MongoDB connected', { 
      host: mongoose.connection.host,
      name: mongoose.connection.name
    });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  }
};

module.exports = connectDB;
