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

    //const password = await bcrypt.hash('Secure@123', 10);
    const aesKey = crypto.randomBytes(32).toString('hex');

    const admin = new User({
        name: 'Initial Admin',
        email: 'admin@ehr.com',
        password: 'Secure@123', // plaintext password for hashing
        role: 'Admin',
        aesKey,
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
