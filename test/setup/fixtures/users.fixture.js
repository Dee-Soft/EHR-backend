/**
 * Plain password for login tests
 * The User model will hash this automatically via pre-save hook
 */
const plainPassword = 'Password123!';

/**
 * Test user fixtures for different roles
 * Note: Passwords are plain text and will be hashed by User model pre-save hook
 */
const testUsers = {
  admin: {
    name: 'Admin User',
    email: 'admin@test.com',
    password: plainPassword,
    role: 'Admin',
    phone: '1234567890',
    address: '123 Admin St',
    dateOfBirth: new Date('1980-01-01'),
    gender: 'Male',
    adminId: 'ADMIN-001',
  },
  
  manager: {
    name: 'Manager User',
    email: 'manager@test.com',
    password: plainPassword,
    role: 'Manager',
    phone: '1234567891',
    address: '123 Manager St',
    dateOfBirth: new Date('1985-01-01'),
    gender: 'Female',
    managerId: 'MGR-001',
  },
  
  provider: {
    name: 'Dr. Provider',
    email: 'provider@test.com',
    password: plainPassword,
    role: 'Provider',
    phone: '1234567892',
    address: '123 Provider St',
    dateOfBirth: new Date('1975-01-01'),
    gender: 'Male',
    providerId: 'PROV-001',
  },
  
  employee: {
    name: 'Employee User',
    email: 'employee@test.com',
    password: plainPassword,
    role: 'Employee',
    phone: '1234567893',
    address: '123 Employee St',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Female',
    employeeId: 'EMP-001',
  },
  
  patient: {
    name: 'Patient User',
    email: 'patient@test.com',
    password: plainPassword,
    role: 'Patient',
    phone: '1234567894',
    address: '123 Patient St',
    dateOfBirth: new Date('1995-01-01'),
    gender: 'Male',
  },
  
  patient2: {
    name: 'Patient Two',
    email: 'patient2@test.com',
    password: plainPassword,
    role: 'Patient',
    phone: '1234567895',
    address: '456 Patient Ave',
    dateOfBirth: new Date('1992-06-15'),
    gender: 'Female',
  },
};

/**
 * Invalid user data for testing validation
 */
const invalidUsers = {
  missingEmail: {
    name: 'No Email User',
    password: plainPassword,
    role: 'Patient',
  },
  
  invalidRole: {
    name: 'Invalid Role User',
    email: 'invalid@test.com',
    password: plainPassword,
    role: 'InvalidRole',
  },
  
  invalidEmail: {
    name: 'Invalid Email User',
    email: 'not-an-email',
    password: plainPassword,
    role: 'Patient',
  },
};

module.exports = {
  testUsers,
  invalidUsers,
  plainPassword,
};
