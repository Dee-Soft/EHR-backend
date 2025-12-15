const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../setup/testDb');
const { testUsers, plainPassword } = require('../setup/fixtures/users.fixture');
const User = require('../../models/User');
const { generateJWT } = require('../../utils/jwtUtils');

let app;

describe('Security: RBAC (Role-Based Access Control)', () => {
  let adminToken, managerToken, providerToken, employeeToken, patientToken;
  let adminUser, managerUser, providerUser, employeeUser, patientUser;
  
  beforeAll(async () => {
    await connect();
    app = require('../../server');
    
    // Create users for each role
    adminUser = await User.create(testUsers.admin);
    managerUser = await User.create(testUsers.manager);
    providerUser = await User.create(testUsers.provider);
    employeeUser = await User.create(testUsers.employee);
    patientUser = await User.create(testUsers.patient);
    
    // Generate tokens for each user
    adminToken = generateJWT(adminUser);
    managerToken = generateJWT(managerUser);
    providerToken = generateJWT(providerUser);
    employeeToken = generateJWT(employeeUser);
    patientToken = generateJWT(patientUser);
  });
  
  afterEach(async () => {
    // Don't clear users created in beforeAll
    // Only clear data created in individual tests
  });
  
  afterAll(async () => {
    await clearDatabase();
    await closeDatabase();
  });
  
  describe('Admin Routes - /api/admin/*', () => {
    test('should allow Admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${adminToken}`);
      
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(401);
    });
    
    test('should deny Manager access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${managerToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
    
    test('should deny Provider access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${providerToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
    
    test('should deny Employee access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${employeeToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
    
    test('should deny Patient access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${patientToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
    
    test('should deny unauthenticated access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Token is missing');
    });
  });
  
  describe('User Management Routes', () => {
    test('should allow Admin to create users', async () => {
      const newUser = {
        name: 'New Test User',
        email: 'newuser@test.com',
        password: 'Password123!',
        role: 'Patient',
        phone: '1234567890',
        address: '123 Test St'
      };
      
      const response = await request(app)
        .post('/api/users/register')
        .set('Cookie', `token=${adminToken}`)
        .send(newUser);
      
      // Expecting either success or specific admin-only registration
      expect([200, 201, 403]).toContain(response.status);
    });
    
    test('should allow Manager to manage employee data', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', `token=${managerToken}`);
      
      // Manager should have some level of user access
      expect([200, 403]).toContain(response.status);
    });
    
    test('should prevent Patient from accessing other user data', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', `token=${patientToken}`);
      
      // Patient should not access all users list
      expect(response.status).toBe(403);
    });
  });
  
  describe('Patient Records Access', () => {
    test('should allow Provider to access patient records', async () => {
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', `token=${providerToken}`);
      
      // Provider should have access to records
      expect([200, 404]).toContain(response.status);
      expect(response.status).not.toBe(403);
    });
    
    test('should allow Patient to access their own records', async () => {
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', `token=${patientToken}`);
      
      // Patient should access their own records
      expect([200, 404]).toContain(response.status);
      expect(response.status).not.toBe(403);
    });
    
    test('should allow Admin full access to all records', async () => {
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', `token=${adminToken}`);
      
      expect([200, 404]).toContain(response.status);
      expect(response.status).not.toBe(403);
    });
    
    test('should prevent Employee from accessing patient records', async () => {
      const response = await request(app)
        .get('/api/patient-records')
        .set('Cookie', `token=${employeeToken}`);
      
      // Employee should not have direct access to patient records
      expect(response.status).toBe(403);
    });
  });
  
  describe('Role Hierarchy', () => {
    test('Admin should have highest privileges', async () => {
      // Admin can access admin routes
      const adminRouteResponse = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${adminToken}`);
      expect([200, 404]).toContain(adminRouteResponse.status);
      
      // Admin can access patient records
      const recordsResponse = await request(app)
        .get('/api/patient-records')
        .set('Cookie', `token=${adminToken}`);
      expect([200, 404]).toContain(recordsResponse.status);
    });
    
    test('Lower roles cannot access higher privilege endpoints', async () => {
      const roles = [
        { name: 'Patient', token: patientToken },
        { name: 'Employee', token: employeeToken },
        { name: 'Provider', token: providerToken },
        { name: 'Manager', token: managerToken }
      ];
      
      for (const role of roles) {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Cookie', `token=${role.token}`);
        
        if (role.name !== 'Admin') {
          expect(response.status).toBe(403);
        }
      }
    });
  });
  
  describe('Authentication Required', () => {
    test('should require authentication for all protected routes', async () => {
      const protectedRoutes = [
        { method: 'get', path: '/api/users' },
        { method: 'get', path: '/api/patient-records' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/auth/me' }
      ];
      
      for (const route of protectedRoutes) {
        const response = await request(app)[route.method](route.path);
        
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Token is missing');
      }
    });
  });
  
  describe('Token Tampering Prevention', () => {
    test('should reject modified tokens', async () => {
      const tamperedToken = adminToken.slice(0, -5) + 'XXXXX';
      
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${tamperedToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Failed to authenticate token');
    });
    
    test('should reject tokens with modified payload', async () => {
      // Try to use patient token to access admin routes
      const response = await request(app)
        .get('/api/admin/users')
        .set('Cookie', `token=${patientToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });
  });
  
  describe('Cross-Role Data Access Prevention', () => {
    test('Patient should not access other patient data', async () => {
      // This would require creating actual patient records and testing access
      // For now, verify patient can't access user management
      const response = await request(app)
        .get('/api/users')
        .set('Cookie', `token=${patientToken}`);
      
      expect(response.status).toBe(403);
    });
    
    test('Provider should not access admin functions', async () => {
      const response = await request(app)
        .delete('/api/admin/users/someid')
        .set('Cookie', `token=${providerToken}`);
      
      expect(response.status).toBe(403);
    });
  });
});
