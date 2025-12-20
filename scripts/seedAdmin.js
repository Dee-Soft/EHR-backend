const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');

// For scripts, we can use console directly or create a simple logger
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, details) => console.error(`[ERROR] ${msg}`, details || '')
};

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ehr');
    const exists = await User.findOne({ role: 'Admin' });
    if (exists) {
      log.info('Admin already exists');
      process.exit(0);
    }

    const admin = new User({
        name: 'Initial Admin',
        email: 'admin@ehr.com',
        password: 'Secure@123', // plaintext password for hashing
        role: 'Admin',
    });
    await admin.save(); // triggers pre-save hook to hash password

    log.info(`Admin created: ${admin.email}`);
    process.exit(0);
  } catch (err) {
    log.error('Failed to create admin:', err.message);
    process.exit(1);
  }
};

createAdmin();
