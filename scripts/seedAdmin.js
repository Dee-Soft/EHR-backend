const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const exists = await User.findOne({ role: 'Admin' });
    if (exists) {
      console.log('Admin already exists');
      process.exit();
    }

    const password = await bcrypt.hash('Secure@123', 10);

    const admin = await User.create({
      name: 'Initial Admin',
      email: 'admin@ehr.com',
      password,
      role: 'Admin',
    });

    console.log('Admin created:', admin.email);
    process.exit();
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  }
};

createAdmin();
