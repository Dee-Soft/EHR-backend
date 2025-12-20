const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('./models/User');

const testUsers = [
  {
    name: 'Test Manager',
    email: 'manager@test.com',
    password: 'password123',
    role: 'Manager',
    phone: '555-0101',
    address: '123 Test St'
  },
  {
    name: 'Test Provider',
    email: 'provider@test.com',
    password: 'password123',
    role: 'Provider',
    phone: '555-0102',
    address: '456 Test Ave',
    providerId: 'PROV001'
  },
  {
    name: 'Test Patient',
    email: 'patient@test.com',
    password: 'password123',
    role: 'Patient',
    phone: '555-0103',
    address: '789 Test Blvd',
    dateOfBirth: new Date('1990-01-01'),
    gender: { type: 'Male' }
  },
  {
    name: 'Assigned Patient',
    email: 'assigned.patient@test.com',
    password: 'password123',
    role: 'Patient',
    phone: '555-0104',
    address: '101 Test Lane',
    dateOfBirth: new Date('1985-05-15'),
    gender: { type: 'Female' }
  }
];

async function createTestUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ehr');
    console.log('Connected to MongoDB');

    // Clear existing test users
    await User.deleteMany({
      email: { $in: testUsers.map(u => u.email) }
    });
    console.log('Cleared existing test users');

    // Create users
    for (const userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${user.email} (${user.role})`);
    }

    // Update provider with assigned patient
    const provider = await User.findOne({ email: 'provider@test.com' });
    const assignedPatient = await User.findOne({ email: 'assigned.patient@test.com' });
    
    if (provider && assignedPatient) {
      provider.assignedPatients.push(assignedPatient._id);
      await provider.save();
      
      assignedPatient.assignedProviderId = provider._id;
      await assignedPatient.save();
      
      console.log(`Assigned patient ${assignedPatient.email} to provider ${provider.email}`);
    }

    console.log('\nTest users created successfully:');
    console.log('- Manager: manager@test.com / password123');
    console.log('- Provider: provider@test.com / password123');
    console.log('- Patient: patient@test.com / password123');
    console.log('- Assigned Patient: assigned.patient@test.com / password123 (assigned to provider)');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error.message);
    process.exit(1);
  }
}

createTestUsers();
