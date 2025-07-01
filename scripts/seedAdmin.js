const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const exists = await User.findOne({ role: 'Admin' });
    if (exists) {
      console.log('Admin already exists');
      process.exit(0);
    }

    const admin = new User({
        name: 'Initial Admin',
        email: 'admin@ehr.com',
        password: 'Secure@123', // plaintext password for hashing
        role: 'Admin',
    });
    await admin.save(); // triggers pre-save hook to hash password

    console.log('Admin created:', admin.email);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  }
};

createAdmin();
